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
} from './analyze'
import type { ComponentIR, SignalIR } from './compiler'
import { lineStartsInTemplate } from './indent'

/* === Types === */

export type EmittedClientModule = {
	/** Full TypeScript source of the generated module. */
	code: string
	/** `@zeix/le-truc` imports the module needs (sorted for emission). */
	imports: Set<string>
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
 * Push a statement, re-indenting multi-line slices (expose blocks, event
 * handler bodies): the shallowest continuation line lands at the statement's
 * own depth, deeper lines keep their relative indent. Lines inside a
 * multi-line template literal pass through byte-identical — their leading
 * whitespace is string content, not indentation (LT-010).
 */
const pushStatement = (lines: string[], text: string, depth: number): void => {
	const statementLines = text.split('\n')
	const rest = statementLines.slice(1)
	const mask = lineStartsInTemplate(statementLines)
	const indents = rest
		.filter((l, i) => l.trim().length > 0 && !mask[i + 1])
		.map(l => l.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ??
			'')
		: ''
	const prefix = '\t'.repeat(depth)
	lines.push(`${prefix}${statementLines[0] ?? ''}`)
	for (const [i, line] of rest.entries()) {
		if (mask[i + 1]) {
			lines.push(line)
			continue
		}
		if (line.trim().length === 0) {
			lines.push('')
			continue
		}
		lines.push(
			`${'\t'.repeat(depth)}${line.startsWith(common) ? line.slice(common.length) : line.trimStart()}`,
		)
	}
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

const emitEachBlock = (
	plan: ForClientPlan,
	imports: Set<string>,
	depth: number,
): string[] => {
	imports.add('each')
	const lines: string[] = []
	pushStatement(lines, `each(${plan.collection}, ${plan.itemParam} => {`, depth)
	for (const rebinding of plan.rebindings)
		pushStatement(
			lines,
			`const ${rebinding.name} = ${rebinding.expr}`,
			depth + 1,
		)
	for (const effect of plan.effects) {
		if (effect.kind === 'watch-attr') {
			imports.add('watch')
			imports.add('bindAttribute')
			const source = effect.coerceToString
				? `() => String((${effect.thunkText})())`
				: effect.thunkText
			pushStatement(
				lines,
				`watch(${source}, bindAttribute(${plan.itemParam}, '${effect.attr}'))`,
				depth + 1,
			)
		} else if (effect.kind === 'watch-class') {
			imports.add('watch')
			imports.add('bindClass')
			for (const key of effect.keys) {
				pushStatement(
					lines,
					`watch(() => Boolean(((${effect.thunkText})()).${key}), bindClass(${plan.itemParam}, '${key}'))`,
					depth + 1,
				)
			}
		} else {
			imports.add('on')
			pushStatement(
				lines,
				`on(${plan.itemParam}, '${effect.event}', ${effect.handlerText})`,
				depth + 1,
			)
		}
	}
	lines.push(`${'\t'.repeat(depth)}})`)
	return lines
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
	depth: number,
): string[] => {
	imports.add('reconcile')
	imports.add('watch')
	imports.add('bindText')
	const lines: string[] = []
	const keyParam = plan.keyParam ?? '_key'
	pushStatement(
		lines,
		`reconcile(${plan.container}, ${plan.template}, ${plan.signal}, (_element, ${plan.itemParam}, ${keyParam}, first) => {`,
		depth,
	)
	pushStatement(
		lines,
		`watch(${plan.itemParam}, bindText(first('${plan.holeSelector}', '${plan.tag}: ${plan.holeSelector} missing')))`,
		depth + 1,
	)
	for (const target of plan.itemEvents) {
		if (target.selector !== null)
			pushStatement(
				lines,
				`const ${target.name} = first('${target.selector}', '${target.message}')`,
				depth + 1,
			)
		for (const event of target.events) {
			imports.add('on')
			pushStatement(
				lines,
				`on(${target.name}, '${event.event}', ${event.handlerText})`,
				depth + 1,
			)
		}
	}
	lines.push(`${'\t'.repeat(depth)}})`)
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
	const push = (text: string): void => pushStatement(lines, text, 2)

	// Queries
	for (const query of plan.queries) {
		if (query.cardinality === 'one') {
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
				push(`const ${signal.name} = ${signal.text}`)
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
		push(component.exposeText)
	}

	// Client-only setup side effects (LT-008): connect-time statements the
	// server never runs — internals?.states.add('clearable') and friends.
	for (const stmt of component.clientSetup) push(stmt)

	// Effects in document order
	for (const effect of plan.effects) {
		if (effect.kind === 'each') {
			// Emitted at depth 3, stripped one tab so the block statement sits
			// at factory-body level (2 tabs) and its contents one deeper.
			for (const line of emitEachBlock(effect.for, imports, 3))
				lines.push(line.replace(/^\t/, ''))
			continue
		}
		if (effect.kind === 'reconcile') {
			for (const line of emitReconcileBlock(effect.for, imports, 3))
				lines.push(line.replace(/^\t/, ''))
			continue
		}
		if (effect.kind === 'watch-text') {
			imports.add('watch')
			imports.add('bindText')
			push(`watch(${effect.source}, bindText(${effect.query}))`)
			continue
		}
		if (effect.kind === 'watch-attr') {
			imports.add('watch')
			if (effect.attr.startsWith('class:')) {
				imports.add('bindClass')
				const key = effect.attr.slice('class:'.length)
				push(
					`watch(() => Boolean(((${effect.thunkText})()).${key}), bindClass(${effect.query}, '${key}'))`,
				)
			} else if (effect.dispatch === 'property') {
				imports.add('bindProperty')
				push(
					`watch(${effect.thunkText}, bindProperty(${effect.query}, '${effect.attr}'))`,
				)
			} else {
				imports.add('bindAttribute')
				const source = effect.coerceToString
					? `() => String((${effect.thunkText})())`
					: effect.thunkText
				push(
					`watch(${source}, bindAttribute(${effect.query}, '${effect.attr}'))`,
				)
			}
			continue
		}
		if (effect.kind === 'pass') {
			imports.add('pass')
			push(
				`pass(${effect.query}, { ${effect.prop}: { get: ${effect.thunkText} } })`,
			)
			continue
		}
		imports.add('on')
		push(`on(${effect.query}, '${effect.event}', ${effect.handlerText})`)
	}

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
	for (const line of lines) body.push(line)
	body.push('\t},')
	if (extensions.length > 0) body.push(`\t[${extensions.join(', ')}],`)
	body.push(')')

	return { code: `${body.join('\n')}\n`, imports }
}
