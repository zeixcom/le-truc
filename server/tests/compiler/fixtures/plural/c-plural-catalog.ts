/**
 * The `c-plural` fixture's catalog (LT-467): the retired basic-pluralize
 * entries, verbatim from the committed `i18n/*.json` they left. The source
 * locale (`en`) lives inline in `c-plural.tsrx`. Each `tasks` pattern spells
 * its locale's own plural and ordinal categories inside one select on
 * `type` — Welsh and Arabic carry six.
 */
export const C_PLURAL_CATALOG: Record<
	string,
	{ done: string; remaining: string; tasks: string }
> = {
	ar: {
		done: 'أحسنت، اكتمل كل شيء!',
		remaining: 'متبقية',
		tasks:
			'{type, select, ordinal {{count, selectordinal, other {مهمة}}} other {{count, plural, zero {مهام} one {مهمة} two {مهمتان} few {مهام} many {مهمة} other {مهمة}}}}',
	},
	cy: {
		done: 'Wedi cwblhau pob tasg!',
		remaining: 'ar ôl',
		tasks:
			'{type, select, ordinal {{count, selectordinal, zero {tasg} one {tasg} two {dasg} few {tasg} many {tasg} other {tasgiau}}} other {{count, plural, zero {tasg} one {tasg} two {dasg} few {tasg} many {tasg} other {tasgiau}}}}',
	},
	de: {
		done: 'Alles erledigt!',
		remaining: 'verbleibend',
		tasks:
			'{type, select, ordinal {{count, selectordinal, other {Aufgaben}}} other {{count, plural, one {Aufgabe} other {Aufgaben}}}}',
	},
	lv: {
		done: 'Viss pabeigts!',
		remaining: 'atlicis',
		tasks:
			'{type, select, ordinal {{count, selectordinal, other {uzdevumu}}} other {{count, plural, zero {uzdevumu} one {uzdevums} other {uzdevumu}}}}',
	},
	pl: {
		done: 'Wszystko gotowe!',
		remaining: 'pozostało',
		tasks:
			'{type, select, ordinal {{count, selectordinal, other {zadania}}} other {{count, plural, one {zadanie} few {zadania} many {zadań} other {zadania}}}}',
	},
	zh: {
		done: '全部完成！',
		remaining: '剩余',
		tasks:
			'{type, select, ordinal {{count, selectordinal, other {个任务}}} other {{count, plural, other {个任务}}}}',
	},
}
