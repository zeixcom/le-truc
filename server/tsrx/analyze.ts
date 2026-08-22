/**
 * Client-side analysis (ADR 0023 milestone 2, LT-002).
 *
 * Walks the component IR and produces the emission plan the client codegen
 * renders: element addressing (generated selectors, uniqueness-checked
 * structurally against the template the compiler itself rendered), signal
 * harvest plans (ADR 0003 — the client seeds every signal from the
 * server-rendered DOM), hoisted-const rebinding for `@for` scopes, and the
 * document-ordered effect list. Every rewrite rule that cannot be applied
 * reports a diagnostic — these rules are the product (ADR 0023
 * consequences): a wrong rewrite is a wrong component.
 *
 * Harvest canonical-site rule: direct sites (text child, direct attribute)
 * win, first by document order; the membership form
 * (`String(sig.get() === const)` marking one item among many) is the
 * composite fallback.
 */

import {
	CONTEXT_NAMES,
	freeIdentifiers,
	JS_GLOBALS,
	MANAGED_TEXT_PROPS,
	type AttributeIR,
	type ComponentIR,
	type ForIR,
	type TemplateNode,
} from './compiler'
import type { TsrxNode } from '@tsrx/core'
import { diagnostic } from './diagnostics'
import type { CompileDiagnostic } from './diagnostics'

/* === Types === */

type ElementNode = Extract<TemplateNode, { kind: 'element' }>
type ExprNode = Extract<TemplateNode, { kind: 'expr' }>

export type ParserKind = 'asInteger' | 'asBoolean' | 'asString' | null

/** A generated element query. */
export type QueryPlan = {
	/** Variable name in the generated factory. */
	name: string
	selector: string
	/** `first()` or `all()`. */
	cardinality: 'one' | 'many'
	message: string
}

/** How a signal seeds itself from the server-rendered DOM. */
export type HarvestPlan =
	| {
			kind: 'text'
			signal: string
			/** Query name of the element whose text was rendered. */
			query: string
			parser: ParserKind
	  }
	| {
			kind: 'attr'
			signal: string
			query: string
			attr: string
			parser: ParserKind
	  }
	| {
			kind: 'membership'
			signal: string
			/** Collection query holding the marked elements. */
			collection: string
			/** Attribute the membership thunk renders (`aria-selected`). */
			markAttr: string
			/** Attribute carrying the signal's value (`aria-controls`). */
			valueAttr: string
			default: string
	  }

/** A hoisted const rebound to a server-rendered attribute inside each(). */
export type RebindingPlan = {
	name: string
	/** Expression for the element-derived value. */
	expr: string
}

export type LoopEffectPlan =
	| {
			kind: 'watch-attr'
			attr: string
			thunkText: string
			/** Number-valued thunks stringify — `bindAttribute` takes string|boolean. */
			coerceToString: boolean
	  }
	| { kind: 'watch-class'; keys: string[]; thunkText: string }
	| { kind: 'on'; event: string; handlerText: string }

/** One `@for` lowered to `each()`. */
export type ForClientPlan = {
	/** Collection query variable (`tabs`). */
	collection: string
	/** Element parameter name inside each() (`tab`). */
	itemParam: string
	rebindings: RebindingPlan[]
	effects: LoopEffectPlan[]
}

export type TopEffectPlan =
	| { kind: 'watch-text'; query: string; source: string }
	| {
			kind: 'watch-attr'
			query: string
			attr: string
			thunkText: string
			dispatch: 'attribute' | 'property'
			/** Number-valued thunks stringify — `bindAttribute` takes string|boolean. */
			coerceToString: boolean
	  }
	| { kind: 'pass'; query: string; prop: string; thunkText: string }
	| { kind: 'on'; query: string; event: string; handlerText: string }
	| { kind: 'each'; for: ForClientPlan }

export type ClientPlan = {
	queries: QueryPlan[]
	harvests: HarvestPlan[]
	effects: TopEffectPlan[]
	/**
	 * Context members the generated factory must destructure (`host`,
	 * `internals`) — collected from every client code position plus the
	 * setup's expose() initializers (compiler.ts `contextRefs`).
	 */
	ambientContext: string[]
}

/* === Internal Functions === */

const isElement = (n: TemplateNode): n is ElementNode => n.kind === 'element'

const nodeType = (node: unknown): string | null =>
	node && typeof node === 'object' && typeof (node as TsrxNode).type === 'string'
		? String((node as TsrxNode).type)
		: null

/** Static attributes of an element as a map (for selector synthesis). */
const staticAttrs = (element: ElementNode): Map<string, string | null> => {
	const map = new Map<string, string | null>()
	for (const attr of element.attrs)
		if (attr.kind === 'static') map.set(attr.name, attr.value)
	return map
}

/**
 * Selector synthesis, calibrated against the hand-written corpus:
 * 1. a `role` attribute is always the discriminator (it is the element's
 *    semantic contract; `div` tags drop the tag itself);
 * 2. otherwise the bare tag, upgraded to a `type`/`class`/`data-*`
 *    discriminator only when the bare tag is structurally ambiguous.
 * Uniqueness is proven structurally — the compiler rendered this HTML.
 */
const buildSelector = (
	element: ElementNode,
	mode: 'role' | 'discriminator' | 'bare',
): string | null => {
	const attrs = staticAttrs(element)
	const clause = (name: string, value: string): string => {
		const attr = `[${name}="${value}"]`
		return element.tag === 'div' ? attr : `${element.tag}${attr}`
	}
	if (mode === 'role') {
		const role = attrs.get('role')
		if (role !== undefined && role !== null) return clause('role', role)
		return null
	}
	if (mode === 'discriminator') {
		const disc =
			['type', 'class'].find(
				name => attrs.has(name) && attrs.get(name) !== null,
			) ??
			[...attrs.keys()].find(
				name => name.startsWith('data-') && attrs.get(name) !== null,
			)
		if (disc !== undefined && attrs.get(disc) !== undefined)
			return clause(disc, attrs.get(disc) as string)
		return null
	}
	return element.tag
}

/** Does `candidate` structurally match a synthesized selector string? */
const matchesSelector = (candidate: ElementNode, selector: string): boolean => {
	const match = selector.match(/^([a-z][a-z0-9-]*)?(?:\[([^\]="]+)="([^"]*)"\])?$/)
	if (!match) return false
	const [, tag, attr, value] = match
	if (tag && candidate.tag !== tag) return false
	if (attr) return staticAttrs(candidate).get(attr) === value
	return true
}

/** Structural match count for a selector over the whole template. */
const countForSelector = (
	node: TemplateNode,
	selector: string,
): number => {
	if (!isElement(node)) return 0
	let count = matchesSelector(node, selector) ? 1 : 0
	for (const child of node.children) count += countForSelector(child, selector)
	return count
}

/**
 * Resolve the selector for an element: try role, bare, then upgrade to a
 * discriminator; accept the first structurally unique candidate.
 */
const resolveSelector = (
	component: ComponentIR,
	element: ElementNode,
): { selector: string; unique: boolean } => {
	const candidates = [
		buildSelector(element, 'role'),
		buildSelector(element, 'bare'),
		buildSelector(element, 'discriminator'),
	].filter((s): s is string => s !== null)
	for (const selector of candidates) {
		if (countForSelector(component.root, selector) === 1)
			return { selector, unique: true }
	}
	return { selector: candidates[0] ?? element.tag, unique: false }
}

const dependenciesOf = (node: TsrxNode): Set<string> => {
	const free = freeIdentifiers(node)
	for (const global of JS_GLOBALS) free.delete(global)
	return free
}

/** `sig.get()` call check for direct/membership matching. */
const isSignalGetCall = (node: unknown, signal: string): boolean => {
	if (nodeType(node) !== 'CallExpression') return false
	const callee = (node as TsrxNode).callee
	if (nodeType(callee) !== 'MemberExpression') return false
	const member = callee as TsrxNode
	return (
		nodeType(member.object) === 'Identifier' &&
		String((member.object as TsrxNode).name) === signal &&
		nodeType(member.property) === 'Identifier' &&
		String((member.property as TsrxNode).name) === 'get'
	)
}

/**
 * Match the membership mark: `() => String(sig.get() === C)` or
 * `() => sig.get() === C`. Returns the const identifier.
 */
const membershipConst = (thunk: TsrxNode, signal: string): string | null => {
	const body = thunk.body
	if (nodeType(body) !== 'BinaryExpression' && nodeType(body) !== 'CallExpression')
		return null
	let comparison = body as TsrxNode
	if (nodeType(body) === 'CallExpression') {
		const call = body as TsrxNode
		const callee = call.callee
		if (
			nodeType(callee) !== 'Identifier' ||
			String((callee as TsrxNode).name) !== 'String' ||
			!Array.isArray(call.arguments)
		)
			return null
		comparison = call.arguments[0] as TsrxNode
	}
	if (nodeType(comparison) !== 'BinaryExpression') return null
	const bin = comparison as Record<string, unknown>
	if (bin.operator !== '===') return null
	const left = bin.left as TsrxNode
	const right = bin.right as TsrxNode
	for (const [a, b] of [
		[left, right],
		[right, left],
	] as const) {
		if (isSignalGetCall(a, signal) && nodeType(b) === 'Identifier')
			return String((b as TsrxNode).name)
	}
	return null
}

/** `() => sig.get()` (direct attribute render of a signal). */
const isDirectAttrThunk = (thunk: TsrxNode, signal: string): boolean =>
	isSignalGetCall(thunk.body, signal)

const classMapKeys = (object: TsrxNode): string[] => {
	const keys: string[] = []
	if (nodeType(object) !== 'ObjectExpression') return keys
	const props = object.properties
	if (!Array.isArray(props)) return keys
	for (const prop of props) {
		if (nodeType(prop) !== 'Property') continue
		const key = (prop as TsrxNode).key
		if (nodeType(key) === 'Identifier') keys.push(String((key as TsrxNode).name))
	}
	return keys
}

const parserForType = (type: string): ParserKind => {
	switch (type) {
		case 'number':
			return 'asInteger'
		case 'boolean':
			return 'asBoolean'
		default:
			return 'asString'
	}
}

const defaultForType = (type: string): string => {
	switch (type) {
		case 'number':
			return '0'
		case 'boolean':
			return 'false'
		default:
			return "''"
	}
}

const sanitizeVarName = (tag: string): string =>
	tag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

/** Conservative check: does a thunk body return a number literal? */
const returnsNumber = (body: unknown): boolean => {
	if (nodeType(body) === 'Literal')
		return typeof (body as TsrxNode).value === 'number'
	if (nodeType(body) === 'ConditionalExpression')
		return returnsNumber((body as TsrxNode).consequent)
	return false
}

const lazyWatchSource = (
	component: ComponentIR,
	child: ExprNode,
): string => {
	const expr = child.expr
	if (nodeType(expr) === 'Identifier') return child.exprText
	if (nodeType(expr) === 'Literal' && typeof (expr as TsrxNode).value === 'string') {
		const value = String((expr as TsrxNode).value)
		// A string literal in a lazy position names a prop: an exposed signal
		// prop, or a managed form prop (FormFactoryContext only — its watch
		// accepts 'validationMessage' exactly when formAssociated() leads).
		if (
			component.exposeProps.has(value) ||
			(component.config?.form && MANAGED_TEXT_PROPS.has(value))
		)
			return `'${value}'`
	}
	return child.exprText
}

/**
 * `() => host.<prop>` — the host-prop mirror. Lowers to `bindProperty` (the
 * host prop is a Slot-backed reactive read; attribute dispatch would be wrong
 * for property-backed targets like `input.value`), and server-renders from the
 * root attribute expression of the parser-exposed prop it reads.
 */
const hostPropMirrorOf = (thunk: TsrxNode): string | null => {
	const body = thunk.body
	if (nodeType(body) !== 'MemberExpression') return null
	const member = body as TsrxNode
	if (
		nodeType(member.object) !== 'Identifier' ||
		String((member.object as TsrxNode).name) !== 'host'
	)
		return null
	if (member.computed || nodeType(member.property) !== 'Identifier') return null
	return String((member.property as TsrxNode).name)
}

/* === Exported Functions === */

/**
 * Analyze a component for client codegen. Diagnostics are appended to the
 * passed array; the plan is still returned so tests can inspect partial
 * results.
 *
 * @param component - Component IR from compileSource
 * @param registry - Custom element tags known in this compile unit; a
 *   reactive attribute on a registry tag lowers to `pass()`, any other
 *   dashed tag to `bindProperty()` (AGENTS.md's own rule, encoded)
 */
export const analyzeClient = (
	component: ComponentIR,
	registry: ReadonlySet<string>,
	diagnostics: CompileDiagnostic[],
): ClientPlan => {
	const source = component.source
	const queries: QueryPlan[] = []
	const harvests: HarvestPlan[] = []
	const effects: TopEffectPlan[] = []
	const ambient = new Set<string>(component.contextRefs)
	const collectAmbient = (node: TsrxNode | null | undefined): void => {
		if (!node) return
		for (const name of freeIdentifiers(node))
			if (CONTEXT_NAMES.has(name)) ambient.add(name)
	}
	const usedNames = new Set<string>([
		component.tag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
		...component.signals.map(s => s.name),
		'host',
	])

	const uniqueName = (base: string): string => {
		let name = base
		let n = 2
		while (usedNames.has(name)) name = `${base}${n++}`
		usedNames.add(name)
		return name
	}

	const addQuery = (
		base: string,
		selector: string,
		cardinality: 'one' | 'many',
	): string => {
		const existing = queries.find(
			q => q.selector === selector && q.cardinality === cardinality,
		)
		if (existing) return existing.name
		const name = uniqueName(base)
		queries.push({
			name,
			selector,
			cardinality,
			message: `${component.tag}: ${selector} missing`,
		})
		return name
	}

	// Pre-collect ref names — thunks may reference any ref in the template.
	const refNames = new Set<string>()
	const collectRefs = (node: TemplateNode): void => {
		if (!isElement(node)) return
		for (const attr of node.attrs)
			if (attr.kind === 'ref') refNames.add(attr.name)
		for (const child of node.children) collectRefs(child)
	}
	collectRefs(component.root)

	const loopFor = (node: TemplateNode): ForIR | null =>
		[...component.fors.values()].find(f => f.output === node) ?? null

	// --- Pass 1: @for loops → each() plans ---------------------------------

	const forPlans = new Map<ForIR, ForClientPlan>()
	for (const loop of component.fors.values()) {
		const output = loop.output
		const { selector, unique } = resolveSelector(component, output)
		if (!unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node.start,
					`No unique selector for the @for output <${output.tag}> in the rendered template; add a distinguishing static attribute (role, class, or data-*).`,
				),
			)
		}
		// Collection naming: the iterable's name when still free, else the
		// plural of the output's role (last segment), else tag + 's'.
		const roleValue = staticAttrs(output).get('role')
		const fallbackBase =
			roleValue !== undefined && roleValue !== null
				? `${roleValue.split('-').pop() ?? roleValue}s`
				: `${output.tag}s`
		const base =
			loop.iterableName && !usedNames.has(loop.iterableName)
				? loop.iterableName
				: fallbackBase
		const collection = addQuery(base, selector, 'many')

		const loopBound = new Set<string>([loop.itemName])
		if (loop.indexName) loopBound.add(loop.indexName)
		// Map hoisted const → attribute it was rendered into as a bare value.
		const constAttr = new Map<string, string>()
		for (const attr of output.attrs) {
			if (attr.kind === 'server' && nodeType(attr.node) === 'Identifier')
				constAttr.set(attr.exprText, attr.name)
		}

		const referencedConsts = new Set<string>()
		/**
		 * Validate free names of a client construct inside the loop: signals
		 * and (rebuilt) hoisted consts are fine; loop variables are the
		 * hoist-first error; anything else is server-only.
		 */
		const checkClientNames = (node: TsrxNode, what: string): void => {
			collectAmbient(node)
			const free = dependenciesOf(node)
			const loopRefs = [...free].filter(name => loopBound.has(name))
			if (loopRefs.length > 0) {
				diagnostics.push(
					diagnostic.loopVariableInReactiveThunk(source, node.start, loopRefs),
				)
				return
			}
			const bad: string[] = []
			for (const name of free) {
				if (component.signals.some(s => s.name === name)) continue
				if (loop.hoisted.some(h => h.name === name)) {
					referencedConsts.add(name)
					continue
				}
				if (refNames.has(name)) continue
				if (JS_GLOBALS.has(name)) continue
				if (CONTEXT_NAMES.has(name)) continue
				bad.push(name)
			}
			if (bad.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.start,
						`${what} references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')} inside an @for body; the client only knows signals, refs, and rebound consts`,
					),
				)
			}
		}

		const effectsPlan: LoopEffectPlan[] = []
		for (const attr of output.attrs) {
			if (attr.kind === 'reactive') {
				checkClientNames(attr.thunk, `Reactive attribute \`${attr.name}\``)
				effectsPlan.push({
					kind: 'watch-attr',
					attr: attr.name,
					thunkText: attr.thunkText,
					coerceToString: returnsNumber(attr.thunk.body),
				})
			} else if (attr.kind === 'class-map') {
				checkClientNames(attr.object, 'Reactive class map')
				effectsPlan.push({
					kind: 'watch-class',
					keys: classMapKeys(attr.object),
					thunkText: attr.thunkText,
				})
			} else if (attr.kind === 'event') {
				checkClientNames(attr.handler, `Event attribute \`${attr.name}\``)
				effectsPlan.push({
					kind: 'on',
					event: attr.event,
					handlerText: attr.handlerText,
				})
			}
		}
		const gatedLazyChild = (node: TemplateNode): unknown => {
			if (node.kind === 'expr' && node.lazy) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						'Lazy &{ } children inside @for bodies lower to template slots (milestone 3, reconcile())',
					),
				)
			}
			if (node.kind === 'element') for (const child of node.children) gatedLazyChild(child)
			return undefined
		}
		gatedLazyChild(loop.output)

		const itemParam =
			loop.itemName === collection ? `${loop.itemName}El` : loop.itemName
		const rebindings: RebindingPlan[] = []
		for (const hoisted of loop.hoisted) {
			if (!referencedConsts.has(hoisted.name)) continue
			const attr = constAttr.get(hoisted.name)
			if (!attr) {
				diagnostics.push(
					diagnostic.constNotRebindable(
						source,
						hoisted.node.start,
						hoisted.name,
						output.tag,
					),
				)
				continue
			}
			rebindings.push({
				name: hoisted.name,
				expr: attr === 'id' ? `${itemParam}.id` : `${itemParam}.getAttribute('${attr}')!`,
			})
		}

		forPlans.set(loop, { collection, itemParam, rebindings, effects: effectsPlan })
	}

	// --- Pass 2: signal render sites (document order) ------------------------
	// Direct sites (text child, direct attribute) and membership marks; the
	// canonical harvest site is the first direct site by document order,
	// else the first membership mark.
	type Site =
		| { kind: 'text' | 'attr'; signal: string; element: ElementNode; attr?: string; order: number }
		| { kind: 'membership'; signal: string; element: ElementNode; attr: string; constName: string; order: number }
	const sites: Site[] = []
	let documentOrder = 0

	const recordSites = (node: TemplateNode, insideLoopOutput: boolean): void => {
		if (!isElement(node)) return
		const isLoopOutput = !!loopFor(node)
		for (const attr of node.attrs) {
			if (attr.kind !== 'reactive') continue
			const order = documentOrder++
			for (const signal of component.signals.map(s => s.name)) {
				if (isDirectAttrThunk(attr.thunk, signal)) {
					sites.push({ kind: 'attr', signal, element: node, attr: attr.name, order })
					break
				}
				const constName = membershipConst(attr.thunk, signal)
				if (constName && isLoopOutput) {
					sites.push({
						kind: 'membership',
						signal,
						element: node,
						attr: attr.name,
						constName,
						order,
					})
					break
				}
			}
		}
		for (const child of node.children) {
			if (child.kind === 'expr' && child.lazy && !insideLoopOutput && !isLoopOutput) {
				const order = documentOrder++
				const expr = child.expr
				if (nodeType(expr) === 'Identifier') {
					const name = String((expr as TsrxNode).name)
					if (component.signals.some(s => s.name === name))
						sites.push({ kind: 'text', signal: name, element: node, order })
				} else if (
					nodeType(expr) === 'Literal' &&
					typeof (expr as TsrxNode).value === 'string'
				) {
					const signal = component.exposeProps.get(String((expr as TsrxNode).value))
					if (signal) sites.push({ kind: 'text', signal, element: node, order })
				} else if (nodeType(expr) === 'ArrowFunctionExpression') {
					const body = (expr as TsrxNode).body
					for (const signal of component.signals.map(s => s.name)) {
						if (isSignalGetCall(body, signal)) {
							sites.push({ kind: 'text', signal, element: node, order })
							break
						}
					}
				}
			}
			recordSites(child, insideLoopOutput || isLoopOutput)
		}
	}
	recordSites(component.root, false)

	// --- Pass 3: harvest plans ------------------------------------------------
	for (const signal of component.signals) {
		const own = sites
			.filter(s => s.signal === signal.name)
			.sort((a, b) => a.order - b.order)
		if (own.length === 0) {
			diagnostics.push(
				diagnostic.signalNotHarvestable(source, signal.init?.start, signal.name),
			)
			continue
		}
		const direct = own.find(s => s.kind === 'text' || s.kind === 'attr') as
			| { kind: 'text'; element: ElementNode }
			| { kind: 'attr'; element: ElementNode; attr: string }
			| undefined
		if (direct) {
			const { selector, unique } = resolveSelector(component, direct.element)
			if (!unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						direct.element.node.start,
						`No unique selector for the harvest site of signal \`${signal.name}\`; add a distinguishing static attribute (role, class, or data-*).`,
					),
				)
			}
			const query = addQuery(
				sanitizeVarName(direct.element.tag),
				selector,
				'one',
			)
			if (direct.kind === 'text') {
				harvests.push({
					kind: 'text',
					signal: signal.name,
					query,
					parser: parserForType(signal.inferredType),
				})
			} else {
				harvests.push({
					kind: 'attr',
					signal: signal.name,
					query,
					attr: direct.attr,
					parser: parserForType(signal.inferredType),
				})
			}
			continue
		}
		// membership: the mark sits on a @for output; the value attribute is
		// the one the compared const was rendered into.
		const mark = own[0] as {
			kind: 'membership'
			element: ElementNode
			attr: string
			constName: string
		}
		const loop = loopFor(mark.element)
		const plan = loop ? forPlans.get(loop) : undefined
		const valueAttr = loop
			? [...loop.output.attrs].find(
					(attr): attr is Extract<AttributeIR, { kind: 'server' }> =>
						attr.kind === 'server' && attr.exprText === mark.constName,
				)
			: undefined
		if (!loop || !plan || !valueAttr) {
			diagnostics.push(
				diagnostic.signalNotHarvestable(source, signal.init?.start, signal.name),
			)
			continue
		}
		harvests.push({
			kind: 'membership',
			signal: signal.name,
			collection: plan.collection,
			markAttr: mark.attr,
			valueAttr: valueAttr.name,
			default: defaultForType(signal.inferredType),
		})
	}

	// --- Pass 4: top-level effects (document order) ----------------------------
	const emitTopEffects = (node: TemplateNode): void => {
		if (!isElement(node)) return
		if (node !== component.root && loopFor(node)) {
			const plan = forPlans.get(loopFor(node) as ForIR)
			if (plan) effects.push({ kind: 'each', for: plan })
			return
		}
		if (node === component.root) {
			for (const attr of component.root.attrs) {
				if (
					attr.kind === 'event' ||
					attr.kind === 'reactive' ||
					attr.kind === 'class-map' ||
					attr.kind === 'ref'
				) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							component.root.node.start,
							'Reactive constructs on the component root element',
						),
					)
					break
				}
			}
		} else {
			const hasClientConstruct =
				node.attrs.some(a => a.kind !== 'static' && a.kind !== 'server') ||
				node.children.some(c => c.kind === 'expr' && c.lazy)
			if (hasClientConstruct) {
				const { selector, unique } = resolveSelector(component, node)
				if (!unique) {
					diagnostics.push(
						diagnostic.unaddressableElement(
							source,
							node.node.start,
							`No unique selector for <${node.tag}> in the rendered template; add a distinguishing static attribute (role, class, or data-*).`,
						),
					)
				}
				const refAttr = node.attrs.find(a => a.kind === 'ref') as
					| { kind: 'ref'; name: string }
					| undefined
				const query = addQuery(refAttr?.name ?? sanitizeVarName(node.tag), selector, 'one')
				const isCustom = node.tag.includes('-')
				for (const attr of node.attrs) {
					if (attr.kind === 'reactive') {
						collectAmbient(attr.thunk)
						const free = dependenciesOf(attr.thunk)
						const bad = [...free].filter(
							name =>
								!component.signals.some(s => s.name === name) &&
								!refNames.has(name) &&
								!JS_GLOBALS.has(name) &&
								!CONTEXT_NAMES.has(name),
						)
						if (bad.length > 0) {
							diagnostics.push(
								diagnostic.unsupported(
									source,
									attr.thunk.start,
									`Reactive attribute \`${attr.name}\` references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
								),
							)
						}
						if (isCustom && registry.has(node.tag)) {
							effects.push({
								kind: 'pass',
								query,
								prop: attr.name,
								thunkText: attr.thunkText,
							})
						} else {
							// A host-prop mirror always dispatches as a property —
							// attribute dispatch would be wrong for
							// property-backed targets like `input.value`.
							const mirror = hostPropMirrorOf(attr.thunk)
							effects.push({
								kind: 'watch-attr',
								query,
								attr: attr.name,
								thunkText: attr.thunkText,
								dispatch:
									mirror !== null || isCustom ? 'property' : 'attribute',
								coerceToString:
									mirror === null && !isCustom && returnsNumber(attr.thunk.body),
							})
						}
					} else if (attr.kind === 'class-map') {
						collectAmbient(attr.object)
						for (const key of classMapKeys(attr.object)) {
							effects.push({
								kind: 'watch-attr',
								query,
								attr: `class:${key}`,
								thunkText: attr.thunkText,
								dispatch: 'attribute',
								coerceToString: false,
							})
						}
					} else if (attr.kind === 'event') {
						collectAmbient(attr.handler)
						effects.push({
							kind: 'on',
							query,
							event: attr.event,
							handlerText: attr.handlerText,
						})
					}
				}
				for (const child of node.children) {
					if (child.kind !== 'expr' || !child.lazy) continue
					collectAmbient(child.expr)
					effects.push({
						kind: 'watch-text',
						query,
						source: lazyWatchSource(component, child),
					})
				}
			}
		}
		for (const child of node.children) emitTopEffects(child)
	}
	emitTopEffects(component.root)

	return { queries, harvests, effects, ambientContext: [...ambient].sort() }
}
