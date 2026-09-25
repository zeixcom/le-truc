/**
 * Wave-4 migration (LT-103) of the hand-written module-scrollarea.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template wraps `children` (the scrollable content markup) in one
 * `<div>`, the element the overflow observer watches. Pages and compiled
 * parents (codeblock, dialog, splitview) author their own first child, and
 * the client addresses it structurally (`host.firstElementChild`), so they
 * are unaffected.
 *
 * Every geometry and child read stays in a client-only position — the scroll
 * handler and the observer effect — so no reactive value reaches served HTML:
 * the component's whole output is `bindState(internals, …)` plus `tabindex`
 * (ADR 0029's motivating case). Deviations from the twin, all setup-subset
 * driven:
 * - the observer helper and its ratio constants move into setup (module-scope
 *   names are not client-known, LTC005);
 * - the twin's setup-time `host.firstElementChild` guard (`if (!child)
 *   return`) moves into the observer effect, which returns no cleanup when
 *   there is no child — an `if`/`return` is outside the setup subset. The
 *   state watches therefore also run on a childless host, where the state is
 *   false and they only clear `tabindex`;
 * - the orientation branch moves from setup into the scroll handler.
 */

import {
	batch,
	bindState,
	createState,
	type FactoryContext,
} from '@zeix/le-truc'

declare global {
	interface HTMLElementTagNameMap {
		'module-scrollarea': HTMLElement
	}
}

/**
 * Adds overflow indicator custom states (`overflow`, `overflow-start`, `overflow-end`) to a scrollable container.
 * Use it when you need to show scroll affordances — provides component-owned
 * `:state()` pseudo-classes (via ElementInternals) that update as the user scrolls,
 * useful for custom scroll UI that should respect reduced-motion accessibility preferences.
 * @attribute {'vertical'|'horizontal'} [orientation=vertical] - Scroll axis to detect overflow on. Read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-scrollarea} Interactive preview and usage examples
 **/
export function ModuleScrollarea(
	{
		orientation,
		children = '',
	}: {
		orientation?: 'horizontal' | 'vertical'
		children?: string
	},
	{ host, internals, on, watch }: FactoryContext<Record<never, never>>,
) {
	const MIN_INTERSECTION_RATIO = 0
	const MAX_INTERSECTION_RATIO = 0.99 // ignore rounding errors of fraction pixels

	const observeOverflow =
		(
			content: Element,
			overflowCallback: () => void,
			noOverflowCallback: () => void,
		) =>
		(container: HTMLElement) => {
			const observer = new IntersectionObserver(
				([entry]) => {
					if (!entry) return
					if (
						entry.intersectionRatio > MIN_INTERSECTION_RATIO &&
						entry.intersectionRatio < MAX_INTERSECTION_RATIO
					)
						overflowCallback()
					else batch(noOverflowCallback)
				},
				{
					root: container,
					threshold: [MIN_INTERSECTION_RATIO, MAX_INTERSECTION_RATIO],
				},
			)
			observer.observe(content)
			return () => {
				observer.disconnect()
			}
		}

	const overflowStart = createState(false)
	const overflowEnd = createState(false)
	const hasOverflow = () => overflowStart.get() || overflowEnd.get()

	const scrollCallback = () => {
		if (host.getAttribute('orientation') === 'horizontal') {
			overflowStart.set(host.scrollLeft > 0)
			overflowEnd.set(host.scrollLeft < host.scrollWidth - host.offsetWidth)
		} else {
			overflowStart.set(host.scrollTop > 0)
			overflowEnd.set(host.scrollTop < host.scrollHeight - host.offsetHeight)
		}
	}

	on(host, 'scroll', () => {
		if (hasOverflow()) batch(scrollCallback)
	})

	watch(hasOverflow, bindState(internals, 'overflow'))
	watch(hasOverflow, overflow => {
		// Only set tabindex="0" explicitly; never force -1. An explicit -1
		// opts the element out of Chromium's native "sequentially focusable
		// scrolling regions" heuristic, which — during the async gap before
		// this effect first runs — can leave a containing modal <dialog>
		// with a single tab stop, letting focus escape the modal.
		if (overflow) host.setAttribute('tabindex', '0')
		else host.removeAttribute('tabindex')
	})
	watch(overflowStart, bindState(internals, 'overflow-start'))
	watch(overflowEnd, bindState(internals, 'overflow-end'))
	watch(
		() => true,
		() => {
			const child = host.firstElementChild
			if (!child) return
			return observeOverflow(
				child,
				() => {
					overflowEnd.set(true)
				},
				() => {
					overflowStart.set(false)
					overflowEnd.set(false)
				},
			)(host)
		},
	)

	return (
		<>
			<module-scrollarea orientation={orientation}>
				<div>{children}</div>
			</module-scrollarea>

			<style>{css`
			/* @media (prefers-reduced-motion: no-preference) { */

			module-scrollarea {
				display: block;
				position: relative;
				overflow-y: auto;
				-webkit-overflow-scrolling: touch;

				&::before,
				&::after {
					content: "";
					position: sticky;
					display: block;
					width: 100%;
					height: var(--space-m);
					opacity: 0;
					pointer-events: none;
					transition: opacity var(--transition-short);
					z-index: 1;
				}

				&::before {
					top: 0;
					background: linear-gradient(180deg, var(--color-shadow), transparent);
				}

				&::after {
					bottom: 0;
					background: linear-gradient(0deg, var(--color-shadow), transparent);
				}

				&:state(overflow-start)::before {
					opacity: 1;
				}

				&:state(overflow-end)::after {
					opacity: 1;
				}

				&[orientation="horizontal"] {
					overflow-x: auto;
					overflow-y: clip;

					&::before,
					&::after {
						width: var(--space-m);
						height: 1000vh;
						margin-block-end: -1000vh;
					}

					&::before {
						left: 0;
						background: linear-gradient(90deg, var(--color-shadow), transparent);
					}

					&::after {
						left: calc(100% - var(--space-m));
						background: linear-gradient(270deg, var(--color-shadow), transparent);
					}
				}
			}
			`}</style>
		</>
	)
}
