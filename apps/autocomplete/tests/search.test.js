/**
 * Tests for the autocomplete search.
 *
 * The brief's requirements, in order:
 *   - the algorithm is written by us
 *   - the supplied data.js dataset is used
 *   - mid-word matches work
 *   - accents and apostrophes are handled
 */
import { describe, it, expect } from 'vitest';

import { countries } from '../data.js';
import { normalizeText, normalizeWithMap, prepareDataset } from '../normalize.js';
import {
  search,
  splitMatch,
  benchmarkSearch,
  RANK_EXACT,
  RANK_PREFIX,
  RANK_SUBSTRING,
} from '../search.js';

const entries = prepareDataset(countries);

const names = (query, limit = 20) => search(entries, query, limit).map((m) => m.name);

describe('the supplied dataset', () => {
  it('is the one that ships with the brief', () => {
    expect(countries.length).toBe(110);
    expect(countries[0]).toEqual({ id: 1, name: 'Afghanistan' });
  });

  it('has no duplicate or empty names', () => {
    const unique = new Set(countries.map((c) => c.name));
    expect(unique.size).toBe(countries.length);
    expect(countries.every((c) => c.name.length > 0)).toBe(true);
  });

  it('is searched in full, not a subset', () => {
    // A landmark from the far end of the list proves the whole dataset is
    // searched rather than the first few entries.
    expect(names('zimbabwe')).toContain('Zimbabwe');
  });
});

describe('mid-word matching', () => {
  it('finds the examples the brief gives', () => {
    const result = names('land');
    expect(result).toContain('Iceland');
    expect(result).toContain('Ireland');
  });

  it('returns every match in the dataset, not just the brief\'s two', () => {
    // Measured against the supplied data: "land" matches seven entries.
    expect(names('land').sort()).toEqual(
      [
        'Finland',
        'Iceland',
        'Ireland',
        'Netherlands',
        'New Zealand',
        'Poland',
        'Switzerland',
      ].sort(),
    );
  });

  it('matches in the middle of a word', () => {
    expect(names('man')).toContain('Romania');
    expect(names('stri')).toContain('Austria');
    expect(names('nama')).toContain('Panama');
  });

  it('matches at the start of a word', () => {
    expect(names('icel')).toContain('Iceland');
  });

  it('matches at the end of a word', () => {
    expect(names('land')).toContain('Finland');
  });
});

describe('accents', () => {
  it('finds an accented entry from an unaccented query', () => {
    expect(names('cote')).toContain("Côte d'Ivoire");
  });

  it('finds an accented entry from a partially accented query', () => {
    expect(names('côte')).toContain("Côte d'Ivoire");
  });

  it('finds the accented entry from the accented query with a plain apostrophe', () => {
    expect(names("côte d'ivoire")).toContain("Côte d'Ivoire");
  });

  it('finds the other accented entry', () => {
    expect(names('sao')).toContain('São Tomé and Príncipe');
    expect(names('tome')).toContain('São Tomé and Príncipe');
  });
});

describe('apostrophes', () => {
  it('matches the brief\'s example exactly', () => {
    expect(names("cote d'ivoire")).toContain("Côte d'Ivoire");
  });

  it('matches a curly apostrophe against the straight one in the data', () => {
    // The dataset uses U+0027; a smart keyboard produces U+2019.
    expect(names('cote d’ivoire')).toContain("Côte d'Ivoire");
  });

  it('treats the apostrophe as part of the word, not as optional', () => {
    // A space or a missing apostrophe is a different string, and is not
    // treated as a fuzzy match. The brief asks for apostrophes to be
    // HANDLED — the variants of the character — not for the character to be
    // optional.
    expect(names('cote d ivoire')).not.toContain("Côte d'Ivoire");
    expect(names('cote divoire')).not.toContain("Côte d'Ivoire");
  });
});

describe('case', () => {
  it('is insensitive', () => {
    expect(names('ICELAND')).toContain('Iceland');
    expect(names('iCeLaNd')).toContain('Iceland');
  });
});

describe('ranking', () => {
  it('puts an exact match first', () => {
    const result = search(entries, 'Japan', 20);
    expect(result[0].name).toBe('Japan');
    expect(result[0].rank).toBe(RANK_EXACT);
  });

  it('puts an exact match before a prefix match', () => {
    // "guinea" is an exact match for "Guinea" and a prefix of
    // "Guinea-Bissau". "Equatorial Guinea" and "Papua New Guinea" match in
    // the middle, so they are substrings. Within a tier the shorter label
    // wins, and "Papua New Guinea" (16) precedes "Equatorial Guinea" (17).
    const result = search(entries, 'guinea', 20);
    expect(result.map((m) => m.name)).toEqual([
      'Guinea',
      'Guinea-Bissau',
      'Papua New Guinea',
      'Equatorial Guinea',
    ]);
    expect(result[0].rank).toBe(RANK_EXACT);
    expect(result[1].rank).toBe(RANK_PREFIX);
    expect(result[2].rank).toBe(RANK_SUBSTRING);
    expect(result[3].rank).toBe(RANK_SUBSTRING);
  });

  it('does not exclude a valid match in order to rank better ones first', () => {
    // Every match is still present, whatever its rank.
    const result = search(entries, 'land', 20);
    expect(result.length).toBe(7);
    expect(result.every((m) => m.name.includes('land') || m.name.includes('Land'))).toBe(true);
  });

  it('applies the display limit only after ranking', () => {
    const all = search(entries, 'a', 0);
    const limited = search(entries, 'a', 10);
    expect(limited.length).toBe(10);
    expect(limited[0].name).toBe(all[0].name);
    expect(all.length).toBeGreaterThan(10);
  });

  it('orders results deterministically', () => {
    const first = names('an', 20);
    const second = names('an', 20);
    expect(first).toEqual(second);
  });
});

describe('an empty query', () => {
  it('returns nothing, so the interface can show a hint instead', () => {
    expect(search(entries, '')).toEqual([]);
    expect(search(entries, '   ')).toEqual([]);
  });
});

describe('a query that matches nothing', () => {
  it('returns an empty list', () => {
    expect(search(entries, 'zzzzzz')).toEqual([]);
  });
});

describe('highlighting', () => {
  it('marks the matched text in the original label', () => {
    const [match] = search(entries, 'land');
    const parts = splitMatch(match);
    expect(parts.before + parts.match + parts.after).toBe(match.name);
    expect(parts.match.toLowerCase()).toContain('land');
  });

  it('marks the right range when the match spans a folded character', () => {
    const [match] = search(entries, "cote d'ivoire");
    const parts = splitMatch(match);
    expect(parts.before).toBe('');
    expect(parts.match).toBe("Côte d'Ivoire");
    expect(parts.after).toBe('');
  });

  it('maps back onto the original label for an accented match', () => {
    const [match] = search(entries, 'sao');
    const parts = splitMatch(match);
    expect(parts.match).toBe('São');
    expect(parts.before).toBe('');
    expect(parts.after).toBe(' Tomé and Príncipe');
  });
});

describe('normalisation', () => {
  it('removes accents', () => {
    expect(normalizeText('Côte d\'Ivoire')).toBe("cote d'ivoire");
    expect(normalizeText('São Tomé')).toBe('sao tome');
  });

  it('folds apostrophe variants', () => {
    expect(normalizeText('cote d’ivoire')).toBe("cote d'ivoire");
    expect(normalizeText('cote dʼivoire')).toBe("cote d'ivoire");
  });

  it('lowercases and trims', () => {
    expect(normalizeText('  Iceland  ')).toBe('iceland');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeText('New   Zealand')).toBe('new zealand');
  });

  it('handles a non-string without throwing', () => {
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(null)).toBe('');
  });

  it('keeps a position map that points at the original string', () => {
    const { normalized, map } = normalizeWithMap('Côte');
    expect(normalized).toBe('cote');
    expect(map).toHaveLength(4);
    expect('Côte'[map[0]]).toBe('C');
    expect('Côte'[map[3]]).toBe('e');
  });
});

describe('performance', () => {
  it('is measured, not assumed', () => {
    const result = benchmarkSearch(countries, ['land', 'cote', 'a', 'zz'], 100);
    expect(result.records).toBe(110);
    expect(result.totalSearches).toBe(400);
    // A linear scan over 110 records is microseconds. The figure is recorded
    // rather than assumed, so it can be compared against reality later.
    expect(result.averageMs).toBeLessThan(5);
  });
});
