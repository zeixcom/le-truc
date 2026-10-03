/**
 * Client-module emitter (ADR 0024 milestone 2, LT-002).
 *
 * Renders the analysis plan into a `defineComponent()` factory whose
 * imports come solely from `@zeix/le-truc` (signal constructors via the CE
 * v2 bridge re-exported since 2.5.1) — the `.tsrx` source imports nothing.
 *
 * Factory layout, mirroring today's hand-written components:
 * 1. element queries (`first()`/`all()`, selectors synthesized and
 *    uniqueness-proven by analyze.ts)
 * 2. signal declarations seeded by DOM harvest (ADR 0003 — the client
 *    never sees the server args)
 * 3. `expose()` verbatim
 * 4. effects in document order: `each()` blocks for server-data `@for`
 *    (hoisted consts rebound first), then `watch()`/`on()`/`pass()`
 */

import type {
	ArmPlan,
	ArmsPlan,
	ClientPlan,
	ForClientPlan,
	ReconcilePlan,
	TopEffectPlan,
} from './analysis/plan'
import { sanitizeVarName } from './ast-utils'
import { CodeBuilder, isJsIdentifier, jsData, jsString } from './codegen'
import { carriedKinds, FORMATTING_KINDS, type Message } from './icu/evaluate'
import { clientSourceRecord } from './icu/parse'
import { computeClientNeededNames } from './imports'
import type { ComponentIR, InitSignalIR } from './ir'
import type { SourceSlice, SourceSpan } from './spans'
import {
	DIRTY_FLAG_ATTRS,
	type DirtyFlagControlTag,
	FACTORY_CONTEXT_MEMBERS,
} from './vocabulary'

/* === Types === */

export type EmittedClientModule = {
	/** Full TypeScript source of the generated module. */
	code: string
	/** `@zeix/le-truc` imports the module needs (sorted for emission). */
	imports: Set<string>
	/**
	 * Generated-file ↔ `.tsrx`-source span table (LT-011): one entry per
	 * verbatim setup statement, thunk, or event handler slice. `check:corpus`
	 * maps tsc diagnostics back through it onto the source location.
	 */
	spans: SourceSpan[]
}

/* === Internal Functions === */

/**
 * The lib.dom interface of each dirty-flag control tag (LT-116), so an
 * `each()` item's `querySelector<…>()` lets `bindProperty`'s keyed setter
 * typecheck. DOM knowledge is emitter business: the analysis only needs to
 * know WHICH tags carry the flag (`vocabulary.ts`), and the `Record` type
 * keeps this table exhaustive against that list. Compiler-side literal —
 * the compiler never imports lib.dom types, it only emits names the
 * generated client resolves.
 */
const DIRTY_FLAG_CONTROL_INTERFACES: ReadonlyMap<string, string> = new Map(
	Object.entries({
		input: 'HTMLInputElement',
		select: 'HTMLSelectElement',
		textarea: 'HTMLTextAreaElement',
		option: 'HTMLOptionElement',
	} satisfies Record<DirtyFlagControlTag, string>),
)

/**
 * The module's `@zeix/le-truc` names — imports and factory-context members
 * alike — with the local name each synthesized call site must use (LT-302).
 * An authored setup const, signal, query or loop variable named like a
 * name the emitter writes a call to (`const bindText = …`) would shadow it
 * inside the factory, so a colliding name is bound under a `__` alias
 * (`bindText as __bindText`, `{ first: __first }`) instead. Authored text
 * keeps its own spelling: inside the factory, the author's name already
 * refers to the author's binding. No collision, no alias — byte-identical.
 */
class ClientImports extends Set<string> {
	#scope: ReadonlySet<string> = new Set()
	/** Record the factory-scope names; call once, before any `use()`. */
	bindScope(scope: ReadonlySet<string>): void {
		this.#scope = scope
	}
	/** The local name for `name`: itself, or `__name` on a collision. */
	local(name: string): string {
		return this.#scope.has(name) ? `__${name}` : name
	}
	/** Add `name` and return its local name, for a synthesized call site. */
	use(name: string): string {
		this.add(name)
		return this.local(name)
	}
}

/** `name`, or `name as local` / `name: local` when aliased. */
const aliased = (name: string, local: string, separator: string): string =>
	local === name ? name : `${name}${separator}${local}`

/** `aria-selected` → `ariaSelected` (ARIA reflection property name). */
const ariaProperty = (attr: string): string | null =>
	attr.startsWith('aria-') ? sanitizeVarName(attr) : null

/**
 * Member access on a runtime object by a class/style map key (LT-221
 * §1.3). Identifier-safe keys keep today's dot bytes; everything else
 * (hyphenated class tokens can ONLY be written quoted) goes through
 * bracket access — `(thunk)()).has-error` parses as subtraction.
 */
const memberAccess = (object: string, key: string): string =>
	isJsIdentifier(key) ? `${object}.${key}` : `${object}[${jsString(key)}]`

const harvestInitializer = (
	plan: ClientPlan['harvests'][number],
	imports: ClientImports,
): string | null => {
	if (plan.kind === 'substitute') return plan.expr
	if (plan.kind === 'text') {
		const parser = imports.use(plan.parser)
		const read = `${plan.query}.textContent`
		return `${parser}()(${read})`
	}
	if (plan.kind === 'attr') {
		const parser = imports.use(plan.parser)
		// CHECKLIST §6 (BUG): `value`/`checked`/`selected` are dirty-flag
		// attributes — between server render and upgrade, the user can type,
		// or the browser can refill via session restore/password-manager
		// autofill/bfcache, so the LIVE IDL property may already differ from
		// the content attribute the server rendered. Reading the attribute
		// here would silently discard that pre-upgrade input the moment the
		// signal seeds itself. Every other attribute has no dirty flag — the
		// content attribute IS the current source of truth for those, so
		// `getAttribute` stays correct there.
		if (DIRTY_FLAG_ATTRS.has(plan.attr)) {
			const live = `${plan.query}.${plan.attr}`
			return `${parser}()(String(${live}))`
		}
		const raw = `${plan.query}.getAttribute(${jsString(plan.attr)})`
		return `${parser}()(${raw})`
	}
	// The list kind is emitted directly from its declaration (verbatim or
	// substituted seed) and never reaches this initializer path.
	if (plan.kind === 'list') return null
	// membership: find the marked element in the collection, read its value
	const markProp = ariaProperty(plan.markAttr)
	const predicate = markProp
		? `el => el.${markProp} === 'true'`
		: `el => el.getAttribute(${jsString(plan.markAttr)}) === 'true'`
	return `${plan.collection}.get().find(${predicate})?.getAttribute(${jsString(plan.valueAttr)}) ?? ${plan.default}`
}

/**
 * A reconciled List's declaration: the authored createList call with its
 * first argument (the seed) replaced by the DOM harvest when the seed is
 * arg-dependent — generics and keyConfig pass through verbatim, so the
 * client's key generation provably matches the server's data-key values.
 */
const listDeclaration = (
	signal: InitSignalIR,
	seed: { container: string; valueSelector: string },
): string | null => {
	const init = signal.init
	if (!init || typeof init.start !== 'number' || typeof init.end !== 'number')
		return null
	const relStart = init.start - signal.textStart
	const relEnd = init.end - signal.textStart
	// Only adopted items carry data-key — authored static siblings of the
	// @for output must not become phantom list items.
	const harvested =
		`[...${seed.container}.children].filter(el => el.hasAttribute('data-key')).map(el => ` +
		`el.querySelector(${jsString(seed.valueSelector)})?.textContent ?? '')`
	return signal.text.slice(0, relStart) + harvested + signal.text.slice(relEnd)
}

const sliceOf = (text: string, start: number | undefined): SourceSlice[] =>
	start === undefined ? [] : [{ text, start }]

const emitEachBlock = (
	plan: ForClientPlan,
	imports: ClientImports,
	out: CodeBuilder,
): void => {
	imports.add('each')
	out.open(`${imports.use('each')}(${plan.collection}, ${plan.itemParam} => {`)
	for (const rebinding of plan.rebindings)
		out.line(`const ${rebinding.name} = ${rebinding.expr}`)
	// LT-037: constructs on descendants of the loop's output root (rather
	// than the root itself) carry a `target` selector, resolved within the
	// item's own subtree. Query each distinct descendant once per item and
	// cache it under a generated local, so N constructs on the same nested
	// element (e.g. an <input>'s `checked` + `tabIndex` + `onChange`) share
	// one `querySelector` call instead of repeating it per construct.
	// LT-116: when the target's leading tag is a native form control, the
	// query emits with the tag's element interface as its type argument —
	// `querySelector` itself returns bare `Element`, and the dirty-flag
	// property dispatch below (`bindProperty(input, 'checked')`) needs the
	// precise key/value typing that interface carries. Sound by
	// construction: the selector is tag-leading for non-div tags (the
	// selector engine's clause form), so every match IS that interface.
	const taken = new Set<string>([
		plan.itemParam,
		...plan.rebindings.map(r => r.name),
	])
	const targetVars = new Map<string, string>()
	for (const effect of plan.effects) {
		if (effect.target === null || targetVars.has(effect.target)) continue
		const tagMatch = effect.target.match(/^[a-z][a-z0-9-]*/)
		const base = sanitizeVarName(tagMatch ? tagMatch[0] : 'el')
		let name = base
		let i = 1
		while (taken.has(name)) name = `${base}${++i}`
		taken.add(name)
		targetVars.set(effect.target, name)
		const tag = tagMatch?.[0] ?? ''
		const typeArg = DIRTY_FLAG_CONTROL_INTERFACES.get(tag)
		out.line(
			`const ${name} = ${plan.itemParam}.querySelector${typeArg ? `<${typeArg}>` : ''}(${jsString(effect.target)})!`,
		)
	}
	const targetOf = (target: string | null): string =>
		target === null
			? plan.itemParam
			: (targetVars.get(target) ?? plan.itemParam)
	for (const effect of plan.effects) {
		if (effect.kind === 'watch-attr') {
			imports.add('watch')
			const source = effect.coerceToString
				? `() => String((${effect.thunkText})())`
				: effect.thunkText
			if (effect.dispatch === 'property') {
				// LT-116: dirty-flag IDL attrs (and host-prop mirrors) write
				// the live property, not the attribute — the loop-body
				// counterpart of the top-level property dispatch.
				imports.add('bindProperty')
				out.line(
					`${imports.local('watch')}(${source}, ${imports.local('bindProperty')}(${targetOf(effect.target)}, ${jsString(effect.attr)}))`,
					sliceOf(effect.thunkText, effect.sourceStart),
				)
			} else {
				imports.add('bindAttribute')
				out.line(
					`${imports.local('watch')}(${source}, ${imports.local('bindAttribute')}(${targetOf(effect.target)}, ${jsString(effect.attr)}))`,
					sliceOf(effect.thunkText, effect.sourceStart),
				)
			}
		} else if (effect.kind === 'watch-class') {
			imports.add('watch')
			imports.add('bindClass')
			for (const key of effect.keys) {
				out.line(
					`${imports.local('watch')}(() => Boolean(${memberAccess(`((${effect.thunkText})())`, key)}), ${imports.local('bindClass')}(${targetOf(effect.target)}, ${jsString(key)}))`,
					sliceOf(effect.thunkText, effect.sourceStart),
				)
			}
		} else {
			imports.add('on')
			out.line(
				`${imports.local('on')}(${targetOf(effect.target)}, ${jsString(effect.event)}, ${effect.handlerText})`,
				sliceOf(effect.handlerText, effect.sourceStart),
			)
		}
	}
	out.close('})')
}

/**
 * One reactive-list @for → reconcile() (ADR 0017): bindItem fills the item's
 * value site reactively — `watch(item, bindText(hole))` updates on every
 * value change (bindItem runs once per entering element, so a one-shot read
 * would go stale on in-place updates) and is idempotent against
 * server-adopted content (setting textContent replaces the template's
 * `<slot>` in clones) — plus per-item event listeners through bindItem's
 * scoped `first` (correctness first — delegation is a later compiler
 * optimization).
 */
const emitReconcileBlock = (
	plan: ReconcilePlan,
	imports: ClientImports,
	out: CodeBuilder,
): void => {
	imports.add('reconcile')
	imports.add('watch')
	imports.add('bindText')
	const keyParam = plan.keyParam ?? '_key'
	out.open(
		`${imports.local('reconcile')}(${plan.container}, ${plan.template}, ${plan.signal}, (_element, ${plan.itemParam}, ${keyParam}, first) => {`,
	)
	out.line(
		`${imports.local('watch')}(${plan.itemParam}, ${imports.local('bindText')}(first(${jsString(plan.holeSelector)}, ${jsString(`${plan.tag}: ${plan.holeSelector} missing`)})))`,
	)
	for (const target of plan.itemEvents) {
		if (target.selector !== null)
			out.line(
				`const ${target.name} = first(${jsString(target.selector)}, ${jsString(target.message)})`,
			)
		for (const event of target.events) {
			imports.add('on')
			out.line(
				`${imports.local('on')}(${target.name}, ${jsString(event.event)}, ${event.handlerText})`,
				sliceOf(event.handlerText, event.sourceStart),
			)
		}
	}
	out.close('})')
	// The @empty arm on the toggle path (LT-212, ADR 0037 s5): the List's
	// `length` read subscribes, so each root shows exactly while it is empty.
	for (const query of plan.emptyQueries) {
		imports.add('bindVisible')
		out.line(
			`${imports.local('watch')}(() => ${plan.signal}.length === 0, ${imports.local('bindVisible')}(${query}))`,
		)
	}
}

/**
 * Every name the author binds in the factory scope, for the alias check in
 * {@link ClientImports}. `host`/`internals` are left out: the plan
 * addresses the root through the literal `host`, so an authored `host`
 * const is the author's own shadow, not a synthesized-site collision.
 */
const factoryScopeNames = (
	component: ComponentIR,
	plan: ClientPlan,
): Set<string> => {
	const names = new Set<string>()
	for (const stmt of [...component.setup, ...component.clientSetup])
		if (stmt.name) names.add(stmt.name)
	for (const signal of component.signals) names.add(signal.name)
	for (const query of plan.queries) names.add(query.name)
	for (const loop of component.fors.values()) {
		names.add(loop.itemName)
		if (loop.kind === 'each') {
			if (loop.indexName) names.add(loop.indexName)
			for (const hoisted of loop.hoisted) names.add(hoisted.name)
		}
	}
	names.delete('host')
	names.delete('internals')
	return names
}

/**
 * The client message preamble (ADR 0030 s9, LT-218): the factory's own `t`
 * for the keys client positions read. It is the source-locale record the
 * build parsed, merged under the per-instance `i18n` attribute the server
 * rendered, parsed once at connect. The server leaves out every key whose
 * form equals the source's, so a source-locale render and an instance
 * created outside a compiled parent carry no attribute and speak the
 * source record; a malformed one warns in DEV_MODE and falls back the
 * same way. No `@zeix/le-truc` export (ADR 0030 s8): the evaluator is
 * `icu/evaluate.ts`'s walk, inlined and narrowed to the node kinds these
 * keys' source patterns use, with one `Intl` formatter per node per
 * connection. The locale is the DOM's (ADR 0030 s6): the nearest `[lang]`,
 * read at the first format rather than at connect, so a locale the
 * component materializes onto its own root first counts, and fixed for
 * the connection.
 *
 * Narrowing reads the SOURCE patterns: the compiler sees no translation.
 * A translation that uses a construct its source does not (a `plural`
 * where the source interpolates) throws a private sentinel from the walk,
 * and that key's accessor formats its source message instead (LT-350,
 * owner ruling): the wrong language until the catalog is fixed, never
 * blank. The source parses with exactly the carried kinds, so the
 * fallback cannot throw again. LT-219's census reports such translations.
 */
const messagePreambleLines = (
	component: ComponentIR,
	keys: readonly string[],
): string[] => {
	const tName = component.messageTBindings?.[0]
	if (!tName || keys.length === 0) return []
	const { source, withArgs } = clientSourceRecord(component.i18nMessages, keys)
	const kinds = carriedKinds([...withArgs].map(key => source[key] as Message))
	const lines = [
		'// Client messages (ADR 0030 s9): the source-locale record, merged under',
		'// the server-rendered `i18n` attribute and fixed for the connection.',
		`const __i18nSource: Record<string, unknown> = ${jsData(source)}`,
		'let __i18nMessages = __i18nSource',
		"const __i18nAttribute = host.getAttribute('i18n')",
		'if (__i18nAttribute) {',
		'\ttry {',
		'\t\tconst parsed: unknown = JSON.parse(__i18nAttribute)',
		"\t\tif (parsed && typeof parsed === 'object')",
		'\t\t\t__i18nMessages = { ...__i18nSource, ...(parsed as Record<string, unknown>) }',
		'\t} catch (error) {',
		"\t\tif (process.env.DEV_MODE === 'true')",
		`\t\t\tconsole.warn(${jsString(`<${component.tag}>: the i18n attribute is not valid JSON, so the component shows its source-locale messages. Check the server render that wrote the attribute.`, 'double')}, error)`,
		'\t}',
		'}',
	]
	if (withArgs.size > 0) {
		const usesFormatter = [...kinds].some(k => FORMATTING_KINDS.has(k))
		lines.push(
			'type __I18nNode = string | { t: string; a: string; o?: unknown; s?: number; off?: number; c?: Record<string, __I18nNode[]> }',
		)
		if (usesFormatter)
			lines.push(
				'let __i18nLocale: string | undefined',
				"const __i18nLang = (): string | undefined => (__i18nLocale ??= (host.closest('[lang]') as HTMLElement | null)?.lang ?? '') || undefined",
				'const __i18nFormatters = new WeakMap<object, unknown>()',
				'const __i18nFormatter = <F>(node: object, make: () => F): F => {',
				'\tlet formatter = __i18nFormatters.get(node) as F | undefined',
				'\tif (!formatter) __i18nFormatters.set(node, (formatter = make()))',
				'\treturn formatter',
				'}',
			)
		const cases: string[] = []
		if (kinds.has('arg'))
			cases.push(
				"\t\t\tcase 'arg':",
				'\t\t\t\tout += String(value)',
				'\t\t\t\tbreak',
			)
		if (kinds.has('num'))
			cases.push(
				"\t\t\tcase 'num':",
				'\t\t\t\tout += __i18nFormatter(node, () => new Intl.NumberFormat(__i18nLang(), node.o as Intl.NumberFormatOptions)).format(Number(value) * (node.s ?? 1))',
				'\t\t\t\tbreak',
			)
		if (kinds.has('date'))
			cases.push(
				"\t\t\tcase 'date':",
				'\t\t\t\tout += __i18nFormatter(node, () => new Intl.DateTimeFormat(__i18nLang(), node.o as Intl.DateTimeFormatOptions)).format(new Date(value as number | Date))',
				'\t\t\t\tbreak',
			)
		if (kinds.has('#'))
			cases.push(
				"\t\t\tcase '#':",
				'\t\t\t\tout += __i18nFormatter(node, () => new Intl.NumberFormat(__i18nLang())).format(Number(value) - (node.off ?? 0))',
				'\t\t\t\tbreak',
			)
		if (kinds.has('plural') || kinds.has('select'))
			cases.push(
				...(kinds.has('plural') && kinds.has('select')
					? ["\t\t\tcase 'plural':", "\t\t\tcase 'select': {"]
					: [`\t\t\tcase '${kinds.has('plural') ? 'plural' : 'select'}': {`]),
				'\t\t\t\tconst c = node.c ?? {}',
				'\t\t\t\tconst own = (key: string) => (Object.hasOwn(c, key) ? c[key] : undefined)',
				...(kinds.has('plural')
					? [
							"\t\t\t\tconst body = node.t === 'plural'",
							'\t\t\t\t\t? (own(`=${Number(value)}`) ??',
							"\t\t\t\t\t\town(__i18nFormatter(node, () => new Intl.PluralRules(__i18nLang(), { type: node.o ? 'ordinal' : 'cardinal' })).select(Number(value) - (node.off ?? 0))) ??",
							'\t\t\t\t\t\tc.other)',
							'\t\t\t\t\t: (own(String(value)) ?? c.other)',
						]
					: ['\t\t\t\tconst body = own(String(value)) ?? c.other']),
				'\t\t\t\tif (body) out += __i18nFormat(body, args)',
				'\t\t\t\tbreak',
				'\t\t\t}',
			)
		// A kind the source does not carry: the accessor falls back (LT-350).
		cases.push('\t\t\tdefault:', '\t\t\t\tthrow __i18nUncarried')
		lines.push(
			'const __i18nUncarried = Symbol()',
			'const __i18nFormat = (message: __I18nNode[], args: Record<string, unknown>): string => {',
			"\tlet out = ''",
			'\tfor (const node of message) {',
			"\t\tif (typeof node === 'string') {",
			'\t\t\tout += node',
			'\t\t\tcontinue',
			'\t\t}',
			'\t\tconst value = args[node.a]',
			'\t\tswitch (node.t) {',
			...cases,
			'\t\t}',
			'\t}',
			'\treturn out',
			'}',
		)
	}
	lines.push(`const ${tName} = {`)
	for (const key of keys) {
		const quoted = jsString(key, 'double')
		const at = `__i18nMessages[${quoted}]`
		const member = isJsIdentifier(key) ? key : quoted
		if (withArgs.has(key))
			lines.push(
				`\t${member}: (args: Record<string, unknown>): string => {`,
				`\t\tconst message = ${at}`,
				"\t\tif (typeof message === 'string') return message",
				'\t\ttry {',
				'\t\t\treturn __i18nFormat(message as __I18nNode[], args)',
				'\t\t} catch (error) {',
				'\t\t\tif (error !== __i18nUncarried) throw error',
				`\t\t\treturn __i18nFormat(__i18nSource[${quoted}] as __I18nNode[], args)`,
				'\t\t}',
				'\t},',
			)
		else
			lines.push(
				`\t${member}: typeof ${at} === 'string' ? (${at} as string) : ${jsData(source[key])},`,
			)
	}
	lines.push('}')
	return lines
}

/* === Exported Functions === */

/**
 * Emit the generated client module for a component IR + analysis plan.
 *
 * @param component - Component IR from compileSource
 * @param plan - Client plan from analyzeClient
 * @param options.sourcePath - Source path for the generated header
 * @param options.childImports - Registry tag → module specifier (relative to
 *   the generated dir); every addressed child component is side-effect
 *   imported so its `declare global` tag-map entry is in scope (type flow
 *   by projection, ADR 0024 sub-design 6)
 */
export const emitClientModule = (
	component: ComponentIR,
	plan: ClientPlan,
	options: {
		sourcePath: string
		childImports?: ReadonlyMap<string, string> | undefined
	},
): EmittedClientModule => {
	const imports = new ClientImports(['defineComponent'])
	imports.bindScope(factoryScopeNames(component, plan))
	for (const ambient of component.expose?.ambients ?? []) imports.add(ambient)
	// The factory body, at the arrow's body depth.
	const out = new CodeBuilder({ depth: 2, reindent: true })
	const push = (text: string, slices: SourceSlice[] = []): void => {
		out.line(text, slices)
	}

	for (const line of messagePreambleLines(component, plan.clientMessageKeys))
		push(line)

	// Queries
	for (const query of plan.queries) {
		// `'host'` is never a real query entry — `usedNames` reserves the name
		// (analysis/plan.ts) so `addQuery` cannot allocate it — but
		// HarvestPlans address the component ROOT through the literal `'host'`
		// (LT-114/LT-115 root-site routing), so a future writer that DID add
		// one would otherwise emit `const host = first('host')`, shadowing the
		// factory context member. Skip defensively and let the root's reads
		// resolve to the destructured `host`.
		if (query.name === 'host') continue
		if (query.cardinality === 'maybe') {
			// A single-branch @if (no @else) root: `first()` without a
			// `required` message returns `Element | undefined` instead of
			// throwing — the element only exists when that branch rendered.
			imports.add('first')
			push(
				`const ${query.name} = ${imports.local('first')}(${jsString(query.selector)})`,
			)
		} else if (query.cardinality === 'one') {
			imports.add('first')
			push(
				`const ${query.name} = ${imports.local('first')}(${jsString(query.selector)}, ${jsString(query.message)})`,
			)
		} else {
			imports.add('all')
			push(
				`const ${query.name} = ${imports.local('all')}(${jsString(query.selector)}, ${jsString(query.message)})`,
			)
		}
	}

	// Plain (non-signal) setup consts — documented as available in both
	// generated modules (vocabulary.ts, diagnostics.ts), but only the SERVER
	// module (emit-server.ts) actually emitted them until now; found and
	// fixed alongside LT-034 (`card-colorscale.tsrx` needed a pure helper
	// function usable from a `style-map` thunk). Only the subset actually
	// reachable from a client-emitted position is included — one referenced
	// only from an `@if` condition (server-only branch selection) would
	// otherwise be a "Cannot find name" client-side (`form-textbox.tsrx`'s
	// `validatable`).
	const clientNeededNames = computeClientNeededNames(component)
	for (const stmt of component.plainSetup)
		if (stmt.name && clientNeededNames.has(stmt.name))
			push(stmt.text, sliceOf(stmt.text, stmt.range.start))

	// Signals seeded by DOM harvest
	for (const signal of component.signals) {
		// `requestContext` signals never get a harvest and are declared by
		// the dedicated verbatim path below.
		if (signal.family === 'context') continue
		const harvest = plan.harvests.find(h => h.signal === signal.name)
		if (!harvest) {
			// No harvest site — under tiering (LT-165 step 5, ADR 0029 s5) this
			// is a routing signal, not a compile error, and the client module is
			// the artifact every tier's mechanism runs (the realm replays it for
			// Simulated-tier components; Static-tier components are "the client
			// corrects at connect"). So the declaration MUST exist here: seeded
			// from its own initializer, exactly as a hand-written factory would
			// declare it. An initializer naming a server param has no client
			// representation, so the analysis rejects it (LTC005, LT-348) before
			// this runs — in every tier, since the realm answering the value
			// does not make the initializer runnable in the browser.
			imports.add(signal.constructor)
			push(
				`const ${signal.name} = ${signal.text}`,
				sliceOf(signal.text, signal.textStart),
			)
			continue
		}
		imports.add(signal.constructor)
		if (harvest.kind === 'list') {
			if (harvest.seed === 'verbatim') {
				push(
					`const ${signal.name} = ${signal.text}`,
					sliceOf(signal.text, signal.textStart),
				)
			} else {
				const substituted = listDeclaration(signal, harvest.seed)
				if (substituted) push(`const ${signal.name} = ${substituted}`)
			}
			continue
		}
		const initializer = harvestInitializer(harvest, imports)
		if (initializer)
			push(
				`const ${signal.name} = ${imports.local(signal.constructor)}(${initializer})`,
			)
	}

	// requestContext-backed signals (LT-035, ADR 0024 sub-design 15): no DOM
	// harvest at all — the client re-dispatches the context-request itself
	// (a `FactoryContext` member, destructured via `plan.ambientContext`
	// below, never a module import) and owns the initial value (a Slot
	// seeded with the fallback until a provider answers). Never matched by
	// the harvest loop above (analyze.ts never records a harvest site for
	// them), so this is a fully separate emission, verbatim, same posture as
	// `expose()`/`clientSetup` just below.
	for (const signal of component.signals) {
		if (signal.family !== 'context') continue
		push(
			`const ${signal.name} = ${signal.text}`,
			sliceOf(signal.text, signal.textStart),
		)
	}

	// expose() verbatim
	if (component.expose) {
		imports.add('expose')
		push(
			component.expose.text,
			sliceOf(component.expose.text, component.expose.range.start),
		)
	}

	// Client-only setup side effects (LT-008): connect-time statements the
	// server never runs — internals?.states.add('clearable') and friends.
	for (const stmt of component.clientSetup)
		push(stmt.text, sliceOf(stmt.text, stmt.range.start))

	// A reactive conditional (ADR 0037): `reconcile()`'s arm form over the
	// templates the server stamped `data-arms`, a key thunk over the test,
	// and one branch of `bindArm` per arm with effects.
	let needsElementType = false
	const emitArms = (plan: ArmsPlan): void => {
		imports.add('reconcile')
		if (plan.boundary) {
			emitBoundary(plan, plan.boundary)
			return
		}
		const key = (arm: ArmPlan): string =>
			arm.renders ? jsString(arm.key) : 'null'
		const test = sliceOf(plan.testText, plan.sourceStart)
		let thunk: string
		if (plan.construct === 'if') {
			const [then, otherwise] = plan.arms
			// The test's own parens (LT-385b): a ternary, comma or assignment
			// test would bind into the conditional's branches and return a
			// non-key.
			thunk = `() => ((${plan.testText}) ? ${then ? key(then) : 'null'} : ${otherwise ? key(otherwise) : 'null'})`
		} else {
			const cases = plan.arms.map(arm =>
				arm.caseText === null
					? `default: return ${key(arm)}`
					: `case ${arm.caseText}: return ${key(arm)}`,
			)
			const fallback = plan.arms.some(arm => arm.caseText === null)
				? ''
				: ' return null'
			thunk = `() => { switch (${plan.testText}) { ${cases.join('; ')} }${fallback} }`
		}
		const templates = `${plan.container}.querySelectorAll<HTMLTemplateElement>(${jsString(`:scope > template[data-arms="${plan.armSet}"]`)})`
		const mounted = plan.arms.filter(arm => arm.effects.length > 0)
		if (mounted.length === 0) {
			out.line(
				`${imports.local('reconcile')}(${plan.container}, ${templates}, ${thunk}, () => {})`,
				test,
			)
			return
		}
		const usesFirst = mounted.some(arm => arm.locals.length > 0)
		out.open(
			`${imports.local('reconcile')}(${plan.container}, ${templates}, ${thunk}, (${plan.elementParam}, ${plan.keyParam}${usesFirst ? ', first' : ''}) => {`,
			test,
		)
		mounted.forEach((arm, index) => {
			const condition = `${plan.keyParam} === ${jsString(arm.key)}`
			if (index === 0) out.open(`if (${condition}) {`)
			else out.between(`} else if (${condition}) {`)
			if (arm.root) {
				needsElementType = true
				out.line(
					`const ${arm.root.name} = ${plan.elementParam} as ElementFromSelector<${jsString(arm.root.tag)}>`,
				)
			}
			for (const local of arm.locals)
				out.line(
					`const ${local.name} = first(${jsString(local.selector)}, ${jsString(local.message)})`,
				)
			for (const inner of arm.effects) emitTopEffect(inner)
		})
		out.close()
		out.close('})')
	}

	// An async boundary (ADR 0037 s4): the arm key follows the task's
	// state with `match()`'s precedence — no value yet is `nil`, a
	// rejection `err`, anything else (a re-fetch keeping its value
	// included) `ok`. The `ok` and `err` mounts write the resolved value
	// and the error text into their arm root; each handles the other state
	// as a no-op, because the arm is disposed on that transition anyway.
	const emitBoundary = (
		plan: ArmsPlan,
		boundary: NonNullable<ArmsPlan['boundary']>,
	): void => {
		const watch = imports.use('watch')
		const unset = imports.use('UnsetSignalValueError')
		const templates = `${plan.container}.querySelectorAll<HTMLTemplateElement>(${jsString(`:scope > template[data-arms="${plan.armSet}"]`)})`
		out.open(
			`${imports.local('reconcile')}(${plan.container}, ${templates}, () => {`,
		)
		out.open('try {')
		out.line(`${boundary.signal}.get()`)
		out.between('} catch (error) {')
		out.line(`return error instanceof ${unset} ? 'nil' : 'err'`)
		out.close()
		out.line("return 'ok'")
		out.between(`}, (${plan.elementParam}, ${plan.keyParam}) => {`)
		out.open(`if (${plan.keyParam} === 'ok') {`)
		out.line(
			`${watch}(${boundary.signal}, { ok: value => { ${plan.elementParam}.textContent = String(value) }, err: () => {} })`,
		)
		if (boundary.errText !== null) {
			out.between(`} else if (${plan.keyParam} === 'err') {`)
			out.line(
				`${watch}(${boundary.signal}, { ok: () => {}, err: error => { ${plan.elementParam}.textContent = String(${boundary.errText}) } })`,
			)
		}
		out.close()
		out.close('})')
	}

	// Effects in document order
	const emitTopEffect = (effect: TopEffectPlan): void => {
		const at = push
		if (effect.kind === 'each') {
			emitEachBlock(effect.for, imports, out)
			return
		}
		if (effect.kind === 'reconcile') {
			emitReconcileBlock(effect.for, imports, out)
			return
		}
		if (effect.kind === 'watch-text') {
			imports.add('watch')
			imports.add('bindText')
			at(
				`${imports.local('watch')}(${effect.source}, ${imports.local('bindText')}(${effect.query}))`,
			)
			return
		}
		if (effect.kind === 'watch-attr') {
			imports.add('watch')
			const slices = sliceOf(effect.thunkText, effect.sourceStart)
			// No `class:` prefix arm (LT-222): the spelling is rejected at
			// classification, so no watch-attr plan can carry one.
			if (effect.dispatch === 'property') {
				imports.add('bindProperty')
				// LT-116 widened this beyond bare host-prop mirrors: dirty-flag
				// IDL attrs on native form controls dispatch here too, so a
				// number-valued `value` thunk now needs the same String
				// coercion the attribute branch applies (the DOMString-typed
				// property setter would otherwise fail check:corpus).
				const source = effect.coerceToString
					? `() => String((${effect.thunkText})())`
					: effect.thunkText
				at(
					`${imports.local('watch')}(${source}, ${imports.local('bindProperty')}(${effect.query}, ${jsString(effect.attr)}))`,
					slices,
				)
			} else {
				imports.add('bindAttribute')
				const source = effect.coerceToString
					? `() => String((${effect.thunkText})())`
					: effect.thunkText
				at(
					`${imports.local('watch')}(${source}, ${imports.local('bindAttribute')}(${effect.query}, ${jsString(effect.attr)}))`,
					slices,
				)
			}
			return
		}
		if (effect.kind === 'watch-style') {
			// LT-028/LT-029: one watch() call against bindStyle()'s map-form
			// overload — every declared CSS property is set from the single
			// evaluated map.
			imports.add('watch')
			imports.add('bindStyle')
			const slices = sliceOf(effect.thunkText, effect.sourceStart)
			const keys = effect.keys.map(key => jsString(key)).join(', ')
			at(
				`${imports.local('watch')}(${effect.thunkText}, ${imports.local('bindStyle')}(${effect.query}, [${keys}]))`,
				slices,
			)
			return
		}
		if (effect.kind === 'watch-class') {
			// LT-031/LT-029: one watch() call against bindClass()'s map-form
			// overload — every declared class token is toggled from the single
			// evaluated map, mirroring watch-style.
			imports.add('watch')
			imports.add('bindClass')
			const slices = sliceOf(effect.thunkText, effect.sourceStart)
			const keys = effect.keys.map(key => jsString(key)).join(', ')
			at(
				`${imports.local('watch')}(${effect.thunkText}, ${imports.local('bindClass')}(${effect.query}, [${keys}]))`,
				slices,
			)
			return
		}
		if (effect.kind === 'watch-html') {
			// LT-025: dangerouslyBindInnerHTML is the sanctioned XSS-aware sink
			// (ADR 0010) — never a raw innerHTML property binding. LT-138: the
			// explicit `sanitizeHtml` makes the client fail closed exactly like
			// the server render (configured default, else escape) instead of
			// falling back to the sink's raw passthrough.
			imports.add('watch')
			imports.add('dangerouslyBindInnerHTML')
			imports.add('sanitizeHtml')
			const slices = sliceOf(effect.thunkText, effect.sourceStart)
			at(
				`${imports.local('watch')}(${effect.thunkText}, ${imports.local('dangerouslyBindInnerHTML')}(${effect.query}, { sanitize: ${imports.local('sanitizeHtml')} }))`,
				slices,
			)
			return
		}
		if (effect.kind === 'pass') {
			imports.add('pass')
			const accessors = effect.setThunkText
				? `{ get: ${effect.thunkText}, set: ${effect.setThunkText} }`
				: `{ get: ${effect.thunkText} }`
			at(
				`${imports.local('pass')}(${effect.query}, { ${effect.prop}: ${accessors} })`,
				[
					...sliceOf(effect.thunkText, effect.sourceStart),
					...(effect.setThunkText
						? sliceOf(effect.setThunkText, effect.setSourceStart)
						: []),
				],
			)
			return
		}
		if (effect.kind === 'raw') {
			at(effect.text, sliceOf(effect.text, effect.sourceStart))
			return
		}
		if (effect.kind === 'arms') {
			emitArms(effect.arms)
			return
		}
		if (effect.kind === 'guarded') {
			// A single-branch @if (no @else) root, addressed with a
			// non-throwing query — every effect it owns only applies when
			// that branch actually rendered.
			out.open(`if (${effect.query}) {`)
			for (const inner of effect.effects) emitTopEffect(inner)
			out.close('}')
			return
		}
		imports.add('on')
		at(
			`${imports.local('on')}(${effect.query}, ${jsString(effect.event)}, ${effect.handlerText})`,
			sliceOf(effect.handlerText, effect.sourceStart),
		)
	}
	for (const effect of plan.effects) emitTopEffect(effect)

	// Factory context vs module imports: expose/watch/on/pass/first/all are
	// context members; each/defineComponent/bind*/parsers/signal
	// constructors are '@zeix/le-truc' module exports. host/internals are
	// context members too, collected by the analyzer from every client code
	// position (ambientContext).
	const contextMembers = [
		...new Set([
			...[...imports].filter(h => FACTORY_CONTEXT_MEMBERS.has(h)),
			...plan.ambientContext,
		]),
	].sort()
	const context = contextMembers.length
		? `{ ${contextMembers.map(name => aliased(name, imports.local(name), ': ')).join(', ')} }`
		: '{}'
	const typeArg = component.propsTypeName ? `<${component.propsTypeName}>` : ''

	// Extension activation (ADR 0024 sub-design 8): config keys lower to the
	// third argument. The form variant always leads — that is what selects
	// the FormFactoryContext overload (ADR 0019's ordering rule, enforced
	// structurally by construction).
	const extensions: string[] = []
	if (component.config?.form === 'value') {
		extensions.push(`${imports.use('formAssociated')}()`)
	} else if (component.config?.form === 'checked') {
		extensions.push(`${imports.use('formAssociatedCheckbox')}()`)
	}
	if (component.config && component.config.observedAttributes.length > 0) {
		extensions.push(
			`${imports.use('observedAttributes')}([${component.config.observedAttributes.map(n => jsString(n)).join(', ')}])`,
		)
	}
	// The widened host typing (FormAssociatedElement & P) is authored via
	// `declare global` — carry its type import when the declarations use it.
	const needsFormType =
		component.config?.form !== null &&
		component.config?.form !== undefined &&
		[component.globalDecl, ...component.typeDecls].some(t =>
			(t ?? '').includes('FormAssociatedElement'),
		)

	const body = new CodeBuilder()
		.line('/**')
		.line(
			' * Generated by the Le Truc TSRX compiler (ADR 0023, milestone 2) from',
		)
		.line(
			` * ${options.sourcePath} — DO NOT EDIT. The server half lives in ${component.tag}.server.ts.`,
		)
		.line(' */')
	// Real-export names an authored `import { … } from '@zeix/le-truc'` line
	// already provides to this module (sub-design 16) — synthesized names
	// are subtracted so no name is bound by two import statements.
	// The `isPending` idiom (LT-211): a reactive thunk reading
	// `isPending(knownSignal)` needs the binding in the generated module
	// whether or not the author imported the name (the profile declares it
	// ambient). Tokenized over the emitted text like the server emitter's
	// scan — it cannot under-match, and an authored import is deduplicated
	// by the `clientLeTrucNames` filter below.
	if (out.lines.some(line => /\bisPending\b/.test(line)))
		imports.add('isPending')

	const importList = [...imports]
		.filter(name => !FACTORY_CONTEXT_MEMBERS.has(name))
		// An aliased name is always imported here: the authored import binds
		// the bare name, which the author's own binding shadows (LT-302).
		.filter(
			name =>
				!component.imports.clientLeTrucNames.has(name) ||
				imports.local(name) !== name,
		)
		.sort()
		.map(name => aliased(name, imports.local(name), ' as '))
	if (importList.length > 0)
		body.line(`import { ${importList.join(', ')} } from '@zeix/le-truc'`)
	if (needsFormType)
		body.line("import type { FormAssociatedElement } from '@zeix/le-truc'")
	if (needsElementType)
		body.line("import type { ElementFromSelector } from '@zeix/le-truc'")
	for (const tag of plan.childTags) {
		const specifier = options.childImports?.get(tag)
		if (specifier) body.line(`import ${jsString(specifier)}`)
	}
	// Authored text and declarations are pre-formatted: appended as written.
	body.append([...component.imports.client, ''])
	for (const decl of component.typeDecls) body.append([decl, ''])
	if (component.globalDecl) body.append([component.globalDecl, ''])
	// The authored component JSDoc rides above the generated default export:
	// identical comment text ⇒ identical CEM extraction (LT-006), and the
	// generated client documents itself.
	if (component.componentDoc) body.append([component.componentDoc, ''])
	body.open(`export default ${imports.local('defineComponent')}${typeArg}(`)
	body.line(`${jsString(component.tag)},`)
	body.open(`(${context}) => {`)
	// The factory body's spans rebase onto the header/import/declaration
	// text that precedes it in the final module.
	body.append(out)
	body.close('},')
	if (extensions.length > 0) body.line(`[${extensions.join(', ')}],`)
	body.close(')')

	return {
		code: `${body}\n`,
		imports,
		spans: body.spans,
	}
}
