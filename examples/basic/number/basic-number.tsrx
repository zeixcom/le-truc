/**
 * Unified-format migration: basic-number — a `deriveCell` computed over a
 * `createCell` signal (`numberCell`), both harvested from root attributes via
 * the widened arg→DOM-site substitution (ADR 0023 sub-design 12/LT-024),
 * rendered as the root's own reactive text child (ADR 0023 examples
 * migration).
 *
 * Deviations from the hand-written `basic-number.ts` (noted per project
 * convention): (1) `lang` inheritance from the closest ancestor `[lang]`
 * (`getLocale()`) needs a DOM ancestor walk with no compile-time DOM site to
 * substitute from — `lang` becomes an ordinary (non-inherited) server arg
 * instead, defaulting to `'en'`. (2) `getNumberFormatter`'s validation/
 * fallback/logging (currency/unit requirement checks, digit-pair swapping)
 * is a plain helper MODULE import — TSRX sources import nothing (ADR 0023
 * sub-design 2) — so `options` is used directly, unsanitized, via
 * `new Intl.NumberFormat(lang, JSON.parse(options))`; a thrown
 * `Intl.NumberFormat` config error (e.g. `style: "currency"` without a
 * `currency`) is not caught and re-logged here.
 */
import { expose } from '@zeix/le-truc'

export type BasicNumberProps = {
	/** Numeric value to format and display. */
	value: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-number': HTMLElement & BasicNumberProps
	}
}

/**
 * Displays a number formatted according to the locale and optional `Intl.NumberFormat` options.
 * Use it for locale-aware number, currency, or unit display.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-number} Interactive preview and usage examples
 * */
export function BasicNumber(
	{ value, lang = 'en', options = '{}' }: { value: number; lang?: string; options?: string },
)
	@{
		const numberCell = createCell(Number(value))
		const formatted = deriveCell(() =>
			new Intl.NumberFormat(lang, JSON.parse(options)).format(numberCell.get()),
		)
		expose({ value: numberCell.get })

		<>
			<basic-number {value} {lang} {options}>{formatted}</basic-number>

			<style>
			basic-number {
				display: inline;
			}
			</style>
		</>
	}
