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
		kind: 'jsdom-error',
		component: 'module-colorinfo',
		message: /Not implemented: HTMLCanvasElement's getContext/,
		reason:
			"module-colorinfo has no canvas. The notice is module-coloreditor's " +
			'composed form-colorgraph drawing after its window closed, which ' +
			'attributes to the next render (realm.ts § Attribution). Same guard, ' +
			'same unserialized pixels (LT-105; the attribution leak is in NOTES).',
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
]
