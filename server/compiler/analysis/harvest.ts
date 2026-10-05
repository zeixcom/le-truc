/**
 * Signal harvest planning (LT-022, regrouping move M5): Pass 2 (render
 * sites in document order) and Pass 3 (how each signal seeds itself from
 * the server-rendered DOM — ADR 0003: DOM is the truth at load time).
 * Harvest canonical-site rule: direct sites (text child, direct attribute)
 * win, first by document order; the membership form
 * (`String(sig.get() === const)` marking one item among many) is the
 * composite fallback. Also hosts the signal-read AST predicates shared
 * with the loop and effect passes.
 */

import type { AstNode } from '../ast-node'
import {
	forEachChild,
	hostPropOf,
	isNode,
	nodeType,
	sanitizeVarName,
	signalGetCallName,
	walkNodes,
} from '../ast-utils'
import { diagnostic } from '../diagnostics'
import { dependenciesOf } from '../evaluability'
import type {
	AttributeIR,
	ComponentIR,
	HarvestSeedIR,
	InitSignalIR,
	SignalIR,
	TemplateNode,
} from '../ir'
import { wordingOf } from '../surface'
import { rangeFields, resolutionOf } from '../tier'
import {
	CONTEXT_NAMES,
	FACTORY_CONTEXT_MEMBERS,
	JS_GLOBALS,
	SCALAR_HARVEST_CONSTRUCTORS,
} from '../vocabulary'
import { elseOf, isIf, thenOf, walkTemplate } from '../walk'
import { reportServerOnlyNames } from './effects'
import {
	CALLABLE_AS_WRITTEN,
	harvestsPerField,
	planListFieldHarvest,
} from './list-harvest'
import type {
	AuthoredParser,
	HarvestPlan,
	HarvestPlans,
	LoopPlans,
	ParserKind,
	PassShared,
} from './plan'
import {
	type ElementNode,
	type ExprNode,
	enclosingIfOf as enclosingIfOfIn,
	isElement,
	loopFor as loopForIn,
	refOf,
	resolveSelector as resolveSelectorIn,
	selectorFor as selectorForIn,
} from './selectors'

/* === Shared signal-read predicates === */

/** `sig.get()` call check for direct/membership matching. */
export const isSignalGetCall = (node: unknown, signal: string): boolean =>
	signalGetCallName(node) === signal

/**
 * `sig.get()` read anywhere inside a node (LT-036): a style-map/class-map
 * object or a computed reactive thunk still renders the signal's value into
 * the DOM, even though no part of it can serve as a splice-harvest site.
 */
export const containsSignalGet = (node: unknown, signal: string): boolean => {
	// Type positions are skipped: they hold no `.get()` calls.
	let found = false
	walkNodes(node, current => {
		if (found) return false
		if (isSignalGetCall(current, signal)) found = true
	})
	return found
}

/**
 * Match the membership mark: `() => String(sig.get() === C)` or
 * `() => sig.get() === C`. Returns the const identifier.
 */
export const membershipConst = (
	thunk: AstNode,
	signal: string,
): string | null => {
	const body = thunk.body
	if (
		nodeType(body) !== 'BinaryExpression' &&
		nodeType(body) !== 'CallExpression'
	)
		return null
	let comparison = body as AstNode
	if (nodeType(body) === 'CallExpression') {
		const call = body as AstNode
		const callee = call.callee
		if (
			nodeType(callee) !== 'Identifier' ||
			String((callee as AstNode).name) !== 'String' ||
			!Array.isArray(call.arguments)
		)
			return null
		comparison = call.arguments[0] as AstNode
	}
	if (nodeType(comparison) !== 'BinaryExpression') return null
	const bin = comparison as Record<string, unknown>
	if (bin.operator !== '===') return null
	const left = bin.left as AstNode
	const right = bin.right as AstNode
	for (const [a, b] of [
		[left, right],
		[right, left],
	] as const) {
		if (isSignalGetCall(a, signal) && nodeType(b) === 'Identifier')
			return String((b as AstNode).name)
	}
	return null
}

/** `() => sig.get()` (direct attribute render of a signal). */
export const isDirectAttrThunk = (thunk: AstNode, signal: string): boolean =>
	isSignalGetCall(thunk.body, signal)

export const parserForType = (type: string): ParserKind => {
	switch (type) {
		case 'number':
			return 'asNumber'
		case 'boolean':
			return 'asBoolean'
		default:
			return 'asString'
	}
}

export const defaultForType = (type: string): string => {
	switch (type) {
		case 'number':
			return '0'
		case 'boolean':
			return 'false'
		default:
			return "''"
	}
}

/**
 * Conservative check: does a thunk body evaluate to a number? Number
 * literals, conditionals over them, and — since LT-126 — a bare read of a
 * number-typed signal (`count.get()`), resolved through the signal's own
 * `inferredType` rather than guessed from the expression's shape.
 *
 * The signal case matters because of LT-116: `value` on a native form
 * control now dispatches as a PROPERTY write, and `HTMLInputElement.value`
 * is DOMString-typed, so an uncoerced number thunk fails `check:corpus` on
 * the generated client. Callers that have no signal list keep the old
 * literal-only behaviour.
 */
export const returnsNumber = (
	body: unknown,
	signals: readonly SignalIR[] = [],
): boolean => {
	if (nodeType(body) === 'Literal')
		return typeof (body as AstNode).value === 'number'
	if (nodeType(body) === 'ConditionalExpression')
		return returnsNumber((body as AstNode).consequent, signals)
	// `<signal>.get()` — the identifier form only. A `.get()` on anything
	// else (a member chain, a call result) is not a signal read this
	// compiler tracks, so it stays undetected rather than guessed at.
	const name = signalGetCallName(body)
	return (
		name !== null &&
		signals.some(s => s.name === name && s.inferredType === 'number')
	)
}

export const lazyWatchSource = (child: ExprNode): string => {
	const expr = child.expr
	// LT-122: the site renders a server ARG that is also an exposed
	// prop. `exprText` is the arg — what the server splices — so the
	// client source has to be spelled from the prop instead, exactly
	// as an authored `{host.<prop>}` would have lowered.
	if (child.bindsProp) return `() => host.${child.bindsProp}`
	if (nodeType(expr) === 'Identifier') return child.exprText
	// Anything else (a call/member expression, etc.) isn't one of `watch()`'s
	// identifier overload — spliced verbatim it would be a
	// bare expression like `formatHex(host.value)`, which matches none of
	// `watch()`'s overloads except accidentally the array-source one,
	// producing a confusing TS2769 instead of running reactively. Thunk-wrap
	// it so it lowers to the arrow thunk-source overload instead (LT-038,
	// found migrating `card-colorscale.tsrx`: `{formatHex(host.value)}`
	// broke until manually rewritten to `{() => formatHex(host.value)}` —
	// an already-authored arrow thunk is left as-is, everything else gets
	// the same wrapping done automatically).
	if (nodeType(expr) === 'ArrowFunctionExpression') return child.exprText
	return `() => ${child.exprText}`
}

/* === Formatted text (D-20) === */

/** Locale-formatting instance methods: their output never parses back. */
const LOCALE_FORMAT_METHODS: ReadonlySet<string> = new Set([
	'toLocaleString',
	'toLocaleDateString',
	'toLocaleTimeString',
])

/** Message argument kinds the evaluator formats (`{n, number}`, `#`, `{d, date}`). */
const FORMATTED_ARG_KINDS: ReadonlySet<string> = new Set(['number', 'date'])

/**
 * How `node` formats a value for display, or null when it does not (D-20,
 * LT-374). Recognition is syntactic, over the expression and — through
 * their names — the setup consts it reads, transitively (`const fmt = new
 * Intl.NumberFormat(…).format`, read as `fmt(n.get())`):
 *
 * - any `Intl` read (`new Intl.NumberFormat(…)`, `Intl.DateTimeFormat(…)`);
 * - a `toLocaleString()`/`toLocaleDateString()`/`toLocaleTimeString()` call,
 *   whatever the receiver;
 * - a call of a declared message (`t.<key>(…)`, `t['<key>'](…)`) whose
 *   pattern takes a number or date argument (`plural`/`selectordinal`/
 *   `number`/`date`/`time`).
 *
 * A formatter reached through an import (`getNumberFormatter(…)`) is not
 * recognized: the compiler does not read other modules. That costs only the
 * diagnostic's precision — a computed text thunk is never a harvest site,
 * so the signal still fails to seed (LTC005) rather than harvesting
 * formatted text.
 */
export const formattingOf = (
	node: AstNode,
	component: ComponentIR,
): string | null => {
	const tNames = new Set(component.messageTBindings ?? [])
	const args = component.i18nArgs ?? {}
	const setupByName = new Map(
		component.setup.flatMap(stmt =>
			stmt.name === null ? [] : [[stmt.name, stmt.node] as const],
		),
	)
	const messageKey = (callee: unknown): string | null => {
		if (nodeType(callee) !== 'MemberExpression') return null
		const member = callee as AstNode
		const object = member.object as AstNode
		if (nodeType(object) !== 'Identifier' || !tNames.has(String(object.name)))
			return null
		const property = member.property as AstNode
		if (!member.computed && nodeType(property) === 'Identifier')
			return String(property.name)
		if (
			member.computed &&
			nodeType(property) === 'Literal' &&
			typeof property.value === 'string'
		)
			return property.value
		return null
	}
	const visited = new Set<string>()
	const inspect = (root: AstNode): string | null => {
		let found: string | null = null
		walkNodes(root, current => {
			if (found) return false
			const type = nodeType(current)
			if (type === 'Identifier' && String(current.name) === 'Intl') {
				found = '`Intl`'
				return false
			}
			if (type !== 'CallExpression' && type !== 'OptionalCallExpression') return
			const callee = current.callee as AstNode
			if (
				nodeType(callee) === 'MemberExpression' &&
				!callee.computed &&
				nodeType(callee.property) === 'Identifier' &&
				LOCALE_FORMAT_METHODS.has(String((callee.property as AstNode).name))
			) {
				found = `\`${String((callee.property as AstNode).name)}()\``
				return false
			}
			const key = messageKey(callee)
			if (
				key !== null &&
				(args[key] ?? []).some(arg => FORMATTED_ARG_KINDS.has(arg.kind))
			) {
				found = `message \`${String((callee.object as AstNode).name)}.${key}\``
				return false
			}
		})
		if (found) return found
		for (const name of dependenciesOf(root)) {
			const stmt = setupByName.get(name)
			if (!stmt || visited.has(name)) continue
			visited.add(name)
			const inner = inspect(stmt)
			if (inner) return inner
		}
		return null
	}
	return inspect(node)
}

/* === Render Sites (Pass 2) === */

/**
 * A signal's render site. Direct sites (text child, direct attribute) and
 * membership marks; the canonical harvest site is the first direct site by
 * document order, else the first membership mark.
 */
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

/**
 * Pass 2's production, Pass 3's input (LT-227). `thunkRendered`: signals
 * whose values reach the DOM only through thunks no site can splice into —
 * style-map/class-map objects, computed (non-`sig.get()`) reactive thunks
 * (LT-036) — or through a client-only read (LT-119/LT-323): rendered, so not
 * LTC004-dead, but never a harvest site; Pass 3 seeds them by initializer
 * reuse. `renderCredited`/`clientCredited` split that credit by position
 * (LT-323/LT-327).
 */
type RenderSites = {
	sites: Site[]
	thunkRendered: Set<string>
	renderCredited: Set<string>
	clientCredited: Set<string>
	/**
	 * Per signal, its first reactive text site that formats the value for
	 * display (`formattingOf`), with the formatting named — LTC059's input
	 * when the signal also has no raw value source (D-20, LT-374).
	 */
	formattedText: Map<string, { node: AstNode; formatting: string }>
}

/** Pass 2: signal render sites, in document order, plus thunk/client credit. */
const collectRenderSites = (component: ComponentIR): RenderSites => {
	const sites: Site[] = []
	const thunkRendered = new Set<string>()
	const textChildren: ExprNode[] = []
	let documentOrder = 0
	const loopFor = (node: TemplateNode) => loopForIn(component, node)

	const recordSites = (node: TemplateNode, insideLoopOutput: boolean): void => {
		if (!isElement(node)) return
		const isLoopOutput = !!loopFor(node)
		for (const attr of node.attrs) {
			if (
				attr.kind !== 'reactive' &&
				attr.kind !== 'style-map' &&
				attr.kind !== 'class-map' &&
				!(attr.kind === 'html' && attr.reactive)
			)
				continue
			const order = documentOrder++
			if (attr.kind === 'style-map' || attr.kind === 'class-map') {
				for (const signal of component.signals.map(s => s.name)) {
					if (containsSignalGet(attr.object, signal)) thunkRendered.add(signal)
				}
				continue
			}
			if (attr.kind === 'html' && attr.reactive) {
				// truc:html={() => …} (LT-025): markup is opaque, unreadable back out
				// of innerHTML — never a harvest SITE, but rendered (LT-036),
				// same treatment as style-map/class-map.
				for (const signal of component.signals.map(s => s.name)) {
					if (containsSignalGet(attr.thunk, signal)) thunkRendered.add(signal)
				}
				continue
			}
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
				// A computed thunk (`() => prefix.get() + '!'`) renders the
				// signal without being its direct site — same credit as a
				// map thunk, same initializer-reuse seed in Pass 3.
				if (containsSignalGet(attr.thunk, signal)) thunkRendered.add(signal)
			}
		}
		for (const child of node.children) {
			if (
				child.kind === 'expr' &&
				child.reactivity === 'reactive' &&
				!insideLoopOutput &&
				!isLoopOutput
			) {
				textChildren.push(child)
				const order = documentOrder++
				const expr = child.expr
				if (nodeType(expr) === 'Identifier') {
					const name = String((expr as AstNode).name)
					if (component.signals.some(s => s.name === name))
						sites.push({ kind: 'text', signal: name, element: node, order })
				} else if (
					nodeType(expr) === 'Literal' &&
					typeof (expr as AstNode).value === 'string'
				) {
					const signal = component.exposeProps.get(
						String((expr as AstNode).value),
					)?.signalName
					if (signal) sites.push({ kind: 'text', signal, element: node, order })
				} else if (nodeType(expr) === 'ArrowFunctionExpression') {
					const body = (expr as AstNode).body
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

	// A reactive conditional (ADR 0037) renders its test's signals and its
	// arms' reactive sites without a harvest site: the arms may not exist at
	// connect, and the winner's own sites are not the signal's only render.
	// Same credit as a computed thunk — rendered, seeded by initializer
	// reuse, which is sound because the server picked and rendered the
	// winner from that same initializer.
	const creditSignalReads = (node: AstNode): void => {
		for (const signal of component.signals)
			if (
				containsSignalGet(node, signal.name) ||
				(nodeType(node) === 'Identifier' &&
					String((node as AstNode).name) === signal.name)
			)
				thunkRendered.add(signal.name)
	}
	walkTemplate(component.root, node => {
		if (node.kind !== 'conditional' || node.mode !== 'reactive') return
		creditSignalReads(node.test)
		for (const arm of node.arms)
			for (const child of arm.children)
				walkTemplate(child, inner => {
					if (inner.kind === 'expr' && inner.reactivity === 'reactive')
						creditSignalReads(inner.expr)
					if (inner.kind !== 'element') return
					for (const attr of inner.attrs) {
						if (
							attr.kind === 'reactive' ||
							attr.kind === 'class-map' ||
							attr.kind === 'style-map'
						)
							creditSignalReads(attr.thunk)
						else if (attr.kind === 'html' && attr.reactive)
							creditSignalReads(attr.thunk)
					}
				})
	})

	// A signal consumed only by a CLIENT-ONLY setup statement (LT-119:
	// `watch(() => showPopup.get() && listbox.visibleOptions.length > 0,
	// bindAttribute(popup, 'hidden'))`) reaches the DOM without a template
	// render site. It gets the same credit as LT-036's map/computed thunks —
	// not dead, never a harvest SITE, seeds by initializer reuse — and the
	// soundness argument is if anything stronger: `clientSetup` statements
	// exist ONLY in the generated client, so the server rendered nothing
	// from this signal and there is no server output for the reused
	// initializer to disagree with. Reaching the DOM this way is the only
	// route open to a predicate over a COMPOSED CHILD's public prop, which
	// no server fold can resolve (LTC034) — see the popup gate in
	// form-combobox.tsrx.
	//
	// LT-323 (ADR 0029 conformance) widens what counts as a read: a bare
	// signal reference (`watch(overflowStart, bindState(…))`), a read through
	// setup consts or derived signals (`const hasOverflow = () =>
	// overflowStart.get() || …`, consumed by `watch(hasOverflow, …)`), and
	// the template's other client-only positions — event handlers and
	// `truc:pass` entries (module-catalog's `total`). None of them reaches
	// served HTML, so none makes the signal an LTC004 routing signal.
	const carriers = new Map<string, Set<string>>(
		component.signals.map(signal => [signal.name, new Set([signal.name])]),
	)
	const carriedBy = (node: AstNode): Set<string> => {
		const carried = new Set<string>()
		for (const name of dependenciesOf(node))
			for (const signal of carriers.get(name) ?? []) carried.add(signal)
		return carried
	}
	for (let changed = true; changed; ) {
		changed = false
		for (const stmt of component.setup) {
			if (stmt.name === null) continue
			const own = carriers.get(stmt.name) ?? new Set<string>()
			const before = own.size
			for (const signal of carriedBy(stmt.node)) own.add(signal)
			carriers.set(stmt.name, own)
			if (own.size !== before) changed = true
		}
	}
	// Credited by a client-only read, as against a template render thunk:
	// only these may seed from an initializer over FactoryContext members
	// (`all()` in catalog's `total`), which the server cannot evaluate.
	// Render credit runs through the same `carriedBy` closure (LT-327): a
	// signal reaching a render position via a setup const (`<p>{() =>
	// label()}</p>`) is as render-bound as a direct `sig.get()`, and folding
	// its context-member initializer would leave the server module reading
	// an undeclared `all` (ADR 0029: any doubt routes downward).
	const renderCredited = new Set(thunkRendered)
	const creditRender = (node: AstNode | null | undefined): void => {
		if (node) for (const signal of carriedBy(node)) renderCredited.add(signal)
	}
	walkTemplate(component.root, node => {
		if (node.kind === 'element') {
			for (const attr of node.attrs) {
				if (
					attr.kind === 'reactive' ||
					attr.kind === 'class-map' ||
					attr.kind === 'style-map'
				)
					creditRender(attr.thunk)
				else if (attr.kind === 'html') {
					creditRender(attr.node)
					if (attr.reactive) creditRender(attr.thunk)
				} else if (attr.kind === 'server') creditRender(attr.node)
			}
		} else if (node.kind === 'expr') creditRender(node.expr)
		else if (node.kind === 'conditional') {
			creditRender(node.test)
			// `@case` tests are render positions too (LT-330).
			for (const arm of node.arms) if (arm.test) creditRender(arm.test)
		} else if (node.kind === 'compose') {
			for (const attr of node.attrs)
				if (attr.kind === 'arg') creditRender(attr.node)
		}
	})
	for (const loop of component.fors.values()) {
		if (loop.kind !== 'each') continue
		creditRender(loop.iterable)
		for (const hoisted of loop.hoisted) creditRender(hoisted.node)
	}
	const clientCredited = new Set<string>()
	const creditClientRead = (node: AstNode): void => {
		for (const signal of carriedBy(node)) {
			thunkRendered.add(signal)
			clientCredited.add(signal)
		}
	}
	for (const stmt of component.clientSetup) creditClientRead(stmt.node)
	walkTemplate(component.root, node => {
		if (node.kind === 'element') {
			for (const attr of node.attrs)
				if (attr.kind === 'event') creditClientRead(attr.handler)
		} else if (node.kind === 'compose') {
			for (const attr of node.attrs) {
				if (attr.kind !== 'pass') continue
				for (const entry of attr.entries) {
					creditClientRead(entry.thunk)
					if (entry.setThunk) creditClientRead(entry.setThunk)
				}
			}
		}
	})

	// Formatted reactive text (D-20): the carriers say which signals a text
	// site reads, through setup consts included; `formattingOf` says whether
	// it formats them. First site in document order wins.
	const formattedText = new Map<string, { node: AstNode; formatting: string }>()
	for (const child of textChildren) {
		const carried = [...carriedBy(child.expr)].filter(
			signal => !formattedText.has(signal),
		)
		if (carried.length === 0) continue
		const formatting = formattingOf(child.expr, component)
		if (!formatting) continue
		for (const signal of carried)
			formattedText.set(signal, { node: child.expr, formatting })
	}

	return {
		sites,
		thunkRendered,
		renderCredited,
		clientCredited,
		formattedText,
	}
}

/* === Harvest Plans (Pass 3) === */

/** Pass 3: one harvest plan per signal, from Pass 2's render sites. */
const planHarvests = (
	shared: PassShared,
	{ forPlans, reconcilePlans }: LoopPlans,
	{
		sites,
		thunkRendered,
		renderCredited,
		clientCredited,
		formattedText,
	}: RenderSites,
): HarvestPlan[] => {
	const {
		component,
		source,
		diagnostics,
		routingSignals,
		addQuery,
		ambient,
		refNames,
		rawSourceRefused,
	} = shared
	const harvests: HarvestPlan[] = []
	/**
	 * A signal the client cannot seed from server-rendered DOM. Under ADR
	 * 0029 sub-design 5 (LT-165 step 5) this is a ROUTING SIGNAL, not an
	 * author error — the realm connects the component for real and serializes
	 * whatever the signal actually settles to, which is exactly the initial
	 * value the harvest could not find a site for. The generated client
	 * declares the signal from its own initializer (`emit-client.ts`), so the
	 * shape compiles and works in every tier; what changed is only who
	 * produces the served HTML.
	 */
	const reportUnharvestable = (signal: InitSignalIR): void => {
		routingSignals.push({
			origin: 'LTC004',
			detail: `signal \`${signal.name}\` has no harvestable initial-DOM site`,
			...rangeFields(source, signal.init),
			resolution:
				signal.init == null
					? { by: 'realm' }
					: resolutionOf(signal.init, component.serverKnown),
		})
	}
	const enclosingIfOf = (target: ElementNode) =>
		enclosingIfOfIn(component, target)
	const selectorFor = (el: ElementNode) => selectorForIn(component, el)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const loopFor = (node: TemplateNode) => loopForIn(component, node)

	/**
	 * An attribute read is a string; a `number`-typed arg converts back
	 * with `Number()`, so a raw value source round-trips (D-20, LT-374:
	 * `<data value={count}>` seeds `createState(count)` with a number,
	 * not its text). The server rendered the attribute as `String(arg)`, which
	 * `Number()` inverts for every finite number — no truncation.
	 */
	const asParamType = (param: string, read: string): string =>
		component.paramProps.find(p => p.name === param)?.isNumber
			? `Number${read}`
			: read
	/**
	 * DOM read expression for a server arg, traced to its rendered site.
	 * Precedence (LT-115):
	 * 1. the exposed prop's Slot — when `allowTrackedRead` (a LAZY
	 *    constructor: `deriveCell`/`deriveStore`/`createMemo`, whose callback
	 *    first runs only after `expose()` has installed the Slot-backed
	 *    property) and the root renders a Parser-exposed prop from this arg,
	 *    read `host.<prop>`: a TRACKED reactive source, so the derived signal
	 *    re-runs on later property writes and `observedAttributes` re-parses
	 *    instead of freezing on the untracked `getAttribute` read (NOTES
	 *    LT-092, the frozen basic-gauge/basic-pluralize `deriveCell`s).
	 * 2. a host-prop mirror (`value={() => host.value}` where the root renders
	 *    the parser-exposed prop from this arg) — read the target element's
	 *    property;
	 * 3. a plain (non-root) element attribute rendering the arg bare;
	 * 4. the root attribute via `host.getAttribute`.
	 * Root sites NEVER become queries: `first()` searches descendants only
	 * (`src/helpers/dom.ts`), so a query for the root's own tag throws
	 * `MissingElementError` for the component's own root at activation (the
	 * LT-024 `site.el !== component.root` guard, restored by LT-115 after a
	 * regrouping-era edit dropped it). Null when the arg renders nowhere (the
	 * signal stays unharvestable).
	 */
	const paramDomRead = (
		param: string,
		allowTrackedRead: boolean,
	): string | null => {
		if (allowTrackedRead) {
			const exposedRootAttr = component.root.attrs.find(
				a =>
					a.kind === 'server' &&
					a.name !== null &&
					a.exprText === param &&
					component.exposeProps.get(a.name)?.parser !== undefined,
			) as Extract<AttributeIR, { kind: 'server' }> | undefined
			if (exposedRootAttr) {
				ambient.add('host')
				return `host.${exposedRootAttr.name}`
			}
		}
		// Server-known `@if` branches only: a reactive conditional's arms may
		// not exist at connect, so nothing inside one is an arg's DOM site.
		const childrenOf = (node: TemplateNode): TemplateNode[] =>
			isIf(node) && node.mode === 'server'
				? [...thenOf(node), ...elseOf(node)]
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
					const prop = hostPropOf(attr.thunk)
					if (!prop || !component.exposeProps.get(prop)?.parser) continue
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
						mirror.el.node,
						`No unique selector for the DOM site of server arg \`${param}\` (<${mirror.el.tag}>) — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
					),
				)
				return null
			}
			const refAttr = refOf(mirror.el)
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
			if (isElement(node)) {
				for (const attr of node.attrs) {
					if (attr.kind === 'server' && attr.exprText === param)
						return { el: node, attr }
				}
			}
			for (const child of childrenOf(node)) {
				const found = findAttrSite(child)
				if (found) return found
			}
			return null
		}
		const site = findAttrSite(component.root)
		// LT-024's root guard, restored by LT-115: the root's own attributes
		// are NOT a query site — `first('<own-tag>')` would throw for the
		// component's own root (descendants-only search). A root match falls
		// through to the `host.getAttribute` branch below instead.
		if (site && site.el !== component.root) {
			const resolved = selectorFor(site.el)
			if (!resolved.unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						site.el.node,
						`No unique selector for the DOM site of server arg \`${param}\` (<${site.el.tag}>) — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
					),
				)
				return null
			}
			const refAttr = refOf(site.el)
			// A DOM-read site inside a single-branch @if (no @else) may not
			// exist at all — address it the same way its own branch-root query
			// would (non-throwing 'maybe'), and null-guard the read, instead of
			// a throwing `first()` the substituted expression could crash on
			// (ADR 0024 sub-design 12).
			const enclosing = enclosingIfOf(site.el)
			const optional = !!enclosing && elseOf(enclosing).length === 0
			const query = addQuery(
				refAttr?.name ?? sanitizeVarName(site.el.tag),
				resolved.selector,
				optional ? 'maybe' : 'one',
			)
			return asParamType(
				param,
				optional
					? `(${query}?.getAttribute('${site.attr.name}') ?? '')`
					: `(${query}.getAttribute('${site.attr.name}') ?? '')`,
			)
		}
		const rootAttr = component.root.attrs.find(
			a => a.kind === 'server' && a.name !== null && a.exprText === param,
		) as Extract<AttributeIR, { kind: 'server' }> | undefined
		if (rootAttr) {
			ambient.add('host')
			return asParamType(param, `(host.getAttribute('${rootAttr.name}') ?? '')`)
		}
		return null
	}

	/**
	 * Rewrite a pure-arg initializer by replacing each param identifier with
	 * its DOM read (`value.length` → `input.value.length`), right-to-left by
	 * source range so surrounding text is untouched. Free names that are
	 * already client-known by another route (another signal declared earlier
	 * in the factory, a ref, a context member) pass through unrewritten — only
	 * server args need a DOM substitution (ADR 0024 sub-design 12: a `deriveCell`
	 * callback may read both a param, needing substitution, and a sibling
	 * signal, needing none).
	 */
	const substituteArgExpr = (
		init: AstNode,
		/**
		 * Allow a no-params-to-substitute initializer to pass through
		 * verbatim (ADR 0024 sub-design 13): sound for `deriveCell`/
		 * `deriveStore` signals, which are FORCED through this path
		 * unconditionally (no direct-site harvest is even attempted for
		 * them), and since LT-036 also for any signal credited in
		 * `thunkRendered` — its value flows into the DOM through a
		 * style-map/class-map object or a computed reactive thunk, so it is
		 * provably not dead, and the server rendered that output from this
		 * same initializer (DOM agrees by construction). A `createCell`/
		 * `createState` signal with a literal initializer and NO rendered
		 * site at all must still fail (LTC004): those DO have a direct-site
		 * harvest route, and a silently-never-rendered signal is exactly
		 * the drift ADR 0003 exists to catch.
		 */
		allowVerbatim: boolean,
		/**
		 * The initializer is LAZY — its body first runs only after `expose()`
		 * has installed the Slot-backed properties, so arg reads may route
		 * through `host.<prop>` (the exposed prop's Slot, a tracked reactive
		 * source; see `paramDomRead`'s precedence 1). Always true for
		 * `deriveCell`/`deriveStore`/`createMemo`; NEVER for the eager
		 * constructors, whose initializer executes at declaration — before
		 * `expose()` — where a `host.<prop>` read would be `undefined`.
		 */
		allowTrackedRead: boolean,
		/**
		 * Admit FactoryContext members (`all`, `first`, …) as client-known
		 * (LT-323). Only for a signal read exclusively in client-only
		 * positions: the client destructures them, and no served HTML
		 * depends on the value the server could not compute.
		 */
		allowContextMembers = false,
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
					!(allowContextMembers && FACTORY_CONTEXT_MEMBERS.has(n)) &&
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
		// literal list seed (ADR 0024 sub-design 13). Only sound for signals
		// with no direct-site harvest route at all (see `allowVerbatim`'s doc).
		if (params.length === 0)
			return allowVerbatim ? source.slice(init.start, init.end) : null
		const reads = new Map<string, string>()
		for (const param of params) {
			const read = paramDomRead(param, allowTrackedRead)
			if (!read) return null
			reads.set(param, read)
		}
		const ranges: Array<[number, number, string]> = []
		// Type positions are skipped: rewriting a name inside one
		// (`typeof label`) into a DOM read would emit invalid TypeScript, and
		// `dependenciesOf` above never counted it as a read anyway.
		const collect = (current: AstNode): void => {
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
			// Non-computed member properties and object keys are positions,
			// not reads — same scoping as freeIdentifiers.
			if (current.type === 'MemberExpression' && !current.computed) {
				if (isNode(current.object)) collect(current.object)
				return
			}
			if (current.type === 'Property' && !current.computed) {
				if (isNode(current.value)) collect(current.value)
				return
			}
			forEachChild(current, collect)
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
		// requestContext-backed signals (LT-035) never need a harvest site —
		// the client re-dispatches the context-request itself and owns its
		// own initial value (a Slot seeded with the fallback), rather than
		// reading it back from server-rendered DOM. LTC004 ("signal never
		// rendered") does not apply: emit-client.ts emits them through a
		// dedicated verbatim path, never this harvest machinery.
		if (signal.family === 'context') continue
		// A sensor seeds itself on the client: its `{ value }` seed and its
		// start callback are client code, declared verbatim (`emit-client.ts`
		// no-harvest path; LT-348 still refuses a server name in either), and
		// a harvest would replace the start callback (ADR 0046 s5).
		if (signal.constructor === 'createSensor') continue
		/**
		 * A scalar `harvest(seed, parser)` marker (ADR 0046 s7, LT-443): the
		 * parser the scalar harvest reads go through — the direct text/attr
		 * site read, an identity seed's substituted DOM read, a membership
		 * value read — spliced as authored. Its free names must resolve on
		 * the client (LTC005's client-position face, as LT-429's map
		 * entries); checked once, where the marker is consumed.
		 */
		const scalarMarker =
			signal.family === 'declared' && signal.harvest?.kind === 'scalar'
				? signal.harvest
				: null
		/**
		 * A scalar-seeded signal: the only family the scalar marker and
		 * LTC077 apply to. A derived callback re-derives (never parses a
		 * seed back — its `inferredType` is usually `unknown` and that is
		 * fine), and a `createList` seed is the list harvest's business.
		 */
		const scalarSeeded =
			signal.family === 'declared' &&
			SCALAR_HARVEST_CONSTRUCTORS.has(signal.constructor)
		/** The authored parser plan for a consumed marker. */
		const authoredParserOf = (
			marker: Extract<HarvestSeedIR, { kind: 'scalar' }>,
		): AuthoredParser => {
			reportServerOnlyNames(
				shared,
				marker.parser,
				`The \`harvest()\` parser of signal \`${signal.name}\``,
			)
			return {
				kind: 'authored',
				text: marker.parserText,
				start: marker.parser.start as number,
				wrap: !CALLABLE_AS_WRITTEN.has(String(marker.parser.type)),
			}
		}
		/**
		 * The parser a scalar harvest reads through (LT-443): the marker's
		 * parser when declared, else the one the inferred type maps to —
		 * and LTC077 at the seed when the type is one the compiler cannot
		 * read and no marker declares a parser, because the inferred-
		 * string fallback would silently connect e.g. `2.5` as `'2.5'`.
		 * Null after reporting: the signal plans nothing.
		 */
		const parserForSeed = (): ParserKind | AuthoredParser | null => {
			// A non-scalar signal with a direct site (a bare `{items}` list
			// signal) keeps today's inferred mapping — the scalar rule does
			// not speak to it.
			if (!scalarSeeded) return parserForType(signal.inferredType)
			if (scalarMarker) return authoredParserOf(scalarMarker)
			if (signal.inferredType === 'unknown') {
				const seedName =
					signal.init && nodeType(signal.init) === 'Identifier'
						? String((signal.init as AstNode).name)
						: null
				const param = seedName
					? component.paramProps.find(p => p.name === seedName)
					: undefined
				diagnostics.push(
					diagnostic.scalarSeedWithoutParser(
						source,
						signal.init,
						signal.name,
						signal.constructor,
						signal.init
							? source.slice(signal.init.start, signal.init.end)
							: signal.name,
						param && param.typeText !== 'unknown' ? param.typeText : null,
					),
				)
				rawSourceRefused.add(signal.name)
				return null
			}
			return parserForType(signal.inferredType)
		}
		/**
		 * A marker whose parser no read takes: a literal seed, an
		 * initializer reused verbatim, a seed that derives from the arg
		 * (the substitution reproduces the derivation, nothing parses).
		 * The same dead declaration a literal-seeded list's map is (ADR
		 * 0046 s7) — refused, not silently ignored.
		 */
		const refuseDeadMarker = (at: AstNode): void => {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					at,
					`The \`harvest()\` parser of signal \`${signal.name}\`, whose seed reads no server-rendered value,`,
					'The client re-evaluates the seed as written, and no parser runs — drop the marker.',
				),
			)
			rawSourceRefused.add(signal.name)
		}
		// A reconciled List seeds from the adopted DOM, not a text/attr site.
		// A derived List (ADR 0046 s4) has no seed to harvest: like every
		// derive callback it re-derives on the client from its sources.
		const listPlan = [...reconcilePlans.values()].find(
			p => p.signal === signal.name,
		)
		if (listPlan && signal.family === 'declared') {
			const free = signal.init ? dependenciesOf(signal.init) : new Set<string>()
			if ([...free].every(name => JS_GLOBALS.has(name))) {
				// The client reuses a literal seed as written, so a `harvest()`
				// map there declares parsers nothing reads (ADR 0046 s7).
				if (signal.harvest) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							signal.harvest.call,
							'A `harvest()` seed on a list seeded with a literal',
							'The client reuses a literal seed as written and harvests nothing — pass the literal to `createList()` directly.',
						),
					)
					rawSourceRefused.add(signal.name)
				} else
					harvests.push({ kind: 'list', signal: signal.name, seed: 'verbatim' })
			} else if (
				[...free].every(name => component.paramNames.includes(name)) &&
				!listPlan.scoped &&
				harvestsPerField(signal)
			) {
				// Per-field harvest (ADR 0046 s7, LT-429): each field from its
				// canonical site in the adopted item, through its parser.
				const loop = [...reconcilePlans.entries()].find(
					([, plan]) => plan === listPlan,
				)?.[0]
				const plan = loop
					? planListFieldHarvest(shared, signal, loop, listPlan.container)
					: null
				if (plan) harvests.push(plan)
			} else if ([...free].every(name => component.paramNames.includes(name))) {
				// The arg-seeded List harvests the container's adopted children
				// through the item value's DOM site (the bare `{item}` hole's
				// parent, ADR 0003). A body that renders the item nowhere has
				// no site — no phase can deliver a value the markup does not
				// carry. A list nested in a Mount Scope (LT-424) has no
				// connect-time container: its items render inside an arm or
				// an item, which may not exist at connect.
				if (listPlan.scoped) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							signal.init,
							`The list seed of \`${signal.name}\`, which is derived from server args, for a reactive-list ${wordingOf(component).loop} nested in an arm or a list item`,
							'The client seeds an arg-derived list from the adopted container at connect, and a nested container may not exist then — seed the list with a literal.',
						),
					)
				} else if (listPlan.holeSelector === null) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							signal.init,
							`The list seed of \`${signal.name}\`, which is derived from server args, with the ${wordingOf(component).loop} body rendering the item nowhere to read it from`,
							"The client seeds the list from the adopted items' rendered values — render the item in the body (the bare `{item}` child), or seed the list with a literal.",
						),
					)
				} else {
					harvests.push({
						kind: 'list',
						signal: signal.name,
						seed: {
							container: listPlan.container,
							valueSelector: listPlan.holeSelector,
						},
					})
				}
			} else {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						signal.init,
						`The list seed of \`${signal.name}\`, which is neither a pure literal nor derived from server args,`,
						"The client either reuses a literal seed (the server rendered from it) or harvests the container's server-rendered children — seed the list with a literal, or derive it from server args.",
					),
				)
			}
			continue
		}
		// `deriveCell`/`deriveStore` initializers are callbacks, not raw values
		// — a 'text'/'attr' direct-site harvest would splice the DOM read in
		// place of the whole function (ADR 0024 sub-design 12). A rendered
		// lazy child of the signal's own name still exists for the WATCH
		// target/initial value (Pass 4 wires it independently of harvest
		// selection here), but harvesting always goes through the arg-
		// substitution route for these constructors.
		const isDerivedCallback =
			signal.constructor === 'deriveCell' ||
			signal.constructor === 'deriveList' ||
			signal.constructor === 'deriveStore' ||
			signal.constructor === 'createMemo'
		const own = isDerivedCallback
			? []
			: sites
					.filter(s => s.signal === signal.name)
					.sort((a, b) => a.order - b.order)
		if (own.length === 0) {
			// The substitution route reproduces the seed expression with each
			// param replaced by its DOM read — so the client value is the
			// seed's own derivation, evaluated identically on both sides. The
			// parser (and LTC077) applies only to an IDENTITY seed: the seed
			// IS the arg's value, so the substituted read is a raw DOM string
			// the inferred-string fallback would connect as-is. A deriving
			// seed (`value.length`, `mode === 'wide'`) keeps today's bare
			// substitution; a marker there declares a parser no read takes —
			// refused, like a literal seed's.
			const identitySeed =
				!!signal.init &&
				nodeType(signal.init) === 'Identifier' &&
				component.paramNames.includes(String((signal.init as AstNode).name))
			const readsArgs =
				!!signal.init &&
				[...dependenciesOf(signal.init)].some(name =>
					component.paramNames.includes(name),
				)
			if (scalarMarker && (!readsArgs || (scalarSeeded && !identitySeed))) {
				refuseDeadMarker(scalarMarker.call)
				continue
			}
			// No rendered site: an initializer over server args can still seed
			// from the args' DOM sites (LT-008 substitution rule). A signal
			// rendered only through a map/computed thunk (LT-036) may also
			// reuse its initializer verbatim — same soundness as a derived
			// callback, per `allowVerbatim`'s contract above.
			const reported = diagnostics.length
			const substituted = signal.init
				? substituteArgExpr(
						signal.init,
						isDerivedCallback || thunkRendered.has(signal.name),
						isDerivedCallback,
						clientCredited.has(signal.name) && !renderCredited.has(signal.name),
					)
				: null
			if (substituted) {
				// The substituted read of an identity seed is a DOM string
				// (LT-008); the marker's parser parses it back, and an unmarked
				// seed whose type the compiler cannot read is LTC077 (LT-443) —
				// the bare splice would connect the string as-is. Derived
				// callbacks and list seeds leave this limb untouched.
				if (scalarSeeded && scalarMarker) {
					harvests.push({
						kind: 'substitute',
						signal: signal.name,
						expr: substituted,
						parser: authoredParserOf(scalarMarker),
					})
				} else if (
					scalarSeeded &&
					identitySeed &&
					signal.inferredType === 'unknown'
				) {
					const seedName =
						signal.init && nodeType(signal.init) === 'Identifier'
							? String((signal.init as AstNode).name)
							: null
					const param = seedName
						? component.paramProps.find(p => p.name === seedName)
						: undefined
					diagnostics.push(
						diagnostic.scalarSeedWithoutParser(
							source,
							signal.init,
							signal.name,
							signal.constructor,
							signal.init
								? source.slice(signal.init.start, signal.init.end)
								: signal.name,
							param && param.typeText !== 'unknown' ? param.typeText : null,
						),
					)
					rawSourceRefused.add(signal.name)
				} else {
					harvests.push({
						kind: 'substitute',
						signal: signal.name,
						expr: substituted,
					})
				}
				continue
			}
			// D-20 (LT-374): a signal seeded from server args that renders only
			// as formatted text has nothing the client can read back — the text
			// does not parse, and no arg it reads renders as a raw attribute
			// (else the substitution above would have found it). LTC059 names
			// the raw-source fix; it replaces the generic server-only-name
			// LTC005 `plan.ts` would raise for the same initializer. Skipped
			// when the substitution failed for another, already-reported reason
			// (an unaddressable arg site).
			const formatted = formattedText.get(signal.name)
			if (
				formatted &&
				signal.init &&
				diagnostics.length === reported &&
				[...dependenciesOf(signal.init)].some(name =>
					component.paramNames.includes(name),
				)
			) {
				diagnostics.push(
					diagnostic.formattedWithoutRawSource(
						source,
						formatted.node,
						`Signal \`${signal.name}\``,
						formatted.formatting,
					),
				)
				rawSourceRefused.add(signal.name)
				continue
			}
			reportUnharvestable(signal)
			continue
		}
		const direct = own.find(s => s.kind === 'text' || s.kind === 'attr') as
			| { kind: 'text'; element: ElementNode }
			| { kind: 'attr'; element: ElementNode; attr: string }
			| undefined
		// LT-114 interplay / LT-115: a direct site ON THE ROOT (a
		// signal-identifier lazy root child, `<my-el>{sig}</my-el>`) must never
		// become a query — `first('<own-tag>')` searches descendants only and
		// throws `MissingElementError` for the component's own root at
		// activation. Route it through the ambient `host` instead (the text
		// site reads `host.textContent`), the same target LT-114's root branch
		// plans the watch against — harvest and watch agree. `'host'` is
		// deliberately NOT a query-table entry: `harvestInitializer` passes
		// unknown query names through verbatim, and `usedNames` already
		// reserves `'host'` (analysis/plan.ts) so `addQuery` can never allocate
		// it. (An `attr` site on the root is unreachable in a compiling
		// component — reactive attributes on the root are LTC005 — but routed
		// uniformly rather than left emitting a broken query.)
		/**
		 * The parser the signal's direct-site harvest reads through
		 * (LT-443): the `harvest()` marker's parser when there is one
		 * (spliced as authored, its free names client-checked), else the
		 * parser the inferred type maps to — and LTC077 when the seed's
		 * type is one the compiler cannot read and no marker declares a
		 * parser, because `asString` would silently connect the seed as a
		 * string. Null after reporting LTC077: the signal plans nothing.
		 */
		const directSiteParser = parserForSeed
		if (direct && direct.element === component.root) {
			const parser = directSiteParser()
			if (!parser) continue
			ambient.add('host')
			if (direct.kind === 'text') {
				harvests.push({
					kind: 'text',
					signal: signal.name,
					query: 'host',
					parser,
				})
			} else {
				harvests.push({
					kind: 'attr',
					signal: signal.name,
					query: 'host',
					attr: direct.attr,
					parser,
				})
			}
			continue
		}
		if (direct) {
			const parser = directSiteParser()
			if (!parser) continue
			const { selector, unique } = resolveSelector(direct.element)
			if (!unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						direct.element.node,
						`No unique selector for the harvest site of signal \`${signal.name}\` — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
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
					parser,
				})
			} else {
				harvests.push({
					kind: 'attr',
					signal: signal.name,
					query,
					attr: direct.attr,
					parser,
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
		const plan = loop?.kind === 'each' ? forPlans.get(loop) : undefined
		const valueAttr = loop
			? [...loop.output.attrs].find(
					(attr): attr is Extract<AttributeIR, { kind: 'server' }> =>
						attr.kind === 'server' && attr.exprText === mark.constName,
				)
			: undefined
		if (!loop || !plan || !valueAttr) {
			reportUnharvestable(signal)
			continue
		}
		// A scalar seed's membership read takes the marker's parser when
		// declared (LT-443) — the parser owns the no-match miss, so no typed
		// default — and LTC077 when the type is unreadable and no marker
		// declares one. A typed, unmarked seed keeps today's parser-less
		// read: the compared const is a string the attribute round-trips
		// verbatim, and an inferred parser would only restate it.
		const membership = {
			kind: 'membership' as const,
			signal: signal.name,
			collection: plan.collection,
			markAttr: mark.attr,
			valueAttr: valueAttr.name,
			default: defaultForType(signal.inferredType),
		}
		if (scalarSeeded && scalarMarker)
			harvests.push({ ...membership, parser: authoredParserOf(scalarMarker) })
		else {
			if (scalarSeeded && !parserForSeed()) continue
			harvests.push(membership)
		}
	}
	return harvests
}

/* === Exported Functions === */

/**
 * Passes 2+3: render sites, then one harvest plan per signal. Requires the
 * loop plans (ADR 0040 s5): a membership harvest addresses its `each()`
 * collection, a reconciled List seeds from its container.
 */
export const runHarvest = (
	shared: PassShared,
	loopPlans: LoopPlans,
): HarvestPlans =>
	planHarvests(shared, loopPlans, collectRenderSites(shared.component))
