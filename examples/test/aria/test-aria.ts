import {
	bindAria,
	createState,
	createTask,
	defineComponent,
	defineMethod,
} from '../../../index'

export type TestAriaProps = {
	expanded: boolean
}

export type TestAriaPendingProps = {
	resolve: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'test-aria': HTMLElement & TestAriaProps
		'test-aria-pending': HTMLElement & TestAriaPendingProps
		'test-aria-trap': HTMLElement
		'test-aria-trap-ok': HTMLElement
		'test-aria-late-ref': HTMLElement
	}
}

/**
 * Test component for `bindAria()` (ADR 0026) and the element-internals
 * declaration registry (LT-007/LT-008).
 *
 * `<test-aria>` exercises the stale-attribute rule on host internals: the
 * server-rendered `aria-expanded` is adopted as initial state (ADR 0003 —
 * the attribute is the connect-time initial-state channel), then removed by
 * the binding's first assertion, after which the component owns the property
 * reactively via internals and post-connect attribute overrides still win.
 * The inner `<span>` is bound on the `Element` target, whose IDL write
 * mirrors into the attribute — visible in markup on every engine.
 *
 * `<test-aria-pending>` drives the same property from an unseeded Task: the
 * attribute keeps authority while the source routes `nil`, and only the
 * first resolved assertion removes it.
 *
 * `<test-aria-trap>` / `<test-aria-trap-ok>` are the LT-005 axe-core trap,
 * ported to a real `defineComponent` so the Truc constructor's registry
 * registration is what makes internals visible to axe: the trap carries an
 * `aria-checked` attribute that is invalid for its internals-set `button`
 * role (`aria-allowed-attr`); the control carries none and stays clean.
 */
export const testAria = defineComponent<TestAriaProps>(
	'test-aria',
	({ expose, first, host, internals, watch }) => {
		const output = first('#state', 'Add element with id="state".')
		const inner = first('#inner', 'Add element with id="inner".')

		// Adopt the server-rendered aria-expanded BEFORE the binding activates
		// (factory setup runs first; effects activate later — ADR 0007). The
		// stale-attribute rule depends on this ordering: removal must never
		// precede adoption.
		const initial = host.getAttribute('aria-expanded')
		const expanded = createState(
			initial != null ? initial.toLowerCase() !== 'false' : false,
		)

		expose({ expanded })

		// Host default semantics via internals (ADR 0026 §1 row 3) — the
		// stale-attribute rule removes the shadowing `aria-expanded` attribute
		// at the first assertion.
		watch(expanded, bindAria(internals, 'ariaExpanded'))

		// Inner native element: the IDL write mirrors into the attribute, so
		// nothing is removed and the value stays CSS/markup-visible.
		watch(expanded, bindAria(inner, 'ariaExpanded'))

		watch(expanded, value => {
			output.textContent = String(value)
		})
	},
)

export const testAriaPending = defineComponent<TestAriaPendingProps>(
	'test-aria-pending',
	({ expose, internals, watch }) => {
		let resolveIt: (() => void) | undefined
		// createTask validates that its callback is an async function, hence
		// the async wrapper around the bare Promise executor.
		const pending = createTask<boolean>(
			async () =>
				new Promise<boolean>(resolve => {
					resolveIt = () => resolve(true)
				}),
		)

		expose({ resolve: defineMethod(() => resolveIt?.()) })

		// Routes nil until resolve() — bindAria's nil path assigns null without
		// removing the server-rendered attribute, which keeps authority.
		watch(pending, bindAria(internals, 'ariaExpanded'))
	},
)

// Static ARIA stays imperative in the factory body (ADR 0026 §2); the
// registry registration in the Truc constructor is what makes these visible
// to axe-core.
export const testAriaTrap = defineComponent(
	'test-aria-trap',
	({ internals }) => {
		if (internals) internals.role = 'button'
	},
)

export const testAriaTrapOk = defineComponent(
	'test-aria-trap-ok',
	({ internals }) => {
		if (internals) internals.role = 'button'
	},
)

/**
 * Element-reference channel: does `ariaDescribedByElements` require its
 * target to be an upgraded (`:defined`) custom element at wiring time? Le
 * Truc's own `first()`/`all()` collect undefined custom-element targets as
 * dependencies and defer effect activation up to `DEPENDENCY_TIMEOUT`
 * (`src/helpers/dom.ts`) — a progressive-enhancement mechanism for reading a
 * *child component's own exposed properties*. An element-reference ARIA
 * property is a different thing: it only needs the target's identity as an
 * `Element` node, not its class behavior, so nothing here waits for
 * anything — confirmed by wiring the reference synchronously in the
 * constructor against `<test-aria-late-target>`, a tag no script on this
 * page ever registers.
 */
export const testAriaLateRef = defineComponent(
	'test-aria-late-ref',
	({ internals }) => {
		if (!internals) return
		internals.role = 'button'
		const target = document.getElementById('late-target')
		if (target) internals.ariaDescribedByElements = [target]
	},
)
