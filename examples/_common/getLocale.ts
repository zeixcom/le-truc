const FALLBACK_LOCALE = 'en'

export function getLocale(el: HTMLElement): string {
	const locale = el.closest('[lang]')?.getAttribute('lang')
	return locale || FALLBACK_LOCALE
}
