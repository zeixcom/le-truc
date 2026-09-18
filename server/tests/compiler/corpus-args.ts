/**
 * Shared per-component fixture args for tests that render the corpus through
 * BOTH mechanisms — the value harness (`render<Name>(args)`) and the
 * simulation realm — plus the tag→render-fn name mapping they both need.
 *
 * One copy is the equivalence audit's validity condition (ADR 0029 s7,
 * LT-165 step 8): phase 1 and phase 2 must run under IDENTICAL inputs, or
 * the byte-identity it asserts proves nothing. `sim-driver.test.ts` (fixture
 * pins, fixed-point gate, two-order hermeticity) and
 * `equivalence-audit.test.ts` import the same table rather than keeping
 * copies that can drift.
 */

/** `form-spinbutton` → `renderFormSpinbutton`. */
export const renderName = (tag: string): string =>
	`render${tag
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')}`

/**
 * An inline reserved-`i18n` record for the fixture args (ADR 0030, LT-173).
 * The compiler supplies the real record at every render boundary; a fixture
 * builds its own so the args tables stay dependency-free (they are shared
 * by tests that compile into per-run temp directories). Values mirror what
 * `i18nRecord('basic-pluralize', 'en')` resolves at the current corpus —
 * per-category word forms per LT-190's `<key>.<category>` convention.
 */
export const PLURALIZE_I18N = {
	lang: 'en',
	t: {
		done: 'Well done, all done!',
		remaining: 'remaining',
		'task.one': 'task',
		'task.other': 'tasks',
		'task.zero': 'tasks',
		'task.two': 'tasks',
		'task.few': 'tasks',
		'task.many': 'tasks',
	},
	timeZone: 'UTC',
	currency: 'USD',
	dir: 'ltr',
} as const

/**
 * An inline record for one component's declared keys (same posture as
 * `PLURALIZE_I18N`): mirrors what `i18nRecord(tag, 'en')` resolves at the
 * current corpus — every key at its source-locale string, since the source
 * locale has no override file. Kept explicit per component so a key or
 * source-string edit fails the render fixtures that need updating.
 */
export const inlineI18n = (t: Record<string, string>) => ({
	lang: 'en',
	t,
	timeZone: 'UTC',
	currency: 'USD',
	dir: 'ltr',
})

/**
 * Same posture as `server-render-smoke.test.ts`: components whose args are
 * genuinely required get a value, everything else renders from `{}`.
 * Diverges from the smoke test's copy in three entries (LT-167): the smoke
 * passes `label` where form-radiogroup's prop is `legend`, and title/href
 * (card-blogpost) / title (card-callout) where the cards' prop is
 * `children` — copied verbatim, those rendered literal `undefined` into the
 * goldens; here the authored props are bound so the goldens pin authored
 * behavior.
 */
export const CORPUS_ARGS: Record<string, Record<string, unknown>> = {
	'form-spinbutton': {
		name: 'quantity',
		i18n: inlineI18n({ decrement: 'Decrement', increment: 'Increment' }),
	},
	'form-checkbox': { name: 'agree', label: 'I agree' },
	'form-radiogroup': {
		name: 'choice',
		legend: 'Pick one',
		options: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' },
		],
	},
	'form-textbox': {
		name: 'title',
		label: 'Title',
		i18n: inlineI18n({ clearInput: 'Clear input' }),
	},
	'form-combobox': {
		name: 'fruit',
		label: 'Fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
		i18n: inlineI18n({ clearInput: 'Clear input' }),
	},
	'form-tokenbox': { name: 'tags', label: 'Tags' },
	'form-listbox': {
		name: 'fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
		i18n: inlineI18n({ filter: 'Filter', clearFilter: 'Clear filter' }),
	},
	// No `name`: the audit rendered form-colorgraph from `{}` before the i18n
	// declaration existed — keep its phase-1 output unchanged except for the
	// record the render signature now requires.
	'form-colorgraph': {
		i18n: inlineI18n({ drag: 'Drag' }),
	},
	'module-tabgroup': {
		tabs: [
			{ id: 'one', label: 'One', content: 'First' },
			{ id: 'two', label: 'Two', content: 'Second' },
		],
	},
	'card-blogpost': { children: 'An excerpt from the post.' },
	'card-callout': { children: 'Heads up' },
	'card-collapsible': { title: 'Details' },
	'basic-button': { label: 'Add' },
	'basic-pluralize': { count: 1, i18n: PLURALIZE_I18N },
}
