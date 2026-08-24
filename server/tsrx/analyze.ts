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

import type { TsrxNode } from '@tsrx/core'
import {
	CONTEXT_NAMES,
	freeIdentifiers,
	JS_GLOBALS,
	MANAGED_TEXT_PROPS,
} from './ast-utils'
import type {
	AttributeIR,
	ComponentIR,
	ForIR,
	PassEntryIR,
	TemplateNode,
} from './compiler'
import type { CompileDiagnostic } from './diagnostics'
import { diagnostic } from './diagnostics'
import type { RegistryEntry } from './registry'

/* === Types === */

type ElementNode = Extract<TemplateNode, { kind: 'element' }>
type ExprNode = Extract<TemplateNode, { kind: 'expr' }>
type IfNode = Extract<TemplateNode, { kind: 'if' }>
type SwitchNode = Extract<TemplateNode, { kind: 'switch' }>
type TryNode = Extract<TemplateNode, { kind: 'try' }>
type ComposeNode = Extract<TemplateNode, { kind: 'compose' }>

export type ParserKind = 'asInteger' | 'asBoolean' | 'asString' | null

/** A generated element query. */
export type QueryPlan = {
	/** Variable name in the generated factory. */
	name: string
	selector: string
	/**
	 * `first(sel, message)` (throws if missing) / `all(sel, message)` / a
	 * non-throwing `first(sel)` for an element that only exists when a
	 * single-branch `@if` (no `@else`) actually rendered it — `message` is
	 * unused for `'maybe'`.
	 */
	cardinality: 'one' | 'many' | 'maybe'
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
	| {
			/**
			 * Arg-substituted seed (LT-008): the initializer reads server args
			 * (e.g. `createCell(value.length)`); the client seeds from the
			 * args' rendered DOM sites — the param identifier is replaced by
			 * an element-derived read (DOM-is-truth, ADR 0023 sub-design 3).
			 */
			kind: 'substitute'
			signal: string
			/** Initializer text with param identifiers replaced by DOM reads. */
			expr: string
	  }
	| {
			/** Reactive List reconciled over the adopted DOM (milestone 3). */
			kind: 'list'
			signal: string
			/**
			 * 'verbatim' — the declared seed is a pure literal; the server
			 * rendered from the same seed, so the DOM agrees by construction.
			 * Otherwise the seed is arg-dependent and the client harvests the
			 * container's adopted children (keys regenerate identically).
			 */
			seed: 'verbatim' | { container: string; valueSelector: string }
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
			/** Source range of `thunkText` (LT-011 span table). */
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			kind: 'watch-class'
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			kind: 'on'
			event: string
			handlerText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }

/** One `@for` over server data lowered to `each()`. */
export type ForClientPlan = {
	/** Collection query variable (`tabs`). */
	collection: string
	/** Element parameter name inside each() (`tab`). */
	itemParam: string
	rebindings: RebindingPlan[]
	effects: LoopEffectPlan[]
}

/** Events on one element inside a reactive-list item, mounted in bindItem. */
export type ReconcileItemEvents = {
	/** bindItem-scoped variable for the element (null target = item root). */
	selector: string | null
	name: string
	message: string
	events: Array<{
		event: string
		handlerText: string
		sourceStart: number | undefined
		sourceEnd: number | undefined
	}>
}

/** One reactive `@for` over a declared List lowered to `reconcile()`. */
export type ReconcilePlan = {
	/** Component tag (query messages). */
	tag: string
	/** Container query variable (`container`). */
	container: string
	/** Extracted-template query variable (`template`). */
	template: string
	/** The declared createList signal (`items`). */
	signal: string
	/** bindItem's item-signal parameter, named after the loop variable. */
	itemParam: string
	/** bindItem's key parameter, from `key k` (null → `_key`). */
	keyParam: string | null
	/** Scoped selector of the element carrying the &{item} hole. */
	holeSelector: string
	itemEvents: ReconcileItemEvents[]
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
			/** Source range of `thunkText` (LT-011 span table). */
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			kind: 'pass'
			query: string
			prop: string
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
			/** `{ get, set }` descriptor's write-back accessor (LT-017). */
			setThunkText: string | undefined
			setSourceStart: number | undefined
			setSourceEnd: number | undefined
	  }
	| {
			kind: 'on'
			query: string
			event: string
			handlerText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * `style={() => ({ … })}` (LT-028): one `watch(thunk, bindStyle(el,
			 * keys))` call against `bindStyle()`'s map-form overload (LT-029) —
			 * every declared CSS property is set from the single evaluated map
			 * in one dispatch. `query` is `'host'` for the component-root case
			 * (LT-028's motivating gap): the target is the ambient `host`, not
			 * a queried descendant.
			 */
			kind: 'watch-style'
			query: string
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * `class={() => ({ … })}` (LT-031): one `watch(thunk, bindClass(el,
			 * keys))` call against `bindClass()`'s map-form overload (LT-029) —
			 * every declared class token is toggled from the single evaluated
			 * map in one dispatch, mirroring `watch-style`. `query` is `'host'`
			 * for the component-root case (LT-032).
			 */
			kind: 'watch-class'
			query: string
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| { kind: 'each'; for: ForClientPlan }
	| { kind: 'reconcile'; for: ReconcilePlan }
	| {
			/**
			 * A verbatim client-only statement (`internals?.states.add(…)`)
			 * lowered from a control-flow branch — always wrapped in a
			 * `'guarded'` effect, never emitted bare (see below).
			 */
			kind: 'raw'
			text: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * Effects that only apply when a single-branch `@if` (no `@else`)
			 * actually rendered — `query` was addressed with a non-throwing
			 * `first()`, so the generated `if (query) { … }` block is the
			 * client-side mirror of the server's own `if (cond) { … }`.
			 */
			kind: 'guarded'
			query: string
			effects: TopEffectPlan[]
	  }
	| {
			/**
			 * An async boundary (`@try`/`@pending`/`@catch`, ADR 0023 sub-design
			 * 13, LT-012): one `watch(signal, { ok, err, nil })` call toggles the
			 * three server-rendered roots' `hidden` property — pure enhance, no
			 * client DOM creation, mirroring `module-lazyload.ts`'s hand-written
			 * shape. `okText`/`errText`, when present, are the arm's own lazy
			 * text child — the resolved value for `okQuery`, the error (or a
			 * member expression over it, e.g. `error.message`) for `errQuery`.
			 */
			kind: 'async'
			signal: string
			pendingQuery: string
			okQuery: string
			errQuery: string
			okText: boolean
			errText: string | null
	  }

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
	/**
	 * Registry tags this component addresses (ref/pass targets) other than
	 * itself. The generated client side-effect-imports their modules so the
	 * children's `declare global` HTMLElementTagNameMap entries resolve in
	 * the client's own type scope (ADR 0023 sub-design 6: type flow by
	 * projection — the child authors its element interface inline).
	 */
	childTags: string[]
}

/* === Internal Functions === */

const isElement = (n: TemplateNode): n is ElementNode => n.kind === 'element'

const nodeType = (node: unknown): string | null =>
	node &&
	typeof node === 'object' &&
	typeof (node as TsrxNode).type === 'string'
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
	const match = selector.match(
		/^([a-z][a-z0-9-]*)?(?:\[([^\]="]+)="([^"]*)"\])?$/,
	)
	if (!match) return false
	const [, tag, attr, value] = match
	if (tag && candidate.tag !== tag) return false
	if (attr) return staticAttrs(candidate).get(attr) === value
	return true
}

/** Structural match count for a selector over the whole template. */
const countForSelector = (node: TemplateNode, selector: string): number => {
	if (node.kind === 'if')
		// Branches are mutually exclusive at runtime: an @if contributes the
		// max of its branch counts, never the sum (same-tag branch roots
		// would otherwise always look ambiguous).
		return Math.max(
			...[node.then, node.alternate].map(branch =>
				branch.reduce(
					(sum, child) => sum + countForSelector(child, selector),
					0,
				),
			),
		)
	if (node.kind === 'switch')
		// Same exclusivity rule, N arms.
		return Math.max(
			...node.cases.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + countForSelector(child, selector),
					0,
				),
			),
		)
	if (node.kind === 'try') {
		// An async boundary (@pending present, ADR 0023 sub-design 13): all
		// three arms coexist in the DOM simultaneously (hidden-toggled, not
		// mutually exclusive) — sum, don't max, and include pendingChildren.
		if (node.pendingChildren !== null)
			return (
				node.children.reduce(
					(sum, c) => sum + countForSelector(c, selector),
					0,
				) +
				node.pendingChildren.reduce(
					(sum, c) => sum + countForSelector(c, selector),
					0,
				) +
				node.catchChildren.reduce(
					(sum, c) => sum + countForSelector(c, selector),
					0,
				)
			)
		// Plain error boundary: body XOR catch renders.
		return Math.max(
			node.children.reduce((sum, c) => sum + countForSelector(c, selector), 0),
			node.catchChildren.reduce(
				(sum, c) => sum + countForSelector(c, selector),
				0,
			),
		)
	}
	if (!isElement(node)) return 0
	let count = matchesSelector(node, selector) ? 1 : 0
	for (const child of node.children) count += countForSelector(child, selector)
	return count
}

/**
 * Structural match count for composed elements over the whole template,
 * grouped by their resolved `.tsrx` source path — the proxy for "this
 * composed target is unique" used by `pass={{ }}` addressing (ADR 0023
 * sub-design 10). Composed elements don't carry reliably-rendered static
 * attributes to build a role/discriminator selector from (they're server
 * args to the child's render call, not guaranteed DOM attributes), so only
 * the count-by-source-identity check is attempted; an author with more than
 * one instance of the same composed child needs a mechanism this milestone
 * doesn't offer yet.
 */
const countComposeBySource = (node: TemplateNode, source: string): number => {
	if (node.kind === 'if')
		return Math.max(
			...[node.then, node.alternate].map(branch =>
				branch.reduce(
					(sum, child) => sum + countComposeBySource(child, source),
					0,
				),
			),
		)
	if (node.kind === 'switch')
		return Math.max(
			...node.cases.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + countComposeBySource(child, source),
					0,
				),
			),
		)
	if (node.kind === 'try')
		return Math.max(
			node.children.reduce(
				(sum, c) => sum + countComposeBySource(c, source),
				0,
			),
			node.catchChildren.reduce(
				(sum, c) => sum + countComposeBySource(c, source),
				0,
			),
		)
	if (node.kind === 'compose') return node.source === source ? 1 : 0
	if (!isElement(node)) return 0
	let count = 0
	for (const child of node.children)
		count += countComposeBySource(child, source)
	return count
}

/**
 * Resolve the selector for an element: try role, bare, then upgrade to a
 * discriminator; accept the first structurally unique candidate. Counting is
 * scoped to `tree` — the whole template, or a loop output subtree for
 * bindItem-scoped element queries.
 */
const resolveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
): { selector: string; unique: boolean } => {
	const candidates = [
		buildSelector(element, 'role'),
		buildSelector(element, 'bare'),
		buildSelector(element, 'discriminator'),
	].filter((s): s is string => s !== null)
	for (const selector of candidates) {
		if (countForSelector(tree, selector) === 1)
			return { selector, unique: true }
	}
	return { selector: candidates[0] ?? element.tag, unique: false }
}

const resolveSelector = (
	component: ComponentIR,
	element: ElementNode,
): { selector: string; unique: boolean } =>
	resolveSelectorIn(component.root, element)

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
	if (
		nodeType(body) !== 'BinaryExpression' &&
		nodeType(body) !== 'CallExpression'
	)
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
		if (nodeType(key) === 'Identifier')
			keys.push(String((key as TsrxNode).name))
	}
	return keys
}

/**
 * Property names of a style-map's object literal. Unlike `classMapKeys`,
 * also accepts string-literal keys — CSS custom properties (`'--gauge-color'`)
 * are not valid JS identifiers and must be quoted at the call site.
 */
const styleMapKeys = (object: TsrxNode): string[] => {
	const keys: string[] = []
	if (nodeType(object) !== 'ObjectExpression') return keys
	const props = object.properties
	if (!Array.isArray(props)) return keys
	for (const prop of props) {
		if (nodeType(prop) !== 'Property') continue
		const key = (prop as TsrxNode).key
		if (nodeType(key) === 'Identifier')
			keys.push(String((key as TsrxNode).name))
		else if (
			nodeType(key) === 'Literal' &&
			typeof (key as TsrxNode).value === 'string'
		)
			keys.push(String((key as TsrxNode).value))
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

const lazyWatchSource = (component: ComponentIR, child: ExprNode): string => {
	const expr = child.expr
	if (nodeType(expr) === 'Identifier') return child.exprText
	if (
		nodeType(expr) === 'Literal' &&
		typeof (expr as TsrxNode).value === 'string'
	) {
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
	/**
	 * Composed (PascalCase) elements' targets, keyed by resolved `.tsrx`
	 * source path (ADR 0023 sub-design 10) — needed only to resolve the
	 * underlying custom-element tag for a `pass={{ }}`-addressed composed
	 * target's query selector text.
	 */
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): ClientPlan => {
	const source = component.source
	const queries: QueryPlan[] = []
	const harvests: HarvestPlan[] = []
	const effects: TopEffectPlan[] = []
	const childTags = new Set<string>()
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
		cardinality: 'one' | 'many' | 'maybe',
	): string => {
		const existing = queries.find(
			q => q.selector === selector && q.cardinality === cardinality,
		)
		if (existing) return existing.name
		// Addressing another registry component means needing its element
		// interface — the generated client imports its module for the tag-map
		// augmentation (type flow by projection).
		const tag = /^[a-z][a-z0-9-]*/.exec(selector)?.[0] ?? ''
		if (
			tag.includes('-') &&
			tag !== component.tag &&
			registry.has(tag) &&
			!childTags.has(tag)
		)
			childTags.add(tag)
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
		if (node.kind === 'if') {
			for (const child of [...node.then, ...node.alternate]) collectRefs(child)
			return
		}
		if (node.kind === 'switch') {
			for (const arm of node.cases)
				for (const child of arm.children) collectRefs(child)
			return
		}
		if (node.kind === 'try') {
			for (const child of [...node.children, ...node.catchChildren])
				collectRefs(child)
			return
		}
		if (node.kind === 'compose') {
			for (const attr of node.attrs)
				if (attr.kind === 'ref') refNames.add(attr.name)
			return
		}
		if (!isElement(node)) return
		for (const attr of node.attrs)
			if (attr.kind === 'ref') refNames.add(attr.name)
		for (const child of node.children) collectRefs(child)
	}
	collectRefs(component.root)

	/** Free names in a reactive/pass thunk the client cannot resolve. */
	const badFreeNames = (node: TsrxNode): string[] =>
		[...dependenciesOf(node)].filter(
			name =>
				!component.signals.some(s => s.name === name) &&
				!refNames.has(name) &&
				!JS_GLOBALS.has(name) &&
				!CONTEXT_NAMES.has(name),
		)

	/**
	 * Validate and lower one target's `pass={{ }}` entries into `pass` effect
	 * plans — shared by raw dashed-tag elements and composed elements, the
	 * two `pass={{ }}` addressing paths (ADR 0023 sub-design 10).
	 */
	const emitPassEntries = (
		entries: PassEntryIR[],
		query: string,
		sink: TopEffectPlan[] = effects,
	): void => {
		for (const entry of entries) {
			collectAmbient(entry.thunk)
			const bad = badFreeNames(entry.thunk)
			if (bad.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						entry.thunk.start,
						`pass entry \`${entry.prop}\` references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
					),
				)
			}
			if (entry.setThunk) {
				collectAmbient(entry.setThunk)
				const badSet = badFreeNames(entry.setThunk)
				if (badSet.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							entry.setThunk.start,
							`pass entry \`${entry.prop}\` (set) references server-only name(s) ${badSet.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
						),
					)
				}
			}
			sink.push({
				kind: 'pass',
				query,
				prop: entry.prop,
				thunkText: entry.thunkText,
				sourceStart: entry.thunk.start,
				sourceEnd: entry.thunk.end,
				setThunkText: entry.setThunkText,
				setSourceStart: entry.setThunk?.start,
				setSourceEnd: entry.setThunk?.end,
			})
		}
	}

	const loopFor = (node: TemplateNode): ForIR | null =>
		[...component.fors.values()].find(f => f.output === node) ?? null

	// --- Pass 1: @for loops → each() plans ---------------------------------

	const forPlans = new Map<ForIR, ForClientPlan>()
	for (const loop of component.fors.values()) {
		if (loop.listSignal) continue // reactive loops → pass 1b (reconcile)
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
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'class-map') {
				checkClientNames(attr.object, 'Reactive class map')
				effectsPlan.push({
					kind: 'watch-class',
					keys: classMapKeys(attr.object),
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'event') {
				checkClientNames(attr.handler, `Event attribute \`${attr.name}\``)
				effectsPlan.push({
					kind: 'on',
					event: attr.event,
					handlerText: attr.handlerText,
					sourceStart: attr.handler.start,
					sourceEnd: attr.handler.end,
				})
			}
		}
		const gatedLazyChild = (node: TemplateNode): unknown => {
			if (node.kind === 'expr' && node.lazy) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						'Lazy &{ } children inside server-data @for bodies have no lowering (each() scopes own no template slots)',
					),
				)
			}
			if (node.kind === 'element')
				for (const child of node.children) gatedLazyChild(child)
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
				expr:
					attr === 'id'
						? `${itemParam}.id`
						: `${itemParam}.getAttribute('${attr}')!`,
			})
		}

		forPlans.set(loop, {
			collection,
			itemParam,
			rebindings,
			effects: effectsPlan,
		})
	}

	// --- Pass 1b: reactive-list @for → reconcile() plans (milestone 3) -------

	const reconcilePlans = new Map<ForIR, ReconcilePlan>()

	const parentOf = (target: TemplateNode): ElementNode | null => {
		const walk = (node: TemplateNode): ElementNode | null => {
			if (!isElement(node)) return null
			for (const child of node.children) {
				if (child === target) return node
				const found = walk(child)
				if (found) return found
			}
			return null
		}
		return walk(component.root)
	}

	for (const loop of component.fors.values()) {
		if (!loop.listSignal) continue
		// One reactive list per component: every extracted template would
		// match the same `first('template')` query, and the second list's
		// reconcile would clone the FIRST list's item shape with no
		// diagnostic. Scoped template addressing (sibling selectors) is the
		// follow-up if a corpus component ever needs two lists.
		if (reconcilePlans.size > 0) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					loop.output.node.start,
					'Only one reactive-list @for per component is supported — a second list would share the extracted <template> selector. Split into components or use server-data lists.',
				),
			)
			continue
		}
		const output = loop.output

		// Container: the parent element holding the loop output. The host
		// itself cannot be the container (no self-query).
		const container = parentOf(output)
		if (!container || container === component.root) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					output.node.start,
					'A reactive-list @for directly under the component root — reconcile() needs a container element distinct from the host (wrap the loop in one).',
				),
			)
			continue
		}
		const containerSelector = resolveSelector(component, container)
		if (!containerSelector.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					container.node.start,
					`No unique selector for the @for container <${container.tag}>; add a distinguishing static attribute (role, class, or data-*).`,
				),
			)
		}
		const containerName = addQuery(
			'container',
			containerSelector.selector,
			'one',
		)

		// The extracted <template> is compiler-emitted; an authored one would
		// collide with the emitted selector.
		if (countForSelector(component.root, 'template') > 0) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node.start,
					'An authored <template> collides with the compiler-extracted item template of the reactive-list @for.',
				),
			)
		}
		const templateName = addQuery('template', 'template', 'one')

		// The item hole's parent element — the item value's DOM site, used by
		// the arg-seeded harvest read.
		const findHoleParent = (node: TemplateNode): ElementNode | null => {
			if (!isElement(node)) return null
			for (const child of node.children) {
				if (
					child.kind === 'expr' &&
					child.lazy &&
					child.exprText === loop.itemName
				)
					return node
				const found = findHoleParent(child)
				if (found) return found
			}
			return null
		}
		const holeParent = findHoleParent(output)
		const holeSelector = holeParent
			? resolveSelectorIn(output, holeParent).selector
			: output.tag

		// Per-item events, grouped per target element, bindItem-scoped.
		const itemEvents: ReconcileItemEvents[] = []
		const takenNames = new Set<string>([
			loop.itemName,
			...(loop.keyName ? [loop.keyName] : []),
			'first',
			'_element',
		])
		const checkItemHandler = (handler: TsrxNode, what: string): void => {
			collectAmbient(handler)
			const free = dependenciesOf(handler)
			if (free.has(loop.itemName)) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						handler.start,
						`${what} references the loop item \`${loop.itemName}\` — inside reconcile()'s bindItem it is a Signal, not the value; render it via &{${loop.itemName}} instead.`,
					),
				)
			}
			const bad = [...free].filter(
				name =>
					name !== loop.itemName &&
					name !== loop.keyName &&
					!component.signals.some(s => s.name === name) &&
					!refNames.has(name) &&
					!JS_GLOBALS.has(name) &&
					!CONTEXT_NAMES.has(name),
			)
			if (bad.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						handler.start,
						`${what} references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')} inside a reactive-list @for body; the client only knows signals, refs, the key binding, and globals`,
					),
				)
			}
		}
		const collectItemEvents = (
			node: TemplateNode,
			isItemRoot: boolean,
		): void => {
			if (!isElement(node)) return
			const elementEvents = node.attrs.filter(a => a.kind === 'event') as Array<
				Extract<AttributeIR, { kind: 'event' }>
			>
			if (elementEvents.length > 0) {
				let target: ReconcileItemEvents | undefined
				if (isItemRoot) {
					target = itemEvents.find(e => e.selector === null)
					if (!target) {
						target = {
							selector: null,
							name: '_element',
							message: '',
							events: [],
						}
						itemEvents.push(target)
					}
				} else {
					const scoped = resolveSelectorIn(output, node)
					if (!scoped.unique) {
						diagnostics.push(
							diagnostic.unaddressableElement(
								source,
								node.node.start,
								`No unique selector for <${node.tag}> inside the @for item template; add a distinguishing static attribute.`,
							),
						)
					}
					target = itemEvents.find(e => e.selector === scoped.selector)
					if (!target) {
						let name = sanitizeVarName(node.tag)
						while (takenNames.has(name)) name = `${name}El`
						takenNames.add(name)
						target = {
							selector: scoped.selector,
							name,
							message: `${component.tag}: ${scoped.selector} missing`,
							events: [],
						}
						itemEvents.push(target)
					}
				}
				for (const attr of elementEvents) {
					checkItemHandler(attr.handler, `Event attribute \`${attr.name}\``)
					target.events.push({
						event: attr.event,
						handlerText: attr.handlerText,
						sourceStart: attr.handler.start,
						sourceEnd: attr.handler.end,
					})
				}
			}
			for (const child of node.children) collectItemEvents(child, false)
		}
		collectItemEvents(output, true)

		reconcilePlans.set(loop, {
			tag: component.tag,
			container: containerName,
			template: templateName,
			signal: loop.listSignal,
			itemParam: loop.itemName,
			keyParam: loop.keyName,
			holeSelector,
			itemEvents,
		})
	}

	// --- Pass 2: signal render sites (document order) ------------------------
	// Direct sites (text child, direct attribute) and membership marks; the
	// canonical harvest site is the first direct site by document order,
	// else the first membership mark.
	type Site =
		| {
				kind: 'text' | 'attr'
				signal: string
				element: ElementNode
				attr?: string
				order: number
		  }
		| {
				kind: 'membership'
				signal: string
				element: ElementNode
				attr: string
				constName: string
				order: number
		  }
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
					sites.push({
						kind: 'attr',
						signal,
						element: node,
						attr: attr.name,
						order,
					})
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
			if (
				child.kind === 'expr' &&
				child.lazy &&
				!insideLoopOutput &&
				!isLoopOutput
			) {
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
					const signal = component.exposeProps.get(
						String((expr as TsrxNode).value),
					)
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

	/**
	 * The @if node whose branches hold `target` as a direct branch root, if
	 * any — elements inside conditional branches address through the union
	 * of all branch roots (whichever rendered is the one in the DOM).
	 */
	const enclosingIfOf = (target: ElementNode): IfNode | null => {
		const walk = (node: TemplateNode): IfNode | null => {
			if (node.kind === 'if') {
				if ([...node.then, ...node.alternate].includes(target)) return node
				for (const child of [...node.then, ...node.alternate]) {
					const found = walk(child)
					if (found) return found
				}
				return null
			}
			if (!isElement(node)) return null
			for (const child of node.children) {
				const found = walk(child)
				if (found) return found
			}
			return null
		}
		return walk(component.root)
	}

	/** Selector for an element, union-addressed when it is an @if branch root. */
	const selectorFor = (
		el: ElementNode,
	): { selector: string; unique: boolean } => {
		const enclosing = enclosingIfOf(el)
		if (!enclosing) return resolveSelector(component, el)
		const roots = [...enclosing.then, ...enclosing.alternate].filter(isElement)
		const clauses: string[] = []
		for (const root of roots) {
			// Global tree (not `root` itself) — `resolveSelectorIn` tries
			// role → bare tag → discriminator IN ORDER and stops at the first
			// one unique WITHIN the tree it's given; passing `root` as its
			// own tree made every candidate trivially "unique" (an element is
			// always unique among itself), so a same-tag sibling elsewhere in
			// the template (two plain `<p>`s, one per @if) was never caught
			// and the bare-tag candidate always won even when ambiguous.
			const self = resolveSelectorIn(component.root, root)
			if (!self.unique) return { selector: self.selector, unique: false }
			if (!clauses.includes(self.selector)) clauses.push(self.selector)
		}
		return { selector: clauses.join(', '), unique: true }
	}

	/**
	 * DOM read expression for a server arg, traced to its rendered site:
	 * a host-prop mirror (`value={() => host.value}` where the root renders
	 * the parser-exposed prop from this arg) wins — read the target element's
	 * property; then a plain element attribute rendering the arg bare; then
	 * the root attribute via `host.getAttribute`. Null when the arg renders
	 * nowhere (the signal stays unharvestable).
	 */
	const paramDomRead = (param: string): string | null => {
		const childrenOf = (node: TemplateNode): TemplateNode[] =>
			node.kind === 'if'
				? [...node.then, ...node.alternate]
				: isElement(node)
					? node.children
					: []
		const findMirror = (
			node: TemplateNode,
		): {
			el: ElementNode
			attr: Extract<AttributeIR, { kind: 'reactive' }>
		} | null => {
			if (isElement(node)) {
				for (const attr of node.attrs) {
					if (attr.kind !== 'reactive') continue
					const prop = hostPropMirrorOf(attr.thunk)
					if (!prop || !component.parserExposeProps.has(prop)) continue
					const rootAttr = component.root.attrs.find(
						a => a.kind === 'server' && a.name === prop,
					) as Extract<AttributeIR, { kind: 'server' }> | undefined
					if (rootAttr && rootAttr.exprText === param) return { el: node, attr }
				}
			}
			for (const child of childrenOf(node)) {
				const found = findMirror(child)
				if (found) return found
			}
			return null
		}
		const mirror = findMirror(component.root)
		if (mirror) {
			const resolved = selectorFor(mirror.el)
			if (!resolved.unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						mirror.el.node.start,
						`No unique selector for the DOM site of server arg \`${param}\` (<${mirror.el.tag}>); add a distinguishing static attribute.`,
					),
				)
				return null
			}
			const refAttr = mirror.el.attrs.find(a => a.kind === 'ref') as
				| { kind: 'ref'; name: string }
				| undefined
			const query = addQuery(
				refAttr?.name ?? sanitizeVarName(mirror.el.tag),
				resolved.selector,
				'one',
			)
			return `${query}.${mirror.attr.name}`
		}
		const findAttrSite = (
			node: TemplateNode,
		): {
			el: ElementNode
			attr: Extract<AttributeIR, { kind: 'server' }>
		} | null => {
			if (isElement(node))
				for (const attr of node.attrs)
					if (attr.kind === 'server' && attr.exprText === param)
						return { el: node, attr }
			for (const child of childrenOf(node)) {
				const found = findAttrSite(child)
				if (found) return found
			}
			return null
		}
		const site = findAttrSite(component.root)
		if (site && site.el !== component.root) {
			const resolved = selectorFor(site.el)
			if (!resolved.unique) return null
			const refAttr = site.el.attrs.find(a => a.kind === 'ref') as
				| { kind: 'ref'; name: string }
				| undefined
			// A DOM-read site inside a single-branch @if (no @else) may not
			// exist at all — address it the same way its own branch-root query
			// would (non-throwing 'maybe'), and null-guard the read, instead of
			// a throwing `first()` the substituted expression could crash on
			// (ADR 0023 sub-design 12).
			const enclosing = enclosingIfOf(site.el)
			const optional = !!enclosing && enclosing.alternate.length === 0
			const query = addQuery(
				refAttr?.name ?? sanitizeVarName(site.el.tag),
				resolved.selector,
				optional ? 'maybe' : 'one',
			)
			return optional
				? `(${query}?.getAttribute('${site.attr.name}') ?? '')`
				: `(${query}.getAttribute('${site.attr.name}') ?? '')`
		}
		const rootAttr = component.root.attrs.find(
			a => a.kind === 'server' && a.name !== null && a.exprText === param,
		) as Extract<AttributeIR, { kind: 'server' }> | undefined
		if (rootAttr) {
			ambient.add('host')
			return `(host.getAttribute('${rootAttr.name}') ?? '')`
		}
		return null
	}

	/**
	 * Rewrite a pure-arg initializer by replacing each param identifier with
	 * its DOM read (`value.length` → `input.value.length`), right-to-left by
	 * source range so surrounding text is untouched. Free names that are
	 * already client-known by another route (another signal declared earlier
	 * in the factory, a ref, a context member) pass through unrewritten — only
	 * server args need a DOM substitution (ADR 0023 sub-design 12: a `deriveCell`
	 * callback may read both a param, needing substitution, and a sibling
	 * signal, needing none).
	 */
	const substituteArgExpr = (
		init: TsrxNode,
		/**
		 * Allow a no-params-to-substitute initializer to pass through
		 * verbatim (ADR 0023 sub-design 13): sound only for `deriveCell`/
		 * `deriveStore` signals, which are FORCED through this path
		 * unconditionally (no direct-site harvest is even attempted for
		 * them) — a `createCell`/`createState` signal with a literal,
		 * unrendered initializer must still fail (TSRX004): those DO have a
		 * direct-site harvest route, and a silently-never-rendered signal is
		 * exactly the drift ADR 0003 exists to catch.
		 */
		allowVerbatim: boolean,
	): string | null => {
		const free = dependenciesOf(init)
		const signalNames = new Set(component.signals.map(s => s.name))
		if (
			[...free].some(
				n =>
					!JS_GLOBALS.has(n) &&
					!component.paramNames.includes(n) &&
					!signalNames.has(n) &&
					!CONTEXT_NAMES.has(n) &&
					!refNames.has(n),
			)
		)
			return null
		const params = [...free].filter(n => component.paramNames.includes(n))
		if (typeof init.start !== 'number' || typeof init.end !== 'number')
			return null
		// Nothing to substitute: the initializer has no server-arg dependency
		// at all (e.g. a niladic async compute), so it is already portable,
		// identical JS on both sides — reuse it verbatim, exactly like a pure
		// literal list seed (ADR 0023 sub-design 13). Only sound for signals
		// with no direct-site harvest route at all (see `allowVerbatim`'s doc).
		if (params.length === 0)
			return allowVerbatim ? source.slice(init.start, init.end) : null
		const reads = new Map<string, string>()
		for (const param of params) {
			const read = paramDomRead(param)
			if (!read) return null
			reads.set(param, read)
		}
		const ranges: Array<[number, number, string]> = []
		const collect = (node: unknown): void => {
			if (Array.isArray(node)) {
				for (const child of node) collect(child)
				return
			}
			if (
				!node ||
				typeof node !== 'object' ||
				typeof (node as TsrxNode).type !== 'string'
			)
				return
			const current = node as TsrxNode & Record<string, unknown>
			if (current.type === 'Identifier') {
				const name = String(current.name)
				if (
					reads.has(name) &&
					typeof current.start === 'number' &&
					typeof current.end === 'number'
				)
					ranges.push([current.start, current.end, reads.get(name) as string])
				return
			}
			for (const [key, value] of Object.entries(current)) {
				if (key === 'loc' || key === 'range' || key === 'parent') continue
				// Non-computed member properties and object keys are positions,
				// not reads — same scoping as freeIdentifiers.
				if (
					key === 'property' &&
					current.type === 'MemberExpression' &&
					!current.computed
				)
					continue
				if (key === 'key' && current.type === 'Property' && !current.computed)
					continue
				if (value && typeof value === 'object') collect(value)
			}
		}
		collect(init)
		let expr = source.slice(init.start, init.end)
		for (const [start, end, read] of ranges.sort((a, b) => b[0] - a[0]))
			expr =
				expr.slice(0, start - (init.start as number)) +
				read +
				expr.slice(end - (init.start as number))
		return expr
	}

	for (const signal of component.signals) {
		// A reconciled List seeds from the adopted DOM, not a text/attr site.
		const listPlan = [...reconcilePlans.values()].find(
			p => p.signal === signal.name,
		)
		if (listPlan) {
			const free = signal.init ? dependenciesOf(signal.init) : new Set<string>()
			if ([...free].every(name => JS_GLOBALS.has(name))) {
				harvests.push({ kind: 'list', signal: signal.name, seed: 'verbatim' })
			} else if ([...free].every(name => component.paramNames.includes(name))) {
				harvests.push({
					kind: 'list',
					signal: signal.name,
					seed: {
						container: listPlan.container,
						valueSelector: listPlan.holeSelector,
					},
				})
			} else {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						signal.init?.start,
						`List seed of \`${signal.name}\` must be a pure literal or derive from server args — the client either reuses the literal (the server rendered from it) or harvests the container's adopted children.`,
					),
				)
			}
			continue
		}
		// `deriveCell`/`deriveStore` initializers are callbacks, not raw values
		// — a 'text'/'attr' direct-site harvest would splice the DOM read in
		// place of the whole function (ADR 0023 sub-design 12). A rendered
		// lazy child of the signal's own name still exists for the WATCH
		// target/initial value (Pass 4 wires it independently of harvest
		// selection here), but harvesting always goes through the arg-
		// substitution route for these constructors.
		const isDerivedCallback =
			signal.constructor === 'deriveCell' ||
			signal.constructor === 'deriveStore'
		const own = isDerivedCallback
			? []
			: sites
					.filter(s => s.signal === signal.name)
					.sort((a, b) => a.order - b.order)
		if (own.length === 0) {
			// No rendered site: an initializer over server args can still seed
			// from the args' DOM sites (LT-008 substitution rule).
			const substituted = signal.init
				? substituteArgExpr(signal.init, isDerivedCallback)
				: null
			if (substituted) {
				harvests.push({
					kind: 'substitute',
					signal: signal.name,
					expr: substituted,
				})
				continue
			}
			diagnostics.push(
				diagnostic.signalNotHarvestable(
					source,
					signal.init?.start,
					signal.name,
				),
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
				diagnostic.signalNotHarvestable(
					source,
					signal.init?.start,
					signal.name,
				),
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

	/**
	 * Emit the effects of one element's client constructs against `query` —
	 * the shared body for plain elements and @if branch-root unions alike.
	 */
	const emitConstructEffects = (
		el: ElementNode,
		query: string,
		sink: TopEffectPlan[] = effects,
	): void => {
		const isCustom = el.tag.includes('-')
		for (const attr of el.attrs) {
			if (attr.kind === 'reactive') {
				collectAmbient(attr.thunk)
				const bad = badFreeNames(attr.thunk)
				if (bad.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							attr.thunk.start,
							`Reactive attribute \`${attr.name}\` references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
						),
					)
				}
				if (isCustom) {
					// ADR 0023 sub-design 4 (amended by sub-design 10): a
					// function-valued attribute is only ever a reactive binding
					// on NATIVE elements. Custom-element interop is solely
					// through the explicit `pass={{ }}` attribute below — one
					// dispatch path, not two shape-inferred ones.
					diagnostics.push(
						diagnostic.reactiveAttrOnCustomElement(
							source,
							attr.thunk.start,
							el.tag,
							attr.name,
						),
					)
					continue
				}
				// A host-prop mirror always dispatches as a property —
				// attribute dispatch would be wrong for property-backed
				// targets like `input.value`.
				const mirror = hostPropMirrorOf(attr.thunk)
				sink.push({
					kind: 'watch-attr',
					query,
					attr: attr.name,
					thunkText: attr.thunkText,
					dispatch: mirror !== null ? 'property' : 'attribute',
					coerceToString: mirror === null && returnsNumber(attr.thunk.body),
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'pass') {
				if (!isCustom || !registry.has(el.tag)) {
					diagnostics.push(
						diagnostic.passTargetNotCustom(source, el.node.start, el.tag),
					)
					continue
				}
				emitPassEntries(attr.entries, query, sink)
			} else if (attr.kind === 'class-map') {
				collectAmbient(attr.object)
				sink.push({
					kind: 'watch-class',
					query,
					keys: classMapKeys(attr.object),
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'style-map') {
				collectAmbient(attr.object)
				sink.push({
					kind: 'watch-style',
					query,
					keys: styleMapKeys(attr.object),
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'event') {
				collectAmbient(attr.handler)
				sink.push({
					kind: 'on',
					query,
					event: attr.event,
					handlerText: attr.handlerText,
					sourceStart: attr.handler.start,
					sourceEnd: attr.handler.end,
				})
			}
		}
		for (const child of el.children) {
			if (child.kind !== 'expr' || !child.lazy) continue
			// A managed form prop as a lazy child requires the widened
			// FormFactoryContext — formAssociated() must lead the extensions.
			if (
				nodeType(child.expr) === 'Literal' &&
				typeof (child.expr as TsrxNode).value === 'string'
			) {
				const prop = String((child.expr as TsrxNode).value)
				if (
					MANAGED_TEXT_PROPS.has(prop) &&
					!component.exposeProps.has(prop) &&
					!component.config?.form
				)
					diagnostics.push(
						diagnostic.managedPropWithoutForm(source, child.node.start, prop),
					)
			}
			collectAmbient(child.expr)
			sink.push({
				kind: 'watch-text',
				query,
				source: lazyWatchSource(component, child),
			})
		}
	}

	/** Does this element carry a construct of its own (not a nested one)? */
	const hasOwnConstruct = (el: ElementNode): boolean =>
		el.attrs.some(
			a => a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
		) || el.children.some(c => c.kind === 'expr' && c.lazy)

	// A lazy text child of the branch ROOT itself is a legitimate construct
	// (watched via the root's own query, exactly like a reactive attribute)
	// — only a NESTED element's own lazy child or construct attrs make the
	// construct unaddressable, hence the depth guard.
	const hasDeepConstruct = (el: ElementNode, depth = 0): boolean =>
		el.children.some(
			child =>
				(depth > 0 && child.kind === 'expr' && child.lazy) ||
				(child.kind === 'element' &&
					(child.attrs.some(
						a =>
							a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
					) ||
						hasDeepConstruct(child, depth + 1))),
		)

	/**
	 * A single-branch `@if` (no `@else`) whose root may not exist at all —
	 * the DOM-derived mirror of the hand-written `if (clearBtn) { … }`
	 * pattern. The root (if any carries client constructs) is addressed with
	 * a non-throwing `first()`; its own construct effects, plus any bare
	 * client-only statement sitting beside it in the branch (LT-008), are all
	 * wrapped in one `'guarded'` effect emitted client-side as
	 * `if (query) { … }`.
	 */
	const handleOptionalIfEffects = (node: IfNode): void => {
		const roots = node.then.filter(isElement)
		for (const root of roots)
			if (hasDeepConstruct(root))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						root.node.start,
						'Client constructs inside @if branches must sit on the branch root elements — deeper elements exist only when their branch rendered',
					),
				)
		const clientStmts = node.then.filter(
			(n): n is TemplateNode & { kind: 'client-stmt' } =>
				n.kind === 'client-stmt',
		)
		const constructedRoots = roots.filter(hasOwnConstruct)
		if (constructedRoots.length > 1) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node.start,
					'Multiple addressable elements with client constructs inside one @if branch — only one root can be addressed per branch; split into separate @if blocks, or address the extra element through a hoisted const referenced from the first',
				),
			)
			return
		}
		const primary = constructedRoots[0] ?? roots[0] ?? null
		const hasConstructs =
			clientStmts.length > 0 || (primary ? hasOwnConstruct(primary) : false)
		if (!hasConstructs) return
		if (!primary) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node.start,
					'A bare client-only statement inside a single-branch @if needs an element sibling in the same branch to test whether the branch rendered',
				),
			)
			return
		}
		const resolved = selectorFor(primary)
		if (!resolved.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					primary.node.start,
					`No unique selector for the @if branch root <${primary.tag}> — add a distinguishing static attribute`,
				),
			)
			return
		}
		const refAttr = primary.attrs.find(a => a.kind === 'ref') as
			| { kind: 'ref'; name: string }
			| undefined
		const query = addQuery(
			refAttr?.name ?? sanitizeVarName(primary.tag),
			resolved.selector,
			'maybe',
		)
		const guarded: TopEffectPlan[] = []
		for (const stmt of node.then) {
			if (stmt.kind === 'client-stmt') {
				collectAmbient(stmt.node)
				guarded.push({
					kind: 'raw',
					text: stmt.text,
					sourceStart: stmt.node.start,
					sourceEnd: stmt.node.end,
				})
				continue
			}
			if (stmt === primary) emitConstructEffects(primary, query, guarded)
		}
		effects.push({ kind: 'guarded', query, effects: guarded })
	}

	/**
	 * @if branches (LT-008): client constructs must sit on the branch ROOT
	 * elements; the client addresses whichever branch rendered through a
	 * union selector (`first('textarea, input[type="text"]')`). Construct
	 * texts must be identical across branches — one effect covers all. A
	 * branch with no `@else` may not render at all — see
	 * `handleOptionalIfEffects` for that (DOM-existence-guarded) case.
	 */
	const handleIfEffects = (node: IfNode): void => {
		if (node.alternate.length === 0) {
			handleOptionalIfEffects(node)
			return
		}
		const roots = [...node.then, ...node.alternate].filter(isElement)
		for (const root of roots)
			if (hasDeepConstruct(root))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						root.node.start,
						'Client constructs inside @if branches must sit on the branch root elements — deeper elements exist only when their branch rendered',
					),
				)
		const clientStmts = [...node.then, ...node.alternate].filter(
			(n): n is TemplateNode & { kind: 'client-stmt' } =>
				n.kind === 'client-stmt',
		)
		for (const stmt of clientStmts)
			diagnostics.push(
				diagnostic.unsupported(
					source,
					stmt.node.start,
					'A bare client-only statement inside an @if with @else — union addressing needs identical constructs in every branch; use a single-branch @if (no @else) instead',
				),
			)
		// Each branch may only carry ONE addressable element of its own —
		// the union query addresses "whichever branch rendered", not
		// multiple distinct siblings within a single branch.
		for (const branch of [node.then, node.alternate]) {
			const constructedInBranch = branch
				.filter(isElement)
				.filter(hasOwnConstruct)
			if (constructedInBranch.length > 1) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						'Multiple addressable elements with client constructs inside one @if branch — union addressing addresses a single root per branch; split into separate @if blocks, or address the extra element through a hoisted const referenced from the first',
					),
				)
				return
			}
		}
		// html={dataRef} is server-rendered only — not a client construct.
		const hasConstructs = roots.some(hasOwnConstruct)
		if (!hasConstructs) return
		const primary = roots.find(r =>
			r.attrs.some(
				a => a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
			),
		)
		if (!primary) return
		const resolved = selectorFor(primary)
		if (!resolved.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					primary.node.start,
					`No unique selector for the @if branch root <${primary.tag}> — add a distinguishing static attribute`,
				),
			)
			return
		}
		const refAttr = primary.attrs.find(a => a.kind === 'ref') as
			| { kind: 'ref'; name: string }
			| undefined
		const query = addQuery(
			refAttr?.name ?? sanitizeVarName(primary.tag),
			resolved.selector,
			'one',
		)
		// Same-named constructs must agree across branches.
		const textsByKey = new Map<string, Set<string>>()
		for (const root of roots)
			for (const attr of root.attrs) {
				if (attr.kind === 'static' || attr.kind === 'server') continue
				const key = `${attr.kind === 'event' ? 'on' : 'bind'}:${'name' in attr ? attr.name : attr.kind}`
				const attrText =
					attr.kind === 'event'
						? attr.handlerText
						: attr.kind === 'reactive' ||
								attr.kind === 'class-map' ||
								attr.kind === 'style-map'
							? attr.thunkText
							: ''
				const texts = textsByKey.get(key) ?? new Set<string>()
				texts.add(attrText)
				textsByKey.set(key, texts)
			}
		for (const [key, texts] of textsByKey)
			if (texts.size > 1)
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						`@if branch constructs differ for \`${key}\` — union addressing requires identical client behavior in every branch`,
					),
				)
		emitConstructEffects(primary, query)
	}

	/** Does a subtree carry client constructs (client-side-only elements)? */
	const hasClientConstructs = (node: TemplateNode): boolean => {
		if (node.kind === 'client-stmt') return true
		if (node.kind === 'expr') return node.lazy
		if (node.kind === 'if' || node.kind === 'switch' || node.kind === 'try')
			return false
		if (!isElement(node)) return false
		if (
			node.attrs.some(
				a => a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
			)
		)
			return true
		return node.children.some(hasClientConstructs)
	}

	/**
	 * @switch arms render exclusively — a construct in one arm would make
	 * its element missing whenever another arm renders, so arms must be
	 * construct-free markup (use @if with identical branch constructs for
	 * interactive alternatives).
	 */
	const handleSwitchEffects = (node: SwitchNode): void => {
		for (const arm of node.cases)
			for (const child of arm.children)
				if (hasClientConstructs(child))
					diagnostics.push(
						diagnostic.unsupported(
							source,
							(child as ElementNode).node?.start ?? node.node.start,
							'Client constructs inside @switch arms — arms render exclusively, so the element is not guaranteed to exist. Keep arms to static/server markup, or use @if branches with identical constructs (union addressing).',
						),
					)
	}

	/** A direct lazy child of `el` whose expr is a bare Identifier, if any. */
	const directLazyIdentifier = (el: ElementNode): string | null => {
		for (const child of el.children) {
			if (
				child.kind === 'expr' &&
				child.lazy &&
				nodeType(child.expr) === 'Identifier'
			)
				return String((child.expr as TsrxNode).name)
		}
		return null
	}

	/**
	 * A direct lazy child of `el` referencing the catch param — bare (`e`) or
	 * a non-computed member read (`e.message`) — as the client-side error
	 * expression (`error`/`error.message`), or null if no such child exists.
	 */
	const directLazyCatchRef = (
		el: ElementNode,
		catchParam: string,
	): string | null => {
		for (const child of el.children) {
			if (child.kind !== 'expr' || !child.lazy) continue
			const expr = child.expr
			if (
				nodeType(expr) === 'Identifier' &&
				String((expr as TsrxNode).name) === catchParam
			)
				return 'error'
			if (
				nodeType(expr) === 'MemberExpression' &&
				!(expr as TsrxNode).computed
			) {
				const obj = (expr as TsrxNode).object
				const prop = (expr as TsrxNode).property
				if (
					nodeType(obj) === 'Identifier' &&
					String((obj as TsrxNode).name) === catchParam &&
					nodeType(prop) === 'Identifier'
				)
					return `error.${String((prop as TsrxNode).name)}`
			}
		}
		return null
	}

	/**
	 * An async boundary (`@try`/`@pending`/`@catch`, ADR 0023 sub-design 13,
	 * LT-012): `lowerTry` already proved each arm has exactly one root
	 * element. All three render server-side (`emit-server.ts`), toggled
	 * `hidden` by which state won at render time; the client wires a single
	 * `watch(signal, { ok, err, nil })` call that flips the same `hidden`
	 * property going forward — pure enhance, no client DOM creation.
	 */
	const handleAsyncBoundary = (node: TryNode): void => {
		const okRoot = node.children.find(isElement) as ElementNode
		const pendingRoot = (node.pendingChildren as TemplateNode[]).find(
			isElement,
		) as ElementNode
		const errRoot = node.catchChildren.find(isElement) as ElementNode
		const catchParam = node.catchParam

		if (
			hasDeepConstruct(okRoot) ||
			hasDeepConstruct(pendingRoot) ||
			hasDeepConstruct(errRoot)
		) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node.start,
					"Client constructs inside an async boundary must sit on each arm's own root element — deeper elements have no addressing (ADR 0023 sub-design 13)",
				),
			)
			return
		}
		if (hasOwnConstruct(pendingRoot)) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					pendingRoot.node.start,
					'@pending arm of an async boundary must be static/server markup — nothing watches it once resolved',
				),
			)
			return
		}

		const okLazyName = directLazyIdentifier(okRoot)
		const boundaryCandidates = component.signals.filter(
			s => s.constructor === 'deriveCell' && s.name === okLazyName,
		)
		if (!okLazyName || boundaryCandidates.length !== 1) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					okRoot.node.start,
					"An async boundary's @try body must render the async signal it guards as a direct lazy child (e.g. `&{data}`), where `data` is a `deriveCell(async …)` signal — the compiler discovers which signal drives isPending() routing from that reference.",
				),
			)
			return
		}
		const signal = boundaryCandidates[0]?.name as string

		if (
			okRoot.attrs.some(
				a => a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
			)
		) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					okRoot.node.start,
					"An async boundary's @try body root may only carry static/server attributes and its one lazy signal child — other reactive constructs have no addressing here yet",
				),
			)
			return
		}
		if (
			errRoot.attrs.some(
				a => a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
			)
		) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					errRoot.node.start,
					'@catch arm of an async boundary may only carry static/server attributes and its one lazy error child',
				),
			)
			return
		}

		const okSelector = resolveSelector(component, okRoot)
		const pendingSelector = resolveSelector(component, pendingRoot)
		const errSelector = resolveSelector(component, errRoot)
		for (const [label, resolved, el] of [
			['@try body', okSelector, okRoot],
			['@pending arm', pendingSelector, pendingRoot],
			['@catch arm', errSelector, errRoot],
		] as const) {
			if (!resolved.unique)
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						el.node.start,
						`No unique selector for the ${label}'s root <${el.tag}> of an async boundary; add a distinguishing static attribute (role, class, or data-*).`,
					),
				)
		}
		const okQuery = addQuery(
			sanitizeVarName(okRoot.tag),
			okSelector.selector,
			'one',
		)
		const pendingQuery = addQuery(
			sanitizeVarName(pendingRoot.tag),
			pendingSelector.selector,
			'one',
		)
		const errQuery = addQuery(
			sanitizeVarName(errRoot.tag),
			errSelector.selector,
			'one',
		)

		const errText = catchParam ? directLazyCatchRef(errRoot, catchParam) : null
		if (
			errRoot.children.some(c => c.kind === 'expr' && c.lazy) &&
			errText === null
		) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					errRoot.node.start,
					`@catch arm's lazy child must reference the catch param \`${catchParam ?? 'e'}\` (bare, or a member read like \`${catchParam ?? 'e'}.message\`)`,
				),
			)
			return
		}

		effects.push({
			kind: 'async',
			signal,
			pendingQuery,
			okQuery,
			errQuery,
			okText: true,
			errText,
		})
	}

	/**
	 * @try error boundaries: the catch arm renders instead on error, so
	 * constructs in the body are not guaranteed (first() would throw on the
	 * error path); interactive error boundaries need optional addressing,
	 * which is outside the current subset. Catch arms must be static.
	 *
	 * A `@pending` arm present routes to `handleAsyncBoundary` instead (ADR
	 * 0023 sub-design 13, LT-012) — a fundamentally different shape (all
	 * three arms render unconditionally, toggled `hidden`) from this plain
	 * mutually-exclusive error boundary.
	 */
	const handleTryEffects = (node: TryNode): void => {
		if (node.pendingChildren !== null) {
			handleAsyncBoundary(node)
			return
		}
		for (const child of node.children)
			if (hasClientConstructs(child))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						(child as ElementNode).node?.start ?? node.node.start,
						'Client constructs inside @try bodies — the catch arm renders instead on error, so the element is not guaranteed to exist; error boundaries over interactive markup need optional addressing (tracked in TODO). Keep the body to static/server markup.',
					),
				)
		for (const child of node.catchChildren)
			if (hasClientConstructs(child))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						(child as ElementNode).node?.start ?? node.node.start,
						'Client constructs inside @catch arms — the arm renders only on error; keep it to static/server markup.',
					),
				)
	}

	/**
	 * `ref={name}` and/or `pass={{ }}` on a composed element (ADR 0023
	 * sub-design 10). Composed elements aren't otherwise addressed at all yet
	 * (server args aren't guaranteed to render as DOM attributes, LT-018's
	 * children are the only other construct they'll carry): an explicit
	 * `ref` is required for BOTH — a bare `ref` (no `pass`) still needs the
	 * query so the name resolves in the factory (e.g. reading `textbox.value`
	 * from an event handler elsewhere in the template) — and the target must
	 * be the sole composed instance of that child in the template
	 * (`countComposeBySource`) since there's no attribute-based discriminator
	 * to fall back on.
	 */
	const emitComposeEffects = (node: ComposeNode): void => {
		const passAttrs = node.attrs.filter(
			(a): a is Extract<(typeof node.attrs)[number], { kind: 'pass' }> =>
				a.kind === 'pass',
		)
		const refAttr = node.attrs.find(
			(a): a is Extract<(typeof node.attrs)[number], { kind: 'ref' }> =>
				a.kind === 'ref',
		)
		if (passAttrs.length === 0 && !refAttr) return
		if (!refAttr) {
			diagnostics.push(
				diagnostic.composedPassRequiresRef(
					source,
					node.node.start,
					node.component,
				),
			)
			return
		}
		if (countComposeBySource(component.root, node.source) !== 1) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					node.node.start,
					`Multiple <${node.component}> instances compose the same child — ref={{ }}/pass={{ }} need a target this milestone can uniquely identify.`,
				),
			)
			return
		}
		// `composeRegistry` is `undefined` during the corpus-wide registry-
		// discovery pass (compileComponent's own tolerance, LT-015) — this
		// component's OWN entry is all that pass needs; the composed child's
		// tag isn't resolvable yet, and that's fine, not an error.
		if (!composeRegistry) return
		const childTag = composeRegistry.get(node.source)?.tag ?? null
		if (!childTag) {
			diagnostics.push(
				diagnostic.composedComponentNotCompiled(
					source,
					node.node.start,
					node.component,
					node.source,
				),
			)
			return
		}
		const query = addQuery(refAttr.name, childTag, 'one')
		if (passAttrs.length > 0)
			emitPassEntries(
				passAttrs.flatMap(a => a.entries),
				query,
			)
	}

	const emitTopEffects = (node: TemplateNode): void => {
		if (node.kind === 'if') {
			handleIfEffects(node)
			return
		}
		if (node.kind === 'switch') {
			handleSwitchEffects(node)
			return
		}
		if (node.kind === 'try') {
			handleTryEffects(node)
			return
		}
		if (node.kind === 'compose') {
			emitComposeEffects(node)
			return
		}
		if (!isElement(node)) return
		if (node !== component.root && loopFor(node)) {
			const loop = loopFor(node) as ForIR
			if (loop.listSignal) {
				const plan = reconcilePlans.get(loop)
				if (plan) effects.push({ kind: 'reconcile', for: plan })
				return
			}
			const plan = forPlans.get(loop)
			if (plan) effects.push({ kind: 'each', for: plan })
			return
		}
		if (node === component.root) {
			for (const attr of component.root.attrs) {
				if (attr.kind === 'style-map') {
					// LT-028: the root's own reactive style is the one construct
					// addressable without a query — the target is the ambient
					// `host`, not a queried descendant.
					collectAmbient(attr.object)
					ambient.add('host')
					effects.push({
						kind: 'watch-style',
						query: 'host',
						keys: styleMapKeys(attr.object),
						thunkText: attr.thunkText,
						sourceStart: attr.thunk.start,
						sourceEnd: attr.thunk.end,
					})
					continue
				}
				if (attr.kind === 'class-map') {
					// LT-032: same root exemption as style-map — targets the
					// ambient `host`, not a queried descendant.
					collectAmbient(attr.object)
					ambient.add('host')
					effects.push({
						kind: 'watch-class',
						query: 'host',
						keys: classMapKeys(attr.object),
						thunkText: attr.thunkText,
						sourceStart: attr.thunk.start,
						sourceEnd: attr.thunk.end,
					})
					continue
				}
				if (
					attr.kind === 'event' ||
					attr.kind === 'reactive' ||
					attr.kind === 'html' ||
					attr.kind === 'ref' ||
					attr.kind === 'pass'
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
				node.attrs.some(
					a => a.kind !== 'static' && a.kind !== 'server' && a.kind !== 'html',
				) || node.children.some(c => c.kind === 'expr' && c.lazy)
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
				const query = addQuery(
					refAttr?.name ?? sanitizeVarName(node.tag),
					selector,
					'one',
				)
				emitConstructEffects(node, query)
			}
		}
		for (const child of node.children) emitTopEffects(child)
	}
	emitTopEffects(component.root)

	return {
		queries,
		harvests,
		effects,
		ambientContext: [...ambient].sort(),
		childTags: [...childTags].sort(),
	}
}
