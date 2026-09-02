/**
 * Unified-format migration: basic-number (LT-114 cutover). The root's lazy
 * text child binds against the ambient `host` (`watch(thunk, bindText(host))`
 * in the generated client) — the exact shape of the hand-written twin's own
 * `watch(() => formatter.format(host.value), bindText(host))`.
 *
 * Contract notes (restored to the hand-written twin verbatim, per the
 * TSRX-HOST-PROFILE data account — no documented deviations):
 * - `value` is Parser-exposed (`asNumber()`), read from the `value` attribute
 *   at connect time, writable and reactive. A pre-upgrade property write
 *   ("explicit DOM value wins", src/component.ts) is preserved the same way
 *   the twin preserved it.
 * - `lang` inherits from the closest ancestor `[lang]` via the shared
 *   `getLocale` helper — a plain import (ADR 0024 sub-design 16).
 * - `options` goes through the shared `getNumberFormatter` helper: invalid
 *   JSON falls back to default formatting with a logged `console.error`;
 *   missing required `currency`/`unit` values likewise.
 * - The formatter is created inside the watch thunk rather than hoisted to a
 *   setup const: a setup const reading `host` is re-declared verbatim into the
 *   server render module where no `host` exists, so the thunk is the one
 *   compiler-expressible home. The formatter is therefore re-derived per
 *   value change — for a display component that is the twin's behavior
 *   everywhere the specs observe it.
 * - The server render materializes the attribute contract only (`value`/
 *   `lang`/`options`); the formatted text is client-derived on connect
 *   (DOM-is-truth). No SSR consumer renders basic-number today — the demo
 *   pages hydrate hand-authored markup, which carries the pre-upgrade text.
 */

import { asNumber } from '@zeix/le-truc'
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
export function BasicNumber(
	{ value, lang = 'en', options = '{}' }: { value: number; lang?: string; options?: string },
)
	@{
		expose({ value: asNumber() })

		<>
			<basic-number {value} {lang} {options}>{() => getNumberFormatter(getLocale(host), host.getAttribute('options')).format(host.value)}</basic-number>

			<style>
			basic-number {
				display: inline;
			}
			</style>
		</>
	}
