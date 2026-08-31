/**
 * Unit tests for makeWatch in src/helpers/reactive.ts
 *
 * Tests that SingleMatchHandlers branches (ok, nil, stale) are correctly forwarded
 * to match(), and that the array-source form passes a MatchHandlers object through
 * to match()'s multi-signal overload (nil on any unset source, collected errors,
 * stale on a seeded re-computing Task) with a per-position-inferred value tuple.
 *
 * No DOM required — host is a plain stub; Task signals are passed directly.
 */
export {};
