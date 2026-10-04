/**
 * Baseline-guard fixture (LT-305): an unguarded Baseline 2024 API, which a
 * Baseline 2023 pin must refuse. Scanned by test/baseline.test.ts, never run.
 */
export const deferred = () => Promise.withResolvers<number>()
