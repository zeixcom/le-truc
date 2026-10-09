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

import { formatMessage } from '../../compiler/icu/evaluate'
import { parseMessage } from '../../compiler/icu/parse'
import { CLIENT_MESSAGE } from '../../compiler/runtime'

/** `form-spinbutton` → `renderFormSpinbutton`. */
export const renderName = (tag: string): string =>
	`render${tag
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')}`

/**
 * An argument message as `i18nRecord` builds it (LT-250, LT-218): a closure
 * over the shared evaluator, tagged with its AST and env so a
 * client-referenced key serializes into the root `i18n` attribute. `lang`
 * is the render locale the env bakes in (its plural rules).
 */
export const argMessage = (pattern: string, lang = 'en') => {
	const parsed = parseMessage(pattern)
	if (!parsed.ok) throw new Error(`fixture pattern: ${parsed.error}`)
	const message = parsed.message
	const env = { lang, timeZone: 'UTC', currency: 'USD' }
	return Object.assign(
		(args: Record<string, unknown>) => formatMessage(message, args, env),
		{ [CLIENT_MESSAGE]: { message, env } },
	)
}

/**
 * An inline reserved-`i18n` record for the fixture args (ADR 0030, LT-173).
 * The compiler supplies the real record at every render boundary; a fixture
 * builds its own so the args tables stay dependency-free (they are shared
 * by tests that compile into per-run temp directories). Values mirror the
 * `en` source record of the `c-plural` compiler fixture
 * (`fixtures/plural/c-plural.tsrx`, the retired basic-pluralize kept for its
 * coverage, LT-467) — since LT-252 the plural morphology is one ICU pattern
 * (`tasks`), a client-referenced message, so it is an {@link argMessage}.
 */
export const C_PLURAL_TASKS =
	'{type, select, ordinal {{count, selectordinal, one {task} other {tasks}}} other {{count, plural, one {task} other {tasks}}}}'

export const C_PLURAL_I18N = {
	lang: 'en',
	t: {
		done: 'Well done, all done!',
		remaining: 'remaining',
		tasks: argMessage(C_PLURAL_TASKS),
	},
	timeZone: 'UTC',
	currency: 'USD',
	dir: 'ltr',
} as const

/**
 * An inline record for one component's declared keys (same posture as
 * `C_PLURAL_I18N`): mirrors what `i18nRecord(tag, 'en')` resolves at the
 * current corpus — every key at its source-locale string, since the source
 * locale has no override file. Kept explicit per component so a key or
 * source-string edit fails the render fixtures that need updating.
 */
export const inlineI18n = (t: Record<string, unknown>) => ({
	lang: 'en',
	t,
	timeZone: 'UTC',
	currency: 'USD',
	dir: 'ltr',
})

/**
 * module-todo's record (LT-467): its labels, and the `remaining` count as an
 * {@link argMessage} — the pattern is client-referenced (`activeCount` is a
 * client memo), so the render serializes it when it differs from the source.
 */
export const MODULE_TODO_REMAINING =
	'{count, plural, =0 {Well done, all done!} one {# task remaining} other {# tasks remaining}}'

export const MODULE_TODO_I18N = inlineI18n({
	addTodo: 'Add Todo',
	addTodoLabel: 'What needs to be done?',
	filter: 'Filter',
	all: 'All',
	active: 'Active',
	completed: 'Completed',
	clearCompleted: 'Clear Completed',
	remaining: argMessage(MODULE_TODO_REMAINING),
})

/**
 * Same posture as `server-render-smoke.test.ts`: components whose args are
 * genuinely required get a value, everything else renders from `{}`.
 * Diverges from the smoke test's copy in two entries (LT-167): title/href
 * (card-blogpost) / title (card-callout) where the cards' prop is
 * `children` — copied verbatim, those rendered literal `undefined` into the
 * goldens; here the authored props are bound so the goldens pin authored
 * behavior. (The third divergence, the smoke's `label` where
 * form-radiogroup's prop was `legend`, ended when LT-514 moved both tables
 * to `children`.)
 */
export const CORPUS_ARGS: Record<string, Record<string, unknown>> = {
	'form-spinbutton': {
		name: 'quantity',
		i18n: inlineI18n({ decrement: 'Decrement', increment: 'Increment' }),
	},
	'form-checkbox': { name: 'agree', label: 'I agree' },
	'form-radiogroup': {
		name: 'choice',
		children: 'Pick one',
		options: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' },
		],
	},
	'form-textbox': {
		name: 'title',
		children: 'Title',
		i18n: inlineI18n({ clearInput: 'Clear input' }),
	},
	'form-combobox': {
		name: 'fruit',
		children: 'Fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
		i18n: inlineI18n({ clearInput: 'Clear input' }),
	},
	'form-tokenbox': {
		name: 'tags',
		children: 'Tags',
		i18n: inlineI18n({
			remove: 'Remove',
			added: argMessage('Added token: {token}'),
			removed: argMessage('Removed token: {token}'),
			duplicate: argMessage('{token} is already in the list'),
		}),
	},
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
		i18n: inlineI18n({
			drag: 'Drag',
			outOfGamut: 'Color out of gamut',
			lightness: 'Lightness',
			chroma: 'Chroma',
			hue: 'Hue',
		}),
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
	'module-codeblock': {
		id: 'codeblock-demo',
		language: 'ts',
		file: 'demo.ts',
		collapsed: true,
		children: '<span class="line">const a = 1</span>',
	},
	'basic-blogmeta': {
		author: 'Esther Brunner',
		avatar: './assets/img/avatar/esther-brunner.jpg',
		published: '2026-04-04',
		modified: '2026-04-08',
		readingTime: 7,
		i18n: inlineI18n({
			avatarOf: 'Avatar of',
			updatedOn: 'updated on',
			minRead: 'min read',
			unknownDate: 'unknown date',
		}),
	},
	'module-carousel': {
		carouselId: 'demo',
		slides: [
			{ title: 'Slide 1', content: '<p>First</p>' },
			{ title: 'Slide 2' },
			{ title: 'Slide 3' },
		],
	},
	'module-catalog': {
		products: [
			{ id: 'product-1', name: 'Product 1', max: 10 },
			{ id: 'product-2', name: 'Product 2', note: '(reduced stock)', max: 5 },
		],
	},
	'module-coloreditor': { value: 'oklch(.48 .23 263)', label: 'Blue' },
	'module-colorinfo': { label: 'Blue', value: 'oklch(.48 .23 263)' },
	'module-dialog': {
		dialogId: 'dialog-demo',
		title: 'Dialog Title',
		children: '<p>Dialog content.</p>',
	},
	'module-lazyload': {
		src: './test/module-lazyload/mocks/simple-text.html',
		loading: 'Loading...',
	},
	'module-listnav': {
		title: 'Pages',
		options: [
			{ value: './test/module-listnav/mocks/page1.html', label: 'Page 1' },
			{ value: './test/module-listnav/mocks/page2.html', label: 'Page 2' },
		],
	},
	'module-calctable': {
		lang: 'en',
		options: '{"style":"currency","currency":"CHF"}',
		rows: [
			{ id: 'item1', description: 'Widget', amount: 3, pricePerUnit: 12.5 },
			{ id: 'item2', description: 'Gadget', amount: 5, pricePerUnit: 8 },
		],
	},
	'module-pagination': { max: 10, value: 1 },
	'module-scrollarea': { children: '<p>Scrollable content</p>' },
	'module-splitview': {
		split: 0.3,
		start: 'Narrow panel (30%)',
		end: 'Wide panel (70%)',
	},
	'module-ticker': {
		fraction: 0.1,
		rows: [
			{ symbol: 'AAPL', open: 189.3, price: 189.3, volume: 0 },
			{ symbol: 'BRK.B', open: 412.75, price: 412.75, volume: 0 },
			{ symbol: 'MSFT', open: 417.5, price: 417.5, volume: 0 },
		],
	},
	'basic-button': { label: 'Add' },
	'module-todo': { i18n: MODULE_TODO_I18N },
}
