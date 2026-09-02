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

import type { TsrxNode } from '@tsrx/core'
import {
	CONTEXT_NAMES,
	hostPropOf,
	identifierName,
	JS_GLOBALS,
	nodeType,
	sanitizeVarName,
} from '../ast-utils'
import { diagnostic } from '../diagnostics'
import { dependenciesOf } from '../evaluability'
import type { AttributeIR, SignalIR, TemplateNode } from '../ir'
import type { AnalysisContext, HarvestPlan, ParserKind } from './plan'
import {
	type ElementNode,
	type ExprNode,
	enclosingIfOf as enclosingIfOfIn,
	isElement,
	resolveSelector as resolveSelectorIn,
	selectorFor as selectorForIn,
} from './selectors'

/* === Shared signal-read predicates === */

/** `sig.get()` call check for direct/membership matching. */
export const isSignalGetCall = (node: unknown, signal: string): boolean => {
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
 * `sig.get()` read anywhere inside a node (LT-036): a style-map/class-map
 * object or a computed reactive thunk still renders the signal's value into
 * the DOM, even though no part of it can serve as a splice-harvest site.
 */
export const containsSignalGet = (node: unknown, signal: string): boolean => {
	if (Array.isArray(node)) {
		return node.some(child => containsSignalGet(child, signal))
	}
	if (
		!node ||
		typeof node !== 'object' ||
		typeof (node as TsrxNode).type !== 'string'
	)
		return false
	for (const [key, value] of Object.entries(node)) {
		if (key === 'loc' || key === 'range' || key === 'parent') continue
		if (containsSignalGet(value, signal)) return true
	}
	return isSignalGetCall(node, signal)
}

/**
 * Match the membership mark: `() => String(sig.get() === C)` or
 * `() => sig.get() === C`. Returns the const identifier.
 */
export const membershipConst = (
	thunk: TsrxNode,
	signal: string,
): string | null => {
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
export const isDirectAttrThunk = (thunk: TsrxNode, signal: string): boolean =>
	isSignalGetCall(thunk.body, signal)

export const parserForType = (type: string): ParserKind => {
	switch (type) {
		case 'number':
			return 'asInteger'
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
 * is DOMString-typed, so an uncoerced number thunk fails `check:tsrx` on
 * the generated client. Callers that have no signal list keep the old
 * literal-only behaviour.
 */
export const returnsNumber = (
	body: unknown,
	signals: readonly SignalIR[] = [],
): boolean => {
	if (nodeType(body) === 'Literal')
		return typeof (body as TsrxNode).value === 'number'
	if (nodeType(body) === 'ConditionalExpression')
		return returnsNumber((body as TsrxNode).consequent, signals)
	// `<signal>.get()` — the identifier form only. A `.get()` on anything
	// else (a member chain, a call result) is not a signal read this
	// compiler tracks, so it stays undetected rather than guessed at.
	if (nodeType(body) === 'CallExpression') {
		const callee = (body as TsrxNode).callee
		if (
			nodeType(callee) === 'MemberExpression' &&
			identifierName((callee as TsrxNode).property) === 'get'
		) {
			const name = identifierName((callee as TsrxNode).object)
			if (name)
				return signals.some(s => s.name === name && s.inferredType === 'number')
		}
	}
	return false
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

/* === Exported Functions === */

/** Passes 2+3: render sites, then one harvest plan per signal. */
export const runHarvest = (ctx: AnalysisContext): void => {
	const {
		component,
		source,
		diagnostics,
		harvests,
		reconcilePlans,
		addQuery,
		ambient,
		refNames,
	} = ctx
	const enclosingIfOf = (target: ElementNode) =>
		enclosingIfOfIn(component, target)
	const selectorFor = (el: ElementNode) => selectorForIn(component, el)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)

	// --- Pass 2: signal render sites (document order) ------------------------
	// Direct sites (text child, direct attribute) and membership marks; the
	// canonical harvest site is the first direct site by document order,
	// else the first membership mark. Signals whose values reach the DOM
	// only through thunks none of these can splice into — style-map/class-map
	// objects, computed (non-`sig.get()`) reactive thunks — are credited in
	// `thunkRendered` instead (LT-036): rendered, so not TSRX004-dead, but
	// never a harvest site; Pass 3 seeds them by initializer reuse.
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
	const thunkRendered = new Set<string>()
	let documentOrder = 0

	const loopFor = (node: TemplateNode) =>
		[...component.fors.values()].find(f => f.output === node) ?? null

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
	// no server fold can resolve (TSRX034) — see the popup gate in
	// form-combobox.tsrx.
	for (const stmt of component.clientSetup)
		for (const signal of component.signals)
			if (containsSignalGet(stmt.node, signal.name))
				thunkRendered.add(signal.name)

	// --- Pass 3: harvest plans ------------------------------------------------

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
					component.parserExposeProps.has(a.name),
			) as Extract<AttributeIR, { kind: 'server' }> | undefined
			if (exposedRootAttr) {
				ambient.add('host')
				return `host.${exposedRootAttr.name}`
			}
		}
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
					const prop = hostPropOf(attr.thunk)
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
						site.el.node.start,
						`No unique selector for the DOM site of server arg \`${param}\` (<${site.el.tag}>); add a distinguishing static attribute.`,
					),
				)
				return null
			}
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
		 * verbatim (ADR 0023 sub-design 13): sound for `deriveCell`/
		 * `deriveStore` signals, which are FORCED through this path
		 * unconditionally (no direct-site harvest is even attempted for
		 * them), and since LT-036 also for any signal credited in
		 * `thunkRendered` — its value flows into the DOM through a
		 * style-map/class-map object or a computed reactive thunk, so it is
		 * provably not dead, and the server rendered that output from this
		 * same initializer (DOM agrees by construction). A `createCell`/
		 * `createState` signal with a literal initializer and NO rendered
		 * site at all must still fail (TSRX004): those DO have a direct-site
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
			const read = paramDomRead(param, allowTrackedRead)
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
		// requestContext-backed signals (LT-035) never need a harvest site —
		// the client re-dispatches the context-request itself and owns its
		// own initial value (a Slot seeded with the fallback), rather than
		// reading it back from server-rendered DOM. TSRX004 ("signal never
		// rendered") does not apply: emit-client.ts emits them through a
		// dedicated verbatim path, never this harvest machinery.
		if (signal.constructor === 'requestContext') continue
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
			signal.constructor === 'deriveStore' ||
			signal.constructor === 'createMemo'
		const own = isDerivedCallback
			? []
			: sites
					.filter(s => s.signal === signal.name)
					.sort((a, b) => a.order - b.order)
		if (own.length === 0) {
			// No rendered site: an initializer over server args can still seed
			// from the args' DOM sites (LT-008 substitution rule). A signal
			// rendered only through a map/computed thunk (LT-036) may also
			// reuse its initializer verbatim — same soundness as a derived
			// callback, per `allowVerbatim`'s contract above.
			const substituted = signal.init
				? substituteArgExpr(
						signal.init,
						isDerivedCallback || thunkRendered.has(signal.name),
						isDerivedCallback,
					)
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
		// component — reactive attributes on the root are TSRX005 — but routed
		// uniformly rather than left emitting a broken query.)
		if (direct && direct.element === component.root) {
			ambient.add('host')
			if (direct.kind === 'text') {
				harvests.push({
					kind: 'text',
					signal: signal.name,
					query: 'host',
					parser: parserForType(signal.inferredType),
				})
			} else {
				harvests.push({
					kind: 'attr',
					signal: signal.name,
					query: 'host',
					attr: direct.attr,
					parser: parserForType(signal.inferredType),
				})
			}
			continue
		}
		if (direct) {
			const { selector, unique } = resolveSelector(direct.element)
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
		const plan = loop ? ctx.forPlans.get(loop) : undefined
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
}
