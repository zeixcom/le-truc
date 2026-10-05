/**
 * The scoped-CSS contract probe (LT-304, ADR 0033 s1/s3): a minimal
 * composing component whose sheet exercises every contract point the
 * `css-probe.spec.ts` comparison pins — the host rule, a guarded
 * `:host::before` (the lowered self-nesting difference, s7), a bare
 * internals rule that must not reach a composed child, and a `:global`
 * page rule.
 * Deliberately not styled for looks; every declaration is an assertion.
 */
import { css } from '@zeix/le-truc-compiler/macros'
import { BasicButton } from '../../basic/button/basic-button.tsrx'

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
			<BasicButton label={'Child button'} />
			<button type="button" class="own">
				{'Own'}
			</button>

			<style>{css`
				:host {
					display: block;
					border-top: 3px solid rgb(255, 0, 0);
				}
				:host::before {
					content: '';
				}
				.label {
					color: rgb(0, 0, 255);
				}
				button {
					text-transform: uppercase;
				}
				:global(.probe-global) {
					letter-spacing: 2px;
				}
			`}</style>
		</css-probe>
	)
}
