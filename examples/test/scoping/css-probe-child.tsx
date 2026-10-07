/**
 * The Children Region probe's child (LT-501, ADR 0033 and ADR 0048 s5): it
 * inserts `{children}` inside `<code>`, the element the server marks with
 * the owner's tag, and renders one internal of its own beside the region.
 * Its sheet limits its scope at its own insertion element, `to (code > *)`
 * — the way ADR 0048 s5 gives a child its stop at the content — so its
 * `span` rule styles the internal beside the region and stops at what
 * `code` holds, under a compiled parent and under a page alike.
 * Deliberately not styled for looks; every declaration is an assertion.
 */
import { css } from '@zeix/le-truc-compiler/macros'

export type CssProbeChildProps = {}

declare global {
	interface HTMLElementTagNameMap {
		'css-probe-child': HTMLElement & CssProbeChildProps
	}
}

export function CssProbeChild({ children = '' }: { children?: string }) {
	return (
		<css-probe-child>
			<pre>
				<code>{children}</code>
			</pre>
			<span class="x">{'Child internal'}</span>

			<style>{css`
				@scope to (code > *) {
					:scope {
						display: block;
					}
					span {
						outline-style: dashed;
					}
					code {
						font-style: italic;
					}
				}
			`}</style>
		</css-probe-child>
	)
}
