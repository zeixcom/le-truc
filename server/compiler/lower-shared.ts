/**
 * Front-end-shared template lowering (LT-202, ADR 0032 sub-design 6: the
 * anti-drift half of the dual front-end contract). Both surfaces lower into
 * the same `TemplateNode` IR; the pieces below are the surface-independent
 * core — condition validation, element/compose lowering, the expression-
 * child lift rule, positional reactivity — while each front end keeps its
 * own control-flow dispatch (`.tsrx`: `@if`/`@switch`/`@try`/`@for`
 * directive nodes; `.tsx`: ternaries, `.map()`, the switch IIFE,
 * `<truc:try>`).
 *
 * Front-end-neutral like the front-end stage modules (`setup-extraction.ts`
 * et al.): no parser values, only the loose
 * `AstNode` type. The recursion into `lowerChildren` arrives through the
 * `Lowering` interface — each front end passes its own dispatcher, since the
 * child-node vocabulary is the one genuinely surface-specific decision.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	attrName,
	collapseJsxText,
	freeIdentifiers,
	identifierName,
	isNode,
	jsxName,
	nodeType,
	text,
} from './ast-utils'
import {
	classifyAttribute,
	classifyComposeAttribute,
} from './classify-attributes'
import { diagnostic, type Site } from './diagnostics'
import {
	containsImpureAmbient,
	dependenciesOf,
	isServerEvaluable,
} from './evaluability'
import type { ExtractContext } from './extract-context'
import {
	collectMatchingElements,
	inOptionalBranch,
	inReactiveArm,
	inReconcileItem,
	namesCustomElementTag,
	shareExclusiveIf,
} from './first-refs'
import type {
	ArmTemplate,
	AttributeIR,
	ComposeAttrIR,
	EachForIR,
	ForIR,
	InitialWinner,
	ItemSetupStmt,
	ReconcileForIR,
	SignalIR,
	TemplateNode,
} from './ir'
import {
	bindsExposedArg,
	classifyChild,
	dependencyClosure,
	withBound,
} from './reactivity'
import { extractItemSetup } from './setup-extraction'
import { wordingOf } from './surface'
import { JS_GLOBALS } from './vocabulary'
import {
	type IfNode,
	isClientConstructAttr,
	type SwitchNode,
	someNode,
} from './walk'

/** The recursion seam: each front end's own children dispatcher. */
export type Lowering = {
	lowerChildren: (
		ctx: ExtractContext,
		parent: AstNode,
		signals: ReadonlyMap<string, SignalIR>,
		fors: Map<AstNode, ForIR>,
	) => TemplateNode[]
}

/* === Condition validation === */

/**
 * How a conditional lowers (ADR 0037): `server` when its test is server-known,
 * `reactive` when it reads a signal or `host`.
 */
export type ConditionMode = 'server' | 'reactive'

/**
 * Lower a loop body with the loop's bindings shadowing same-named signals.
 * `reactive` marks a reactive list's item and key: they are signals of their
 * own (ADR 0046 s3), so a condition reading one is reactive (LT-424).
 */
const lowerLoopBody = <T>(
	ctx: ExtractContext,
	names: ReadonlyArray<string | null | undefined>,
	lower: () => T,
	reactive = false,
): T => {
	const depth = ctx.loopBound.length
	for (const n of names)
		if (n) {
			ctx.loopBound.push(n)
			ctx.loopReactive.push(reactive)
		}
	try {
		return lower()
	} finally {
		ctx.loopBound.length = depth
		ctx.loopReactive.length = depth
	}
}

/** A list of names as message copy: `` `a` and `b` ``. */
const nameList = (names: readonly string[]): string =>
	names.map(n => `\`${n}\``).join(' and ')

/** Is `name`'s innermost loop binding a reactive list's item or key? */
const boundReactive = (ctx: ExtractContext, name: string): boolean =>
	ctx.loopReactive[ctx.loopBound.lastIndexOf(name)] === true

/** Whether a setup const's initializer reads a signal or `host`, transitively. */
const readsSignalThroughAlias = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	name: string,
	seen: Set<string> = new Set(),
): boolean => {
	if (seen.has(name) || signals.has(name)) return false
	seen.add(name)
	const init = ctx.setupInits.get(name)
	if (!init) return false
	for (const read of freeIdentifiers(init)) {
		if (signals.has(read) || read === 'host') return true
		if (readsSignalThroughAlias(ctx, signals, read, seen)) return true
	}
	return false
}

/**
 * Whether a setup const's initializer EAGERLY dereferences a signal — an
 * `X.get()` call whose `X` is a signal (or resolves to one through further
 * setup consts), or a bare alias of such a const. The snapshot is one
 * server value, so a condition reading it stays `server`, exactly as the
 * setup-const contract promises; only a LIVE alias (a function whose body
 * reads a signal or `host`, or a bare signal alias) goes stale under a
 * `server` classification and is refused instead.
 */
const eagerlyDereferencesSignal = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	name: string,
	seen: Set<string> = new Set(),
): boolean => {
	if (seen.has(name)) return false
	seen.add(name)
	const init = ctx.setupInits.get(name)
	if (!init) return false
	if (init.type === 'Identifier')
		return eagerlyDereferencesSignal(ctx, signals, String(init.name), seen)
	if (init.type !== 'CallExpression') return false
	const callee = init.callee as AstNode | undefined
	if (
		!isNode(callee) ||
		callee.type !== 'MemberExpression' ||
		callee.computed === true ||
		!isNode(callee.property) ||
		callee.property.type !== 'Identifier' ||
		callee.property.name !== 'get'
	)
		return false
	const object = callee.object as AstNode | undefined
	if (!isNode(object) || object.type !== 'Identifier') return false
	const target = String(object.name)
	return (
		signals.has(target) ||
		target === 'host' ||
		readsSignalThroughAlias(ctx, signals, target, seen)
	)
}

/**
 * Classify a control-flow condition (`@if` test / ternary test, `@switch`
 * discriminant). A test that reads a signal or `host` is reactive (ADR
 * 0037: its arms become template-cloned branches) — which names its client
 * thunk may read is the analysis's check, as for every client position,
 * and a loop binding shadows a same-named signal (LT-387). Any other test
 * must be server-known at render time (args, setup consts, globals); null
 * when it is not, after reporting why. A setup const that eagerly
 * dereferences a signal (`const snapshot = open.get()`) is one server
 * value and stays `server`; a live alias of a signal or `host` — a
 * function reading it, or a bare alias — would classify `server` and never
 * update, so it is refused (LTC005). The message names the surface's
 * spelling of the construct.
 */
export const validateCondition = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	test: AstNode,
	kind: 'if' | 'switch',
): ConditionMode | null => {
	const wording = wordingOf(ctx)
	const what = kind === 'if' ? wording.ifCondition : wording.switchDiscriminant
	const free = freeIdentifiers(test)
	for (const global of JS_GLOBALS) free.delete(global)
	const bound = new Set(ctx.loopBound)
	const isSignal = (name: string) =>
		bound.has(name)
			? boundReactive(ctx, name)
			: signals.has(name) || name === 'host'
	if ([...free].some(isSignal)) return 'reactive'
	// A live setup alias of a signal (`const isOpen = () => open.get()`)
	// would classify `server` and never update; refuse it rather than go
	// stale. An eager snapshot (`const snapshot = open.get()`) is one server
	// value — exempt.
	const alias = [...free].find(
		name =>
			!bound.has(name) &&
			!eagerlyDereferencesSignal(ctx, signals, name) &&
			readsSignalThroughAlias(ctx, signals, name),
	)
	if (alias) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				test,
				`${what} that reads the setup const \`${alias}\`, which reads a signal or \`host\`,`,
				'The server classifies the condition from the names it spells — read the signal or `host` directly in the condition.',
			),
		)
		return null
	}
	const unknown = [...free].filter(name => !ctx.serverKnown.has(name))
	if (unknown.length > 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				test,
				`${what} that reads ${unknown.map(n => `\`${n}\``).join(', ')}, which the server render does not know,`,
				'A condition is evaluated during the server render, or on the client when it reads a signal or `host` — derive it from args, setup consts or signals.',
			),
		)
		return null
	}
	return 'server'
}

/* === Shared arm/child helpers === */

/** The sole element child among a control-flow arm's children, or null. */
export const singleRootOf = (
	children: TemplateNode[],
): (TemplateNode & { kind: 'element' }) | null => {
	const roots = children.filter(
		(c): c is TemplateNode & { kind: 'element' } => c.kind === 'element',
	)
	return roots.length === 1
		? (roots[0] as TemplateNode & { kind: 'element' })
		: null
}

/**
 * Mark direct `{expr}` children of each root element reactive when they read
 * a name that is reactive *by position* rather than by declaration (LT-052).
 * Three such names exist, and all are already recognised structurally
 * downstream: a `@catch`/`err` arm's error parameter, a reactive loop body's
 * item binding (the slot fill), and — since items became Mount Scopes (ADR
 * 0046 s1) — nothing else needs marking here, but the descent now follows the
 * server-rendered control flow an item body may carry (a server-known
 * conditional's arms, a plain boundary's): a bare `{item}` is routinely
 * nested inside one (`<li>{ok ? <b>{item}</b> : null}</li>`), and the slot
 * marker the server bakes and the client binds must fire at that depth too.
 * None of the marked names is a declared signal, so the general lift rule in
 * `reactivity.ts` correctly classifies them static — the context that makes
 * them reactive lives here, in the construct that binds them.
 *
 * Recurses through element children and server-rendered control-flow arms,
 * matching the recursive walk `validateListBody` uses to count item reads —
 * a reactive loop's item is routinely nested, not a direct child of the
 * loop's output root.
 */
export const markPositionallyReactive = (
	nodes: TemplateNode[],
	names: ReadonlySet<string>,
): void => {
	if (names.size === 0) return
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'expr') {
			if (node.reactivity === 'reactive') return
			const read = [...freeIdentifiers(node.expr)].filter(name =>
				names.has(name),
			)
			if (read.length === 0) return
			node.reactivity = 'reactive'
			node.deps = withBound(node.deps, read)
			return
		}
		if (node.kind === 'element') for (const child of node.children) visit(child)
		if (node.kind === 'conditional' && node.mode === 'server')
			for (const arm of node.arms)
				for (const child of arm.children) visit(child)
		if (node.kind === 'try' && node.pendingChildren === null) {
			for (const child of node.children) visit(child)
			for (const child of node.catchChildren) visit(child)
		}
	}
	for (const node of nodes) visit(node)
}

/**
 * Whether a plain `{expr}` child lifts into a `watch()` (LT-051). The rule
 * and its rationale live in `reactivity.ts`; this wrapper only turns the
 * `opaque` verdict into a LTC017 diagnostic. The `{children}` insertion
 * point (ADR 0024 sub-design 10) is a server arg, so it classifies `static`
 * without a special case here.
 */
const liftsToReactive = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	expr: AstNode,
	exprText: string,
	container: AstNode,
): boolean => {
	// `{'label'}` used to mean "watch the prop named label" — legible only
	// because `&` marked it as not-text. Bare, it is the literal string, so
	// the silent reading is a wrong component; demand `{host.label}`.
	if (
		nodeType(expr) === 'Literal' &&
		typeof expr.value === 'string' &&
		ctx.exposedProps.has(String(expr.value))
	) {
		ctx.diagnostics.push(
			diagnostic.stringLiteralPropChild(
				ctx.source,
				container,
				String(expr.value),
			),
		)
		return false
	}
	const verdict = classifyChild(expr, signals)
	if (verdict.kind === 'opaque') {
		ctx.diagnostics.push(
			diagnostic.unliftableChild(
				ctx.source,
				container,
				verdict.names,
				exprText,
			),
		)
		return false
	}
	// CHECKLIST §4 / LTC033 (error form): a `server` child renders ONCE,
	// server-side, forever — there is no watch() to ever correct it, unlike
	// a `reactive` child (which gets the WARNING form of this check in
	// analysis/effects.ts, since the client's first binding pass corrects
	// an omitted fold there). An impure ambient here (`Date.now()`, a random
	// id, `Intl`/`toLocaleString`) bakes one build-time reading into the
	// page permanently with no safety net at all — hard error, not a warning.
	if (verdict.kind === 'server' && containsImpureAmbient(expr))
		ctx.diagnostics.push(diagnostic.impureStaticChild(ctx.source, expr))
	return verdict.kind === 'reactive'
}

/**
 * The shared expression-child lowering: reactivity classification
 * (`bindsExposedArg`'s positional rule, LT-122 + the lift rule) and the
 * dependency closure, recorded once on the `expr` IR node (ADR 0040 s7). Both front ends' `lowerChildren` funnel every ordinary
 * `{expr}` child through here, so the lift rule cannot drift between
 * surfaces.
 */
export const lowerExpressionChild = (
	ctx: ExtractContext,
	expr: AstNode,
	container: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
): TemplateNode & { kind: 'expr' } => {
	const exprText = text(ctx.source, expr)
	// LT-122: `{label}`, where `label` is both a server arg
	// and an exposed prop, is reactive BY POSITION the same
	// way a `@catch` param or a loop item is — the arg is
	// what the server renders, the prop is what the client
	// rebinds against that render. `exprText` stays the arg.
	const bindsProp = bindsExposedArg(
		expr,
		ctx.argNames,
		ctx.exposedProps,
		signals,
		ctx.parserProps,
	)
	const reactive =
		bindsProp !== null ||
		liftsToReactive(ctx, signals, expr, exprText, container)
	return {
		kind: 'expr',
		expr,
		exprText,
		reactivity: reactive ? 'reactive' : 'server',
		deps: dependencyClosure(
			expr,
			signals,
			ctx.argNames,
			bindsProp ?? undefined,
		),
		...(bindsProp !== null ? { bindsProp } : {}),
		node: container,
	}
}

/* === Composed elements === */

/**
 * Composed-element children (ADR 0024 sub-design 10, LT-018): the markup
 * between a composed element's opening/closing tags substitutes into the
 * child's own template wherever it writes a bare `{children}` expression —
 * compile-time content substitution, not a live client binding (that markup
 * is rendered once, server-side, into the string forwarded as the child's
 * `children` server arg). Anything that would need CLIENT wiring — refs,
 * events, reactive/pass attributes, nested control-flow, or further
 * composition — has no meaning at a content-substitution site, so it is
 * diagnosed instead of silently dropped or silently inert. The two message
 * fragments naming the offending shapes are surface vocabulary (the `.tsrx`
 * sigil spelling vs. the `.tsx` expression spelling).
 */
export const validateComposedChildren = (
	ctx: ExtractContext,
	children: TemplateNode[],
): void => {
	const wording = wordingOf(ctx)
	const walk = (node: TemplateNode): void => {
		if (node.kind === 'text') return
		if (node.kind === 'expr') {
			if (node.reactivity === 'reactive')
				ctx.diagnostics.push(
					diagnostic.composedElementUnsupported(
						ctx.source,
						node.node,
						`${wording.lazyChild} in a composed element's content`,
					),
				)
			return
		}
		if (node.kind !== 'element') {
			ctx.diagnostics.push(
				diagnostic.composedElementUnsupported(
					ctx.source,
					node.node,
					`${node.kind === 'compose' ? 'A nested composed element' : wording.controlFlow} in a composed element's content`,
				),
			)
			return
		}
		for (const attr of node.attrs) {
			if (attr.kind === 'static' || attr.kind === 'server') continue
			ctx.diagnostics.push(
				diagnostic.composedElementUnsupported(
					ctx.source,
					node.node,
					`A \`${attr.kind}\` attribute in a composed element's content`,
				),
			)
		}
		for (const child of node.children) walk(child)
	}
	for (const child of children) walk(child)
}

/**
 * Lower a composed (PascalCase) element: resolve its tag against the file's
 * compose-import map (ADR 0024 sub-design 10), classify attributes as server
 * args (regardless of value shape), `ref`, or `pass={{ }}` (client-prop
 * interop), and lower any children into the reserved `children`
 * substitution (LT-018) — validated to statics/server expressions only
 * (`validateComposedChildren` above). Classification
 * (`classify-attributes.ts`) is reused verbatim from the machinery.
 */
export const lowerComposeElement = (
	ctx: ExtractContext,
	element: AstNode,
	tag: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	lowering: Lowering,
): (TemplateNode & { kind: 'compose' }) | null => {
	const source = ctx.composeImports.get(tag)
	if (!source) {
		ctx.diagnostics.push(
			diagnostic.unresolvedComposedComponent(ctx.source, element, tag),
		)
		return null
	}
	const opening = element.openingElement
	const attrs: ComposeAttrIR[] = []
	if (isNode(opening) && Array.isArray(opening.attributes)) {
		for (const attr of asArray(opening.attributes)) {
			if (attr.type !== 'JSXAttribute') {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						attr,
						'Spread attributes on a composed element',
					),
				)
				continue
			}
			const classified = classifyComposeAttribute(ctx, attr)
			if ('reason' in classified) {
				ctx.diagnostics.push(
					diagnostic.invalidAttribute(
						ctx.source,
						attr,
						`${classified.reason} (attribute \`${attrName(attr)}\`)`,
					),
				)
				continue
			}
			attrs.push(classified)
		}
	}
	const children = lowering.lowerChildren(ctx, element, signals, fors)
	validateComposedChildren(ctx, children)
	return {
		kind: 'compose',
		component: tag,
		source,
		attrs,
		children,
		node: element,
	}
}

/* === Element lowering === */

/**
 * Lower one plain element: classify its attributes
 * (`classify-attributes.ts`, reused verbatim), diagnose a PascalCase tag in
 * a non-child-list position (LTC011's sibling — the wording names the
 * surface's loop spelling), run the impure-server-attribute and textarea-
 * value checks (LTC033/LTC030), and recurse into children through the
 * front end's own dispatcher.
 */
export const lowerElement = (
	ctx: ExtractContext,
	element: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	lowering: Lowering,
): TemplateNode & { kind: 'element' } => {
	const wording = wordingOf(ctx)
	const opening = element.openingElement
	const tagNode = isNode(opening) ? opening.name : null
	const tag = jsxName(tagNode) ?? ''
	// LTC053 (LT-213): a tag that is not a plain identifier — `.tsrx`'s
	// dynamic `<{expr}>` container, `.tsx`'s namespaced or member name —
	// has no static element to lower; `jsxName` returns null for all of
	// them. The error fails the compile, so the `tag: ''` placeholder
	// returned below never reaches an emitted component.
	if (tag === '')
		ctx.diagnostics.push(
			diagnostic.unsupportedElementTag(
				ctx.source,
				element,
				isNode(tagNode) ? text(ctx.source, tagNode) : '?',
				wording.conditionalTag,
			),
		)
	// LTC056 (LT-358 rider): an authored `<script>` element is refused on
	// both surfaces, whatever its `type` — it would pass verbatim into
	// served HTML, and the page owns script loading. Raised here, the one
	// plain-element funnel both front ends share, so a template target
	// inherits the refusal for free. Like LTC053, the error fails the
	// compile, so the lowered element below never reaches emitted output.
	if (tag === 'script')
		ctx.diagnostics.push(
			diagnostic.scriptElementInTemplate(ctx.source, element),
		)
	// LTC061 (LT-383): an authored `<template>` is refused on both surfaces —
	// the compiler owns template extraction (reactive-list item templates,
	// template-cloned arms), and the selector probe cannot see inside one
	// (css-select's HTML mode skips `<template>` content). Raised in the same
	// funnel as LTC056; the probe's own throw stays as the backstop.
	if (tag === 'template')
		ctx.diagnostics.push(
			diagnostic.templateElementInTemplate(ctx.source, element),
		)
	if (/^[A-Z]/.test(tag))
		ctx.diagnostics.push(
			diagnostic.composedElementUnsupported(
				ctx.source,
				element,
				`A composed element \`<${tag}>\` in ${wording.composedPosition}, or in any other position that is not an element's child list`,
			),
		)
	const attrs: AttributeIR[] = []
	if (isNode(opening) && Array.isArray(opening.attributes)) {
		for (const attr of asArray(opening.attributes)) {
			if (attr.type !== 'JSXAttribute') {
				ctx.diagnostics.push(
					diagnostic.unsupported(ctx.source, attr, 'Spread attributes'),
				)
				continue
			}
			const classified = classifyAttribute(ctx, attr, signals)
			if ('reason' in classified) {
				ctx.diagnostics.push(
					diagnostic.invalidAttribute(
						ctx.source,
						attr,
						`${classified.reason} (attribute \`${attrName(attr)}\`)`,
					),
				)
				continue
			}
			// CHECKLIST §4 / LTC033 (error form), LT-075: the attribute
			// counterpart of the static-CHILD check in `liftsToReactive`.
			// A `server` attribute is rendered once into the initial HTML and
			// never bound client-side, so an impure ambient here bakes one
			// build-time reading into the page permanently. The REACTIVE thunk
			// form is deliberately NOT escalated — it keeps the warning verdict
			// in analysis/effects.ts, where the refused fold is corrected by
			// the client's first binding pass.
			if (
				classified.kind === 'server' &&
				containsImpureAmbient(classified.node)
			)
				ctx.diagnostics.push(
					diagnostic.impureStaticAttribute(
						ctx.source,
						classified.node,
						classified.name,
					),
				)
			attrs.push(classified)
		}
	}
	// CHECKLIST §10 / LTC030: `value` is not a real HTML attribute on
	// `<textarea>` — the browser ignores it, and with no compensating write
	// the pre-hydration control renders empty. Only flags the STATIC/
	// server-rendered forms (`value="x"`, `value={arg}`): those have no
	// client-side correction at all, ever. A reactive-thunk mirror
	// (`value={() => host.value}`) still renders the same dead attribute,
	// but `bindProperty` corrects the live `.value` on connect, and pairing
	// it with a static text-content child (`<textarea>{value}</textarea>`)
	// covers the pre-hydration gap too — a legitimate pattern (see
	// form-textbox.tsrx), not the footgun this rule targets.
	if (tag === 'textarea') {
		const valueAttr = attrs.find(
			a => (a.kind === 'static' || a.kind === 'server') && a.name === 'value',
		)
		if (valueAttr)
			ctx.diagnostics.push(
				diagnostic.textareaValueAttribute(ctx.source, element),
			)
	}
	return {
		kind: 'element',
		tag,
		attrs,
		children: lowering.lowerChildren(ctx, element, signals, fors),
		node: element,
	}
}

/* === Children skeleton === */

/**
 * The children-lowering skeleton shared by both front ends. Text collapse,
 * expression containers, element dispatch (compose vs. plain, and the
 * `<style>` placeholder), and fragment recursion are surface-independent;
 * the front ends contribute:
 *
 * - `dispatchChild` — grammar-specific CHILD NODE TYPES outside the four
 *   universal shapes (`.tsrx`: `@for`/`@if`/`@switch`/`@try` directives,
 *   `JSXStyleElement`, `@for`-in; `.tsx`: the `<truc:try>` element). Consumes the child by pushing the lowered
 *   node into `out` and returning true.
 * - `dispatchControlFlow` — control-flow EXPRESSION SHAPES inside an
 *   expression container (`.tsx`: ternary/`&&`, `.map()`, the switch
 *   IIFE). Returns true when the expression was handled; false
 *   falls through to the ordinary expression-child lift.
 *
 * JSXText collapsing runs for both; the `.tsrx` retired-`&{}`-sigil check
 * rides the `onText` pre-scan hook (it needs the NEXT sibling — see
 * `lower-template.ts`).
 */
export const lowerChildrenSkeleton = (
	ctx: ExtractContext,
	parent: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	lowering: Lowering,
	hooks: {
		/** Pre-scan beside a JSXText child (the `.tsrx` retired-`&{}`-sigil
		 * check needs the NEXT sibling — a diagnose-only hook). */
		onText?: (
			ctx: ExtractContext,
			child: AstNode,
			next: AstNode | undefined,
		) => void
		/** Grammar-specific child node types. Consume the child by pushing
		 * the lowered node (or nothing, when diagnosed) into `out` and
		 * returning true; return false to let the skeleton's universal
		 * shapes handle it. */
		dispatchChild?: (
			ctx: ExtractContext,
			child: AstNode,
			out: TemplateNode[],
			signals: ReadonlyMap<string, SignalIR>,
			fors: Map<AstNode, ForIR>,
		) => boolean
		/** Control-flow expression shapes inside an expression container.
		 * Consumes the expression by pushing the lowered node (or nothing,
		 * when diagnosed) into `out` and returning true; return false to
		 * lower it as an ordinary expression child. */
		dispatchControlFlow?: (
			ctx: ExtractContext,
			expr: AstNode,
			out: TemplateNode[],
			container: AstNode,
			signals: ReadonlyMap<string, SignalIR>,
			fors: Map<AstNode, ForIR>,
		) => boolean
	},
): TemplateNode[] => {
	const out: TemplateNode[] = []
	const children =
		parent.type === 'JSXElement' || parent.type === 'JSXFragment'
			? asArray(parent.children)
			: []
	for (let i = 0; i < children.length; i++) {
		const child = children[i] as AstNode
		if (child.type === 'JSXText') {
			hooks.onText?.(ctx, child, children[i + 1] as AstNode | undefined)
			const collapsed = collapseJsxText(String(child.value ?? ''))
			if (collapsed) out.push({ kind: 'text', value: collapsed, node: child })
			continue
		}
		if (hooks.dispatchChild?.(ctx, child, out, signals, fors)) continue
		if (child.type === 'JSXExpressionContainer') {
			const expr = child.expression
			// A `{/* comment */}` child renders nothing: the `.tsx` front end
			// already drops its `JSXEmptyExpression`, and as an `expr` child
			// it would reach a typed text sink with no argument (LT-428).
			if (!isNode(expr) || expr.type === 'JSXEmptyExpression') continue
			if (hooks.dispatchControlFlow?.(ctx, expr, out, child, signals, fors))
				continue
			out.push(lowerExpressionChild(ctx, expr, child, signals))
			continue
		}
		if (child.type === 'JSXElement') {
			const tag = jsxName(
				isNode(child.openingElement) ? child.openingElement.name : null,
			)
			if (tag === 'style') {
				// Style blocks become placeholder elements (tag 'style'); the
				// CSS is extracted from the raw source, never rendered. The
				// `.tsrx` parser produces these as dedicated JSXStyleElement
				// nodes (handled in its own dispatcher), so this branch only
				// engages for `.tsx` sources — where it is the ONLY path a
				// `<style>` block can arrive by.
				out.push({
					kind: 'element',
					tag: 'style',
					attrs: [],
					children: [],
					node: child,
				})
				continue
			}
			const lowered =
				tag && /^[A-Z]/.test(tag)
					? lowerComposeElement(ctx, child, tag, signals, fors, lowering)
					: lowerElement(ctx, child, signals, fors, lowering)
			if (lowered) out.push(lowered)
			continue
		}
		if (child.type === 'JSXFragment') {
			out.push(...lowering.lowerChildren(ctx, child, signals, fors))
			continue
		}
	}
	return out
}

/* === Loop empty arm (LT-212) === */

/**
 * Validate a loop's empty arm (`.tsrx` `@empty { … }`, `.tsx`
 * `{xs.length === 0 ? <empty/> : xs.map(…)}`) and return it, or `null` when
 * a diagnostic was pushed. The arm is CLIENT-INERT: static markup plus
 * server-rendered expressions and attributes, optionally under a
 * server-known `@if`/`@switch`. Over server data the server alone decides
 * whether the arm renders, so a client construct inside it would bind to an
 * element that may not exist. Over a reactive List (ADR 0037 s5: the
 * toggle path) every root must be an element, because the client toggles
 * each root's `hidden` as the list empties and fills.
 *
 * The message names the surface's spelling of the arm.
 */
export const validateEmptyArm = (
	ctx: ExtractContext,
	arm: TemplateNode[],
	kind: ForIR['kind'],
	fors: ReadonlyMap<AstNode, ForIR>,
	at: Site,
): TemplateNode[] | null => {
	const what = wordingOf(ctx).emptyArm
	const outputs = new Set([...fors.values()].map(f => f.output))
	// A reactive list's empty arm stays in the container on the toggle path,
	// always rendered, so its elements bind in the scope that holds the
	// list like any other element there (ADR 0046 s1, LT-424): reactive
	// attributes, class and style maps, events and lazy text. A server-data
	// loop's arm renders conditionally, server-side, and binds nothing.
	const bindsInScope = (a: AttributeIR): boolean =>
		kind === 'reconcile' &&
		(a.kind === 'reactive' ||
			a.kind === 'class-map' ||
			a.kind === 'style-map' ||
			a.kind === 'event')
	let offending: AstNode | undefined
	// Pre-order, first offender wins — an offending node is not descended.
	const offends = (node: TemplateNode): boolean => {
		switch (node.kind) {
			case 'text':
				return false
			case 'conditional':
				// A reactive conditional is a client construct like any other.
				if (node.mode === 'reactive') offending = node.node
				return node.mode === 'reactive'
			case 'expr':
				if (node.reactivity !== 'reactive' || kind === 'reconcile') return false
				offending = node.node
				return true
			case 'element':
				// A client construct, or any `truc:html` — the arm root renders
				// through `emitElement`, which writes no inner HTML.
				if (
					outputs.has(node) ||
					node.attrs.some(
						a =>
							(isClientConstructAttr(a) && !bindsInScope(a)) ||
							a.kind === 'html',
					)
				) {
					offending = node.node
					return true
				}
				return false
			default:
				offending = node.node
				return true
		}
	}
	if (arm.some(node => someNode(node, offends))) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				offending ?? at,
				`A client construct (an event, a reactive binding, a ref, a composed element, a loop or a boundary) inside an ${what}`,
				'The arm renders static and server-known content only — move the construct out of the arm, beside the loop.',
			),
		)
		return null
	}
	if (kind === 'reconcile') {
		const loose = arm.find(n => n.kind !== 'element')
		if (loose) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					loose.node ?? at,
					`A non-element root in the ${what} of a reactive-list loop`,
					"The client toggles each root's `hidden` as the list empties and fills — wrap that content in an element.",
				),
			)
			return null
		}
		// The compiler owns `hidden` and `data-unreconciled` on these roots
		// (LT-301): an authored copy would be emitted twice beside its own.
		for (const root of arm) {
			if (root.kind !== 'element') continue
			const owned = root.attrs.find(
				a =>
					(a.kind === 'static' || a.kind === 'server') &&
					(a.name === 'hidden' || a.name === 'data-unreconciled'),
			)
			if (owned && 'name' in owned) {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						root.node,
						`An authored \`${owned.name}\` on a root of the ${what} of a reactive-list loop`,
						'The compiler sets that attribute itself as the list empties and fills — remove it.',
					),
				)
				return null
			}
		}
	}
	return arm
}

/* === Loops (LT-233: one program after the header) === */

/**
 * A loop as its header parsed it. The two spellings — `.tsrx`'s `@for (const
 * item of items; index i; key k) { … }` and `.tsx`'s `{items.map((item, i)
 * => …)}` — genuinely differ only up to here: binding names, the iterable,
 * the body's statements and which of them is the output. Everything after
 * is `lowerLoop`, so a rule added to one surface's loops cannot miss the
 * other's (the COMPILER_REVIEW §1.1 and §2.3 drifts both lived in the
 * copied tail this replaced).
 */
export type LoopSource = {
	/** The loop node — the `ForIR` key (the directive / the `.map()` call). */
	node: AstNode
	/** The loop variable, or null when the header destructures. */
	itemName: string | null
	/** An index binding and where it was written. */
	index: { name: string; at: Site } | null
	iterable: AstNode
	/** `.tsrx`'s `key` clause. */
	key: AstNode | null
	/**
	 * `.tsx` only: the `.map()` callback's second parameter, which the
	 * receiver's type routes (ADR 0046 s4) — over a declared List it is the
	 * item's key and replaces `index`; over an Array it stays the index.
	 */
	keyOverList: AstNode | null
	/** `.tsx` only: the `.map()` callback declares more than two parameters. */
	extraParams: boolean
	/** Body statements, in order. Empty for an expression-bodied callback. */
	statements: AstNode[]
	/** The output element a statement carries, or null for any other statement. */
	outputOf: (stmt: AstNode) => AstNode | null
	/** An expression-bodied callback's output (`item => <li/>`). */
	expressionOutput: AstNode | null
	/** Lower the empty arm (`null`: none; `false`: diagnosed, drop the loop). */
	lowerEmptyArm: (kind: ForIR['kind']) => TemplateNode[] | null | false
}

/**
 * Validate a reactive-list body (ADR 0046 s1: the item is a Mount Scope).
 * Item content lowers through the arm emission — reactive attributes, class/
 * style maps, `truc:pass`, events, lazy text children over the item, and
 * key-derived attributes (a `server` attribute reading the `key` binding,
 * set once at clone because a key never changes) all bind in `bindItem`
 * against the item's own scope, and the server bakes item-dependent sites
 * empty in the extracted `<template>`. Arm sets and loops nest (ADR 0046 s1,
 * LT-424): their content is walked under the same rules. What still has no
 * lowering inside an item: a plain `@try` boundary (neither emitter renders
 * one in an item template), a server-data loop over the item or key, a
 * composed child whose args or content read the item or key (LTC075 — the
 * child renders once into the template, its root `lang`/`i18n` baked at
 * the parent's locale; ADR 0030 s9), and any non-arrow expression or
 * attribute over the item or key — the item is the signal the List hands
 * out, so a client read takes the arrow form
 * (`() => item.get()`) and the bare `{item}` child is the signal shorthand.
 *
 * The slot-fill restrictions this walk used to enforce (one lazy hole,
 * server-static attributes only, no control flow, no client constructs) are
 * retired here (ADR 0028 lifecycle); the shape errors item content now hits
 * live in the shared arm/element machinery (`emitLazyTextChildren`'s
 * one-lazy-child gate and the server-only-name report), and the unmountable
 * constructs an arm set would collide with are `validateArmSetPlacement`'s.
 * (`ref={}` never reaches here — `classify-attributes.ts` retires it on
 * every element; a host-level `first()` into an item is refused in the
 * analysis, which is where the synthetic ref attrs exist for both raw and
 * composed targets.)
 */
const validateListBody = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	itemName: string,
	keyName: string | null,
	fors: ReadonlyMap<AstNode, ForIR>,
	setup: readonly ItemSetupStmt[],
): void => {
	const wording = wordingOf(ctx)
	const { loop } = wording
	// The item's own setup names (ADR 0046 s5) are per-item like the item:
	// a const is a value fixed per item — set once at clone, like the key —
	// and a signal or a ref is read in an arrow.
	const consts = new Set<string>()
	const live = new Set<string>([itemName])
	for (const stmt of setup)
		if (stmt.kind === 'const') consts.add(stmt.name)
		else if (stmt.kind !== 'client') live.add(stmt.name)
	const cloneTime = new Set<string>(consts)
	if (keyName !== null) cloneTime.add(keyName)
	const itemRead = (node: AstNode): string[] =>
		[...freeIdentifiers(node)].filter(
			name => live.has(name) || cloneTime.has(name),
		)
	const walk = (node: TemplateNode): void => {
		if (node.kind === 'expr') {
			// The bare `{item}` identifier is the signal shorthand — reactive by
			// position (`markPositionallyReactive`), the one sanctioned spelling.
			if (node.reactivity === 'reactive') return
			const reads = itemRead(node.expr)
			if (reads.length > 0)
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node,
						`The expression \`{${node.exprText}}\` in a reactive-list ${loop} body reading ${reads.map(n => `\`${n}\``).join(' and ')}, which the extracted \`<template>\` render does not bind`,
						reads.every(n => n === itemName || n === keyName)
							? `The loop item is the signal the List hands out: \`${itemName}\` is read with \`.get()\` in an arrow (\`{() => ${itemName}.get()}\`), and the bare \`{${itemName}}\` child is its shorthand. The key is not renderable text.`
							: `The item's setup names are per-item: read them in an arrow (\`{() => ${reads.find(n => n !== itemName && n !== keyName)}}\`), which the item's mount writes.`,
					),
				)
			return
		}
		// An async boundary is an arm set (ADR 0037 s4), a Mount Scope that
		// nests in the item (ADR 0046 s1, LT-424); its arms answer to the same
		// item-read rules.
		if (node.kind === 'try' && node.pendingChildren !== null) {
			for (const child of [
				...node.children,
				...node.catchChildren,
				...node.pendingChildren,
			])
				walk(child)
			return
		}
		// A conditional's arms — server-rendered or an arm set — are item
		// content too.
		if (node.kind === 'conditional') {
			for (const arm of node.arms) for (const child of arm.children) walk(child)
			return
		}
		if (node.kind === 'try') {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.node,
					`A ${wording.boundary} inside a reactive-list ${loop} body`,
					"The item's mount has no lowering for a boundary — move it out of the item, beside the loop.",
				),
			)
			return
		}
		// A composed child renders once, into the extracted `<template>` —
		// its root `lang` and `i18n` included (ADR 0030 s9) — so neither its
		// args nor its content may read the item or key (LTC075, LT-355).
		// `truc:pass` is the per-item channel: the item's mount wires it.
		if (node.kind === 'compose') {
			for (const attr of node.attrs) {
				if (attr.kind !== 'arg' || attr.node === null) continue
				const reads = itemRead(attr.node)
				if (reads.length > 0)
					ctx.diagnostics.push(
						diagnostic.composeReadsListItem(
							ctx.source,
							attr.node,
							node.component,
							`its \`${attr.name}\` arg`,
							reads,
							wording,
						),
					)
			}
			const content = (child: TemplateNode): void => {
				// A reactive child in composed content is already LTC011's
				// (`validateComposedChildren`).
				const at =
					child.kind === 'expr' && child.reactivity !== 'reactive'
						? child.expr
						: null
				const sites: AstNode[] = at ? [at] : []
				if (child.kind === 'element') {
					for (const attr of child.attrs)
						if (attr.kind === 'server') sites.push(attr.node)
					for (const grandchild of child.children) content(grandchild)
				}
				for (const site of sites) {
					const reads = itemRead(site)
					if (reads.length > 0)
						ctx.diagnostics.push(
							diagnostic.composeReadsListItem(
								ctx.source,
								site,
								node.component,
								'its content',
								reads,
								wording,
							),
						)
				}
			}
			for (const child of node.children) content(child)
			return
		}
		if (node.kind !== 'element') return
		for (const attr of node.attrs) {
			if (attr.kind !== 'server' || attr.bindsProp != null) continue
			const reads = itemRead(attr.node)
			if (reads.length === 0) continue
			const signal = reads.find(n => live.has(n))
			if (signal === undefined) {
				// A key-only read is a key-derived attribute (ADR 0046 s1):
				// set once at clone against the key binding, nothing to watch —
				// and so is a read of the item's own consts (ADR 0046 s5), each
				// a value fixed per item. Those names mixed with anything else
				// have no clone-time meaning — the other names are server
				// values no client phase can fold there.
				const free = [...freeIdentifiers(attr.node)]
				if (free.every(n => cloneTime.has(n))) continue
				const subject = reads.every(n => n === keyName)
					? `the key binding \`${keyName}\``
					: `the item's ${nameList(reads)}`
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						attr.node,
						`The attribute \`${attr.name}\` in a reactive-list ${loop} body reading ${subject} together with ${nameList(free.filter(n => !cloneTime.has(n)))}`,
						reads.every(n => n === keyName)
							? `A key-derived attribute reads the key binding alone (\`${attr.name}={${keyName}}\`) and is set once at clone, because a key never changes; the other names are server values the clone-time write cannot fold.`
							: `An attribute over the item's consts alone (\`${attr.name}={${reads.find(n => n !== keyName)}}\`) is set once at clone, because each is fixed per item; the other names are server values the clone-time write cannot fold.`,
					),
				)
				continue
			}
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					attr.node,
					`The attribute \`${attr.name}\` in a reactive-list ${loop} body reading \`${signal}\`, which is a signal, not a value`,
					signal === itemName
						? `Read it in an arrow thunk: \`${attr.name}={() => ${itemName}.get()}\` — a store item's fields are cells too (\`${itemName}.field.get()\`). A key-derived attribute (\`${attr.name}\` over the key binding alone) is set once at clone.`
						: `Read it in an arrow thunk: \`${attr.name}={() => ${signal}.get()}\`.`,
				),
			)
		}
		for (const child of node.children) {
			// A nested loop (ADR 0046 s1, LT-424): a reactive list's item is a
			// Mount Scope of its own, and a server-data loop lowers to a static
			// query against the item — over server data. One whose iterable
			// reads the item or key iterates per-item state the extracted
			// template cannot render.
			const inner = [...fors.values()].find(f => f.output === child)
			if (inner?.kind === 'each') {
				const reads = itemRead(inner.iterable)
				if (reads.length > 0)
					ctx.diagnostics.push(
						diagnostic.unsupported(
							ctx.source,
							inner.iterable,
							`A server-data loop inside a reactive-list ${loop} body iterating ${reads.map(n => `\`${n}\``).join(' and ')}`,
							'A server-data loop renders once into the extracted `<template>`, outside the list — iterate server data, or declare the per-item collection as a List and loop over it reactively.',
						),
					)
			}
			walk(child)
		}
	}
	walk(output)
}

/**
 * Resolve an item's `first()` references against the item's own content
 * (ADR 0046 s2): structurally, like a component's, but within the item. A
 * selector that names the item root resolves at build time to `bindItem`'s
 * element parameter — `first` searches descendants only. One that reaches
 * into a nested arm or a nested list's item is refused: those elements are
 * recreated while the item lives. A required reference whose only match
 * sits in a branch that may not render is optional in fact (LTC040).
 */
const resolveItemRefs = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	setup: ItemSetupStmt[],
	fors: ReadonlyMap<AstNode, ForIR>,
): void => {
	const wording = wordingOf(ctx)
	const nestedOutputs = [...fors.values()]
		.filter(f => f.kind === 'reconcile' && f.output !== output)
		.map(f => f.output)
		.filter(o => someNode(output, n => n === o))
	for (const stmt of setup) {
		if (stmt.kind !== 'ref') continue
		const at = stmt.node
		const { elements } = collectMatchingElements(output, stmt.selector)
		if (elements.length === 0) {
			// An optional reference may match markup the template does not
			// render, and a custom-element tag may name a composed child,
			// whose tag this pass cannot know: the client queries as authored.
			if (!stmt.required || namesCustomElementTag(stmt.selector)) continue
			ctx.diagnostics.push(
				diagnostic.firstSelectorNotFound(
					ctx.source,
					at,
					stmt.name,
					stmt.selector,
				),
			)
			continue
		}
		const nested =
			elements.find(el => inReactiveArm(output, el)) ??
			elements.find(el => inReconcileItem(nestedOutputs, el))
		if (nested) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					at,
					`A \`first()\` reference in a reactive-list ${wording.loop} item's setup to <${nested.tag}> inside a nested arm or list item`,
					'Those elements are cloned anew while the item lives, so a reference taken when the item mounts goes stale — bind the element from inside its own arm or item instead (an event handler or a reactive attribute on it).',
				),
			)
			continue
		}
		if (elements.length > 1 && !shareExclusiveIf(output, elements)) {
			ctx.diagnostics.push(
				diagnostic.firstSelectorAmbiguous(
					ctx.source,
					at,
					stmt.name,
					stmt.selector,
					elements.length,
					wording,
				),
			)
			continue
		}
		if (elements[0] === output) {
			stmt.root = true
			continue
		}
		if (stmt.required && elements.every(el => inOptionalBranch(output, el))) {
			ctx.diagnostics.push(
				diagnostic.deadRequiredReason(ctx.source, at, stmt.name, stmt.selector),
			)
			stmt.required = false
		}
	}
}

/**
 * The reactive-list loop over a declared `createList` or `deriveList`
 * (milestone 3, ADR 0046 s4): the reconcile plan. Index bindings stay gated
 * (keyed reconciliation). The body's statements before the output element
 * are the item's setup (ADR 0046 s5, `extractItemSetup`), classified while
 * the item and key are bound; their names stay bound, reactive by position,
 * while the output lowers.
 */
const lowerListLoop = (
	ctx: ExtractContext,
	loop: LoopSource,
	itemName: string,
	listSignal: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	lowering: Lowering,
): (TemplateNode & { kind: 'element' }) | null => {
	const wording = wordingOf(ctx)
	if (loop.extraParams) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				'A `.map()` callback over a List with more than two parameters',
				"A List's `map` passes `(item, key)` and nothing else — remove the extra parameters.",
			),
		)
		return null
	}
	if (loop.index) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.index.at,
				`An index binding in a reactive-list ${wording.loop}`,
				'An index does not survive keyed reconciliation — remove the index binding.',
			),
		)
		return null
	}
	let keyName: string | null = null
	if (loop.key) {
		keyName = identifierName(loop.key)
		if (!keyName) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					loop.key,
					wording.keyBindingShape,
					`The key binding becomes the key parameter of \`reconcile()\`’s \`bindItem\` — write a bare identifier, for example ${wording.keyBindingExample}.`,
				),
			)
			return null
		}
	}
	if (itemName === 'first' || keyName === 'first' || itemName === 'element') {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				`${wording.loopBindings} named \`first\` or \`element\``,
				'Both names are reserved parameters of `reconcile()`’s `bindItem` — rename the binding.',
			),
		)
		return null
	}
	// The body's statements are the item's setup (ADR 0046 s5); the output
	// element is the one the body renders.
	let outputNode = loop.expressionOutput
	const setupStmts: AstNode[] = []
	for (const stmt of loop.statements) {
		const candidate = outputNode ? null : loop.outputOf(stmt)
		if (candidate) outputNode = candidate
		else setupStmts.push(stmt)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				`A ${wording.loop} body with no output element`,
				'Render one element per item.',
			),
		)
		return null
	}
	const body = outputNode
	const lowered = lowerLoopBody(
		ctx,
		[itemName, keyName],
		() => {
			const item = extractItemSetup(ctx, setupStmts, signals)
			// The item's own names: per-item values, so a condition over one
			// switches arms in the item's mount, like one over the item.
			const names = item.setup
				.filter(stmt => stmt.kind === 'const' || stmt.kind === 'signal')
				.map(stmt => stmt.name as string)
			const itemSignals = new Map(signals)
			for (const signal of item.signals) itemSignals.set(signal.name, signal)
			// A per-item function const is an event handler by identifier, like
			// a setup const (`onClick={remove}`).
			const outerInits = ctx.setupInits
			const inits = new Map(outerInits)
			for (const stmt of item.setup)
				if (stmt.kind === 'const') inits.set(stmt.name, stmt.node)
			ctx.setupInits = inits
			try {
				const output = lowerLoopBody(
					ctx,
					names,
					() => lowerElement(ctx, body, itemSignals, fors, lowering),
					true,
				)
				return { output, setup: item.setup }
			} finally {
				ctx.setupInits = outerInits
			}
		},
		true,
	)
	const { output, setup } = lowered
	// The item binding is the slot fill — reactive by position, not a
	// declared signal, so the lift rule alone would leave it static and
	// `validateListBody` would then see no item reads to route.
	markPositionallyReactive([output], new Set([itemName]))
	resolveItemRefs(ctx, output, setup, fors)
	validateListBody(ctx, output, itemName, keyName, fors, setup)
	const emptyArm = loop.lowerEmptyArm('reconcile')
	if (emptyArm === false) return null
	const forIR: ReconcileForIR = {
		kind: 'reconcile',
		itemName,
		listSignal,
		keyText: loop.key ? text(ctx.source, loop.key) : null,
		keyName,
		setup,
		output,
		node: loop.node,
		emptyArm,
	}
	fors.set(loop.node, forIR)
	return output
}

/**
 * Lower a loop from its parsed header. Server-data iterables lower to
 * `each()`; a declared `createList` or `deriveList` to the reconcile plan; any
 * other reactive source stays gated (LTC001). The iterable's TYPE routes
 * the loop, never its spelling.
 */
export const lowerLoop = (
	ctx: ExtractContext,
	loop: LoopSource,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	lowering: Lowering,
): (TemplateNode & { kind: 'element' }) | null => {
	const wording = wordingOf(ctx)
	const { itemName } = loop
	if (!itemName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				`${wording.aLoop} over a destructuring loop variable`,
				'Bind the item to one name and read its fields in the body (`item.id`).',
			),
		)
		return null
	}
	const iterableName = identifierName(loop.iterable)
	const iterableSignal = iterableName ? signals.get(iterableName) : undefined
	if (iterableSignal) {
		if (
			iterableSignal.constructor !== 'createList' &&
			iterableSignal.constructor !== 'deriveList'
		) {
			ctx.diagnostics.push(
				diagnostic.reactiveForNotSupported(
					ctx.source,
					loop.node,
					iterableSignal.name,
					wording,
				),
			)
			return null
		}
		return lowerListLoop(
			ctx,
			// A `.map()` callback's second parameter is the key over a List.
			loop.keyOverList ? { ...loop, index: null, key: loop.keyOverList } : loop,
			itemName,
			iterableSignal.name,
			signals,
			fors,
			lowering,
		)
	}
	if (loop.key) {
		ctx.diagnostics.push(diagnostic.keyOnServerDataFor(ctx.source, loop.key))
		return null
	}
	if (loop.extraParams) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				'A `.map()` callback with more than two parameters',
				'A `.map()` callback over an Array takes `(item, index)` at most — remove the extra parameters.',
			),
		)
		return null
	}
	const hoisted: EachForIR['hoisted'] = []
	let outputNode = loop.expressionOutput
	for (const stmt of loop.statements) {
		if (stmt.type === 'VariableDeclaration') {
			if (stmt.kind !== 'const') {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						stmt,
						`A \`let\` or \`var\` declaration in a ${wording.loop} body`,
						'Declare it with `const`.',
					),
				)
				continue
			}
			for (const decl of asArray(stmt.declarations)) {
				const declName = identifierName(decl.id)
				if (!declName || !isNode(decl.init)) {
					ctx.diagnostics.push(
						diagnostic.unsupported(
							ctx.source,
							stmt,
							`A destructuring declaration in a ${wording.loop} body`,
							'Declare one `const` per value (`const id = item.id`).',
						),
					)
					continue
				}
				hoisted.push({
					name: declName,
					initText: text(ctx.source, decl.init),
					node: decl,
				})
			}
			continue
		}
		const candidate = outputNode ? null : loop.outputOf(stmt)
		if (candidate) {
			outputNode = candidate
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt,
				wording.loopBodyStatements,
				'Move the statement into setup; render a branch with a conditional.',
			),
		)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				`A ${wording.loop} body with no output element`,
				'Render one element per item.',
			),
		)
		return null
	}
	const output = lowerLoopBody(
		ctx,
		[itemName, loop.index?.name, ...hoisted.map(h => h.name)],
		() => lowerElement(ctx, outputNode, signals, fors, lowering),
	)
	if (!output.tag) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node,
				`A ${wording.loop} body whose output is not a single element`,
				"Wrap each item's content in one element.",
			),
		)
		return null
	}
	const emptyArm = loop.lowerEmptyArm('each')
	if (emptyArm === false) return null
	const forIR: EachForIR = {
		kind: 'each',
		itemName,
		indexName: loop.index?.name ?? null,
		iterableText: text(ctx.source, loop.iterable),
		iterable: loop.iterable,
		iterableName,
		hoisted,
		output,
		node: loop.node,
		emptyArm,
	}
	fors.set(loop.node, forIR)
	return output
}

/* === Conditionals and boundaries (the shared tails) === */

/**
 * The initial winner a front end leaves on a fresh conditional: assembly
 * resolves it once the whole component is known (`resolveInitialWinners`).
 */
const UNRESOLVED_INITIAL: InitialWinner = { fold: true }

/** The `if` conditional, once a surface has lowered the test and both branches. */
export const finishIf = (
	ctx: ExtractContext,
	node: AstNode,
	test: AstNode,
	then: TemplateNode[],
	alternate: TemplateNode[],
	mode: ConditionMode,
): IfNode | null => {
	if (then.length === 0 && alternate.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node,
				`A ${wordingOf(ctx).if} with no output element in any branch`,
				'Render an element in at least one branch, or remove the conditional.',
			),
		)
		return null
	}
	return {
		kind: 'conditional',
		construct: 'if',
		mode,
		test,
		testText: text(ctx.source, test),
		arms: [
			{ key: 'then', test: null, testText: null, children: then },
			{ key: 'else', test: null, testText: null, children: alternate },
		],
		initial: UNRESOLVED_INITIAL,
		node,
	}
}

/**
 * A `@case` value a reactive switch can key an arm by: a string, number,
 * boolean or `null` literal, or a negated number. Null for anything else.
 */
const caseLiteral = (
	test: AstNode,
): { value: string | number | boolean | null } | null => {
	if (test.type === 'Literal') {
		const value = test.value
		return value === null ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
			? { value }
			: null
	}
	if (
		test.type === 'UnaryExpression' &&
		test.operator === '-' &&
		isNode(test.argument) &&
		test.argument.type === 'Literal' &&
		typeof test.argument.value === 'number'
	)
		return { value: -test.argument.value }
	return null
}

/**
 * The `switch` conditional, once a surface has lowered the discriminant and
 * every arm. Arm keys are `case:<value>` and `default` (ADR 0037 s2). A
 * reactive switch keys its arms by literal case values only — a dynamic one
 * has no compile-time name for the server emit and the client to agree on,
 * so it is LTC062, with no fallback.
 */
export const finishSwitch = (
	ctx: ExtractContext,
	node: AstNode,
	discriminant: AstNode,
	cases: Array<{ test: AstNode | null; children: TemplateNode[] }>,
	mode: ConditionMode,
): SwitchNode | null => {
	const arms: ArmTemplate[] = []
	const seen = new Set<string>()
	for (const arm of cases) {
		let key = 'default'
		if (arm.test) {
			const literal = caseLiteral(arm.test)
			if (literal === null && mode === 'reactive') {
				ctx.diagnostics.push(
					diagnostic.dynamicCaseValue(
						ctx.source,
						arm.test,
						text(ctx.source, arm.test),
						wordingOf(ctx),
					),
				)
				return null
			}
			// The literal's JSON (LT-385d), not `String(value)`: the key must
			// be value-typed so `@case 1` and `@case '1'` stay distinct, while
			// `1` and `1.0` — the same literal value, as `===` says — share
			// one key.
			key = `case:${literal === null ? text(ctx.source, arm.test) : JSON.stringify(literal.value)}`
		}
		if (seen.has(key) && mode === 'reactive') {
			ctx.diagnostics.push(
				diagnostic.dynamicCaseValue(
					ctx.source,
					arm.test ?? node,
					arm.test ? text(ctx.source, arm.test) : 'default',
					wordingOf(ctx),
					true,
				),
			)
			return null
		}
		seen.add(key)
		arms.push({
			key,
			test: arm.test,
			testText: arm.test ? text(ctx.source, arm.test) : null,
			children: arm.children,
		})
	}
	return {
		kind: 'conditional',
		construct: 'switch',
		mode,
		test: discriminant,
		testText: text(ctx.source, discriminant),
		arms,
		initial: UNRESOLVED_INITIAL,
		node,
	}
}

/** Report a switch with no arms, or an arm with no output (the switch tail). */
export const reportEmptySwitch = (
	ctx: ExtractContext,
	at: Site,
	which: 'switch' | 'arm',
): void => {
	const wording = wordingOf(ctx)
	ctx.diagnostics.push(
		diagnostic.unsupported(
			ctx.source,
			at,
			which === 'switch' ? wording.switchNoArms : wording.caseWithoutOutput,
			which === 'switch'
				? 'Add at least one arm, or remove the switch.'
				: 'Render an element in every arm, or remove the empty arm.',
		),
	)
}

/**
 * The boundary tail both spellings share (`@try`/`@pending`/`@catch`, `<truc:try
 * pending catch>`): with a pending arm it is an ASYNC boundary (ADR 0024
 * sub-design 13) whose three arms each need exactly one root element — each
 * is cloned from its template as the task settles (ADR 0037 s4) — and the
 * catch parameter is reactive by position in its arm.
 */
export const finishTry = (
	ctx: ExtractContext,
	node: AstNode,
	arms: {
		children: TemplateNode[]
		catchParam: string | null
		catchChildren: TemplateNode[]
		pendingChildren: TemplateNode[] | null
		/** Where each arm was written, for the single-root diagnostics. */
		at: {
			body: Site
			pending: Site
			catch: Site
		}
	},
): (TemplateNode & { kind: 'try' }) | null => {
	const wording = wordingOf(ctx)
	const { children, catchParam, catchChildren, pendingChildren, at } = arms
	if (pendingChildren !== null) {
		const multiRoot: Array<[TemplateNode[], Site, string]> = [
			[children, at.body, wording.tryBody],
			[pendingChildren, at.pending, wording.pendingArm],
			[catchChildren, at.catch, wording.catchArm],
		]
		for (const [arm, offset, which] of multiRoot) {
			if (singleRootOf(arm)) continue
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					offset,
					`An async boundary's ${which} that does not render exactly one root element`,
					"The client clones each arm from a template with one root element — wrap the arm's content in a single element.",
				),
			)
			return null
		}
	}
	if (children.length === 0 && catchChildren.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node,
				`A ${wording.boundary} with no output element`,
				`Render an element in the ${wording.tryBody} or the ${wording.catchArm}.`,
			),
		)
		return null
	}
	// The catch arm's error child reads the catch parameter, which is
	// reactive by position — the async boundary re-renders the arm when the
	// task rejects — but is not a declared signal.
	if (catchParam !== null)
		markPositionallyReactive(catchChildren, new Set([catchParam]))
	return {
		kind: 'try',
		children,
		catchParam,
		catchChildren,
		pendingChildren,
		node,
	}
}
