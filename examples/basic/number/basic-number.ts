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
 * Use it for locale-aware number, currency, or unit display — options should be
 * provided as a JSON object and the value is read once at connect time.
 * Invalid `options` JSON falls back to defaults; `style: "unit"` requires a valid `unit`.
 * Format options are read from the `options` attribute as a JSON object.
 * @demo {./docs/examples/basic-number.html} Interactive preview and usage examples */
export default defineComponent<BasicNumberProps>(
	'basic-number',
	({ expose, host, watch }) => {
		const formatter = getNumberFormatter(
			getLocale(host),
			host.getAttribute('options'),
		)

		expose({ value: asNumber() })

		watch(() => formatter.format(host.value), bindText(host))
	},
)
