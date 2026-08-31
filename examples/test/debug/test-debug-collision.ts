import { defineComponent } from '@zeix/le-truc'

export type TestDebugCollisionProps = {
	debug: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'test-debug-collision': HTMLElement & TestDebugCollisionProps
	}
}

/**
 * Deliberately calls `expose({ debug: ... })` to exercise the reserved-name
 * collision documented in ADR 0022's Consequences: in a `DEV_MODE` build,
 * `debug` is reserved on *every* component by the auto-injected `debug()`
 * extension (LT-007), even ones — like this one — that never reference it.
 * `expose({ debug: ... })` must throw `InvalidPropertyNameError` at connect
 * (a deferred-activation throw, ADR 0007 — surfaces as an uncaught
 * `pageerror`, not something this factory's own code can catch).
 *
 * Kept as its own component/page so the throw doesn't interfere with
 * `test-debug`'s assertions. Production behavior (no reservation, since
 * `debug()` isn't merged into `exts` at all outside `DEV_MODE`) is verified
 * separately, at the bundle level, by `test/regression-bundle.test.ts`
 * (LT-009) — this test only exercises the `DEV_MODE` half live in a real
 * browser.
 */
export default defineComponent<TestDebugCollisionProps>(
	'test-debug-collision',
	({ expose }) => {
		expose({ debug: true })
	},
)
