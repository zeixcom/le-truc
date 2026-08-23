/**
 * Client-module emitter (ADR 0023 milestone 2, LT-002).
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
	ClientPlan,
	ForClientPlan,
	ParserKind,
	ReconcilePlan,
	TopEffectPlan,
} from './analyze'
import type { ComponentIR, SignalIR } from './compiler'
import {
	appendWithSpans,
	type SourceSlice,
	type SourceSpan,
	type SpanCursor,
} from './spans'

/* === Types === */

export type EmittedClientModule = {
	/** Full TypeScript source of the generated module. */
	code: string
	/** `@zeix/le-truc` imports the module needs (sorted for emission). */
	imports: Set<string>
	/**
	 * Generated-file ↔ `.tsrx`-source span table (LT-011): one entry per
	 * verbatim setup statement, thunk, or event handler slice. `check:tsrx`
	 * maps tsc diagnostics back through it onto the source location.
	 */
	spans: SourceSpan[]
}

/* === Internal Functions === */

/** `aria-selected` → `ariaSelected` (ARIA reflection property name). */
const ariaProperty = (attr: string): string | null => {
	if (!attr.startsWith('aria-')) return null
	return attr
		.split('-')
		.map((part, i) =>
			i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join('')
}

const parserImport = (parser: ParserKind): string | null => parser

const harvestInitializer = (
	plan: ClientPlan['harvests'][number],
	queries: ClientPlan['queries'],
	imports: Set<string>,
): string | null => {
	const queryName = (name: string): string =>
		queries.find(q => q.name === name)?.name ?? name
	if (plan.kind === 'substitute') return plan.expr
	if (plan.kind === 'text') {
		if (plan.parser && parserImport(plan.parser)) imports.add(plan.parser)
		const read = `${queryName(plan.query)}.textContent`
		return plan.parser ? `${plan.parser}()(${read})` : read
	}
	if (plan.kind === 'attr') {
		if (plan.parser && parserImport(plan.parser)) imports.add(plan.parser)
		const raw = `${queryName(plan.query)}.getAttribute('${plan.attr}')`
		return plan.parser ? `${plan.parser}()(${raw})` : `${raw} ?? ''`
	}
	// The list kind is emitted directly from its declaration (verbatim or
	// substituted seed) and never reaches this initializer path.
	if (plan.kind === 'list') return null
	// membership: find the marked element in the collection, read its value
	const markProp = ariaProperty(plan.markAttr)
	const predicate = markProp
		? `el => el.${markProp} === 'true'`
		: `el => el.getAttribute('${plan.markAttr}') === 'true'`
	return `${queryName(plan.collection)}.get().find(${predicate})?.getAttribute('${plan.valueAttr}') ?? ${plan.default}`
}

/**
 * A reconciled List's declaration: the authored createList call with its
 * first argument (the seed) replaced by the DOM harvest when the seed is
 * arg-dependent — generics and keyConfig pass through verbatim, so the
 * client's key generation provably matches the server's data-key values.
 */
const listDeclaration = (
	signal: SignalIR,
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
		`el.querySelector('${seed.valueSelector}')?.textContent ?? '')`
	return signal.text.slice(0, relStart) + harvested + signal.text.slice(relEnd)
}

const sliceOf = (text: string, start: number | undefined): SourceSlice[] =>
	start === undefined ? [] : [{ text, start }]

const emitEachBlock = (
	plan: ForClientPlan,
	imports: Set<string>,
	lines: string[],
	spans: SourceSpan[],
	cursor: SpanCursor,
	depth: number,
): void => {
	imports.add('each')
	const append = (text: string, at: number, slices: SourceSlice[] = []): void =>
		appendWithSpans(lines, text, at, slices, spans, cursor)
	append(`each(${plan.collection}, ${plan.itemParam} => {`, depth)
	for (const rebinding of plan.rebindings)
		append(`const ${rebinding.name} = ${rebinding.expr}`, depth + 1)
	for (const effect of plan.effects) {
		if (effect.kind === 'watch-attr') {
			imports.add('watch')
			imports.add('bindAttribute')
			const source = effect.coerceToString
				? `() => String((${effect.thunkText})())`
				: effect.thunkText
			append(
				`watch(${source}, bindAttribute(${plan.itemParam}, '${effect.attr}'))`,
				depth + 1,
				sliceOf(effect.thunkText, effect.sourceStart),
			)
		} else if (effect.kind === 'watch-class') {
			imports.add('watch')
			imports.add('bindClass')
			for (const key of effect.keys) {
				append(
					`watch(() => Boolean(((${effect.thunkText})()).${key}), bindClass(${plan.itemParam}, '${key}'))`,
					depth + 1,
					sliceOf(effect.thunkText, effect.sourceStart),
				)
			}
		} else {
			imports.add('on')
			append(
				`on(${plan.itemParam}, '${effect.event}', ${effect.handlerText})`,
				depth + 1,
				sliceOf(effect.handlerText, effect.sourceStart),
			)
		}
	}
	const closing = `${'\t'.repeat(depth)}})`
	lines.push(closing)
	cursor.offset += closing.length + 1
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
	imports: Set<string>,
	lines: string[],
	spans: SourceSpan[],
	cursor: SpanCursor,
	depth: number,
): void => {
	imports.add('reconcile')
	imports.add('watch')
	imports.add('bindText')
	const append = (text: string, at: number, slices: SourceSlice[] = []): void =>
		appendWithSpans(lines, text, at, slices, spans, cursor)
	const keyParam = plan.keyParam ?? '_key'
	append(
		`reconcile(${plan.container}, ${plan.template}, ${plan.signal}, (_element, ${plan.itemParam}, ${keyParam}, first) => {`,
		depth,
	)
	append(
		`watch(${plan.itemParam}, bindText(first('${plan.holeSelector}', '${plan.tag}: ${plan.holeSelector} missing')))`,
		depth + 1,
	)
	for (const target of plan.itemEvents) {
		if (target.selector !== null)
			append(
				`const ${target.name} = first('${target.selector}', '${target.message}')`,
				depth + 1,
			)
		for (const event of target.events) {
			imports.add('on')
			append(
				`on(${target.name}, '${event.event}', ${event.handlerText})`,
				depth + 1,
				sliceOf(event.handlerText, event.sourceStart),
			)
		}
	}
	const closing = `${'\t'.repeat(depth)}})`
	lines.push(closing)
	cursor.offset += closing.length + 1
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
 *   by projection, ADR 0023 sub-design 6)
 */
export const emitClientModule = (
	component: ComponentIR,
	plan: ClientPlan,
	options: {
		sourcePath: string
		childImports?: ReadonlyMap<string, string> | undefined
	},
): EmittedClientModule => {
	const imports = new Set<string>(['defineComponent'])
	for (const ambient of component.exposeAmbients) imports.add(ambient)
	const lines: string[] = []
	const spans: SourceSpan[] = []
	const cursor: SpanCursor = { offset: 0 }
	const push = (text: string, slices: SourceSlice[] = []): void =>
		appendWithSpans(lines, text, 2, slices, spans, cursor)

	// Queries
	for (const query of plan.queries) {
		if (query.cardinality === 'maybe') {
			// A single-branch @if (no @else) root: `first()` without a
			// `required` message returns `Element | undefined` instead of
			// throwing — the element only exists when that branch rendered.
			imports.add('first')
			push(`const ${query.name} = first('${query.selector}')`)
		} else if (query.cardinality === 'one') {
			imports.add('first')
			push(
				`const ${query.name} = first('${query.selector}', '${query.message}')`,
			)
		} else {
			imports.add('all')
			push(`const ${query.name} = all('${query.selector}', '${query.message}')`)
		}
	}

	// Signals seeded by DOM harvest
	for (const signal of component.signals) {
		const harvest = plan.harvests.find(h => h.signal === signal.name)
		if (!harvest) continue
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
		const initializer = harvestInitializer(harvest, plan.queries, imports)
		if (initializer)
			push(`const ${signal.name} = ${signal.constructor}(${initializer})`)
	}

	// expose() verbatim
	if (component.exposeText) {
		imports.add('expose')
		push(
			component.exposeText,
			sliceOf(component.exposeText, component.exposeRange?.start),
		)
	}

	// Client-only setup side effects (LT-008): connect-time statements the
	// server never runs — internals?.states.add('clearable') and friends.
	for (const stmt of component.clientSetup)
		push(stmt.text, sliceOf(stmt.text, stmt.range.start))

	// Effects in document order
	const emitTopEffect = (effect: TopEffectPlan, depth: number): void => {
		const at = (text: string, slices: SourceSlice[] = []): void =>
			appendWithSpans(lines, text, depth, slices, spans, cursor)
		if (effect.kind === 'each') {
			emitEachBlock(effect.for, imports, lines, spans, cursor, depth)
			return
		}
		if (effect.kind === 'reconcile') {
			emitReconcileBlock(effect.for, imports, lines, spans, cursor, depth)
			return
		}
		if (effect.kind === 'watch-text') {
			imports.add('watch')
			imports.add('bindText')
			at(`watch(${effect.source}, bindText(${effect.query}))`)
			return
		}
		if (effect.kind === 'watch-attr') {
			imports.add('watch')
			const slices = sliceOf(effect.thunkText, effect.sourceStart)
			if (effect.attr.startsWith('class:')) {
				imports.add('bindClass')
				const key = effect.attr.slice('class:'.length)
				at(
					`watch(() => Boolean(((${effect.thunkText})()).${key}), bindClass(${effect.query}, '${key}'))`,
					slices,
				)
			} else if (effect.dispatch === 'property') {
				imports.add('bindProperty')
				at(
					`watch(${effect.thunkText}, bindProperty(${effect.query}, '${effect.attr}'))`,
					slices,
				)
			} else {
				imports.add('bindAttribute')
				const source = effect.coerceToString
					? `() => String((${effect.thunkText})())`
					: effect.thunkText
				at(
					`watch(${source}, bindAttribute(${effect.query}, '${effect.attr}'))`,
					slices,
				)
			}
			return
		}
		if (effect.kind === 'pass') {
			imports.add('pass')
			const accessors = effect.setThunkText
				? `{ get: ${effect.thunkText}, set: ${effect.setThunkText} }`
				: `{ get: ${effect.thunkText} }`
			at(`pass(${effect.query}, { ${effect.prop}: ${accessors} })`, [
				...sliceOf(effect.thunkText, effect.sourceStart),
				...(effect.setThunkText
					? sliceOf(effect.setThunkText, effect.setSourceStart)
					: []),
			])
			return
		}
		if (effect.kind === 'raw') {
			at(effect.text, sliceOf(effect.text, effect.sourceStart))
			return
		}
		if (effect.kind === 'async') {
			// Async boundary (ADR 0023 sub-design 13, LT-012): one watch() call
			// mirrors the server's own state routing — all three roots already
			// exist server-rendered, `hidden` toggled here going forward. `ok`'s
			// `value` is the resolved signal value (the arm's own lazy text
			// child); `err`'s `error` is the SingleMatchHandlers Error (bound to
			// the authored catch param — bare or a member read, e.g. `.message`).
			imports.add('watch')
			const append = (text: string, atDepth: number): void =>
				appendWithSpans(lines, text, atDepth, [], spans, cursor)
			append(`watch(${effect.signal}, {`, depth)
			append('ok: value => {', depth + 1)
			append(`${effect.pendingQuery}.hidden = true`, depth + 2)
			append(`${effect.errQuery}.hidden = true`, depth + 2)
			append(`${effect.okQuery}.hidden = false`, depth + 2)
			if (effect.okText)
				append(`${effect.okQuery}.textContent = String(value)`, depth + 2)
			append('},', depth + 1)
			append('nil: () => {', depth + 1)
			append(`${effect.okQuery}.hidden = true`, depth + 2)
			append(`${effect.errQuery}.hidden = true`, depth + 2)
			append(`${effect.pendingQuery}.hidden = false`, depth + 2)
			append('},', depth + 1)
			append('err: error => {', depth + 1)
			append(`${effect.pendingQuery}.hidden = true`, depth + 2)
			append(`${effect.okQuery}.hidden = true`, depth + 2)
			append(`${effect.errQuery}.hidden = false`, depth + 2)
			if (effect.errText)
				append(
					`${effect.errQuery}.textContent = String(${effect.errText})`,
					depth + 2,
				)
			append('},', depth + 1)
			append('})', depth)
			return
		}
		if (effect.kind === 'guarded') {
			// A single-branch @if (no @else) root, addressed with a
			// non-throwing query — every effect it owns only applies when
			// that branch actually rendered.
			at(`if (${effect.query}) {`)
			for (const inner of effect.effects) emitTopEffect(inner, depth + 1)
			const closing = `${'\t'.repeat(depth)}}`
			lines.push(closing)
			cursor.offset += closing.length + 1
			return
		}
		imports.add('on')
		at(
			`on(${effect.query}, '${effect.event}', ${effect.handlerText})`,
			sliceOf(effect.handlerText, effect.sourceStart),
		)
	}
	for (const effect of plan.effects) emitTopEffect(effect, 2)

	// Factory context vs module imports: expose/watch/on/pass/first/all are
	// context members; each/defineComponent/bind*/parsers/signal
	// constructors are '@zeix/le-truc' module exports. host/internals are
	// context members too, collected by the analyzer from every client code
	// position (ambientContext).
	const CONTEXT_HELPERS = ['all', 'expose', 'first', 'on', 'pass', 'watch']
	const contextMembers = [
		...new Set([
			...[...imports].filter(h => CONTEXT_HELPERS.includes(h)),
			...plan.ambientContext,
		]),
	].sort()
	const context = contextMembers.length
		? `{ ${contextMembers.join(', ')} }`
		: '{}'
	const typeArg = component.propsTypeName ? `<${component.propsTypeName}>` : ''

	// Extension activation (ADR 0023 sub-design 8): config keys lower to the
	// third argument. The form variant always leads — that is what selects
	// the FormFactoryContext overload (ADR 0019's ordering rule, enforced
	// structurally by construction).
	const extensions: string[] = []
	if (component.config?.form === 'value') {
		imports.add('formAssociated')
		extensions.push('formAssociated()')
	} else if (component.config?.form === 'checked') {
		imports.add('formAssociatedCheckbox')
		extensions.push('formAssociatedCheckbox()')
	}
	if (component.config && component.config.observedAttributes.length > 0) {
		imports.add('observedAttributes')
		extensions.push(
			`observedAttributes([${component.config.observedAttributes.map(n => `'${n}'`).join(', ')}])`,
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

	const body: string[] = [
		'/**',
		' * Generated by the Le Truc TSRX compiler (ADR 0023, milestone 2) from',
		` * ${options.sourcePath} — DO NOT EDIT. The server half lives in ${component.tag}.server.ts.`,
		' */',
	]
	const importList = [...imports]
		.filter(name => !CONTEXT_HELPERS.includes(name))
		.sort()
	body.push(`import { ${importList.join(', ')} } from '@zeix/le-truc'`)
	if (needsFormType)
		body.push("import type { FormAssociatedElement } from '@zeix/le-truc'")
	for (const tag of plan.childTags) {
		const specifier = options.childImports?.get(tag)
		if (specifier) body.push(`import '${specifier}'`)
	}
	body.push('')
	for (const decl of component.typeDecls) body.push(decl, '')
	if (component.globalDecl) body.push(component.globalDecl, '')
	// The authored component JSDoc rides above the generated default export:
	// identical comment text ⇒ identical CEM extraction (LT-006), and the
	// generated client documents itself.
	if (component.componentDoc) body.push(component.componentDoc, '')
	body.push(`export default defineComponent${typeArg}(`)
	body.push(`\t'${component.tag}',`)
	body.push(`\t(${context}) => {`)
	// `spans` were recorded relative to `lines.join('\n')` — offset by the
	// header/import/declaration text that precedes it in the final module.
	const bodyBaseOffset = body.join('\n').length + 1
	for (const line of lines) body.push(line)
	body.push('\t},')
	if (extensions.length > 0) body.push(`\t[${extensions.join(', ')}],`)
	body.push(')')

	return {
		code: `${body.join('\n')}\n`,
		imports,
		spans: spans.map(s => ({
			...s,
			generatedStart: s.generatedStart + bodyBaseOffset,
		})),
	}
}
