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
		message: /Error: (Invalid URL|No URL provided|Recursive URL detected)/,
		reason:
			'LT-449: module-lazyload now drives the compiled async boundary with ' +
			'a `createTask`, and the simulated fixture (and module-listnav, ' +
			'which composes lazyload and passes its `src`) renders without a ' +
			'fetchable URL on purpose — the task rejects by design and the ' +
			"boundary's err arm carries the message into the pinned snapshot. " +
			"The notice is the task's unobserved-rejection report during " +
			'simulated connect; no fetch runs on the jsdom substrate, so beyond ' +
			'the sanctioned err arm nothing in the serialized markup changes. ' +
			'(Retired with the scenario it covered: the twin-era ' +
			'`#missing-elements-test` classification — the compiled component ' +
			'owns its markup, so the broken-state demo instance no longer ' +
			'exists.)',
	},
	{
		kind: 'console',
		message:
			/reconcile\(\) did not activate in <module-lazyload>; its other effects are unaffected: InvalidTemplateError/,
		docsOnly: true,
		reason:
			'LT-449: the realm parses with the definitions already live, so ' +
			'jsdom connects parent-first — the composed (or standalone) ' +
			"lazyload's factory runs at upgrade, before the parser has " +
			'appended the arm templates, and reconcile() refuses with ' +
			'InvalidTemplateError. The refusal is Contained per Mount Scope ' +
			'(ADR 0028 s3): the element keeps its served markup, the ' +
			'serialization is the fixed point either way, and a real page ' +
			'registers definitions from a deferred module so children upgrade ' +
			'first (the LT-423 precedent, verified against plain jsdom). The ' +
			"boundary's client behavior is exercised on real Chromium by the " +
			'component spec.',
	},
	{
		kind: 'console',
		component: 'test-listitem-tsx',
		message:
			/reconcile\(\) item "[^"]+" did not activate in <ul\.tasks> and stays unbound; the other items are unaffected: InvalidPassPropertyError: Cannot pass from <test-listitem-tsx> to <form-checkbox>: 'checked' is not a property/,
		reason:
			'The same notice for the `.tsx` twin (LT-423). Same fixed-point ' +
			're-parse, same real-page verification, same per-descriptor ' +
			'Contained drop, same unaffected serialization.',
	},
	{
		kind: 'console',
		component: 'test-listitem',
		message:
			/reconcile\(\) item "[^"]+" did not activate in <ul\.tasks> and stays unbound; the other items are unaffected: InvalidPassPropertyError: Cannot pass from <test-listitem> to <form-checkbox>: 'checked' is not a property/,
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
