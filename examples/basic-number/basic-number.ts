import { asNumber, type Component, component, setText } from '../..'

export type BasicNumberProps = {
	value: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-number': Component<BasicNumberProps, {}>
	}
}

type Logger = {
	onWarn: (message: string) => void
	onError: (message: string) => void
}

const FALLBACK_LOCALE = 'en'

function getNumberFormatter(
	locale: string,
	rawOptions: string | null,
	logger: Logger = {
		onWarn: console.warn,
		onError: console.error,
	},
) {
	const useFallback = () => new Intl.NumberFormat(locale)
	if (!rawOptions) return useFallback()
	const { onWarn, onError } = logger

	let o: Intl.NumberFormatOptions = {}
	try {
		o = JSON.parse(rawOptions)
	} catch (error) {
		onError?.(`Invalid JSON: ${error}`)
		return useFallback()
	}

	const style = o.style ?? 'decimal'

	const drops: string[] = []
	if (style === 'currency') {
		if (
			!o.currency
			|| typeof o.currency !== 'string'
			|| o.currency.length !== 3
		) {
			onError?.(
				`style="currency" requires a 3-letter ISO currency (e.g. "CHF").`,
			)
			return useFallback()
		}
	} else {
		drops.push('currency', 'currencyDisplay', 'currencySign')
	}

	if (style === 'unit') {
		if (!o.unit || typeof o.unit !== 'string') {
			onError?.(
				`style="unit" requires a "unit" (e.g. "liter", "kilometer-per-hour").`,
			)
			return useFallback()
		}
	} else {
		drops.push('unit', 'unitDisplay')
	}

	if (o.notation && o.notation !== 'compact') drops.push('compactDisplay')

	const sanitized: Intl.NumberFormatOptions = {}
	for (const [k, v] of Object.entries(o)) {
		if (!drops.includes(k)) sanitized[k] = v
		else onWarn?.(`Option "${k}" is ignored for style="${style}".`)
	}

	const { minimumFractionDigits: minFD, maximumFractionDigits: maxFD } =
		sanitized
	if (minFD != null && maxFD != null && minFD > maxFD) {
		onWarn?.(
			`minimumFractionDigits (${minFD}) > maximumFractionDigits (${maxFD}); swapping.`,
		)
		sanitized.minimumFractionDigits = maxFD
		sanitized.maximumFractionDigits = minFD
	}
	const { minimumSignificantDigits: minSD, maximumSignificantDigits: maxSD } =
		sanitized
	if (minSD != null && maxSD != null && minSD > maxSD) {
		onWarn?.(
			`minimumSignificantDigits (${minSD}) > maximumSignificantDigits (${maxSD}); swapping.`,
		)
		sanitized.minimumSignificantDigits = maxSD
		sanitized.maximumSignificantDigits = minSD
	}

	try {
		const formatter = new Intl.NumberFormat(locale, sanitized)
		if (formatter.resolvedOptions().locale !== locale)
			onWarn(
				`Fall back to locale ${formatter.resolvedOptions().locale} instead of ${locale}`,
			)
		return formatter
	} catch (e) {
		onError?.(
			`Options rejected by Intl.NumberFormat: ${e instanceof Error ? e.message : String(e)}`,
		)
		return useFallback()
	}
}

export default component<BasicNumberProps, {}>(
	'basic-number',
	() => ({}),
	{ value: asNumber() },
	el => {
		const formatter = getNumberFormatter(
			el.closest('[lang]')?.getAttribute('lang') || FALLBACK_LOCALE,
			el.getAttribute('options'),
		)
		return {
			component: [setText(() => formatter.format(el.value))],
		}
	},
)
