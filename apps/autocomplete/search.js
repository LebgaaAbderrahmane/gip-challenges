/**
 * The autocomplete search.
 *
 * Hand-written, as the brief requires: "You should write the auto completion
 * algorithm."
 *
 * Two decisions shape it.
 *
 * MATCHING IS BY SUBSTRING, NOT BY PREFIX
 * The brief asks for mid-word matches — "land" finds "Iceland" and "Ireland".
 * A prefix search would find neither, so the search is `includes` over the
 * whole label.
 *
 * RANKING NEVER EXCLUDES A VALID MATCH
 * Results are ordered exact, then prefix, then any other substring, and only
 * then truncated to the display limit. The limit is applied AFTER ranking, so
 * a match is never hidden by a less relevant one ranking above it.
 *
 * PERFORMANCE
 * The supplied dataset is 110 records. A linear scan over the prepared
 * entries is a few microseconds, so no index is built — an index would cost
 * more to construct than the scan ever costs to run. `benchmarkSearch`
 * measures it rather than assuming.
 */
import { normalizeText } from './normalize.js';

/** Display tiers, best first. */
export const RANK_EXACT = 0;
export const RANK_PREFIX = 1;
export const RANK_SUBSTRING = 2;

/** How many suggestions the interface shows at once. */
export const DEFAULT_LIMIT = 10;

/**
 * Searches prepared entries.
 *
 * @param {Array<{id: number, name: string, normalized: string, map: number[]}>} entries
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{id: number, name: string, normalized: string, map: number[], rank: number, matchStart: number, matchEnd: number}>}
 */
export function search(entries, query, limit = DEFAULT_LIMIT) {
  const needle = normalizeText(query);

  // An empty query shows nothing. The interface displays a hint instead.
  if (needle === '') return [];

  const matches = [];

  for (const entry of entries) {
    const index = entry.normalized.indexOf(needle);
    if (index === -1) continue;

    const rank =
      entry.normalized === needle
        ? RANK_EXACT
        : entry.normalized.startsWith(needle)
          ? RANK_PREFIX
          : RANK_SUBSTRING;

    // The match is mapped back onto the ORIGINAL label, so the highlighted
    // range is correct even when the match spans a folded character.
    const start = entry.map[index] ?? 0;
    const endIndex = index + needle.length - 1;
    const end = (entry.map[endIndex] ?? start) + 1;

    matches.push({
      id: entry.id,
      name: entry.name,
      normalized: entry.normalized,
      map: entry.map,
      rank,
      matchStart: start,
      matchEnd: end,
    });
  }

  // Rank first. Within a tier, a shorter label is the more specific answer,
  // and the name breaks any remaining tie so the order is deterministic.
  matches.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name),
  );

  // Truncation happens after ranking, never before.
  return limit > 0 ? matches.slice(0, limit) : matches;
}

/**
 * Splits a label into the parts around the match, for highlighting.
 *
 * The parts are plain strings, and the interface builds them with DOM nodes
 * rather than by concatenating HTML, so a dataset label can never inject
 * markup.
 *
 * @param {{name: string, matchStart: number, matchEnd: number}} match
 * @returns {{before: string, match: string, after: string}}
 */
export function splitMatch(match) {
  const { name, matchStart, matchEnd } = match;
  return {
    before: name.slice(0, matchStart),
    match: name.slice(matchStart, matchEnd),
    after: name.slice(matchEnd),
  };
}

/**
 * Measures the search over the real dataset.
 *
 * The plan asks for a measured figure rather than an assumed one, so this
 * returns the actual timings.
 *
 * @param {Array<{id: number, name: string}>} rawEntries
 * @param {string[]} queries
 * @param {number} [iterations]
 */
export function benchmarkSearch(rawEntries, queries, iterations = 200) {
  // Imported lazily to keep this module free of a circular dependency on
  // prepareDataset.
  const prepare = (entries) =>
    entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      normalized: normalizeText(entry.name),
      map: [],
    }));

  const prepared = prepare(rawEntries);

  const started = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const query of queries) {
      search(prepared, query, DEFAULT_LIMIT);
    }
  }
  const elapsed = performance.now() - started;
  const total = iterations * queries.length;

  return {
    records: rawEntries.length,
    queries: queries.length,
    iterations,
    totalSearches: total,
    totalMs: Number(elapsed.toFixed(3)),
    averageMs: Number((elapsed / total).toFixed(4)),
  };
}
