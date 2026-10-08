/**
 * The platform-CSS contract probe (LT-501, ADR 0033): a minimal composing
 * component whose sheet exercises each authored form `css-probe.spec.ts`
 * pins against the same sheet inline in a plain host — a prelude-less
 * `@scope` with an authored limit, `:where(:scope)` host rules (the ADR
 * 0033 s1 idiom) beside a bare `:scope` one, a relative `> p` descendant,
 * a bare rule on the composed child's host, a tag-led rule and an unscoped
 * rule. Its `CssProbeChild` compose
 * site passes children (ADR 0048): a span of its own and a custom
 * element, which the probe's rules reach as its descendants, with no limit
 * of its own in the way. (A composed element in content is LTC011; a raw
 * custom element is plain content.)
 * Deliberately not styled for looks; every declaration is an assertion.
 */
import { css } from '@zeix/le-truc-compiler/macros'
import { BasicButton } from '../../basic/button/basic-button.tsrx'
import { CssProbeChild } from './css-probe-child.tsx'

export type CssProbeProps = {}

declare global {
	interface HTMLElementTagNameMap {
		'css-probe': HTMLElement & CssProbeProps
	}
}

// biome-ignore lint/correctness/noEmptyPattern: the probe takes no server args, and the compiler's params contract requires an (empty) destructured object pattern.
export function CssProbe({}: CssProbeProps) {
	return (
		<css-probe>
			<p class="label">{'Label'}</p>
			<p class="probe-global">{'Global'}</p>
			<p class="tag-led">{'Tag-led'}</p>
			<BasicButton label={'Child button'} />
			<button type="button" class="own">
				{'Own'}
			</button>
			<CssProbeChild>
				<span class="x">{'Kid'}</span>
				<x-kid-widget>
					<button type="button">
						<span>{'Kid button'}</span>
					</button>
				</x-kid-widget>
			</CssProbeChild>

			<style>{css`
				.probe-global {
					letter-spacing: 2px;
				}
				css-probe .tag-led {
					word-spacing: 5px;
				}
				@scope to (basic-button > *) {
					:scope {
						display: block;
						border-top: 3px solid rgb(255, 0, 0);
					}
					:where(:scope) {
						outline-color: rgb(255, 0, 255);
					}
					:scope::before {
						content: '';
					}
					> p.label {
						color: rgb(0, 0, 255);
					}
					.label {
						font-weight: 700;
					}
					css-probe-child {
						padding-left: 2px;
						padding-right: 2px;
					}
					button {
						text-transform: uppercase;
					}
					.x {
						text-decoration-line: underline;
					}
				}
			`}</style>
		</css-probe>
	)
}
