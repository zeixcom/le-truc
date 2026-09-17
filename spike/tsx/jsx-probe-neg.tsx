/**
 * §7 probe re-run (LT-183) — NEGATIVE half. `truc:pass` is NOT declared on
 * this element's ambient entry, so the attribute must be a TYPE ERROR whose
 * message names `"truc:pass"` as the property key (TS2322) — proving
 * namespaced JSX attribute names are per-element type-checkable in `.tsx`,
 * not merely parseable.
 *
 * This file is EXPECTED to fail type-checking; the runner captures the exit
 * code and greps the diagnostic. It is excluded from the spike tsconfig's
 * default project (see tsconfig.probe-neg.json) so the clean probe stays
 * clean.
 */

declare global {
	namespace JSX {
		interface IntrinsicElements {
			'probe-neg': {
				class?: string
			}
		}
	}
}

export const ProbeNeg = () => (
	// No suppression directive here: the point is that tsc itself reports
	// the namespaced attribute name as the offending property key.
	<probe-neg truc:pass={{ value: () => 'x' }} />
)
