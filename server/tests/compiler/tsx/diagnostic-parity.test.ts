/**
 * Cross-surface DIAGNOSTIC parity (LT-242; the ADR 0032 s6 equivalence
 * contract, amended: both surfaces render identically AND diagnose
 * identically).
 *
 * `parity.test.ts` proves successful compiles agree. Every drift COMPILER_
 * REVIEW §2.3 found lived on the failure path instead, where it could not
 * look: the `.tsx` `offenders` truthiness bug (fixed LT-221), the
 * `.tsrx`-only `keyName` arm (ruled grammar asymmetry, LT-221) and the
 * per-item `ref` message. A user of either surface must get the same code
 * and the same sentence for the same invalid component — otherwise one
 * surface teaches its users something the other never hears.
 *
 * Each case authors ONE invalid component in both surfaces, compiles both
 * front ends, and asserts equal `[code, severity, message]` lists after the
 * `.tsx` messages are TRANSLATED into `.tsrx` spelling. Translation is two
 * things only:
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
 * Line numbers are not compared: the two spellings lay out differently.
 * Each case also asserts its `code` is present on both sides, so a fixture
 * that stops triggering its family fails instead of passing vacuously.
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
	term('listControlFlow', 'control flow inside a list body'),
	term(
		'loopBindings',
		'the names a list loop binds (`.tsx` has no key binding)',
	),
	term('listHandlerNames', 'what a list item handler may read'),
	term('listItemHandlerFix', 'acting on an item (`.tsx` has no key binding)'),
	term('loopBodyStatements', 'statements in a server-data loop body'),
	framed('loop', l => `reactive-list ${l}`, 'the list loop'),
	framed('loop', l => `${l} over`, 'a loop over its iterable'),
	framed('loop', l => `${l} bodies`, 'loop bodies'),
	term('aLoop', 'a loop, sentence-initial'),
	term('emptyArmFix', 'the empty arm as a fix-it'),
	term('emptyArm', 'the empty arm'),
	term('ifCondition', 'a conditional test'),
	term('switchDiscriminant', 'a switch discriminant'),
	framed('if', i => `the same ${i}`, 'one conditional'),
	term('ifBranches', 'conditional branches'),
	term('switchArms', 'switch arms'),
	term('tryBody', 'the boundary body'),
	term('pendingArm', 'the pending arm'),
	term('catchArm', 'the catch arm'),
	term('conditionalTag', 'choosing between static tags (LTC053 fix-it)'),
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

const shape = (
	diagnostics: CompileDiagnostic[],
	surface: 'tsrx' | 'tsx',
	file: string,
): string[] =>
	diagnostics.map(
		d => `${d.code} ${d.severity}: ${normalize(d.message, surface, file)}`,
	)

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
		<>
			<c-el>${body}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

const tsxSource = ({
	pre = '',
	params = '{}: {}',
	setup = '',
	body,
	tsx,
}: Spec) =>
	`${pre}
export function C(${params}) {
	${setup}
	return (
		<>
			<c-el>${tsx ?? body}</c-el>
			<style>{css\`c-el { color: red }\`}</style>
		</>
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
const REVIEW_SHAPES: Case[] = [
	{
		name: '§1.1 offenders: an impure attribute with no offending name',
		code: 'LTC005',
		spec: list(...same('<li title={String(Math.random())}>{item}</li>')),
		pins: ['reads impure ambient state'],
		forbid: ['reads ,'],
	},
	{
		name: '§1.1 offenders: a named offender in a list-body attribute',
		code: 'LTC005',
		spec: list(...same('<li title={label}>{item}</li>')),
		pins: ['reads label, which derive per item or client-side'],
	},
	{
		name: '§2.3 keyName: a loop variable named `first`',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul data-container>@for (const first of items) { <li>{first}</li> }</ul>',
			tsx: '<ul data-container>{items.map(first => <li>{first}</li>)}</ul>',
		},
		pins: ['reserved parameters of reconcile() bindItem'],
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
		name: 'missing item hole',
		code: 'LTC005',
		spec: list(...same('<li>static</li>')),
		pins: ['(found 0)'],
	},
	{
		name: 'a lazy child other than the item',
		code: 'LTC005',
		spec: list(...same('<li>{item}{() => item}</li>')),
	},
	{
		name: 'control flow inside the body',
		code: 'LTC005',
		spec: list(
			'<li>{item}@if (ok) { <b>x</b> }</li>',
			'<li>{item}{ok ? <b>x</b> : null}</li>',
			'{ ok }: { ok: boolean }',
		),
	},
	{
		name: 'a handler reading the loop item',
		code: 'LTC005',
		spec: list(...same('<li onClick={() => items.remove(item)}>{item}</li>')),
	},
	{
		name: 'an index binding',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: '<ul>@for (const item of items; index i) { <li>{item}</li> }</ul>',
			tsx: '<ul>{items.map((item, i) => <li>{item}</li>)}</ul>',
		},
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
		// LT-233: the `.tsx` list body used to keep only its `return` and
		// drop every other statement silently; one shared body walk now
		// rejects a hoisted const on both surfaces.
		name: 'a hoisted const in a reactive-list body',
		code: 'LTC005',
		spec: {
			pre: imports('createList'),
			setup: LIST,
			body: "<ul data-container>@for (const item of items) { const label = 'x'\n<li>{item}</li> }</ul>",
			tsx: "<ul data-container>{items.map(item => { const label = 'x'; return <li>{item}</li> })}</ul>",
		},
		pins: ['Hoisted consts inside a reactive-list'],
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
		spec: {
			params: '{ rows }: { rows: string[] }',
			body: '<ul>@for (const r of rows) { let x = r\n<li>{r}</li> }</ul>',
			tsx: '<ul>{rows.map(r => { let x = r; return <li>{r}</li> })}</ul>',
		},
	},
	{
		name: 'a statement other than a const in a server-data loop body',
		code: 'LTC005',
		spec: {
			params: '{ rows }: { rows: string[] }',
			body: '<ul>@for (const r of rows) { console.log(r)\n<li>{r}</li> }</ul>',
			tsx: '<ul>{rows.map(r => { console.log(r); return <li>{r}</li> })}</ul>',
		},
	},
]

/**
 * Condition validation — the LTC005 condition face ADR 0037 retires
 * (LT-274–LT-276). Pinned identical on both surfaces now, so the ADR 0037
 * codes that replace it inherit parity from day one: when they land, these
 * cases flip to the new codes on both sides at once or fail here.
 */
const CONDITIONS: Case[] = [
	{
		name: 'a signal read in an if condition',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			setup: cell('open', 'false'),
			body: '@if (open.get()) { <p>x</p> }',
			tsx: '{open.get() ? <p>x</p> : null}',
		},
		pins: ['the DOM keeps the initially rendered branch'],
	},
	{
		name: 'a bare signal as an if condition',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			setup: cell('open', 'false'),
			body: '@if (open) { <p>x</p> }',
			tsx: '{open ? <p>x</p> : null}',
		},
	},
	{
		name: 'a host read in an if condition',
		code: 'LTC005',
		spec: {
			pre: imports('asBoolean'),
			setup: 'expose({ open: asBoolean() })',
			body: '@if (host.open) { <p>x</p> }',
			tsx: '{host.open ? <p>x</p> : null}',
		},
	},
	{
		name: 'a signal read in a switch discriminant',
		code: 'LTC005',
		spec: {
			pre: imports('createCell'),
			setup: cell('m', "'a'"),
			body: "@switch (m.get()) { @case 'a': { <p>a</p> } @default: { <p>b</p> } }",
			tsx: "{(() => { switch (m.get()) { case 'a': return <p>a</p>; default: return <p>b</p> } })()}",
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
		spec: {
			pre: imports('deriveCell'),
			setup:
				"const data = deriveCell(async () => 'x')\n\t\texpose({ data: data.get })",
			body: '@try { <div class="ok">{data}</div> } @pending { <><p class="a">a</p><p class="b">b</p></> } @catch (e) { <p class="err">{e.message}</p> }',
			tsx: '<truc:try pending={<><p class="a">a</p><p class="b">b</p></>} catch={e => <p class="err">{e.message}</p>}><div class="ok">{data}</div></truc:try>',
		},
		pins: ['must render exactly one root element'],
	},
]

/** A sample of each remaining diagnostic family. */
const FAMILIES: Case[] = [
	{
		name: 'LTC006 React DOM-property name',
		code: 'LTC006',
		spec: { body: '<p className="x">x</p>' },
	},
	{
		name: 'LTC006 non-function event attribute',
		code: 'LTC006',
		spec: { body: '<p onClick="x()">x</p>' },
	},
	{
		name: 'LTC007 unaddressable async-boundary root',
		code: 'LTC007',
		spec: {
			pre: imports('deriveCell'),
			params: "{ aId = 'a' }: { aId?: string }",
			setup: "const d = deriveCell(async () => 'x')\n\t\texpose({ d: d.get })",
			body: '@try { <p id={aId}>{d}</p> } @pending { <p id={aId}>…</p> } @catch (e) { <p>{e.message}</p> }',
			tsx: '<truc:try pending={<p id={aId}>…</p>} catch={e => <p>{e.message}</p>}><p id={aId}>{d}</p></truc:try>',
		},
	},
	{
		name: 'LTC008 async component function',
		code: 'LTC008',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replace(
				'export function',
				'export async function',
			),
			tsx: tsxSource({ body: '<p>x</p>' }).replace(
				'export function',
				'export async function',
			),
		},
	},
	{
		name: 'LTC008 root is not the custom element',
		code: 'LTC008',
		sources: {
			tsrx: tsrxSource({ body: '<p>x</p>' }).replaceAll('c-el', 'div'),
			tsx: tsxSource({ body: '<p>x</p>' }).replaceAll('c-el', 'div'),
		},
	},
	{
		name: 'LTC008 two component functions',
		code: 'LTC008',
		sources: {
			tsrx: `${tsrxSource({ body: '<p>x</p>' })}\n${tsrxSource({ body: '<p>y</p>' }).replace('C(', 'D(').replaceAll('c-el', 'd-el')}`,
			tsx: `${tsxSource({ body: '<p>x</p>' })}\n${tsxSource({ body: '<p>y</p>' }).replace('C(', 'D(').replaceAll('c-el', 'd-el')}`,
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
]

/* === Tests === */

const compileBoth = (c: Case) => {
	const sources = c.sources ?? {
		tsrx: tsrxSource(c.spec as Spec),
		tsx: tsxSource(c.spec as Spec),
	}
	return {
		tsrx: compileComponent(sources.tsrx, 'c.tsrx', new Set()).diagnostics,
		tsx: compileComponentTsx(sources.tsx, 'c.tsx', new Set()).diagnostics,
	}
}

const runCases = (cases: Case[]) =>
	test.each(cases.map(c => [c.name, c] as const))('%s', (_, c) => {
		const { tsrx, tsx } = compileBoth(c)
		expect(tsrx.map(d => d.code)).toContain(c.code)
		expect(tsx.map(d => d.code)).toContain(c.code)
		expect(shape(tsx, 'tsx', 'c.tsx')).toEqual(shape(tsrx, 'tsrx', 'c.tsrx'))
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
})

describe('diagnostic parity — conditions (LTC005 condition face, ADR 0037 rider)', () => {
	runCases(CONDITIONS)
})

describe('diagnostic parity — one sample per family', () => {
	runCases(FAMILIES)
})

describe('grammar asymmetry — shapes with no counterpart', () => {
	test('.tsrx: a key binding named `first` is rejected (no `.tsx` spelling — the key comes from keyConfig)', () => {
		const { diagnostics } = compileComponent(
			tsrxSource({
				pre: imports('createList'),
				setup: LIST,
				body: '<ul data-container>@for (const item of items; key first) { <li>{item}</li> }</ul>',
			}),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d =>
					d.code === 'LTC005' &&
					d.message.includes('reserved parameters of reconcile() bindItem'),
			),
		).toBe(true)
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
