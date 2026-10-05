/**
 * Standing realm diagnostics for the jsdom substrate (ADR 0035 sub-design 3
 * limb 1, LT-263 — the remainder of what was `sim/report.ts`).
 *
 * The report CHANNEL is compiler-side (`../build-report.ts`): partitioning,
 * matching and the warning copy are substrate-independent and a build with
 * no substrate installed still needs them. What stays here is the one thing
 * that is genuinely a fact about jsdom — which notices this substrate is
 * known to emit, and why each cannot affect the serialized markup. A
 * different substrate would ship a different list, which is precisely why
 * the list travels with the driver and reaches the channel through
 * `SimulationProvider.classifications`.
 *
 * Every entry below is known, explained, and expected on the corpus. Adding
 * one is a design decision, not a convenience: name the exact condition and
 * why it cannot affect the serialized markup. If an entry stops matching
 * anything — the component was fixed — retire it; a classification that
 * admits nothing is kept only as a record, and the baseline test says so.
 */

import type { ClassifiedDiagnostic } from '../simulation/contract.ts'

export const CLASSIFIED_DIAGNOSTICS: readonly ClassifiedDiagnostic[] = [
	{
		kind: 'jsdom-error',
		component: 'form-colorgraph',
		message: /Not implemented: HTMLCanvasElement's getContext/,
		reason:
			'jsdom does not implement canvas. form-colorgraph guards the missing ' +
			'context (`if (!ctx) return`). Canvas pixels do not serialize, so the ' +
			'notice cannot affect the serialized markup.',
	},
	{
		kind: 'jsdom-error',
		component: 'module-coloreditor',
		message: /Not implemented: HTMLCanvasElement's getContext/,
		reason:
			'The same notice from the composed form-colorgraph, attributed to ' +
			'the rendering parent (LT-188). Same guard, same unserialized pixels.',
	},
	{
		kind: 'console',
		component: 'module-lazyload',
		message:
			/<module-lazyload#missing-elements-test> did not enhance .*MissingElementError/,
		reason:
			'The demo page authors this instance without its required ' +
			'`card-callout` on purpose, to exercise the broken state the spec ' +
			'asserts. It keeps its served markup, which is what the spec expects ' +
			'(LT-104: page occurrences simulate now that lazyload is Simulated).',
	},
	{
		kind: 'console',
		component: 'test-listitem-tsx',
		message:
			/reconcile\(\) item "[^"]+" did not activate .*InvalidPassPropertyError: Cannot pass from <test-listitem-tsx> to <form-checkbox>: 'checked' is not a property/,
		reason:
			'The same notice for the `.tsx` twin (LT-423). Same fixed-point ' +
			're-parse, same real-page verification, same per-descriptor ' +
			'Contained drop, same unaffected serialization.',
	},
	{
		kind: 'console',
		component: 'test-listitem',
		message:
			/reconcile\(\) item "[^"]+" did not activate .*InvalidPassPropertyError: Cannot pass from <test-listitem> to <form-checkbox>: 'checked' is not a property/,
		reason:
			'LT-423: the fixed-point second pass re-parses with the definitions ' +
			'already live, so jsdom connects parent-first and the composed ' +
			"child's connect lags the item mount's pass() validation. A real " +
			'page registers definitions from a deferred module after the parse ' +
			'(children upgrade first — verified against plain jsdom), the ' +
			'Contained drop is per descriptor, and the serialization is the ' +
			'fixed point either way.',
	},
]
