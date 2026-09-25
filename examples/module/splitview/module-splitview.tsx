/**
 * Wave-4 migration (LT-102) of the hand-written module-splitview.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what module-splitview.html authors by hand: two
 * vertical-overflow `module-scrollarea` panes around the divider. `start` and
 * `end` are the panes' content markup, rendered through `truc:html` — which
 * escapes it unless the site configures a sanitizer (`configureHtmlSanitizer`).
 * The root's `--module-splitview-ratio` and the divider's
 * `aria-orientation`/`aria-valuenow` render from the args, in the exact form
 * the `split` watcher writes, so the served markup is already correct before
 * it runs (no 50% flash for a preset split).
 *
 * Setup is the twin's verbatim, except that the step constants move from
 * module scope into setup: a module-scope const is not a client-known name
 * (LTC005). The pointer handlers only touch `setPointerCapture`,
 * `getBoundingClientRect` and listeners inside `on()` callbacks.
 */

import { asNumber, type FactoryContext } from '@zeix/le-truc'

export type ModuleSplitviewProps = {
	/** Split ratio between 0.1 and 0.9 (e.g. 0.5 = 50/50). Read from the `split` attribute at connect time. */
	split: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-splitview': HTMLElement & ModuleSplitviewProps
	}
}

/**
 * A resizable split view with a draggable divider and keyboard support.
 * Use it for two-panel layouts where the user should control the split — provides
 * ARIA separator semantics and Arrow key support on the divider for accessibility.
 * Set `orientation="vertical"` for a top/bottom split.
 * @attribute {'horizontal'|'vertical'} [orientation=horizontal] - Layout direction of the split. Read once at connect time; not a reactive property.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-splitview} Interactive preview and usage examples
 **/
export function ModuleSplitview(
	{
		split = 0.5,
		orientation = 'horizontal',
		start = '',
		end = '',
	}: {
		split?: number
		orientation?: 'horizontal' | 'vertical'
		/** Content markup of the first (left/top) pane. */
		start?: string
		/** Content markup of the second (right/bottom) pane. */
		end?: string
	},
	{ expose, first, host, on, watch }: FactoryContext<ModuleSplitviewProps>,
) {
	const MIN_SPLIT = 0.1
	const MAX_SPLIT = 0.9
	const STEP = 0.05

	expose({ split: asNumber(0.5) })

	const divider = first('button.divider', 'Add a button.divider resize handle.')
	const isVertical = host.getAttribute('orientation') === 'vertical'

	// pointermove/pointerup are only attached while dragging, mirroring
	// form-colorgraph.ts — keeps them off the debugger's always-on radar.
	on(divider, 'pointerdown', event => {
		divider.setPointerCapture(event.pointerId)
		const handleMove = (e: PointerEvent) => {
			const rect = host.getBoundingClientRect()
			const ratio = isVertical
				? (e.clientY - rect.top) / rect.height
				: (e.clientX - rect.left) / rect.width
			host.split = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, ratio))
		}
		const handleUp = () => {
			divider.removeEventListener('pointermove', handleMove)
			divider.removeEventListener('pointerup', handleUp)
			divider.removeEventListener('lostpointercapture', handleUp)
		}
		divider.addEventListener('pointermove', handleMove, { passive: true })
		divider.addEventListener('pointerup', handleUp)
		divider.addEventListener('lostpointercapture', handleUp)
	})
	on(divider, 'keydown', event => {
		const { key } = event
		const decrement = isVertical ? key === 'ArrowUp' : key === 'ArrowLeft'
		const increment = isVertical ? key === 'ArrowDown' : key === 'ArrowRight'
		if (decrement || increment || key === 'Home' || key === 'End') {
			event.preventDefault()
		}
		if (decrement) return { split: Math.max(MIN_SPLIT, host.split - STEP) }
		if (increment) return { split: Math.min(MAX_SPLIT, host.split + STEP) }
		if (key === 'Home') return { split: MIN_SPLIT }
		if (key === 'End') return { split: MAX_SPLIT }
	})
	watch('split', split => {
		host.style.setProperty(
			'--module-splitview-ratio',
			`${(split * 100).toFixed(2)}%`,
		)
		divider.setAttribute('aria-valuenow', String(Math.round(split * 100)))
	})

	return (
		<>
			<module-splitview
				split={split}
				orientation={orientation}
				style={`--module-splitview-ratio: ${(split * 100).toFixed(2)}%;`}
			>
				<module-scrollarea>
					<div truc:html={start} />
				</module-scrollarea>
				<button
					type="button"
					class="divider"
					role="separator"
					aria-label="Resize panels"
					aria-orientation={orientation}
					aria-valuenow={String(Math.round(split * 100))}
					aria-valuemin="10"
					aria-valuemax="90"
				/>
				<module-scrollarea>
					<div truc:html={end} />
				</module-scrollarea>
			</module-splitview>

			<style>{css`
			module-splitview {
				display: grid;
				grid-template-columns: var(--module-splitview-ratio, 50%) var(--space-xs) 1fr;
				overflow: hidden;

				& module-scrollarea {
					min-width: 0;
					min-height: 0;
				}

				.divider {
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 0;
					border: 0;
					background: var(--color-border-soft);
					cursor: col-resize;
					touch-action: none;
					transition: background-color var(--transition-short) var(--easing-inout);

					&::after {
						content: "";
						display: block;
						width: 2px;
						height: var(--space-l);
						border-radius: 1px;
						background: var(--color-text);
						opacity: var(--opacity-translucent);
					}

					&:hover {
						background: var(--color-border);
					}

					&:focus-visible {
						outline: 2px solid var(--color-selection);
						outline-offset: -2px;
					}
				}

				&[orientation="vertical"] {
					grid-template-columns: 1fr;
					grid-template-rows: var(--module-splitview-ratio, 50%) var(--space-xs) 1fr;

					& .divider {
						cursor: row-resize;

						&::after {
							width: var(--space-l);
							height: 2px;
						}
					}
				}
			}
			`}</style>
		</>
	)
}
