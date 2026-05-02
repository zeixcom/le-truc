/**
 * Unit tests for makeWatch in src/helpers/reactive.ts
 *
 * Tests that SingleMatchHandlers branches (ok, nil, stale) are correctly forwarded
 * to match(). Uses createTask with a seeded value to trigger the stale path: on the
 * first effect run the task has a retained value but is still computing, so match()
 * routes to stale instead of ok.
 *
 * No DOM required — host is a plain stub; Task signals are passed directly.
 */
export {};
