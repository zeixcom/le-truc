/**
 * Baseline-guard fixture (LT-305): one use of each syntax form the scanner
 * names. Scanned by test/baseline.test.ts, never run.
 */
export class Probe {
	static ready = false
	static {
		Probe.ready = true
	}
	#secret = 1
	static has(value: object): boolean {
		return #secret in value
	}
}
export const sets = /[\p{L}--[a-z]]/v
export const indices = /a/d
export const modifier = /(?i:a)b/
export const dispose = (): void => {
	using _resource = { [Symbol.dispose]: () => {} }
}
await Promise.resolve()
