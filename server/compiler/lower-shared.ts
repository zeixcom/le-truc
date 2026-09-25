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
	JS_GLOBALS,
	jsxName,
	nodeType,
	text,
} from './ast-utils'
import {
	classifyAttribute,
	classifyComposeAttribute,
} from './classify-attributes'
import { diagnostic } from './diagnostics'
import {
	containsImpureAmbient,
	dependenciesOf,
	isServerEvaluable,
} from './evaluability'
import type {
	AttributeIR,
	ComposeAttrIR,
	EachForIR,
	ExtractContext,
	ForIR,
	ReconcileForIR,
	SignalIR,
	TemplateNode,
} from './ir'
import { bindsExposedArg, classifyChild } from './reactivity'
import { wordingOf } from './surface'

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
 * Validate a control-flow condition (`@if` test / ternary test, `@switch`
 * discriminant): server-known at render time (args, setup consts, globals)
 * and never a signal read — the DOM keeps the initially rendered branch.
 * The message names the surface's spelling of the construct.
 */
export const validateCondition = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	test: AstNode,
	kind: 'if' | 'switch',
): boolean => {
	const wording = wordingOf(ctx)
	const what = kind === 'if' ? wording.ifCondition : wording.switchDiscriminant
	const free = freeIdentifiers(test)
	for (const global of JS_GLOBALS) free.delete(global)
	const signalReads = [...free].filter(name => signals.has(name))
	if (signalReads.length > 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				test.start,
				`${what} reads signal(s) ${signalReads.map(n => `\`${n}\``).join(', ')} — the DOM keeps the initially rendered branch, so a signal condition would silently stop matching. Conditions must derive from args or setup consts evaluated once at render time`,
			),
		)
		return false
	}
	const unknown = [...free].filter(name => !ctx.serverKnown.has(name))
	if (unknown.length > 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				test.start,
				`${what} references non-server-known name(s) ${unknown.map(n => `\`${n}\``).join(', ')} — conditions must evaluate at render time (args and setup); client-side conditional rendering is outside the model`,
			),
		)
		return false
	}
	return true
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
 * Two such names exist, and both are already recognised structurally
 * downstream: a `@catch`/`err` arm's error parameter, and a reactive loop
 * body's item binding (the slot fill). Neither is a declared signal, so the
 * general lift rule in `reactivity.ts` correctly classifies them static —
 * the context that makes them reactive lives here, in the construct that
 * binds them.
 *
 * Recurses through element children, matching the recursive walk
 * `validateListBody` uses to count slot-fill holes — a reactive loop's item
 * is routinely nested (`<li><span>{item}</span></li>`), not a direct child
 * of the loop's output root.
 */
export const markPositionallyReactive = (
	nodes: TemplateNode[],
	names: ReadonlySet<string>,
): void => {
	if (names.size === 0) return
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'expr') {
			if (node.lazy) return
			for (const name of freeIdentifiers(node.expr))
				if (names.has(name)) {
					node.lazy = true
					return
				}
			return
		}
		if (node.kind === 'element') for (const child of node.children) visit(child)
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
				container.start,
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
				container.start,
				verdict.names,
				exprText,
			),
		)
		return false
	}
	// CHECKLIST §4 / LTC033 (error form): a `static` child renders ONCE,
	// server-side, forever — there is no watch() to ever correct it, unlike
	// a `reactive` child (which gets the WARNING form of this check in
	// analysis/effects.ts, since the client's first binding pass corrects
	// an omitted fold there). An impure ambient here (`Date.now()`, a random
	// id, `Intl`/`toLocaleString`) bakes one build-time reading into the
	// page permanently with no safety net at all — hard error, not a warning.
	if (verdict.kind === 'static' && containsImpureAmbient(expr))
		ctx.diagnostics.push(diagnostic.impureStaticChild(ctx.source, expr.start))
	return verdict.kind === 'reactive'
}

/**
 * The shared expression-child lowering: reactivity classification
 * (`bindsExposedArg`'s positional rule, LT-122 + the lift rule) into the
 * `expr` IR node. Both front ends' `lowerChildren` funnel every ordinary
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
	return {
		kind: 'expr',
		expr,
		exprText,
		lazy:
			bindsProp !== null ||
			liftsToReactive(ctx, signals, expr, exprText, container),
		...(bindsProp !== null ? { bindsProp } : {}),
		node: container,
	}
}

/* === Composed elements === */

/**
 * Composed-element children (ADR 0023 sub-design 10, LT-018): the markup
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
			if (node.lazy)
				ctx.diagnostics.push(
					diagnostic.composedElementUnsupported(
						ctx.source,
						node.node.start,
						wording.lazyChild,
					),
				)
			return
		}
		if (node.kind !== 'element') {
			ctx.diagnostics.push(
				diagnostic.composedElementUnsupported(
					ctx.source,
					node.node.start,
					node.kind === 'compose'
						? 'A nested composed element'
						: wording.controlFlow,
				),
			)
			return
		}
		for (const attr of node.attrs) {
			if (attr.kind === 'static' || attr.kind === 'server') continue
			ctx.diagnostics.push(
				diagnostic.composedElementUnsupported(
					ctx.source,
					node.node.start,
					`A \`${attr.kind}\` attribute`,
				),
			)
		}
		for (const child of node.children) walk(child)
	}
	for (const child of children) walk(child)
}

/**
 * Lower a composed (PascalCase) element: resolve its tag against the file's
 * compose-import map (ADR 0023 sub-design 10), classify attributes as server
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
			diagnostic.unresolvedComposedComponent(ctx.source, element.start, tag),
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
						attr.start,
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
						attr.start,
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
				element.start,
				isNode(tagNode) ? text(ctx.source, tagNode) : '?',
				wording.conditionalTag,
			),
		)
	if (/^[A-Z]/.test(tag))
		ctx.diagnostics.push(
			diagnostic.composedElementUnsupported(
				ctx.source,
				element.start,
				`Composed element \`<${tag}>\` in this position (${wording.composedPosition}, or another non-child-list context)`,
			),
		)
	const attrs: AttributeIR[] = []
	if (isNode(opening) && Array.isArray(opening.attributes)) {
		for (const attr of asArray(opening.attributes)) {
			if (attr.type !== 'JSXAttribute') {
				ctx.diagnostics.push(
					diagnostic.unsupported(ctx.source, attr.start, 'Spread attributes'),
				)
				continue
			}
			const classified = classifyAttribute(ctx, attr, signals)
			if ('reason' in classified) {
				ctx.diagnostics.push(
					diagnostic.invalidAttribute(
						ctx.source,
						attr.start,
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
						classified.node.start,
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
				diagnostic.textareaValueAttribute(ctx.source, element.start),
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
			if (!isNode(expr)) continue
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
	at: number | undefined,
): TemplateNode[] | null => {
	const what = wordingOf(ctx).emptyArm
	const outputs = new Set([...fors.values()].map(f => f.output))
	let offending: AstNode | undefined
	const inert = (node: TemplateNode): boolean => {
		switch (node.kind) {
			case 'text':
				return true
			case 'expr':
				if (node.lazy) offending = node.node
				return !node.lazy
			case 'element':
				if (outputs.has(node)) {
					offending = node.node
					return false
				}
				for (const attr of node.attrs) {
					if (attr.kind !== 'static' && attr.kind !== 'server') {
						offending = node.node
						return false
					}
				}
				return node.children.every(inert)
			case 'if':
				return [...node.then, ...node.alternate].every(inert)
			case 'switch':
				return node.cases.every(c => c.children.every(inert))
			default:
				offending = node.node
				return false
		}
	}
	if (!arm.every(inert)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				offending?.start ?? at,
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
					loose.node?.start ?? at,
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
						root.node.start,
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
	index: { name: string; at: number | undefined } | null
	iterable: AstNode
	/** `.tsrx`'s `key` clause; `.tsx` has none (the List's keyConfig keys it). */
	key: AstNode | null
	/**
	 * `.tsx` only: the `.map()` callback declares more than `(item, index)`.
	 * Checked on the server-data path — over a List the index check fires
	 * first, as it always did.
	 */
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
 * Validate the reactive-list body shape (ADR 0024 sub-design 5, extended by
 * LT-215): statics and event attributes anywhere, exactly one lazy `{item}`
 * hole (the slot fill), and — since LT-215 — expressions that classify
 * SERVER-STATIC (`isServerEvaluable` against `ctx.serverKnown`: server args,
 * the reserved record's `t`/`lang`, no impure ambient state). A server-static
 * value folds identically into every item at every render call and needs no
 * per-item client binding, so `listTemplateLines` bakes it into the extracted
 * `<template>` at render time — the client clones the SERVED template, so the
 * folded bytes ride along to cloned items. Item-derived expressions (they
 * read names outside `serverKnown`) and control flow stay rejected: the
 * slot-fill contract has no channel for a per-item value. (`ref={}` never
 * reaches here — `classify-attributes.ts` retires it on every element.)
 */
const validateListBody = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	itemName: string,
): void => {
	const { loop, listControlFlow } = wordingOf(ctx)
	// Join FIRST, then test the string: an empty array is truthy, which
	// once made the impure-ambient arm unreachable and printed `reads , …`
	// (COMPILER_REVIEW §1.1, LT-221).
	const notBuildTime = (node: AstNode): string => {
		const offenders = [...dependenciesOf(node)]
			.filter(name => !ctx.serverKnown.has(name))
			.join(', ')
		return offenders
			? `reads ${offenders}, which derive per item or client-side`
			: 'reads impure ambient state'
	}
	let holes = 0
	const walk = (node: TemplateNode): void => {
		if (node.kind === 'expr') {
			const isItemHole =
				node.lazy &&
				node.expr.type === 'Identifier' &&
				node.exprText === itemName
			if (isItemHole) holes++
			else if (node.lazy)
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Lazy children inside a reactive-list ${loop} body must be the bare item ({${itemName}}) — the slot fill; {${node.exprText}} derives per item, and the extracted <template> has no per-item binding channel (ADR 0024 sub-design 5).`,
					),
				)
			else if (!isServerEvaluable(node.expr, ctx.serverKnown))
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`{${node.exprText}} inside a reactive-list ${loop} body ${notBuildTime(node.expr)} — only server-known build-time values (server args, the i18n record's \`t\`) can be interpolated here (ADR 0024 sub-design 5).`,
					),
				)
			return
		}
		if (node.kind !== 'element') {
			if (node.kind === 'if' || node.kind === 'switch' || node.kind === 'try')
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`${listControlFlow} inside a reactive-list ${loop} body — the extracted template is static markup`,
					),
				)
			return
		}
		for (const attr of node.attrs) {
			if (attr.kind === 'event' || attr.kind === 'static') continue
			if (
				attr.kind === 'server' &&
				isServerEvaluable(attr.node, ctx.serverKnown)
			)
				continue
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.node.start,
					`Dynamic attribute \`${'name' in attr ? attr.name : attr.kind}\` inside a reactive-list ${loop} body${attr.kind === 'server' ? ` ${notBuildTime(attr.node)}` : ''} — only server-known build-time values (server args, the i18n record's \`t\`) can be interpolated here (ADR 0024 sub-design 5, LT-215).`,
				),
			)
		}
		for (const child of node.children) walk(child)
	}
	walk(output)
	if (holes !== 1) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				output.node.start,
				`A reactive-list ${loop} body must render the item exactly once via {${itemName}} — that hole is the template slot the client fills (found ${holes}).`,
			),
		)
	}
}

/**
 * The reactive-list loop over a declared `createList` (milestone 3): the
 * reconcile plan. Index bindings stay gated (keyed reconciliation); the
 * body is exactly the output element — a hoisted const has no per-item
 * rebinding channel here.
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
	if (loop.index) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.index.at,
				`Index bindings in a reactive-list ${wording.loop} — index identity does not survive keyed reconciliation`,
			),
		)
		return null
	}
	let keyName: string | null = null
	if (loop.key) {
		// Reachable from `.tsrx` only — `.tsx` has no key clause.
		keyName = identifierName(loop.key)
		if (!keyName) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					loop.key.start,
					'The key clause of a reactive-list @for must name the key binding (a bare identifier, e.g. `key k`) — it becomes reconcile() bindItem’s key parameter',
				),
			)
			return null
		}
	}
	if (itemName === 'first' || keyName === 'first' || itemName === 'element') {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node.start,
				`${wording.loopBindings} named \`first\`/\`element\` — reserved parameters of reconcile() bindItem`,
			),
		)
		return null
	}
	let outputNode = loop.expressionOutput
	for (const stmt of loop.statements) {
		const candidate = outputNode ? null : loop.outputOf(stmt)
		if (candidate) {
			outputNode = candidate
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				stmt.type === 'VariableDeclaration'
					? `Hoisted consts inside a reactive-list ${wording.loop} body (derive at use sites; per-item const rebinding is outside the milestone-3 subset)`
					: `Statements other than the output element inside a reactive-list ${wording.loop} body`,
			),
		)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node.start,
				`${wording.loop} bodies must contain an output element`,
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors, lowering)
	// The item binding is the slot fill — reactive by position, not a
	// declared signal, so the lift rule alone would leave it static and
	// `validateListBody` would then see zero holes.
	markPositionallyReactive([output], new Set([itemName]))
	validateListBody(ctx, output, itemName)
	const emptyArm = loop.lowerEmptyArm('reconcile')
	if (emptyArm === false) return null
	const forIR: ReconcileForIR = {
		kind: 'reconcile',
		itemName,
		listSignal,
		keyText: loop.key ? text(ctx.source, loop.key) : null,
		keyName,
		output,
		node: loop.node,
		emptyArm,
	}
	fors.set(loop.node, forIR)
	return output
}

/**
 * Lower a loop from its parsed header. Server-data iterables lower to
 * `each()`; a declared reactive `createList` to the reconcile plan; any
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
				loop.node.start,
				`${wording.loop} over a destructuring loop variable`,
			),
		)
		return null
	}
	const iterableName = identifierName(loop.iterable)
	const iterableSignal = iterableName ? signals.get(iterableName) : undefined
	if (iterableSignal) {
		if (iterableSignal.constructor !== 'createList') {
			ctx.diagnostics.push(
				diagnostic.reactiveForNotSupported(
					ctx.source,
					loop.node.start,
					iterableSignal.name,
					wording,
				),
			)
			return null
		}
		return lowerListLoop(
			ctx,
			loop,
			itemName,
			iterableSignal.name,
			signals,
			fors,
			lowering,
		)
	}
	if (loop.key) {
		ctx.diagnostics.push(
			diagnostic.keyOnServerDataFor(ctx.source, loop.key.start),
		)
		return null
	}
	if (loop.extraParams) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node.start,
				'map callbacks take at most (item, index) — the key clause is a reactive-List concern',
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
						stmt.start,
						`Non-const declarations inside ${wording.loop} bodies`,
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
							stmt.start,
							`Destructuring declarations inside ${wording.loop} bodies`,
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
				stmt.start,
				wording.loopBodyStatements,
			),
		)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node.start,
				`${wording.loop} bodies must contain an output element`,
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors, lowering)
	if (!output.tag) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				loop.node.start,
				`${wording.loop} output must be a single element`,
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

/** The `if` IR, once a surface has lowered the test and both branches. */
export const finishIf = (
	ctx: ExtractContext,
	node: AstNode,
	test: AstNode,
	then: TemplateNode[],
	alternate: TemplateNode[],
): (TemplateNode & { kind: 'if' }) | null => {
	if (then.length === 0 && alternate.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				`${wordingOf(ctx).ifBranches} must contain output elements`,
			),
		)
		return null
	}
	return {
		kind: 'if',
		testText: text(ctx.source, test),
		test,
		then,
		alternate,
		node,
	}
}

/** Report a switch with no arms, or an arm with no output (the switch tail). */
export const reportEmptySwitch = (
	ctx: ExtractContext,
	at: number | undefined,
	which: 'switch' | 'arm',
): void => {
	const wording = wordingOf(ctx)
	ctx.diagnostics.push(
		diagnostic.unsupported(
			ctx.source,
			at,
			which === 'switch'
				? wording.switchNoArms
				: `${wording.caseArms} must contain output elements`,
		),
	)
}

/**
 * The boundary tail both spellings share (`@try`/`@pending`/`@catch`, `<truc:try
 * pending catch>`): with a pending arm it is an ASYNC boundary (ADR 0023
 * sub-design 13) whose three arms each need exactly one root element — all
 * render, `hidden`-toggled by which state won — and the catch parameter is
 * reactive by position in its arm.
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
			body: number | undefined
			pending: number | undefined
			catch: number | undefined
		}
	},
): (TemplateNode & { kind: 'try' }) | null => {
	const wording = wordingOf(ctx)
	const { children, catchParam, catchChildren, pendingChildren, at } = arms
	if (pendingChildren !== null) {
		const multiRoot: Array<[TemplateNode[], number | undefined, string]> = [
			[
				children,
				at.body,
				`An async boundary's ${wording.tryBody} must render exactly one root element (its own \`hidden\` toggle and client addressing need a single target)`,
			],
			[
				pendingChildren,
				at.pending,
				`${wording.pendingArm} must render exactly one root element`,
			],
			[
				catchChildren,
				at.catch,
				`${wording.catchArm} of an async boundary must render exactly one root element`,
			],
		]
		for (const [arm, offset, what] of multiRoot) {
			if (singleRootOf(arm)) continue
			ctx.diagnostics.push(diagnostic.unsupported(ctx.source, offset, what))
			return null
		}
	}
	if (children.length === 0 && catchChildren.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				`${wording.boundaries} must contain output elements`,
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
