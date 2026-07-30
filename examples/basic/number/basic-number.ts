import { asNumber, bindText, defineComponent } from '../../..'
import { getLocale } from '../../_common/getLocale'
import { getNumberFormatter } from '../../_common/getNumberFormatter'

export type BasicNumberProps = {
	/** Numeric value to format and display. Read from the `value` attribute at connect time. */
	value: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-number': HTMLElement & BasicNumberProps
	}
}

/**
 * Displays a number formatted according to the locale and optional `Intl.NumberFormat` options.
 * Use it for locale-aware number, currency, or unit display — the value is read once at connect time.
 * Invalid `options` JSON falls back to defaults; `style: "unit"` requires a valid `unit`.
 * @attribute {string} [lang] - BCP 47 locale tag (e.g. `de-CH`). Falls back to the nearest ancestor's `lang` attribute, or `en` if none is set. Read once at connect time.
 * @attribute {Intl.NumberFormatOptions} [options={}] - `Intl.NumberFormat` options as a JSON object, e.g. `{"style":"currency","currency":"EUR"}`. Read once at connect time.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-number} Interactive preview and usage examples
 * */
export default defineComponent<BasicNumberProps>(
	'basic-number',
	({ expose, host, watch }) => {
		expose({ value: asNumber() })

		const formatter = getNumberFormatter(
			getLocale(host),
			host.getAttribute('options'),
		)
		watch(() => formatter.format(host.value), bindText(host))
	},
)
