/**
 * LT-308 positive probe: the reserved `i18n` record typed per key from
 * `export const i18n = { … } as const`. An argument-less message is a
 * string an attribute takes as-is (`Reactive<string>`, no `undefined`
 * widening); a message with arguments is a function of its argument record.
 */
export const i18n = {
	filter: 'Filter',
	tasks: '{count, plural, one {# task} other {# tasks}}',
} as const

export function I18nMessages({
	count = 0,
	i18n: { t },
}: {
	count?: number
	i18n: I18n<typeof i18n>
}) {
	return (
		<div>
			<input placeholder={t.filter} />
			<span aria-label={t.tasks({ count: 1 })}>{t.tasks({ count })}</span>
		</div>
	)
}
