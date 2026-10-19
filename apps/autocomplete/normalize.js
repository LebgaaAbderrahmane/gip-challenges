/**
 * Text normalisation for the autocomplete.
 *
 * The dataset contains labels that differ only by diacritics or by the kind
 * of apostrophe: "Cote d'Ivoire" and "Côte d'Ivoire" are the same place, and
 * a user typing either should find it.
 *
 * Normalisation happens ONCE, when the dataset is loaded, never per
 * keystroke. The original label is always kept for display, so what the
 * user sees is exactly what the dataset says.
 */

/**
 * Canonicalises a string for matching.
 *
 * The steps, and why each is here:
 *
 *   1. NFD decomposition splits "é" into "e" and a combining accent, so the
 *      accents can be removed. NFC would compose them again and nothing
 *      would match.
 *   2. Combining marks are removed, which makes "Côte" match "Cote".
 *   3. Apostrophe variants are folded to the plain ASCII one. The dataset
 *      uses U+0027, but keyboards and copy-paste produce U+2019 (right
 *      single quotation mark) and U+02BC (modifier letter apostrophe), and
 *      a user typing "cote d'ivoire" with a smart keyboard should still
 *      find the entry.
 *   4. Lowercasing makes the match case-insensitive.
 *   5. Whitespace is collapsed and trimmed, so a stray double space or a
 *      trailing space does not change the result.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeText(value) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’ʼ`´]/g, "'")
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalises a string while remembering where each character came from.
 *
 * Highlighting has to mark the matched text in the ORIGINAL label, and the
 * normalised string is not character-for-character the same as the original:
 * "Côte d'Ivoire" normalises to "cote d'ivoire", and the folded apostrophe
 * may have been a different character to begin with.
 *
 * The map records, for every character of the normalised string, the index it
 * came from in the original. Highlighting then walks the original string
 * using those indices, so the marked range is always correct.
 *
 * @param {string} value
 * @returns {{normalized: string, map: number[]}}
 */
export function normalizeWithMap(value) {
  const source = typeof value === 'string' ? value : '';

  let normalized = '';
  /** @type {number[]} */
  const map = [];

  // 1. Decompose, so combining accents become their own characters.
  for (let i = 0; i < source.length; i++) {
    const codePoint = source.codePointAt(i);
    const char = String.fromCodePoint(codePoint);
    const charLength = char.length;

    const decomposed = char.normalize('NFD');

    for (let j = 0; j < decomposed.length; j++) {
      // 2. Drop combining marks entirely.
      if (/\p{M}/u.test(decomposed[j])) continue;

      // 3. Fold apostrophe variants to the plain one.
      const folded = /[’ʼ`´]/.test(decomposed[j]) ? "'" : decomposed[j];

      normalized += folded;
      map.push(i);
    }

    i += charLength - 1;
  }

  // 4. Lowercase. 5. Collapse whitespace and trim.
  const lower = normalized.toLocaleLowerCase('en');
  const trimmed = lower.replace(/\s+/g, ' ').trim();

  // Collapsing and trimming shift the positions, so the map is rebuilt
  // alongside the final string.
  const finalMap = [];
  let inSpace = false;
  for (let i = 0; i < trimmed.length; i++) {
    const originalIndex = map[i] ?? 0;
    if (trimmed[i] === ' ') {
      if (inSpace) continue;
      inSpace = true;
    } else {
      inSpace = false;
    }
    finalMap.push(originalIndex);
  }

  return { normalized: trimmed, map: finalMap };
}

/**
 * Builds the searchable form of a dataset entry, once.
 *
 * @param {{id: number, name: string}} entry
 * @returns {{id: number, name: string, normalized: string, map: number[]}}
 */
export function toSearchable(entry) {
  const { normalized, map } = normalizeWithMap(entry.name);
  return {
    id: entry.id,
    name: entry.name,
    normalized,
    map,
  };
}

/**
 * Prepares a whole dataset for searching.
 *
 * @param {Array<{id: number, name: string}>} entries
 * @returns {Array<{id: number, name: string, normalized: string, map: number[]}>}
 */
export function prepareDataset(entries) {
  return entries.map(toSearchable);
}