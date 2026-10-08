/**
 * Cross-surface DIAGNOSTIC parity (LT-242; the ADR 0032 s6 equivalence
 * contract, amended: both surfaces render identically AND diagnose
 * identically).
 *
 * `parity.test.ts` proves successful compiles agree. Every drift COMPILER_
 * REVIEW §2.3 found lived on the failure path instead, where it could not
 * look: the `.tsx` `offenders` truthiness bug (fixed LT-221), the
 * `.tsrx`-only `keyName` arm (a grammar asymmetry until the `.tsx` keyed
 * `map` closed it, LT-425) and the per-item `ref` message. A user of either surface must get the same code
 * and the same sentence for the same invalid component — otherwise one
 * surface teaches its users something the other never hears.
 *
 * Each case authors ONE invalid component in both surfaces, compiles both
 * front ends, and asserts equal `[code, severity, covered text, message]`
 * lists after the `.tsx` side is TRANSLATED into `.tsrx` spelling. Message
 * translation is two things only:
 *
 * - the echoed file name (`c.tsrx` / `c.tsx`) — structural, not wording;
 * - `SURFACE_VOCABULARY` — the explicit allowlist of fragments that
 *   legitimately differ because they NAME the authored spelling (`@if`
 *   against a conditional, `@for body` against `map body`). Since LT-233
 *   every entry is built from the compiler's own vocabulary
 *   (`server/compiler/surface.ts`), so the table cannot drift from the
 *   product; the one entry outside it echoes the author's own tag. Every
 *   entry must be exercised by some case — a stale entry fails.
 *
 * Parity cannot see the second drift class: shared machinery that speaks
 * `.tsrx` to BOTH surfaces (`@for`, `@if`) is identical and still wrong
 * for `.tsx` users. The leak scan rejects `.tsrx` directive vocabulary in
 * every `.tsx` message. LT-242 found six such leaks; LT-233 folded them
 * into the vocabulary, and the scan now tolerates none.
 *
 * Each diagnostic's range is compared by the authored text it covers
 * (ADR 0044 s1, LT-371), not by offset — the two spellings lay out
 * differently. Where the surfaces spell the covered construct differently
 * (`@if (…) { … }` against a ternary), the case lists the pair in `spans`;
 * an unexercised pair fails. Each case also asserts its `code` is present
 * on both sides, so a fixture that stops triggering its family fails
 * instead of passing vacuously.
 */
import { describe, expect, test } from 'bun:test'
import type {
	CompileDiagnostic,
	DiagnosticCode,
} from '../../../compiler/diagnostics'
import { compileComponent } from '../../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../../compiler/frontend/tsx'
import { SURFACE_WORDING, type SurfaceWording } from '../../../compiler/surface'

/* === Surface vocabulary allowlist === */

type VocabularyEntry = {
	tsrx: string
	tsx: string
	/** What the fragment names. */
	why: string
}

const W = SURFACE_WORDING

/** An entry for one vocabulary key, used whole. */
const term = (key: keyof SurfaceWording, why: string): VocabularyEntry => ({
	tsrx: String(W.tsrx[key]),
	tsx: String(W.tsx[key]),
	why,
})

/** An entry for a vocabulary key inside a fixed frame (`… ${key} …`). */
const framed = (
	key: keyof SurfaceWording,
	frame: (fragment: string) => string,
	why: string,
): VocabularyEntry => ({
	tsrx: frame(String(W.tsrx[key])),
	tsx: frame(String(W.tsx[key])),
	why,
})

/**
 * Fragments that differ between surfaces for the SAME invalid component.
 * Short terms (`loop`, `if`) appear only inside a frame: bare, `.tsx`'s
 * `conditional` would also rewrite surface-neutral prose.
 */
const SURFACE_VOCABULARY: readonly VocabularyEntry[] = [
	term('keyBindingShape', 'a key binding that is not a bare identifier'),
	term('keyBindingExample', 'the key binding as a fix-it'),
	term('loopBodyStatements', 'statements in a server-data loop body'),
	framed('loop', l => `reactive-list ${l}`, 'the list loop'),
	framed('loop', l => `${l} over`, 'a loop over its iterable'),
	framed('loop', l => `${l} body`, 'a loop body'),
	framed('loop', l => `the ${l} body`, 'a server-data loop body'),
	framed('loop', l => `the ${l} item`, 'a list item as a Mount Scope root'),
	term('aLoop', 'a loop, sentence-initial'),
	term('emptyArmFix', 'the empty arm as a fix-it'),
	term('emptyArm', 'the empty arm'),
	term('ifCondition', 'a conditional test'),
	term('switchDiscriminant', 'a switch discriminant'),
	framed('if', i => `the same ${i}`, 'one conditional'),
	framed('if', i => `this ${i}`, 'this conditional'),
	term('ifBranches', 'conditional branches'),
	term('switchArms', 'switch arms'),
	term('ifBranch', 'one conditional branch'),
	term('caseLabel', 'a switch arm test (LTC062)'),
	term('reactiveConditional', 'a condition over a signal (ADR 0037)'),
	framed(
		'reactiveConditional',
		r => `an arm of ${r.charAt(0).toLowerCase()}${r.slice(1)}`,
		'an arm of a condition over a signal (LTC081)',
	),
	term('asyncBoundary', 'an async boundary as an arm set (LTC063, LT-432)'),
	term('tryBody', 'the boundary body'),
	term('pendingArm', 'the pending arm'),
	term('catchArm', 'the catch arm'),
	term(
		'boundary',
		'the boundary construct (the loop-body rule, LT-358a/LT-359)',
	),
	term('conditionalTag', 'choosing between static tags (LTC053 fix-it)'),
	term('stylesheetForm', 'the stylesheet spelling as a fix-it (LTC078)'),
	...(['if', 'switch'] as const).flatMap(branch => [
		{
			tsrx: W.tsrx.loopInBranch(branch).inside,
			tsx: W.tsx.loopInBranch(branch).inside,
			why: `a loop's ${branch} branch`,
		},
		{
			tsrx: W.tsrx.loopInBranch(branch).outOf,
			tsx: W.tsx.loopInBranch(branch).outOf,
			why: `leaving a ${branch} branch`,
		},
	]),
	// The one entry outside the vocabulary: LTC053 echoes the author's tag.
	{
		tsrx: '<{level}>',
		tsx: '<truc:element>',
		why: 'the authored dynamic-tag spelling',
	},
].filter(entry => entry.tsrx !== entry.tsx)

/** Longest `.tsx` fragment first, so a frame is consumed before a term inside it. */
const BY_TSX_LENGTH = [...SURFACE_VOCABULARY].sort(
	(a, b) => b.tsx.length - a.tsx.length,
)

const used = new Set<VocabularyEntry>()

/**
 * A `.tsx` message as its `.tsrx` twin would spell it. A fragment `.tsx`
 * leaves out entirely (an empty spelling — the key-binding fix-it) cannot
 * be translated back in, so the `.tsrx` side drops it instead.
 */
const normalize = (
	message: string,
	surface: 'tsrx' | 'tsx',
	file: string,
): string => {
	let out = message.replaceAll(file, '⟨file⟩')
	for (const entry of BY_TSX_LENGTH) {
		if (entry.tsx === '') {
			if (surface === 'tsrx' && out.includes(entry.tsrx)) {
				used.add(entry)
				out = out.replaceAll(entry.tsrx, '')
			}
			continue
		}
		if (out.includes(entry[surface])) used.add(entry)
		if (surface === 'tsx') out = out.replaceAll(entry.tsx, entry.tsrx)
	}
	return out
}

/* === Surface leaks === */

/**
 * `.tsrx` directive vocabulary a `.tsx` author never writes. Parity alone
 * cannot see a leak — shared machinery that speaks `.tsrx` to both
 * surfaces is identical, and wrong for one of them.
 */
const TSRX_VOCABULARY =
	/@(?:for|if|else|switch|case|default|try|pending|catch|empty)\b|&\{/

/** The `.tsx` messages that name `.tsrx` spellings. */
const leaks = (diagnostics: CompileDiagnostic[]): string[] =>
	diagnostics
		.filter(d => TSRX_VOCABULARY.test(d.message))
		.map(d => `${d.code}: ${d.message}`)

/**
 * Each diagnostic as `code severity ⟨covered text⟩: message`, in `.tsrx`
 * spelling: the message through the vocabulary, the covered text through
 * the case's `spans`. `usedSpans` collects the pairs a `.tsx` range hit.
 */
const shape = (
	diagnostics: CompileDiagnostic[],
	surface: 'tsrx' | 'tsx',
	file: string,
	source: string,
	spans: ReadonlyArray<[string, string]> = [],
	usedSpans: Set<[string, string]> = new Set(),
): string[] =>
	diagnostics.map(d => {
		let covered = source.slice(d.location.start, d.location.end)
		const pair =
			surface === 'tsx' ? spans.find(([, tsx]) => tsx === covered) : undefined
		if (pair) {
			usedSpans.add(pair)
			covered = pair[0]
		}
		return `${d.code} ${d.severity} ⟨${covered}⟩: ${normalize(d.message, surface, file)}`
	})

/* === Source builders === */

type Spec = {
	/** Module-level lines above the component (imports, `export const`s). */
	pre?: string
	params?: string
	setup?: string
	/** Template content inside `<c-el>` — `.tsrx` spelling. */
	body: string
	/** `.tsx` spelling of `body`, when the surfaces spell it differently. */
	tsx?: string
}

const tsrxSource = ({ pre = '', params = '{}: {}', setup = '', body }: Spec) =>
	`${pre}
export function C(${params})
	@{
		${setup}
			<c-el>${body}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

/**
 * The text a ROOT diagnostic (LTC008's wrong root tag) covers: the root
 * element, `<style>` child included (LT-375). Cases comparing a root
 * diagnostic across surfaces allowlist the two spellings with it.
 */
const coveredRoot = (source: string): string =>
	source.slice(
		source.indexOf('<div>'),
		source.lastIndexOf('</div>') + '</div>'.length,
	)

const tsxSource = ({
	pre = '',
	params = '{}: {}',
	setup = '',
	body,
	tsx,
}: Spec) =>
	`import { css } from '@zeix/le-truc-compiler/macros'
${pre}
export function C(${params}) {
	${setup}
	return (
			<c-el>${tsx ?? body}
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`

/** A whole-file override for driver-level shapes the builders cannot reach. */
type Case = {
	name: string
	code: DiagnosticCode
	spec?: Spec
	sources?: { tsrx: string; tsx: string }
	/** Substrings BOTH surfaces' messages must contain (negative pins). */
	pins?: string[]
	/** Substrings neither surface may produce (the drift a pin guards). */
	forbid?: string[]
	/**
	 * Covered texts the two surfaces spell differently, `[tsrx, tsx]` — a
	 * `.tsx` range covering exactly the second compares as the first. Every
	 * pair must be exercised; any other range must cover the same text.
	 */
	spans?: Array<[string, string]>
}

const imports = (...names: string[]) =>
	`import { ${names.join(', ')} } from '@zeix/le-truc'`

const LIST = `const items = createList<string>([], { keyConfig: 'item' })`

const list = (body: string, tsxBody: string, params?: string): Spec => ({
	pre: imports('createList'),
	...(params ? { params } : {}),
	setup: LIST,
	body: `<ul data-container>@for (const item of items) { ${body} }</ul>`,
	tsx: `<ul data-container>{items.map(item => ${tsxBody})}</ul>`,
})

const same = (body: string): [string, string] => [body, body]

const cell = (name: string, init: string) =>
	`const ${name} = createCell(${init})\n\t\texpose({ ${name}: ${name}.get })`

/* === Cases === */

/**
 * The three COMPILER_REVIEW §2.3 shapes. Two are fixed; the per-item `ref`
 * has converged in practice — `classify-attributes.ts` retires `ref={}` on
 * both surfaces before either list-body validator sees it, so the `.tsrx`
 * `attr.kind === 'ref'` arm in `validateListBody` is unreachable (LT-233
 * deletes it with the fold). The pins keep all three closed.
 */
// The two §1.1 offender shapes (the impure attribute and the named
// offender) retired with the slot fill (LT-423) — they are in the
// reactive-list bodies describe's compiles-clean list.
const REVIEW_SHAPES: Case[] = [
	{
		name: '§2.3 keyName: a loop variable named `first`',
		code: 'LTC005',
		spans: [
			[
				'@for (const first of items) { <li>{first}</li> }',
				'items.map(first => <li>{first}</li>)',
			],
		],
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul data-container>@for (const first of items) { <li>{first}</li> }</ul>',
			tsx: '<ul data-container>{items.map(first => <li>{first}</li>)}</ul>',
		},
		pins: ['reserved parameters of `reconcile()`’s `bindItem`'],
	},
	{
		name: '§2.3 per-item ref: `ref={}` inside a reactive-list body',
		code: 'LTC006',
		spec: list(...same('<li ref={x}>{item}</li>')),
		pins: ['`ref={name}` is retired'],
		forbid: ['per-item element refs'],
	},
]

/** The reactive-list body family (ADR 0024 sub-design 5, the copied seam). */
const LIST_BODY: Case[] = [
	{
		// ADR 0046 s4 (LT-425): the `.tsx` keyed `map` binds the key, so the
		// reserved-name check covers the key binding on both surfaces.
		name: 'a key binding named `first`',
		code: 'LTC005',
		spans: [
			[
				'@for (const item of items; key first) { <li>{item}</li> }',
				'items.map((item, first) => <li>{item}</li>)',
			],
		],
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul data-container>@for (const item of items; key first) { <li>{item}</li> }</ul>',
			tsx: '<ul data-container>{items.map((item, first) => <li>{item}</li>)}</ul>',
		},
		pins: ['reserved parameters of `reconcile()`’s `bindItem`'],
	},
	{
		name: 'a key binding that is not a bare identifier',
		code: 'LTC005',
		spans: [['item.id', '{ id }']],
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul data-container>@for (const item of items; key item.id) { <li>{item}</li> }</ul>',
			tsx: '<ul data-container>{items.map((item, { id }) => <li>{item}</li>)}</ul>',
		},
		pins: ['write a bare identifier'],
	},
	{
		// The one-hole rule retired (ADR 0046 s1); the shared lazy-text gate
		// owns this shape now — two lazy children race on the shared
		// textContent.
		name: 'a lazy child other than the item',
		code: 'LTC005',
		spec: list(...same('<li>{item}{() => item}</li>')),
		pins: ['More than one lazy text child'],
	},
	{
		// A server attribute over the item is still refused: the item is the
		// signal the List hands out (ADR 0046 s3), and the template render
		// outside the loop cannot fold a per-item value.
		name: 'a server attribute reading the item',
		code: 'LTC005',
		spec: list(...same('<li title={item}>{item}</li>')),
		pins: ['which is a signal, not a value'],
	},
	{
		// The impure-ambient attribute refusal (LTC033) is position-blind:
		// the build machine's clock/RNG baked into the extracted template is
		// the same permanent wrong value it is anywhere else.
		name: '§1.1 offenders: an impure attribute in the body',
		code: 'LTC033',
		spec: list(...same('<li title={String(Math.random())}>{item}</li>')),
		pins: ['reads an ambient value'],
	},
	{
		// Per-field harvest (ADR 0046 s7, LT-429): the key field comes from
		// `data-key`, every other field needs a site in the item.
		name: 'LTC072 a field of an arg-seeded list item rendered nowhere',
		code: 'LTC072',
		spec: {
			pre: imports('createList'),
			params: '{ rows = [] }: { rows?: Array<{ id: string; label: string }> }',
			setup: 'const items = createList(rows, { keyConfig: row => row.id })',
			body: '<ul data-container>@for (const row of items) { <li class="row">static</li> }</ul>',
			tsx: '<ul data-container>{items.map(row => <li class="row">static</li>)}</ul>',
		},
		pins: ['Field `label` of list `items` renders nowhere', 'data-label'],
		forbid: ['Field `id`'],
	},
	{
		name: 'LTC076 a field of an arg-seeded list item with no parser',
		code: 'LTC076',
		spec: {
			pre: imports('createList'),
			params: '{ rows = [] }: { rows?: Array<{ id: string; due: Date }> }',
			setup: 'const items = createList(rows, { keyConfig: row => row.id })',
			body: '<ul data-container>@for (const row of items) { <li><time datetime={() => String(row.get().due)}></time></li> }</ul>',
			tsx: '<ul data-container>{items.map(row => <li><time datetime={() => String(row.get().due)}></time></li>)}</ul>',
		},
		pins: [
			'Field `due` of list `items` has type `Date`',
			'`createList(harvest(rows, { due: … }), …)`',
		],
	},
	{
		// A composed child renders once into the extracted template, root
		// `lang`/`i18n` included (ADR 0030 s9, LT-355): an arg over the item
		// has no per-item render to reach.
		name: 'LTC075 a composed child in the item reading the item in an arg',
		code: 'LTC075',
		spec: {
			...list(...same('<li><Kid label={item.get()} /></li>')),
			pre: `${imports('createList')}\nimport { Kid } from './kid.tsrx'`,
		},
		pins: ['<Kid>', 'its `label` arg', '`truc:pass`'],
	},
	{
		name: 'LTC075 a composed child in the item reading the key in its content',
		code: 'LTC075',
		spec: {
			pre: `${imports('createList')}\nimport { Kid } from './kid.tsrx'`,
			setup: LIST,
			body: '<ul data-container>@for (const item of items; key k) { <li><Kid><b title={k}>x</b></Kid></li> }</ul>',
			tsx: '<ul data-container>{items.map((item, k) => <li><Kid><b title={k}>x</b></Kid></li>)}</ul>',
		},
		pins: ['reads `k` in its content'],
	},
	{
		// A server-data loop renders once into the extracted template, so
		// one over the item has no lowering (LT-424); a loop over server
		// data nests.
		name: 'a server-data loop over the item',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			setup: `const items = createList<string[]>([], { keyConfig: 'item' })`,
			body: '<ul data-container>@for (const item of items) { <li>@for (const part of item.get()) { <i>{part}</i> }</li> }</ul>',
			tsx: '<ul data-container>{items.map(item => <li>{item.get().map(part => <i>{part}</i>)}</li>)}</ul>',
		},
		pins: ['inside a reactive-list', 'iterating `item`'],
	},
	{
		// LT-349: the positive server-only rule, with the LT-348 tail. The
		// subject is the shared construct face now — the item plans through
		// `emitConstructEffects` like an arm (LT-423).
		name: 'a handler reading a server arg',
		code: 'LTC005',
		spec: list(
			...same('<li onClick={() => console.log(label)}>{item}</li>'),
			'{ label }: { label: string }',
		),
		pins: [
			'references server-only name `label` — the generated client does not bind it',
		],
	},
	{
		// A plain boundary has no lowering inside the item's mount (LT-423);
		// an async boundary is an arm set and nests (LT-424).
		name: 'a boundary inside the body',
		code: 'LTC005',
		spans: [
			[
				'@try { <b>{item}</b> } @catch (e) { <b>{e.message}</b> }',
				'<truc:try catch={e => <b>{e.message}</b>}><b>{item}</b></truc:try>',
			],
		],
		spec: list(
			'<li>@try { <b>{item}</b> } @catch (e) { <b>{e.message}</b> }</li>',
			'<li><truc:try catch={e => <b>{e.message}</b>}><b>{item}</b></truc:try></li>',
		),
		pins: ['inside a reactive-list'],
	},
	{
		// No client-need walk reaches a list body, so a setup const read only
		// there would never be emitted client-side (LT-349).
		name: 'a handler reading a setup const',
		code: 'LTC005',
		spec: {
			...list(...same('<li onClick={() => console.log(gap)}>{item}</li>')),
			setup: `${LIST}\n\t\tconst gap = 1`,
		},
		pins: ['references `gap`, which a list body cannot read'],
	},
	{
		name: 'a server-data loop attribute reading a server arg',
		code: 'LTC005',
		spec: {
			params: '{ label, names }: { label: string; names: string[] }',
			body: '<ul>@for (const n of names) { <li title={() => label}>{n}</li> }</ul>',
			tsx: '<ul>{names.map(n => <li title={() => label}>{n}</li>)}</ul>',
		},
		pins: [
			'Reactive attribute `title` inside the',
			'references server-only name `label` — the generated client does not bind it',
		],
	},
	{
		name: 'a list directly under the component root',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '@for (const item of items) { <li>{item}</li> }',
			tsx: '{items.map(item => <li>{item}</li>)}',
		},
	},
	{
		name: 'a loop over a reactive source that is not a List',
		code: 'LTC001',
		spans: [
			[
				'@for (const r of rows) { <li>{r}</li> }',
				'rows.map(r => <li>{r}</li>)',
			],
		],
		spec: {
			pre: imports('createCell'),
			setup: cell('rows', '[] as string[]'),
			body: '<ul>@for (const r of rows) { <li>{r}</li> }</ul>',
			tsx: '<ul>{rows.map(r => <li>{r}</li>)}</ul>',
		},
	},
	{
		name: 'a loop variable read inside a reactive thunk',
		code: 'LTC002',
		spec: {
			pre: imports('createCell'),
			params: '{ rows }: { rows: string[] }',
			setup: cell('n', '0'),
			body: '<ul>@for (const r of rows) { <li class={() => r + n.get()}>{r}</li> }</ul>',
			tsx: '<ul>{rows.map(r => <li class={() => r + n.get()}>{r}</li>)}</ul>',
		},
	},
	{
		name: 'a loop inside a conditional branch (LT-301)',
		code: 'LTC005',
		spec: {
			params: '{ rows, ok }: { rows: string[]; ok: boolean }',
			body: '<ul>@if (ok) { @for (const r of rows) { <li onClick={() => console.log(1)}>{r}</li> } }</ul>',
			tsx: '<ul>{ok ? <>{rows.map(r => <li onClick={() => console.log(1)}>{r}</li>)}</> : null}</ul>',
		},
	},
	{
		name: 'a loop inside a switch arm (LT-301)',
		code: 'LTC005',
		spec: {
			params: '{ rows, mode }: { rows: string[]; mode: string }',
			body: "<ul>@switch (mode) { @case 'a': { @for (const r of rows) { <li onClick={() => console.log(1)}>{r}</li> } } @default: { <li>x</li> } }</ul>",
			tsx: "<ul>{(() => { switch (mode) { case 'a': return <>{rows.map(r => <li onClick={() => console.log(1)}>{r}</li>)}</>; default: return <li>x</li> } })()}</ul>",
		},
	},
	{
		name: 'a list handler reading a server-only name',
		code: 'LTC005',
		spec: list(
			'<li onClick={() => console.log(label)}>{item}</li>',
			'<li onClick={() => console.log(label)}>{item}</li>',
			'{ label }: { label: string }',
		),
	},
	{
		name: 'a non-const declaration in a server-data loop body',
		code: 'LTC005',
		spans: [['let x = r', 'let x = r;']],
		spec: {
			params: '{ rows }: { rows: string[] }',
			body: '<ul>@for (const r of rows) { let x = r\n<li>{r}</li> }</ul>',
			tsx: '<ul>{rows.map(r => { let x = r; return <li>{r}</li> })}</ul>',
		},
	},
	{
		name: 'a statement other than a const in a server-data loop body',
		code: 'LTC005',
		spans: [['console.log(r)', 'console.log(r);']],
		spec: {
			params: '{ rows }: { rows: string[] }',
			body: '<ul>@for (const r of rows) { console.log(r)\n<li>{r}</li> }</ul>',
			tsx: '<ul>{rows.map(r => { console.log(r); return <li>{r}</li> })}</ul>',
		},
	},
	{
		// LT-358a: the .tsx map-body guard gains its .tsrx twin — an @try
		// where a @for body's output belongs is LTC053 on both surfaces,
		// not the generic non-output-statement rule.
		name: 'a boundary as a loop body root (LTC053, LT-358a)',
		code: 'LTC053',
		spans: [
			[
				'@try { <li class="a">{r}</li> } @catch (e) { <li class="b">{e.message}</li> }',
				'<truc:try catch={e => <li class="b">{e.message}</li>}><li class="a">{r}</li></truc:try>',
			],
		],
		spec: {
			params: '{ rows }: { rows: string[] }',
			body: '@for (const r of rows) { @try { <li class="a">{r}</li> } @catch (e) { <li class="b">{e.message}</li> } }',
			tsx: '{rows.map(r => <truc:try catch={e => <li class="b">{e.message}</li>}><li class="a">{r}</li></truc:try>)}',
		},
		pins: ['cannot sit directly in', "the body's root must be an element"],
	},
]

/**
 * Condition validation — the LTC005 condition face ADR 0037 retires
 * (LT-274–LT-276). Pinned identical on both surfaces now, so the ADR 0037
 * codes that replace it inherit parity from day one: when they land, these
 * cases flip to the new codes on both sides at once or fail here.
 */
/**
 * Conditions over signals are legal since ADR 0037 (LT-274): the four
 * shapes that pinned LTC005's retired condition face now compile on both
 * surfaces (`REACTIVE_CONDITIONS` below), and the cases here pin the new
 * refusals — LTC062, LTC063 and the placement and arm-shape faces of
 * LTC005.
 */
const REACTIVE_CONDITIONS: Spec[] = [
	{
		pre: imports('createCell'),
		setup: cell('open', 'false'),
		body: '@if (open.get()) { <p>x</p> }',
		tsx: '{open.get() ? <p>x</p> : null}',
	},
	{
		pre: imports('createCell'),
		setup: cell('open', 'false'),
		body: '@if (open.get()) { <p class="a">x</p> } @else { <b>y</b> }',
		tsx: '{open.get() ? <p class="a">x</p> : <b>y</b>}',
	},
	{
		pre: imports('asBoolean'),
		params: '{ open }: { open?: boolean }',
		setup: 'expose({ open: asBoolean() })',
		body: '@if (host.open) { <p>x</p> }',
		tsx: '{host.open ? <p>x</p> : null}',
	},
	{
		pre: imports('createCell'),
		setup: cell('m', "'a'"),
		body: "@switch (m.get()) { @case 'a': { <p>a</p> } @default: { <p>b</p> } }",
		tsx: "{(() => { switch (m.get()) { case 'a': return <p>a</p>; default: return <p>b</p> } })()}",
	},
]

const CONDITIONS: Case[] = [
	{
		name: 'LTC062 a dynamic case value in a reactive switch',
		code: 'LTC062',
		spec: {
			pre: imports('createCell'),
			setup: `const other = 'b'
		${cell('m', "'a'")}`,
			body: "@switch (m.get()) { @case 'a': { <p>a</p> } @case other: { <p>b</p> } }",
			tsx: "{(() => { switch (m.get()) { case 'a': return <p>a</p>; case other: return <p>b</p> } })()}",
		},
		pins: ['is not a literal'],
	},
	{
		name: 'LTC062 two case values naming one arm',
		code: 'LTC062',
		spec: {
			pre: imports('createCell'),
			setup: cell('m', '1'),
			// LT-385d made case keys value-typed (`case:` + the literal's
			// JSON), so `1` and `'1'` name DISTINCT arms now; the duplicate
			// pair is two spellings of one literal value — `1.0` parses to
			// `1`, as `===` says.
			body: '@switch (m.get()) { @case 1: { <p>a</p> } @case 1.0: { <p>b</p> } }',
			tsx: '{(() => { switch (m.get()) { case 1: return <p>a</p>; case 1.0: return <p>b</p> } })()}',
		},
		pins: ['names the same arm'],
	},
	{
		name: 'LTC063 a reactive condition in a reactive list container',
		code: 'LTC063',
		spans: [
			[
				'@if (open.get()) { <li class="head">x</li> }',
				'open.get() ? <li class="head">x</li> : null',
			],
		],
		spec: {
			pre: imports('createCell', 'createList'),
			setup: `${LIST}
		${cell('open', 'false')}`,
			body: '<ul data-container>@if (open.get()) { <li class="head">x</li> }@for (const item of items) { <li>{item}</li> }</ul>',
			tsx: '<ul data-container>{open.get() ? <li class="head">x</li> : null}{items.map(item => <li>{item}</li>)}</ul>',
		},
	},
	{
		name: 'LTC063 an async boundary in a reactive list container',
		code: 'LTC063',
		spans: [
			[
				'@try { <li class="a">{data}</li> } @pending { <li class="p">p</li> } @catch (e) { <li class="b">{e.message}</li> }',
				'<truc:try pending={<li class="p">p</li>} catch={e => <li class="b">{e.message}</li>}><li class="a">{data}</li></truc:try>',
			],
		],
		spec: {
			pre: imports('createList', 'deriveCell'),
			setup: `${LIST}
		const data = deriveCell(async () => 'x')
		expose({})`,
			body: '<ul data-container>@try { <li class="a">{data}</li> } @pending { <li class="p">p</li> } @catch (e) { <li class="b">{e.message}</li> }@for (const item of items) { <li>{item}</li> }</ul>',
			tsx: '<ul data-container><truc:try pending={<li class="p">p</li>} catch={e => <li class="b">{e.message}</li>}><li class="a">{data}</li></truc:try>{items.map(item => <li>{item}</li>)}</ul>',
		},
		pins: ['move the boundary out'],
	},
	{
		name: 'LTC074 an unkeyed element beside a reactive-list loop in its container',
		code: 'LTC074',
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul data-container><input type="text" />@for (const item of items) { <li>{item}</li> }</ul>',
			tsx: '<ul data-container><input type="text" />{items.map(item => <li>{item}</li>)}</ul>',
		},
		pins: ['data-unreconciled', 'first run'],
	},
	{
		name: 'a reactive condition inside a server-known branch',
		code: 'LTC005',
		spans: [['@if (open.get()) { <p>x</p> }', 'open.get() ? <p>x</p> : null']],
		spec: {
			pre: imports('createCell'),
			params: '{ ok }: { ok: boolean }',
			setup: cell('open', 'false'),
			body: '@if (ok) { <div class="a">@if (open.get()) { <p>x</p> }</div> }',
			tsx: '{ok ? <div class="a">{open.get() ? <p>x</p> : null}</div> : null}',
		},
		pins: ['inside another control-flow branch'],
	},
	{
		name: 'a reactive conditional branch with two roots',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			setup: cell('open', 'false'),
			body: '@if (open.get()) { <><p class="a">x</p><p class="b">y</p></> }',
			tsx: '{open.get() ? <><p class="a">x</p><p class="b">y</p></> : null}',
		},
		pins: ['does not render exactly one root element'],
	},
	{
		name: 'a reactive switch reading a server arg',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			params: '{ mode }: { mode: string }',
			setup: cell('m', "'a'"),
			body: "@switch (m.get() + mode) { @case 'a': { <p>a</p> } }",
			tsx: "{(() => { switch (m.get() + mode) { case 'a': return <p>a</p> } })()}",
		},
	},
	{
		name: 'an async boundary whose body does not render its signal',
		code: 'LTC005',
		spec: {
			pre: imports('deriveCell'),
			setup:
				"const data = deriveCell(async () => 'x')\n\t\texpose({ data: data.get })",
			body: '@try { <div class="ok">static</div> } @pending { <p class="wait">…</p> } @catch (e) { <p class="err">{e.message}</p> }',
			tsx: '<truc:try pending={<p class="wait">…</p>} catch={e => <p class="err">{e.message}</p>}><div class="ok">static</div></truc:try>',
		},
	},
	{
		name: 'an async boundary whose catch arm renders a lazy child over something else',
		code: 'LTC005',
		spec: {
			pre: imports('deriveCell'),
			setup:
				"const data = deriveCell(async () => 'x')\n\t\texpose({ data: data.get })",
			body: '@try { <div class="ok">{data}</div> } @pending { <p class="wait">…</p> } @catch (e) { <p class="err">{data}</p> }',
			tsx: '<truc:try pending={<p class="wait">…</p>} catch={e => <p class="err">{data}</p>}><div class="ok">{data}</div></truc:try>',
		},
	},
	{
		name: 'a reactive condition reading a server arg',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			params: '{ ok }: { ok: boolean }',
			setup: cell('open', 'false'),
			body: '@if (open.get() && ok) { <p>x</p> }',
			tsx: '{open.get() && ok ? <p>x</p> : null}',
		},
	},
	{
		name: 'an authored `hidden` on the reactive-list empty arm (ADR 0037 s5)',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul data-container>@for (const item of items) { <li><span>{item}</span></li> } @empty { <li class="none" hidden>Nothing yet</li> }</ul>',
			tsx: '<ul data-container>{items.length === 0 ? <li class="none" hidden>Nothing yet</li> : items.map(item => <li><span>{item}</span></li>)}</ul>',
		},
	},
	{
		name: 'a client construct below a conditional branch root',
		code: 'LTC005',
		spec: {
			params: '{ ok }: { ok: boolean }',
			body: '@if (ok) { <div class="a"><button type="button" onClick={() => console.log(1)}>x</button></div> } @else { <p class="b">y</p> }',
			tsx: '{ok ? <div class="a"><button type="button" onClick={() => console.log(1)}>x</button></div> : <p class="b">y</p>}',
		},
	},
	{
		name: 'a client construct in a switch arm',
		code: 'LTC005',
		spec: {
			params: '{ mode }: { mode: string }',
			body: '@switch (mode) { @case \'a\': { <button type="button" onClick={() => console.log(1)}>a</button> } @default: { <p>b</p> } }',
			tsx: '{(() => { switch (mode) { case \'a\': return <button type="button" onClick={() => console.log(1)}>a</button>; default: return <p>b</p> } })()}',
		},
	},
	{
		name: 'an async boundary whose pending arm has two roots',
		code: 'LTC005',
		spans: [
			[
				'{ <><p class="a">a</p><p class="b">b</p></> }',
				'<><p class="a">a</p><p class="b">b</p></>',
			],
		],
		spec: {
			pre: imports('deriveCell'),
			setup:
				"const data = deriveCell(async () => 'x')\n\t\texpose({ data: data.get })",
			body: '@try { <div class="ok">{data}</div> } @pending { <><p class="a">a</p><p class="b">b</p></> } @catch (e) { <p class="err">{e.message}</p> }',
			tsx: '<truc:try pending={<><p class="a">a</p><p class="b">b</p></>} catch={e => <p class="err">{e.message}</p>}><div class="ok">{data}</div></truc:try>',
		},
		pins: ['that does not render exactly one root element'],
	},
]

/**
 * LTC005's server-only face (LT-347): one fixture per position the client
 * emits authored code into. The generated client binds no server arg and no
 * `t`, so each would be a ReferenceError at connect. List bodies are pinned
 * in LIST_BODY above; a new client-emitted position belongs here.
 */
const LABEL = '{ label }: { label: string }'
const ICU = {
	pre: `${imports('createCell')}\nexport const i18n = { tasks: '{count, plural, other {# tasks}}' }`,
	params: '{ i18n: { t } }: { i18n: I18n }',
}
const SERVER_ONLY: Case[] = [
	{
		name: 'a reactive text child',
		code: 'LTC005',
		spec: { params: LABEL, body: '<span>{() => label.toUpperCase()}</span>' },
		pins: ['Reactive text on <span> references server-only name `label`'],
	},
	{
		// LT-218 admits a static `t.<key>` read (the client message channel);
		// a computed key stays server-only.
		name: 'a reactive text child reading `t` through a computed key',
		code: 'LTC005',
		spec: {
			...ICU,
			setup: 'const c = createCell(0)\n\t\texpose({ count: c.get })',
			body: "<span>{() => t[host.count > 0 ? 'tasks' : 'tasks']({ count: host.count })}</span>",
		},
		pins: ['Reactive text on <span> references server-only name `t`'],
	},
	{
		name: 'a reactive text child of the component root',
		code: 'LTC005',
		spec: { params: LABEL, body: '{() => label.toUpperCase()}' },
		pins: ['Reactive text on the component root references'],
	},
	{
		name: 'a reactive attribute',
		code: 'LTC005',
		spec: { params: LABEL, body: '<span title={() => label}>x</span>' },
		pins: ['Reactive attribute `title` references'],
	},
	{
		name: 'a class map',
		code: 'LTC005',
		spec: {
			params: LABEL,
			body: "<span class={() => ({ a: label === 'x' })}>x</span>",
		},
		pins: ['Reactive class map references'],
	},
	{
		name: 'a style map',
		code: 'LTC005',
		spec: {
			params: LABEL,
			body: '<span style={() => ({ color: label })}>x</span>',
		},
		pins: ['Reactive style map references'],
	},
	{
		name: 'an event handler',
		code: 'LTC005',
		spec: {
			params: LABEL,
			body: '<button onClick={() => console.log(label)}>x</button>',
		},
		pins: ['Event handler `onClick` references'],
	},
	{
		name: 'a reactive truc:html',
		code: 'LTC005',
		spec: { params: LABEL, body: '<span truc:html={() => label}></span>' },
		pins: ['Reactive `truc:html` references'],
	},
	{
		name: 'an expose() get/set descriptor',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			params: LABEL,
			setup:
				"const c = createCell('')\n\t\texpose({ v: { get: () => label + c.get(), set: (x: string) => c.set(x) } })",
			body: '<span>x</span>',
		},
		pins: ['`expose()` entry `v` references'],
	},
	{
		name: 'a defineMethod body',
		code: 'LTC005',
		spec: {
			pre: imports('defineMethod'),
			params: LABEL,
			setup: 'expose({ go: defineMethod(() => { console.log(label) }) })',
			body: '<span>x</span>',
		},
		pins: ['`expose()` entry `go` references'],
	},
	{
		name: 'a signal with no harvest site',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			params: LABEL,
			setup: 'const c = createCell(label)\n\t\texpose({ v: c.get })',
			body: '<span>x</span>',
		},
		pins: ['The initializer of signal `c` references'],
	},
	{
		// LT-349: a compiler-generated query local is not a client rebinding
		// — the handler would log the queried <button>, not the arg.
		name: 'a server arg named like a queried element',
		code: 'LTC005',
		spec: {
			params: '{ button }: { button: string }',
			body: '<button onClick={() => console.log(button)}>x</button>',
		},
		pins: ['Event handler `onClick` references server-only name `button`'],
	},
	{
		// LT-358c: the record spelling (`messages.t.<key>`) flags the record
		// binding, so the report must route to the literal-key sentence —
		// the generic exposed-prop fix would contradict it.
		name: 'a record-spelled message read',
		code: 'LTC005',
		spec: {
			pre: `${imports('createCell')}\nexport const i18n = { tasks: '{count, plural, other {# tasks}}' }`,
			params: '{ i18n: messages }: { i18n: I18n }',
			setup: 'const c = createCell(0)\n\t\texpose({ count: c.get })',
			body: '<span>{() => messages.t.tasks({ count: c.get() })}</span>',
		},
		pins: [
			'Reactive text on <span> references server-only name `messages`',
			'reads a declared key literally',
		],
		forbid: ['Read the value through an exposed prop or from the DOM.'],
	},
	{
		name: 'a module-level const',
		code: 'LTC005',
		spec: {
			pre: 'const MAX = 5',
			body: '<button onClick={() => console.log(MAX)}>x</button>',
		},
		pins: [
			'Event handler `onClick` references server-only name `MAX`',
			'Import `MAX` from a module, or declare it as a const in setup.',
		],
	},
	{
		name: 'a setup const a client position pulls in',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			params: LABEL,
			setup:
				'const c = createCell(0)\n\t\texpose({ n: c.get })\n\t\tconst x = label.length',
			body: '<span title={() => String(x + c.get())}>x</span>',
		},
		pins: ['Setup const `x`, which a client position reads'],
	},
]

/** An `async` component function, per surface (LTC008). */
const ASYNC = {
	tsrx: tsrxSource({ body: '<p>x</p>' }).replace(
		'export function',
		'export async function',
	),
	tsx: tsxSource({ body: '<p>x</p>' }).replace(
		'export function',
		'export async function',
	),
}

/** A second component function `D`, per surface (LTC008). */
const SECOND = {
	tsrx: tsrxSource({ body: '<p>y</p>' })
		.replace('C(', 'D(')
		.replaceAll('c-el', 'd-el'),
	// The second function only: the source's marker import stays once, at the top.
	tsx: tsxSource({ body: '<p>y</p>' })
		.replace("import { css } from '@zeix/le-truc-compiler/macros'\n", '')
		.replace('C(', 'D(')
		.replaceAll('c-el', 'd-el'),
}

/** A fragment-root output, per surface (LTC060) — root and `<style>` still wrapped in `<>…</>`. */
const FRAGMENT_ROOT = {
	tsrx: `export function C({}: {})
	@{
		<>
			<c-el><p>x</p></c-el>
			<style>@scope {
	:scope { color: red }
}</style>
		</>
	}`,
	tsx: `import { css } from '@zeix/le-truc-compiler/macros'
export function C({}: {}) {
	return (
		<>
			<c-el><p>x</p></c-el>
			<style>{css\`@scope {
	:scope { color: red }
}\`}</style>
		</>
	)
}`,
}

/**
 * A `<style>` block holding an expression in place of the stylesheet, per
 * surface (LTC078, LT-444) — read before LT-444 as an empty sheet.
 */
const STYLE_EXPRESSION = {
	tsrx: `export function C({}: {})
	@{
		const sheet = '@scope { :scope { color: red } }'
		<c-el><p>x</p><style>{sheet}</style></c-el>
	}`,
	tsx: `export function C({}: {}) {
	const sheet = '@scope { :scope { color: red } }'
	return <c-el><p>x</p><style>{sheet}</style></c-el>
}`,
}

/** The text a fragment-root diagnostic (LTC060) covers: the whole fragment. */
const coveredFragment = (source: string): string =>
	source.slice(source.indexOf('<>'), source.indexOf('</>') + '</>'.length)

/** A sample of each remaining diagnostic family. */
const FAMILIES: Case[] = [
	{
		name: 'LTC060 fragment root',
		code: 'LTC060',
		sources: FRAGMENT_ROOT,
		// The covered fragment spells the `<style>` block differently by
		// surface (the `css` tag) — allowlist that difference.
		spans: [
			[coveredFragment(FRAGMENT_ROOT.tsrx), coveredFragment(FRAGMENT_ROOT.tsx)],
		],
		pins: ['Drop the fragment so that the host element is the root'],
	},
	{
		// LT-417: only the root's first direct `<style>` child is the
		// stylesheet. A second direct one (here the builders' own block,
		// which follows the body's) and a nested one are refused, not
		// rendered empty with their CSS dropped.
		name: 'LTC073 second direct <style> child of the root',
		code: 'LTC073',
		spec: {
			body: '<style>p { color: blue }</style>',
			tsx: '<style>{css`p { color: blue }`}</style>',
		},
		spans: [
			[
				'<style>@scope {\n\t:scope {\n\t\t  color: red;\n\t\t}\n}</style>',
				'<style>{css`@scope {\n\t:scope {\n\t\t  color: red;\n\t\t}\n}`}</style>',
			],
		],
		pins: [
			'A second `<style>` block in the root',
			"root's single `<style>` child",
		],
	},
	{
		name: 'LTC073 <style> nested in a descendant',
		code: 'LTC073',
		spec: {
			body: '<div><style>p { color: blue }</style></div>',
			tsx: '<div><style>{css`p { color: blue }`}</style></div>',
		},
		spans: [
			[
				'<style>p { color: blue }</style>',
				'<style>{css`p { color: blue }`}</style>',
			],
		],
		pins: [
			'A `<style>` block nested inside an element',
			"root's single `<style>` child",
		],
	},
	{
		// LT-444: an expression child is no stylesheet on either surface;
		// it compiled to an empty sheet with no message.
		name: 'LTC078 an expression in place of the stylesheet',
		code: 'LTC078',
		sources: STYLE_EXPRESSION,
		pins: ['The content of this `<style>` block is not a stylesheet'],
	},
	{
		name: 'LTC006 React DOM-property name',
		code: 'LTC006',
		spec: { body: '<p className="x">x</p>' },
	},
	{
		name: 'LTC006 unrecognized truc: attribute (LT-353)',
		code: 'LTC006',
		spec: { body: '<p truc:bogus="x">x</p>' },
		pins: ['`truc:bogus` is not a Le Truc attribute'],
	},
	{
		name: 'LTC006 retired truc:case (LT-353)',
		code: 'LTC006',
		spec: { body: '<span truc:case="one">x</span>' },
		pins: ['is retired (ADR 0030)'],
	},
	{
		name: 'LTC006 non-function event attribute',
		code: 'LTC006',
		spec: { body: '<p onClick="x()">x</p>' },
	},
	{
		name: 'LTC007 unaddressable async-boundary container',
		code: 'LTC007',
		spans: [
			[
				'<div>@try { <p>{d}</p> } @pending { <p>…</p> } @catch (e) { <p>{e.message}</p> }</div>',
				'<div><truc:try pending={<p>…</p>} catch={e => <p>{e.message}</p>}><p>{d}</p></truc:try></div>',
			],
		],
		spec: {
			pre: imports('deriveCell'),
			setup: "const d = deriveCell(async () => 'x')\n\t\texpose({ d: d.get })",
			body: '<div>@try { <p>{d}</p> } @pending { <p>…</p> } @catch (e) { <p>{e.message}</p> }</div><div>x</div>',
			tsx: '<div><truc:try pending={<p>…</p>} catch={e => <p>{e.message}</p>}><p>{d}</p></truc:try></div><div>x</div>',
		},
		pins: ['which holds a'],
	},
	{
		// LT-416: both surfaces cover the `async` keyword itself, so the
		// covered texts agree without a `spans` pair.
		name: 'LTC008 async component function',
		code: 'LTC008',
		sources: ASYNC,
	},
	{
		name: 'LTC008 root is not the custom element',
		code: 'LTC008',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replaceAll('c-el', 'div'),
			tsx: tsxSource({ body: '<p>x</p>' }).replaceAll('c-el', 'div'),
		},
		// The diagnostic covers the whole root element, and since LT-375 the
		// root carries the `<style>` block — whose spelling differs by
		// surface (the `css` tag). Allowlist that covered-text difference.
		spans: [
			[
				coveredRoot(tsrxSource({ body: '<p>x</p>' }).replaceAll('c-el', 'div')),
				coveredRoot(tsxSource({ body: '<p>x</p>' }).replaceAll('c-el', 'div')),
			],
		],
	},
	{
		name: 'LTC008 two component functions',
		code: 'LTC008',
		spans: [[SECOND.tsrx.trim(), SECOND.tsx.trim()]],
		sources: {
			tsrx: `${tsrxSource({ body: '<p>x</p>' })}\n${SECOND.tsrx}`,
			tsx: `${tsxSource({ body: '<p>x</p>' })}\n${SECOND.tsx}`,
		},
	},
	{
		name: 'LTC009 unknown config key',
		code: 'LTC009',
		spec: { pre: 'export const config = { bogus: true }', body: '<p>x</p>' },
	},
	{
		name: 'LTC010 managed form prop without formAssociated',
		code: 'LTC010',
		spec: { body: '<p>{host.validationMessage}</p>' },
	},
	{
		name: 'LTC011 unresolved composed element',
		code: 'LTC011',
		spec: { body: '<Foo />' },
	},
	{
		name: 'LTC012 reactive attribute on a custom element',
		code: 'LTC012',
		spec: {
			pre: imports('createCell'),
			setup: cell('n', '0'),
			body: '<x-el count={() => n.get()}></x-el>',
		},
	},
	{
		name: 'LTC014 unused plain import',
		code: 'LTC014',
		spec: { pre: "import { foo } from './foo'", body: '<p>x</p>' },
	},
	{
		name: 'LTC015 requestContext arity',
		code: 'LTC015',
		spec: {
			setup: "const c = requestContext('x')\n\t\texpose({ c })",
			body: '<p>x</p>',
		},
	},
	{
		name: 'LTC017 signal through an opaque call',
		code: 'LTC017',
		spec: {
			pre: imports('createCell'),
			setup: cell('n', '0'),
			body: '<p>{String(n)}</p>',
		},
	},
	{
		name: 'LTC019 string-literal prop name in child position',
		code: 'LTC019',
		spec: {
			pre: imports('asString'),
			setup: "expose({ label: asString('') })",
			body: "<p>{'label'}</p>",
		},
	},
	{
		name: 'LTC025 malformed first() call',
		code: 'LTC025',
		spec: { setup: 'const b = first()', body: '<p>x</p>' },
	},
	{
		name: 'LTC026 first() matches nothing',
		code: 'LTC026',
		spec: { setup: "const b = first('button', 'required')", body: '<p>x</p>' },
	},
	{
		name: 'LTC026 malformed selector',
		code: 'LTC026',
		spec: { setup: "const b = first('p[', 'required')", body: '<p>x</p>' },
	},
	{
		name: 'LTC027 ambiguous first()',
		code: 'LTC027',
		spec: {
			setup: "const b = first('p', 'required')",
			body: '<p>x</p><p>y</p>',
		},
	},
	{
		name: 'LTC028 reserved expose name',
		code: 'LTC028',
		spec: {
			pre: imports('asString'),
			setup: "expose({ constructor: asString('') })",
			body: '<p>x</p>',
		},
	},
	{
		name: 'LTC030 textarea value attribute',
		code: 'LTC030',
		spec: {
			params: '{ v }: { v: string }',
			body: '<textarea value={v}></textarea>',
		},
	},
	{
		name: 'LTC032 default on a required prop',
		code: 'LTC032',
		spec: { params: "{ a = 'x' }: { a: string }", body: '<p>{a}</p>' },
	},
	{
		name: 'LTC033 impure static child',
		code: 'LTC033',
		spec: { body: '<p>{Date.now()}</p>' },
	},
	{
		name: 'LTC033 impure static attribute',
		code: 'LTC033',
		spec: { body: '<p title={String(Math.random())}>x</p>' },
	},
	{
		name: 'LTC036 real export without an import',
		code: 'LTC036',
		spec: { setup: cell('n', '0'), body: '<p>x</p>' },
	},
	{
		name: 'LTC037 FactoryContext name in an import',
		code: 'LTC037',
		spec: { pre: imports('requestContext'), body: '<p>x</p>' },
	},
	{
		name: 'LTC040 dead required reason',
		code: 'LTC040',
		spec: {
			params: '{ ok }: { ok: boolean }',
			setup: "const a = first('p.x', 'required')",
			body: '@if (ok) { <p class="x">x</p> }',
			tsx: '{ok ? <p class="x">x</p> : null}',
		},
	},
	{
		name: 'LTC041 two first() names for one element',
		code: 'LTC041',
		spec: {
			setup: "const a = first('p.x')\n\t\tconst b = first('p')",
			body: '<p class="x">x</p>',
		},
	},
	{
		name: 'LTC042 static id in a template',
		code: 'LTC042',
		spec: { body: '<p id="x">x</p>' },
	},
	{
		name: 'LTC044 conditional signal constructor',
		code: 'LTC044',
		spec: {
			pre: imports('createCell'),
			params: '{ a }: { a: boolean }',
			setup:
				'const s = a ? createCell(1) : createCell(2)\n\t\texpose({ s: s.get })',
			body: '<p>x</p>',
		},
	},
	{
		name: 'LTC045 deferred collector call',
		code: 'LTC045',
		spec: { setup: "setTimeout(() => watch('x', () => {}))", body: '<p>x</p>' },
	},
	{
		name: 'LTC046 rendered client-only const',
		code: 'LTC046',
		spec: {
			setup: "const el = first('p')\n\t\tconst t = el?.textContent",
			body: '<p>{t}</p>',
		},
	},
	{
		name: 'LTC047 untranslated literal prose',
		code: 'LTC047',
		spec: {
			pre: "export const i18n = { en: { hi: 'Hi' } }",
			body: '<p>Hello there</p>',
		},
	},
	{
		name: 'LTC053 dynamic tag',
		code: 'LTC053',
		spans: [
			['<{level}>x</{level}>', '<truc:element tag={level}>x</truc:element>'],
		],
		spec: {
			params: '{ level }: { level: string }',
			body: '<{level}>x</{level}>',
			tsx: '<truc:element tag={level}>x</truc:element>',
		},
	},
	{
		name: 'LTC054 page context in a server-evaluated child',
		code: 'LTC054',
		spec: { body: '<p>{location.href}</p>' },
	},
	{
		name: 'LTC055 unparseable ICU source pattern',
		code: 'LTC055',
		spec: {
			pre: "export const i18n = { n: '{n, plural, one {x}}' }",
			params: '{ i18n: { t } }: { i18n: I18n }',
			body: '<p>{t.n}</p>',
		},
	},
	{
		name: 'LTC055 ICU call site missing an argument',
		code: 'LTC055',
		spec: {
			pre: "export const i18n = { n: '{count, plural, other {# items}}' }",
			params: '{ i18n: { t } }: { i18n: I18n }',
			body: '<p>{t.n({ total: 1 })}</p>',
		},
		pins: ['is missing `count`', 'passes `total`'],
	},
	{
		name: 'LTC055 ICU argument message read without a call',
		code: 'LTC055',
		spec: {
			pre: "export const i18n = { hi: 'Hello, {name}!' }",
			params: '{ i18n: { t } }: { i18n: I18n }',
			body: '<p title={t.hi}>x</p>',
		},
		pins: ['read without a call'],
	},
	{
		// LT-358 rider: an authored <script> element is refused on both
		// surfaces, whatever its type — the page owns script loading.
		name: 'LTC056 authored <script> element',
		code: 'LTC056',
		spec: {
			body: '<script src="https://example.com/x.js"></script>',
		},
		pins: ['scripts are refused'],
	},
	{
		name: 'LTC056 module-type <script> is refused too',
		code: 'LTC056',
		spec: {
			body: '<script type="module">document.title = "x"</script>',
		},
		pins: ['whatever their `type`'],
	},
	{
		// LT-374 (D-20): formatted text does not parse back into state — a
		// signal seeded from an arg needs a raw value source beside it.
		name: 'LTC059 formatted-only signal with no raw value source',
		code: 'LTC059',
		spec: {
			pre: imports('createState'),
			params: '{ count = 0 }: { count?: number }',
			setup: 'const n = createState(count)\n\t\texpose({})',
			body: '<p>{() => n.get().toLocaleString(\'en-US\')}</p><button type="button" onClick={() => n.set(n.get() + 1)}>+</button>',
		},
		pins: ['formatted with `toLocaleString()`', '<data value={() => …}>'],
	},
	{
		// LT-383: an authored <template> is refused on both surfaces — the
		// compiler owns template extraction, and the selector probe cannot
		// see inside one.
		name: 'LTC061 authored <template> element',
		code: 'LTC061',
		spec: { body: '<div><template><p>x</p></template></div>' },
		pins: ['A `<template>` element in a component template'],
	},
	{
		// LT-268: the sheet is parsed (ADR 0033 s9), and spec-grammar
		// findings report identically on both surfaces — the CSS text is
		// the same string on either side of the seam. LT-394: a warning.
		name: 'LTC065 stylesheet: an invalid unit',
		code: 'LTC065',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(
				'color: red;',
				'width: 10pxx;',
			),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(
				'color: red;',
				'width: 10pxx;',
			),
		},
		pins: ['`width`', '10pxx'],
	},
	{
		// LT-501: a selector that descends past a compound an authored limit
		// excludes is dead on either surface.
		name: 'LTC071 stylesheet: a selector descending past an authored limit',
		code: 'LTC071',
		sources: {
			tsrx: tsrxSource({
				body: '<p>x</p><other-el><span>y</span></other-el>',
			})
				.replace('@scope {', '@scope to (other-el > *) {')
				.replace(':scope {', 'other-el span {'),
			tsx: tsxSource({
				body: '<p>x</p><other-el><span>y</span></other-el>',
			})
				.replace('@scope {', '@scope to (other-el > *) {')
				.replace(':scope {', 'other-el span {'),
		},
		pins: ['`other-el > *`', 'remove the limit'],
	},
	// LT-501: the platform-CSS stylesheet contract reports identically on
	// both surfaces — the sheet text is the same string either side of the seam.
	{
		name: 'LTC066 stylesheet: a rule in @scope led by the own tag',
		code: 'LTC066',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(':scope {', 'c-el {'),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(':scope {', 'c-el {'),
		},
		pins: ['Write `:where(:scope)` for the host'],
	},
	{
		name: 'LTC086 stylesheet: :host',
		code: 'LTC086',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(':scope {', ':host {'),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(':scope {', ':host {'),
		},
		pins: ['`:host(.x)` becomes `:where(:scope).x`'],
	},
	{
		name: 'LTC069 stylesheet: :global',
		code: 'LTC069',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(
				':scope {',
				':global(.x) {',
			),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(':scope {', ':global(.x) {'),
		},
		pins: ['Remove the wrapper'],
	},
	{
		// LT-502: a top-level rule the component's tag does not contain is a
		// warning, the same string on both surfaces.
		name: 'LTC088 stylesheet: an unscoped top-level rule',
		code: 'LTC088',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(
				'@scope {',
				'.x {\n\tcolor: blue;\n}\n@scope {',
			),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(
				'@scope {',
				'.x {\n\tcolor: blue;\n}\n@scope {',
			),
		},
		pins: ['`.x`', 'applies to the whole page'],
	},
	{
		name: 'LTC089 stylesheet: a @scope inside @scope on a lowered target',
		code: 'LTC089',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(
				'color: red;',
				'color: red; } @scope (.x) { .y { top: 0; }',
			),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(
				'color: red;',
				'color: red; } @scope (.x) { .y { top: 0; }',
			),
		},
		pins: ['`cssTargets`', 'no flat-selector form'],
	},
	// LTC081 (LT-461): a handler arg the composing parent cannot address.
	{
		name: 'LTC081 a handler arg with no function type',
		code: 'LTC081',
		spec: {
			params: '{ onClick }: { onClick?: string }',
			body: '<p>x</p>',
		},
		pins: ['Handler arg `onClick` has no function type'],
	},
	{
		name: 'LTC081 a handler arg read outside an event attribute',
		code: 'LTC081',
		spec: {
			params: '{ onClick }: { onClick?: () => void }',
			body: '<button onClick={() => onClick?.()}>x</button>',
		},
		pins: ['is read outside an event attribute'],
	},
	{
		name: 'LTC081 a handler arg placed in a reactive arm',
		code: 'LTC081',
		spec: {
			pre: imports('createCell'),
			params: '{ onClick }: { onClick?: () => void }',
			setup: cell('open', 'false'),
			body: '@if (open.get()) { <button onClick={onClick}>x</button> }',
			tsx: '{open.get() ? <button onClick={onClick}>x</button> : null}',
		},
		pins: ["recreates the arm's elements on every flip"],
	},
	{
		name: 'LTC081 a handler arg placed in a reactive-list item',
		code: 'LTC081',
		spec: list(
			...same('<li><button onClick={onClick}>x</button></li>'),
			'{ onClick }: { onClick?: () => void }',
		),
		pins: ["recreates the item's elements on every reconcile"],
	},
	{
		name: 'LTC081 a handler arg placed in a server-data loop body',
		code: 'LTC081',
		spec: {
			params: '{ rows, onClick }: { rows: string[]; onClick?: () => void }',
			body: '<ul>@for (const row of rows) { <li><button onClick={onClick}>{row}</button></li> }</ul>',
			tsx: '<ul>{rows.map(row => <li><button onClick={onClick}>{row}</button></li>)}</ul>',
		},
		pins: ['once for each item'],
	},
]

/**
 * A reactive list whose body carries the item's setup (ADR 0046 s5):
 * `stmts` before the output, statement per line on `.tsrx`, a block body
 * with semicolons on `.tsx`.
 */
const itemSetup = (
	stmts: string[],
	body: string,
	options: {
		tsx?: string
		params?: string
		pre?: string[]
		setup?: string
	} = {},
): Spec => ({
	pre: imports('createList', ...(options.pre ?? [])),
	...(options.params ? { params: options.params } : {}),
	setup: `${LIST}${options.setup ? `\n\t\t${options.setup}` : ''}`,
	body: `<ul data-container>@for (const item of items; key k) { ${stmts.join('\n')}\n${body} }</ul>`,
	tsx: `<ul data-container>{items.map((item, k) => { ${stmts.map(stmt => `${stmt};`).join(' ')} return ${options.tsx ?? body} })}</ul>`,
})

/** The covered-text pair of a statement refused on both surfaces. */
const stmtSpan = (stmt: string): [string, string] => [stmt, `${stmt};`]

/**
 * Per-item setup (ADR 0046 s5, LT-426): the component-setup rules with the
 * item and key known, run in both phases — what one phase lacks is refused.
 */
const ITEM_SETUP: Case[] = [
	{
		name: 'a per-item const reading a server arg',
		code: 'LTC005',
		spans: [stmtSpan('const tag = `${label}-${k}`')],
		spec: itemSetup(
			['const tag = `${label}-${k}`'],
			'<li id={tag}>{item}</li>',
			{
				params: '{ label }: { label: string }',
			},
		),
		pins: ["which the item's client mount does not have"],
	},
	{
		name: 'a per-item const reading `host`',
		code: 'LTC005',
		spans: [stmtSpan('const t = host.title')],
		spec: itemSetup(['const t = host.title'], '<li>{item}</li>'),
		pins: ['which the server render does not have'],
	},
	{
		name: 'a per-item derived signal whose compute reads a ref',
		code: 'LTC005',
		spans: [stmtSpan('const w = createMemo(() => row.title)')],
		spec: itemSetup(
			["const row = first('li')", 'const w = createMemo(() => row.title)'],
			'<li>{item}</li>',
			{ pre: ['createMemo'] },
		),
		pins: ['The per-item signal `w`', 'a `createSensor()` start callback'],
	},
	{
		name: 'a per-item createSensor without a seed',
		code: 'LTC005',
		spans: [stmtSpan('const s = createSensor<boolean>(set => () => {})')],
		spec: itemSetup(
			['const s = createSensor<boolean>(set => () => {})'],
			'<li>{item}</li>',
			{ pre: ['createSensor'] },
		),
		pins: [
			'A per-item `createSensor()` without a server-known `{ value }` seed',
		],
	},
	{
		name: '`expose()` in an item',
		code: 'LTC005',
		spans: [stmtSpan('expose({})')],
		spec: itemSetup(['expose({})'], '<li>{item}</li>'),
		pins: ["`expose()` in a reactive-list item's setup"],
	},
	{
		name: '`requestContext()` in an item',
		code: 'LTC005',
		spans: [stmtSpan("const c = requestContext('x', 0)")],
		spec: itemSetup(["const c = requestContext('x', 0)"], '<li>{item}</li>'),
		pins: ["`requestContext()` in a reactive-list item's setup"],
	},
	{
		name: 'a `let` in an item',
		code: 'LTC005',
		spans: [stmtSpan('let n = 1')],
		spec: itemSetup(['let n = 1'], '<li>{item}</li>'),
		pins: ['A setup declaration other than a single initialized `const`'],
	},
	{
		name: 'a statement outside the setup rules, refused with component setup’s message',
		code: 'LTC005',
		spans: [['if (k) {}', 'if (k) {}']],
		spec: {
			...itemSetup([], '<li>{item}</li>'),
			body: '<ul data-container>@for (const item of items; key k) { if (k) {}\n<li>{item}</li> }</ul>',
			tsx: '<ul data-container>{items.map((item, k) => { if (k) {} return <li>{item}</li> })}</ul>',
		},
		pins: [
			'A setup statement other than a `const` declaration, `expose()` or a client-only side effect',
		],
	},
	{
		name: 'a per-item `first()` into a nested arm',
		code: 'LTC005',
		spans: [["first('b')", "first('b')"]],
		spec: itemSetup(
			["const b = first('b')"],
			'<li><span>{item}</span>@if (open.get()) { <b>x</b> }</li>',
			{
				pre: ['createCell'],
				setup: cell('open', 'false'),
				tsx: '<li><span>{item}</span>{open.get() ? <b>x</b> : null}</li>',
			},
		),
		pins: ['inside a nested arm or list item'],
	},
	{
		name: 'a per-item `first()` matching nothing',
		code: 'LTC026',
		spans: [["first('em', 'needed')", "first('em', 'needed')"]],
		spec: itemSetup(["const e = first('em', 'needed')"], '<li>{item}</li>'),
	},
	{
		name: 'an attribute over an item const mixed with a server arg',
		code: 'LTC005',
		spans: [same('`${tag}${label}`')],
		spec: itemSetup(
			['const tag = `t-${k}`'],
			'<li title={`${tag}${label}`}>{item}</li>',
			{
				params: '{ label }: { label: string }',
			},
		),
		pins: [
			"reading the item's `tag` together with `label`",
			"An attribute over the item's consts alone (`title={tag}`)",
		],
	},
	{
		name: 'a non-arrow text child over an item const',
		code: 'LTC005',
		spans: [same('{tag}')],
		spec: itemSetup(['const tag = `t-${k}`'], '<li>{tag}</li>'),
		pins: ["The item's setup names are per-item"],
	},
	{
		name: 'a per-item signal in a non-arrow attribute',
		code: 'LTC005',
		spans: [same('loud')],
		spec: itemSetup(
			['const loud = createMemo(() => item.get().toUpperCase())'],
			'<li title={loud}>{item}</li>',
			{ pre: ['createMemo'] },
		),
		pins: ['reading `loud`, which is a signal, not a value'],
	},
]

/* === Tests === */

const sourcesOf = (c: Case) =>
	c.sources ?? {
		tsrx: tsrxSource(c.spec as Spec),
		tsx: tsxSource(c.spec as Spec),
	}

const compileBoth = (c: Case) => {
	const sources = sourcesOf(c)
	return {
		tsrx: compileComponent(sources.tsrx, 'c.tsrx', new Set()).diagnostics,
		tsx: compileComponentTsx(sources.tsx, 'c.tsx', new Set()).diagnostics,
	}
}

const runCases = (cases: Case[]) =>
	test.each(cases.map(c => [c.name, c] as const))('%s', (_, c) => {
		const { tsrx, tsx } = compileBoth(c)
		const sources = sourcesOf(c)
		const usedSpans = new Set<[string, string]>()
		expect(tsrx.map(d => d.code)).toContain(c.code)
		expect(tsx.map(d => d.code)).toContain(c.code)
		expect(shape(tsx, 'tsx', 'c.tsx', sources.tsx, c.spans, usedSpans)).toEqual(
			shape(tsrx, 'tsrx', 'c.tsrx', sources.tsrx),
		)
		expect((c.spans ?? []).filter(pair => !usedSpans.has(pair))).toEqual([])
		expect(leaks(tsx)).toEqual([])
		for (const d of [...tsrx, ...tsx]) {
			for (const bad of c.forbid ?? []) expect(d.message).not.toContain(bad)
		}
		for (const pin of c.pins ?? []) {
			expect(tsrx.some(d => d.message.includes(pin))).toBe(true)
			expect(tsx.some(d => d.message.includes(pin))).toBe(true)
		}
	})

describe('diagnostic parity — the §2.3 drift shapes (negative pins)', () => {
	runCases(REVIEW_SHAPES)
})

describe('diagnostic parity — reactive-list bodies', () => {
	runCases(LIST_BODY)
	// The slot-fill refusals ADR 0046 s1 retires (LT-423): server-known
	// content (impure included), a body that renders the item nowhere, a
	// server condition in the item, and the item signal read in arrows all
	// compile on both surfaces now — the item is a Mount Scope, and the
	// shared machinery owns every remaining shape error.
	test.each([
		[
			'<li title={label}>{item}</li>',
			'<li title={label}>{item}</li>',
			'{ label }: { label: string }',
		],
		['<li>static</li>', '<li>static</li>', '{}: {}'],
		[
			'<li><span>{item}</span>@if (ok) { <b>{label}</b> }</li>',
			'<li><span>{item}</span>{ok ? <b>{label}</b> : null}</li>',
			'{ ok, label }: { ok: boolean; label: string }',
		],
	])('compiles on both surfaces (LT-423): %s', (tsrxBody, tsxBody, params) => {
		const { tsrx, tsx } = compileBoth({
			name: 'clean',
			code: 'LTC005',
			spec: list(tsrxBody, tsxBody, params),
		})
		for (const diagnostics of [tsrx, tsx])
			expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})
	test.each([
		[
			'<li class={() => item.get()} onClick={() => console.log(item.get())}>{item}</li>',
		],
	])('the item signal binds in arrows on both surfaces (LT-423): %s', body => {
		const { tsrx, tsx } = compileBoth({
			name: 'clean',
			code: 'LTC005',
			spec: list(...same(body)),
		})
		for (const diagnostics of [tsrx, tsx])
			expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})
})

describe('an authored <template> beside a reactive list (LT-383)', () => {
	test('reports LTC061 once, not LTC061 plus the old LTC007 collision', () => {
		const { tsrx, tsx } = compileBoth({
			name: 'template beside list',
			code: 'LTC061',
			spec: {
				...list(...same('<li>{item}</li>')),
				body: '<div><template><p>x</p></template><ul data-container>@for (const item of items) { <li>{item}</li> }</ul></div>',
				tsx: '<div><template><p>x</p></template><ul data-container>{items.map(item => <li>{item}</li>)}</ul></div>',
			},
		})
		for (const diagnostics of [tsrx, tsx]) {
			const errors = diagnostics.filter(d => d.severity === 'error')
			expect(errors.map(d => d.code)).toEqual(['LTC061'])
		}
	})
})

describe('reactive-list bodies: the positive rule admits client names (LT-349)', () => {
	test.each([
		['<li onClick={() => clearTimeout(0)}>{item}</li>'],
		['<li onClick={() => { items.remove(0); host.focus() }}>{item}</li>'],
	])('%s compiles clean', body => {
		const { tsrx, tsx } = compileBoth({
			name: 'clean',
			code: 'LTC005',
			spec: list(...same(body)),
		})
		expect([...tsrx, ...tsx].filter(d => d.severity === 'error')).toEqual([])
	})
})

describe('diagnostic parity — conditions (LTC005 condition face, ADR 0037 rider)', () => {
	runCases(CONDITIONS)
	test.each(REACTIVE_CONDITIONS.map(spec => [spec.body, spec] as const))(
		'compiles on both surfaces (ADR 0037): %s',
		(_, spec) => {
			const { tsrx, tsx } = compileBoth({ name: 'clean', code: 'LTC005', spec })
			for (const diagnostics of [tsrx, tsx])
				expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		},
	)
})

describe('diagnostic parity — server-only names in client positions (LT-347, LT-348)', () => {
	runCases(SERVER_ONLY)
	// The false positives LT-347's allowlist produced (LT-348): browser
	// globals outside `JS_GLOBALS` in handlers and maps, FactoryContext
	// primitives, and an array-destructured callback parameter (the `.tsx`
	// converter emitted its element as a shorthand Property, leaving the
	// name free).
	test.each([
		["<button onClick={() => { clearTimeout(1); fetch('/x') }}>x</button>"],
		['<button onClick={() => getComputedStyle(host)}>x</button>'],
		["<span class={() => ({ a: matchMedia('(x)').matches })}>x</span>"],
	])('browser globals stay clean: %s', body => {
		const { tsrx, tsx } = compileBoth({
			name: 'clean',
			code: 'LTC005',
			spec: { body },
		})
		expect([...tsrx, ...tsx].filter(d => d.code === 'LTC005')).toEqual([])
	})
	test('client names in those positions stay clean', () => {
		const { tsrx, tsx } = compileBoth({
			name: 'clean',
			code: 'LTC005',
			spec: {
				params: LABEL,
				setup:
					"const narrow = (el: Element) => matchMedia('(x)').matches && el",
				body: "<button onClick={() => [[host]].forEach(([label]) => { all('button'); narrow(label) })}>{label}</button>",
			},
		})
		expect([...tsrx, ...tsx].filter(d => d.code === 'LTC005')).toEqual([])
	})
})

describe('diagnostic parity — one sample per family', () => {
	runCases(FAMILIES)
})

describe('the keyed `map` (ADR 0046 s4, LT-425)', () => {
	// A `server` attribute over the key binding alone is a key-derived
	// attribute — set once at clone, baked empty in the extracted template.
	test('a key-derived attribute compiles on both surfaces, set once at clone', () => {
		const { component: tsrx, diagnostics: tsrxDiagnostics } = compileComponent(
			tsrxSource({
				pre: imports('createList'),
				setup: LIST,
				body: '<ul data-container>@for (const item of items; key k) { <li id={k}><label for={k}>{item}</label></li> }</ul>',
			}),
			'c.tsrx',
			new Set(),
		)
		const { component: tsx, diagnostics: tsxDiagnostics } = compileComponentTsx(
			tsxSource({
				pre: imports('createList'),
				setup: LIST,
				body: '<ul data-container>{items.map((item, k) => <li id={k}><label for={k}>{item}</label></li>)}</ul>',
			}),
			'c.tsx',
			new Set(),
		)
		expect(tsrxDiagnostics).toEqual([])
		expect(tsxDiagnostics).toEqual([])
		for (const component of [tsrx, tsx]) {
			expect(component?.clientCode).toContain(".setAttribute('id', k)")
			expect(component?.clientCode).toContain(".setAttribute('for', k)")
			expect(component?.serverCode).toContain('<template data-list="0">')
		}
		expect(tsx?.clientCode).toBe(tsrx?.clientCode.replace('c.tsrx', 'c.tsx'))
		expect(tsx?.serverCode).toBe(tsrx?.serverCode.replace('c.tsrx', 'c.tsx'))
	})

	test('the key reaches an item handler (`items.remove(k)`)', () => {
		const { component, diagnostics } = compileComponentTsx(
			tsxSource({
				pre: imports('createList'),
				setup: LIST,
				body: '<ul data-container>{items.map((item, k) => <li><button onClick={() => items.remove(k)}>{item}</button></li>)}</ul>',
			}),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain('(_element, item, k, first) =>')
		expect(component?.clientCode).toContain('() => items.remove(k)')
	})

	test('over an Array the second parameter stays the index', () => {
		const { component, diagnostics } = compileComponentTsx(
			tsxSource({
				params: '{ names }: { names: string[] }',
				body: '<ul>{names.map((n, i) => <li data-i={i}>{n}</li>)}</ul>',
			}),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.serverCode).not.toContain('<template data-list')
	})

	test('a `deriveList` is a list source, keyed by its own keyConfig on both sides', () => {
		const { component, diagnostics } = compileComponentTsx(
			tsxSource({
				pre: imports('createList', 'deriveList'),
				setup: `${LIST}
	const upper = deriveList(() => items.get().map(s => s.toUpperCase()), { keyConfig: 'u' })`,
				body: '<ul data-container>{upper.map((item, k) => <li id={k}>{item}</li>)}</ul>',
			}),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		const declaration =
			"const upper = deriveList(() => items.get().map(s => s.toUpperCase()), { keyConfig: 'u' })"
		expect(component?.clientCode).toContain(declaration)
		expect(component?.serverCode).toContain(declaration)
		expect(component?.clientCode).toContain('reconcile(container,')
		expect(component?.serverCode).toContain('of upper.entries()')
	})

	test('a `.map()` callback over a List takes `(item, key)` at most', () => {
		const { diagnostics } = compileComponentTsx(
			tsxSource({
				pre: imports('createList'),
				setup: LIST,
				body: '<ul data-container>{items.map((item, k, x) => <li>{item}</li>)}</ul>',
			}),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC005'])
		expect(diagnostics[0]?.message).toContain('passes `(item, key)`')
	})
})

describe('grammar asymmetry — shapes with no counterpart', () => {
	/** A `.tsx` component whose root's `<style>` child is `style`. */
	const styled = (style: string, pre = '', setup = '') =>
		`${pre}
export function C({}: {}) {
	${setup}
	return <c-el><p>x</p>${style}</c-el>
}`
	const MACROS = "import { css } from '@zeix/le-truc-compiler/macros'"
	const ltc078 = (source: string) =>
		compileComponentTsx(source, 'c.tsx', new Set())
			.diagnostics.filter(d => d.code === 'LTC078')
			.map(d => [source.slice(d.location.start, d.location.end), d.message])

	// LT-444: the `.tsx` template-literal shapes `.tsrx` has no spelling for.
	// Each read as an empty sheet before, shipping no CSS without a word.
	test.each([
		[
			'a `css` a component-scope declaration shadows',
			styled(
				'<style>{css`p { color: red }`}</style>',
				MACROS,
				"const css = (s: TemplateStringsArray) => s.join('')",
			),
			'css',
			'a declaration in the component shadows that import',
		],
		[
			"another module's `css`",
			styled(
				'<style>{css`p { color: red }`}</style>',
				"import { css } from 'lit'",
			),
			'css',
			'is not the `css` marker',
		],
		[
			'a foreign tag',
			styled('<style>{scss`p { color: red }`}</style>', MACROS),
			'scss',
			'is tagged `scss`, not the `css` marker',
		],
		[
			'a substitution in the `css` template',
			styled(
				'<style>{css`p { color: ${tone} }`}</style>',
				MACROS,
				"const tone = 'red'",
			),
			'tone',
			'contains a `${}` substitution',
		],
		[
			'a substitution in a bare template literal',
			styled(
				'<style>{`p { color: ${tone} }`}</style>',
				'',
				"const tone = 'red'",
			),
			'tone',
			'contains a `${}` substitution',
		],
		[
			'JSX text in place of the template',
			styled('<style>p</style>', MACROS),
			'p',
			'is not a stylesheet',
		],
		[
			'a second expression after the template',
			styled(
				'<style>{css`p { color: red }`}{css`a { color: red }`}</style>',
				MACROS,
			),
			'{css`a { color: red }`}',
			'is not a stylesheet',
		],
	])('.tsx: LTC078 refuses %s', (_, source, covered, pin) => {
		const found = ltc078(source)
		expect(found).toHaveLength(1)
		expect(found[0]?.[0]).toBe(covered)
		expect(found[0]?.[1]).toContain(pin)
	})

	test.each([
		[
			'the `css` marker under an alias',
			styled(
				'<style>{style`p { color: red }`}</style>',
				"import { css as style } from '@zeix/le-truc-compiler/macros'",
			),
		],
		['a bare template literal', styled('<style>{`p { color: red }`}</style>')],
		['an empty block', styled('<style></style>')],
		['an empty container', styled('<style>{/* none yet */}</style>')],
		[
			'blank text around the template',
			styled('<style>\n\t{css`p { color: red }`}\n</style>', MACROS),
		],
	])('.tsx: %s is a stylesheet spelling', (_, source) => {
		const { diagnostics, component } = compileComponentTsx(
			source,
			'c.tsx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		// The sheet is read, not dropped: an authored rule reaches the CSS.
		if (source.includes('color: red'))
			expect(component?.css).toContain('color: red')
	})

	test('.tsrx: a `${}` in the CSS body is CSS text, not a substitution — a value position fails the parse', () => {
		// The `.tsrx` body is parsed as CSS by `@tsrx/core`: it has no
		// substitution to refuse (LT-444 item 2).
		const { diagnostics } = compileComponent(
			`export function C({}: {})
	@{
		<c-el><p>x</p><style>p { color: \${tone} }</style></c-el>
	}`,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC008'])
	})

	test('.tsrx: an index binding over a List is LTC005 (the `.tsx` second parameter is the key)', () => {
		const { diagnostics } = compileComponent(
			tsrxSource({
				pre: imports('createList'),
				setup: LIST,
				body: '<ul>@for (const item of items; index i) { <li>{item}</li> }</ul>',
			}),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d =>
					d.code === 'LTC005' &&
					d.message.includes('An index binding in a reactive-list'),
			),
		).toBe(true)
	})
})

/* === Nested Mount Scopes (ADR 0046 s1–s2, LT-424) === */

const LISTS = `${LIST}\n\t\tconst others = createList<string>([], { keyConfig: 'x' })`

const NESTED_SCOPES: Case[] = [
	{
		name: 'a reactive list inside a server-data loop body',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			params: '{ rows }: { rows: string[] }',
			setup: LIST,
			body: '<div class="rows">@for (const row of rows) { <section><b>{row}</b><ul class="list">@for (const item of items) { <li>{item}</li> }</ul></section> }</div>',
			tsx: '<div class="rows">{rows.map(row => <section><b>{row}</b><ul class="list">{items.map(item => <li>{item}</li>)}</ul></section>)}</div>',
		},
		pins: ['inside a server-data'],
	},
	{
		// A nested container may not exist at connect, so no harvest reads it.
		name: 'an arg-seeded list nested in an arm',
		code: 'LTC005',
		spec: {
			pre: imports('createCell', 'createList'),
			params: '{ seed }: { seed: string[] }',
			setup: `const items = createList<string>(seed, { keyConfig: 'item' })\n\t\t${cell('open', 'true')}`,
			body: '<div class="box">@if (open.get()) { <section><ul class="list">@for (const item of items) { <li>{item}</li> }</ul></section> }</div>',
			tsx: '<div class="box">{open.get() ? <section><ul class="list">{items.map(item => <li>{item}</li>)}</ul></section> : null}</div>',
		},
		pins: ['nested in an arm or a list item', 'seed the list with a literal'],
	},
	{
		// Neither a class nor a child path tells the two spans apart, and
		// each must match nothing in the nested items' content.
		name: 'LTC007 an element no selector separates from a nested scope',
		code: 'LTC007',
		spec: {
			pre: imports('createList'),
			setup: LISTS,
			body: '<ul data-container>@for (const item of items) { <li><b><span>{item}</span></b><b><span>{() => item.get()}</span></b><ol class="x">@for (const x of others) { <li><b><span>{x}</span></b></li> }</ol></li> }</ul>',
			tsx: '<ul data-container>{items.map(item => <li><b><span>{item}</span></b><b><span>{() => item.get()}</span></b><ol class="x">{others.map(x => <li><b><span>{x}</span></b></li>)}</ol></li>)}</ul>',
		},
		pins: ['Give it a unique `class`'],
	},
]

describe('diagnostic parity — nested Mount Scopes (LT-424)', () => {
	runCases(NESTED_SCOPES)
	// The refusals ADR 0046 s1 lifts: arm sets and lists inside arms and
	// items, server-data loops and async boundaries inside items — and, with
	// the list template hoisted to the host's end (ADR 0046 s2, LT-454), a
	// list whose container is the arm or item root.
	test.each([
		[
			'a reactive list directly under an arm root',
			{
				pre: imports('createCell', 'createList'),
				setup: `${LIST}\n\t\t${cell('open', 'true')}`,
				body: '<div class="box">@if (open.get()) { <ul class="list">@for (const item of items) { <li>{item}</li> }</ul> }</div>',
				tsx: '<div class="box">{open.get() ? <ul class="list">{items.map(item => <li>{item}</li>)}</ul> : null}</div>',
			},
		],
		[
			'a reactive list directly under a list item root',
			{
				pre: imports('createList'),
				setup: LISTS,
				body: '<table class="grid">@for (const item of items; key k) { <tbody>@for (const x of others) { <tr><td>{x}</td></tr> }</tbody> }</table>',
				tsx: '<table class="grid">{items.map((item, k) => <tbody>{others.map(x => <tr><td>{x}</td></tr>)}</tbody>)}</table>',
			},
		],
		[
			'an arm set inside a list item',
			{
				pre: imports('createCell', 'createList'),
				setup: `${LIST}\n\t\t${cell('open', 'false')}`,
				body: '<ul data-container>@for (const item of items) { <li><span>{item}</span>@if (open.get()) { <b>x</b> }</li> }</ul>',
				tsx: '<ul data-container>{items.map(item => <li><span>{item}</span>{open.get() ? <b>x</b> : null}</li>)}</ul>',
			},
		],
		[
			'a reactive list inside a list item',
			{
				pre: imports('createList'),
				setup: LISTS,
				body: '<ul data-container>@for (const item of items; key k) { <li><span>{item}</span><ol class="x">@for (const x of others) { <li>{x}</li> }</ol></li> }</ul>',
				tsx: '<ul data-container>{items.map((item, k) => <li><span>{item}</span><ol class="x">{others.map(x => <li>{x}</li>)}</ol></li>)}</ul>',
			},
		],
		[
			'a server-data loop inside a list item',
			{
				pre: imports('createList'),
				params: '{ tags }: { tags: string[] }',
				setup: LIST,
				body: '<ul data-container>@for (const item of items) { <li><span>{item}</span><nav>@for (const tag of tags) { <button type="button" onClick={() => items.remove(0)}>{tag}</button> }</nav></li> }</ul>',
				tsx: '<ul data-container>{items.map(item => <li><span>{item}</span><nav>{tags.map(tag => <button type="button" onClick={() => items.remove(0)}>{tag}</button>)}</nav></li>)}</ul>',
			},
		],
		[
			'an async boundary inside a list item',
			{
				pre: imports('createList', 'deriveCell'),
				setup: `${LIST}\n\t\tconst data = deriveCell(async () => 'ok')`,
				body: '<ul data-container>@for (const item of items) { <li><span>{item}</span>@try { <b>{data}</b> } @pending { <i>…</i> } @catch (e) { <i>{e.message}</i> }</li> }</ul>',
				tsx: '<ul data-container>{items.map(item => <li><span>{item}</span><truc:try pending={<i>…</i>} catch={e => <i>{e.message}</i>}><b>{data}</b></truc:try></li>)}</ul>',
			},
		],
		[
			'a reactive list inside an arm',
			{
				pre: imports('createCell', 'createList'),
				setup: `${LIST}\n\t\t${cell('open', 'true')}`,
				body: '<div class="box">@if (open.get()) { <section><ul class="list">@for (const item of items) { <li>{item}</li> }</ul></section> }</div>',
				tsx: '<div class="box">{open.get() ? <section><ul class="list">{items.map(item => <li>{item}</li>)}</ul></section> : null}</div>',
			},
		],
		[
			'an arm set inside an arm',
			{
				pre: imports('createCell'),
				setup: `${cell('open', 'true')}\n\t\tconst more = createCell(false)`,
				body: '<div class="box">@if (open.get()) { <section>@if (more.get()) { <b>more</b> }</section> }</div>',
				tsx: '<div class="box">{open.get() ? <section>{more.get() ? <b>more</b> : null}</section> : null}</div>',
			},
		],
	] as const)('%s compiles on both surfaces', (_, spec) => {
		const { tsrx, tsx } = compileBoth({ name: 'clean', code: 'LTC005', spec })
		for (const diagnostics of [tsrx, tsx])
			expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})
})

describe('diagnostic parity — per-item setup (LT-426)', () => {
	runCases(ITEM_SETUP)
	// What ADR 0046 s5 admits: a key-derived const, a per-item memo, a
	// `first()` naming the item root, a seeded sensor, a client-only side
	// effect, a function const as an event handler.
	test.each([
		[
			'a key-derived const',
			itemSetup(['const id = `opt-${k}`'], '<li id={id}>{item}</li>'),
		],
		[
			'a per-item memo, read in an arrow and a condition',
			itemSetup(
				['const loud = createMemo(() => item.get().toUpperCase())'],
				"<li title={() => loud.get()}><span>{item}</span>@if (loud.get() === 'A') { <b>a</b> }</li>",
				{
					pre: ['createMemo'],
					tsx: "<li title={() => loud.get()}><span>{item}</span>{loud.get() === 'A' ? <b>a</b> : null}</li>",
				},
			),
		],
		[
			'a root ref and a client-only side effect',
			itemSetup(
				["const row = first('li')", 'watch(item, v => { row.title = v })'],
				'<li>{item}</li>',
			),
		],
		[
			'a seeded sensor whose start reads the root ref',
			itemSetup(
				[
					"const row = first('li')",
					"const hot = createSensor<boolean>(set => { const on = () => set(true); row.addEventListener('pointerenter', on); return () => row.removeEventListener('pointerenter', on) }, { value: false })",
				],
				"<li class={() => (hot.get() ? 'hot' : null)}>{item}</li>",
				{ pre: ['createSensor'] },
			),
		],
		[
			'a function const as an event handler',
			itemSetup(
				['const remove = () => items.remove(k)'],
				'<li><span>{item}</span><button type="button" onClick={remove}>x</button></li>',
			),
		],
	] as const)('%s compiles on both surfaces', (_, spec) => {
		const { tsrx, tsx } = compileBoth({ name: 'clean', code: 'LTC005', spec })
		for (const diagnostics of [tsrx, tsx])
			expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})
})

describe('the allowlist stays minimal', () => {
	test('every entry is exercised by some case (stale entries fail)', () => {
		const stale = SURFACE_VOCABULARY.filter(entry => !used.has(entry)).map(
			entry => entry.tsrx,
		)
		expect(stale).toEqual([])
	})
})
