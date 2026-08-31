/**
 * LT-003 harness probe: element-reference channel — the combobox pattern as
 * the hardest real case (ADR 0026 §1, "component-internal relationships").
 * A real Le Truc component (unlike LT-001/LT-002's raw custom elements —
 * the thing under test here, `all()`'s reactive Cell retargeting
 * `ariaActiveDescendantElement` per keystroke, is a library integration
 * concern, not a pure-platform one).
 *
 * Wires the `aria*Elements` policy row:
 *   ariaActiveDescendantElement — retargeted per ArrowUp/ArrowDown, tracks
 *     the current index into the all()-backed `[role="option"]` list
 *   ariaControlsElements        — [popup], a hidden listbox popup
 *   ariaDescribedByElements     — [descriptionEl]. The textbox starts with a
 *     stale `aria-describedby="stale-id"` attribute in the HTML (nobody's
 *     id) — assigning the IDL property here demonstrates the spec side
 *     effect that writing an element-reference property clears the content
 *     attribute, whatever it held.
 *   ariaLabelledByElements      — [labelEl]
 *   ariaErrorMessageElements    — [errorEl]
 *
 * `ariaOwnsElements` is deliberately not exercised — ADR 0026 §4 withholds
 * it. Static relationships are set once, imperative in the factory body
 * (ADR 0026 §2: no helper for statements shorter than their helper call).
 *
 * `options` (the `all()` Cell) MUST be read inside a tracked `watch()`
 * source, not just inside the handler body: `watch()` wraps the *handler*
 * in `untrack()` (src/helpers/reactive.ts) so accidental reads inside it
 * never become dependencies. An earlier draft read `options.get()` only
 * inside the handler body of a single-source `watch(activeIndex, ...)` call
 * — that never subscribed the effect, so the Cell's MutationObserver
 * (lazily activated only once something actually subscribes) never turned
 * on and the list stayed frozen at its first snapshot (see README.md).
 *
 * LT-004 rewires this through `bindAria()` (poc-bind-aria.ts) using the
 * *thunk* source form — `() => T | null` — rather than the array-source form
 * the original draft (and its first fix) used: `SingleMatchHandlers` only
 * has an overload for single sources (string/Signal/thunk), not the
 * multi-source array form, so combining `activeIndex` and `options` into one
 * tracked thunk is what makes `bindAria` pluggable here at all. Returning
 * `null` from the thunk drives `bindAria`'s `nil` path (clears
 * `ariaActiveDescendantElement` on Escape) via `deriveCell`'s null/undefined
 * routing — not `bindAria`'s own defensive `ok(null)` guard.
 */
import { createState, defineComponent } from '../../index'
import { bindAria } from './poc-bind-aria'

export default defineComponent('poc-combobox', ({ all, first, on, watch }) => {
	const textbox = first('input', 'Needed a text input.')
	const popup = first('.popup', 'Needed a popup container.')
	const options = all('[role="option"]')
	const descriptionEl = first('.description')
	const labelEl = first('.label')
	const errorEl = first('.error')

	textbox.ariaControlsElements = [popup]
	if (descriptionEl) textbox.ariaDescribedByElements = [descriptionEl]
	if (labelEl) textbox.ariaLabelledByElements = [labelEl]
	if (errorEl) textbox.ariaErrorMessageElements = [errorEl]

	const activeIndex = createState(-1)
	watch(
		() => {
			const i = activeIndex.get()
			const list = options.get()
			return i >= 0 ? (list[i] ?? null) : null
		},
		bindAria(textbox, 'ariaActiveDescendantElement'),
	)

	on(textbox, 'keydown', event => {
		const list = options.get()
		if (!list.length) return
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			activeIndex.update(i => Math.min(i + 1, list.length - 1))
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			activeIndex.update(i => Math.max(i - 1, 0))
		} else if (event.key === 'Escape') {
			activeIndex.set(-1)
		}
	})
})
