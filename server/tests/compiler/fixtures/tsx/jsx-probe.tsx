/**
 * §7 probe re-run (LT-183, TSX_SPIKE.md): verify the three 2026-09-06 facts
 * in-repo with the repo's TypeScript 6.0.3, under `--jsx preserve --strict`.
 *
 * 1. Namespaced JSX attribute names (`truc:pass`) parse AND type-check —
 *    positively (declared on the ambient element) here, and negatively in
 *    `jsx-probe-neg.tsx` (undeclared on the ambient element → TS2322 naming
 *    `"truc:pass"` as the property key).
 * 2. Function-valued attributes, dashed attributes, and IIFE statement blocks
 *    in children position all type-check under `--strict`.
 * 3. `--jsx preserve` avoids jsx-runtime module resolution (this file imports
 *    no runtime; see the tsconfig — `jsx: preserve`, no jsxImportSource).
 *
 * The ambient element declarations below mirror the shape the `.tsx` host
 * profile would carry: light-DOM attributes (`class`, `for`, `data-*`), the
 * host-owned namespaced attributes, and function-valued reactive thunks.
 * This file must type-check CLEAN; the exit code is captured by the runner.
 */

declare global {
	namespace JSX {
		interface IntrinsicElements {
			'probe-el': {
				class?: string | (() => string)
				'data-value'?: string
				'truc:pass'?: { [prop: string]: () => unknown }
				'truc:case'?: string
				onClick?: (event: MouseEvent) => void
				children?: unknown
			}
			span: { children?: unknown }
		}
	}
}

const signalValue = (): string => 'probe'

export const ProbeElement = () => (
	<probe-el
		class="static"
		data-value="dashed"
		onClick={() => signalValue()}
	>
		{signalValue() === 'probe' ? (
			<span>ternary arm</span>
		) : (
			<span>other arm</span>
		)}
		{(() => {
			const prefix = 'iife'
			return <span>{`${prefix}-arm`}</span>
		})()}
	</probe-el>
)

export const ProbePass = () => (
	<probe-el truc:pass={{ value: () => signalValue() }} truc:case="one" />
)
