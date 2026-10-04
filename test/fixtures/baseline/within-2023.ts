/**
 * Baseline-guard fixture (LT-305): Baseline 2023 and older features only,
 * plus one type-only mention of a newer interface, which ships no code.
 * Scanned by test/baseline.test.ts, never run.
 */
export const internals = (host: HTMLElement): ElementInternals =>
	host.attachInternals()
export const label = (host: HTMLElement): string | null => host.ariaLabel
export const hasOwn = (value: object, key: string): boolean =>
	Object.hasOwn(value, key)
export type States = CustomStateSet
