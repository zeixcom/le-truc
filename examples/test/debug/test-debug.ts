import { bindText, defineComponent } from '@zeix/le-truc'

export type TestDebugProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'test-debug': HTMLElement & TestDebugProps
	}
}

/**
 * Plain test component for the `DEV_MODE` debug instrumentation (ADR 0022,
 * LT-010). Deliberately never imports or references `debug()` or anything
 * from `src/extensions/debug.ts` — the `debug` property and all
 * instrumentation come entirely from `defineComponent()`'s auto-injection
 * (LT-007), proving zero source changes are required to make a component
 * debuggable.
 *
 * `on(btn, ...)` calls `e.stopImmediatePropagation()` on purpose — this is
 * the LT-011 regression case (the debug companion listener must still fire
 * for that click even though the author's own handler stops propagation).
 */
export default defineComponent<TestDebugProps>(
	'test-debug',
	({ expose, first, host, on, pass, watch }) => {
		const btn = first('button', 'Add a <button> element.')
		const attributed = first('#attributed', 'Add element with id="attributed".')
		const unattributed = first(
			'#unattributed',
			'Add element with id="unattributed".',
		)
		const child = first('basic-number', 'Add a <basic-number> element.')

		expose({ count: 0 })

		on(btn, 'click', e => {
			e.stopImmediatePropagation()
			return { count: 1 }
		})

		// Attributed: bindText() registers its returned closure in the debug
		// WeakMap (LT-001), so this watch() call's element is attributable.
		watch('count', bindText(attributed))

		// Unattributed: a raw inline handler isn't produced by a `bind*`
		// helper, so it gets no per-element mark — host-level pulse only.
		watch('count', n => {
			unattributed.textContent = String(n)
		})

		pass(child, { value: () => host.count })
	},
)
