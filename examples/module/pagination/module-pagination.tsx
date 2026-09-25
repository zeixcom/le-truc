/**
 * Wave-4 migration (LT-099) of the hand-written module-pagination.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what module-pagination.html authors by hand, from the
 * `max`/`value` server args. Setup is the twin's, copied verbatim — including
 * the `asClampedInteger(min, max)` initializers, whose contract (the input's
 * `max` as the page-count floor) the spec pins. The `.value`/`.max` displays,
 * optional `first()` + `bindText` pairs in the twin, are text thunks over the
 * exposed props: rendering them from the args instead would ship each value
 * twice (LTC039).
 */

import {
	asClampedInteger,
	bindProperty,
	type FactoryContext,
} from '@zeix/le-truc'

export type ModulePaginationProps = {
	/** Total number of pages. Read from the `max` attribute at connect time. */
	max: number
	/** Current page number (1-based). Read from the `value` attribute at connect time. */
	value: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-pagination': HTMLElement & ModulePaginationProps
	}
}

/**
 * A pagination control with prev/next buttons, a direct page input, and keyboard navigation.
 * Use it for navigating paged data — provides ARIA navigation semantics, keyboard
 * focus management, and Enter key support on the page input field.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-pagination} Interactive preview and usage examples
 **/
export function ModulePagination(
	{ max = 1, value = 1 }: { max?: number; value?: number },
	{ expose, first, host, on, watch }: FactoryContext<ModulePaginationProps>,
) {
	const input = first(
		'input',
		'Add an <input[type="number"]> to enter the page number to go to.',
	)
	const prev = first(
		'button.prev',
		'Add a <button.prev> to go to the previous page.',
	)
	const next = first(
		'button.next',
		'Add a <button.next> to go to the next page.',
	)

	expose({
		max: asClampedInteger(Number(input.max) ?? 1),
		value: asClampedInteger(input.valueAsNumber ?? 1, host.max),
	})

	on(host, 'keyup', e => {
		const { key } = e
		if (e.target instanceof HTMLInputElement) return

		let nextPage = host.value
		if ((key === 'ArrowLeft' || key === '-') && host.value > 1) nextPage--
		else if ((key === 'ArrowRight' || key === '+') && host.value < host.max)
			nextPage++
		if (document.activeElement === prev && nextPage <= 1) next.focus()
		else if (document.activeElement === next && nextPage >= host.max)
			prev.focus()
		host.value = nextPage
	})
	on(input, 'change', () => {
		const numValue = input.valueAsNumber
		const clamped = Number.isNaN(numValue)
			? 1
			: Math.max(1, Math.min(numValue, host.max))
		input.valueAsNumber = clamped
		host.value = clamped
	})
	on(prev, 'click', () => {
		host.value--
		if (host.value <= 1) next.focus()
	})
	on(next, 'click', () => {
		host.value++
		if (host.value >= host.max) prev.focus()
	})

	watch('value', value => {
		host.setAttribute('value', String(value))
		input.value = String(value)
		prev.disabled = value <= 1
	})
	watch('max', max => {
		host.hidden = max <= 1
		host.setAttribute('max', String(max))
		input.max = String(max)
	})
	watch(() => host.value >= host.max, bindProperty(next, 'disabled'))

	return (
		<>
			<module-pagination max={max} value={value}>
				<div>
					<label>
						<span class="visually-hidden">Page</span>
						<input
							type="number"
							name="page"
							min="1"
							max={String(max)}
							value={String(value)}
						/>
					</label>
					<span class="value visually-hidden" aria-current="page">
						{() => host.value}
					</span>{' '}
					of <span class="max">{() => host.max}</span>
				</div>
				<div class="buttons">
					<button
						type="button"
						class="prev"
						disabled={value <= 1}
						aria-label="Previous page"
					>
						❮
					</button>
					<button
						type="button"
						class="next"
						disabled={value >= max}
						aria-label="Next page"
					>
						❯
					</button>
				</div>
			</module-pagination>

			<style>{css`
			module-pagination {
				display: inline-flex;
				align-items: center;
				gap: var(--space-s);

				& label {
					display: inline-block;
				}

				& input {
					display: inline-block;
					box-sizing: border-box;
					background: var(--color-input);
					color: var(--color-text);
					border: none;
					border-bottom: 1px solid var(--color-border);
					padding: var(--space-xs) var(--space-xxs);
					font-size: var(--font-size-m);
					width: 100%;
					height: var(--input-height);
					transition: color var(--transition-short) var(--easing-inout);
					text-align: right;
					appearance: textfield;
					-moz-appearance: textfield;

					&::-webkit-outer-spin-button,
					&::-webkit-inner-spin-button {
						-webkit-appearance: none;
						margin: 0;
					}
				}

				.buttons {
					display: flex;
					align-items: center;
				}

				& button {
					flex-grow: 0;
					box-sizing: border-box;
					height: var(--input-height);
					min-width: var(--input-height);
					border: 1px solid var(--color-border);
					background-color: var(--color-secondary);
					color: var(--color-text);
					padding: 0 var(--space-s);
					font-size: var(--font-size-s);
					line-height: var(--line-height-s);
					white-space: nowrap;
					cursor: pointer;
					transition: all var(--transition-shorter) var(--easing-inout);

					&:focus {
						z-index: 1;
					}

					&:disabled {
						opacity: var(--opacity-translucent);
					}

					&:not(:disabled) {
						cursor: pointer;
						opacity: var(--opacity-solid);

						&:hover {
							background-color: var(--color-secondary-hover);
						}

						&:active {
							background-color: var(--color-secondary-active);
						}
					}

					&:first-of-type {
						border-radius: var(--space-xs) 0 0 var(--space-xs);
						border-right-width: 0;
					}

					&:last-of-type {
						border-radius: 0 var(--space-xs) var(--space-xs) 0;
					}
				}
			}
			`}</style>
		</>
	)
}
