/**
 * LT-308 negative probe (must FAIL tsc in the ORDINARY tsconfig — wired
 * through `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts). Per-key `t` types make
 * each planted read an error at its native position:
 *
 * - an undeclared key (`t.fliter`);
 * - an argument message read bare in an attribute (`t.tasks`);
 * - a call on an argument-less message (`t.filter()`);
 * - a catalog without `as const`: its widened values are the
 *   `string | function` union, so the first attribute read fails;
 * - a possibly-undefined `aria-label` — attributes are `Reactive<T>`
 *   again, no `undefined` widening (the LT-237 revert).
 */
export const i18n = {
	filter: 'Filter',
	tasks: '{count, plural, one {# task} other {# tasks}}',
} as const

const loose = { filter: 'Filter' }

export function I18nBadReads({
	maybeLabel,
	i18n: { t },
}: {
	maybeLabel?: string
	i18n: I18n<typeof i18n>
}) {
	const w = {} as I18n<typeof loose>
	return (
		<div>
			<input placeholder={t.fliter} />
			<span aria-label={t.tasks}>{t.filter()}</span>
			<input placeholder={w.t.filter} />
			<button type="button" aria-label={maybeLabel}>x</button>
		</div>
	)
}
