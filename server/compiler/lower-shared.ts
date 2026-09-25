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
import { containsImpureAmbient } from './evaluability'
import type {
	AttributeIR,
	ComposeAttrIR,
	ExtractContext,
	ForIR,
	SignalIR,
	TemplateNode,
} from './ir'
import { bindsExposedArg, classifyChild } from './reactivity'

/** The recursion seam: each front end's own children dispatcher. */
export type Lowering = {
	lowerChildren: (
		ctx: ExtractContext,
		parent: AstNode,
		signals: ReadonlyMap<string, SignalIR>,
		fors: Map<AstNode, ForIR>,
	) => TemplateNode[]
}

/** Surface vocabulary for the diagnostics that name authored shapes. */
export type SurfaceWording = {
	/** A lazy child inside a composed element's content. */
	lazyChild: string
	/** Control flow inside a composed element's content. */
	controlFlow: string
	/** Where a composed element is illegal (the non-child-list context). */
	composedPosition: string
	/** The conditional spelling that picks between two static tags (LTC053). */
	conditionalTag: string
}

/* === Condition validation === */

/**
 * Validate a control-flow condition (`@if` test / ternary test, `@switch`
 * discriminant): server-known at render time (args, setup consts, globals)
 * and never a signal read — the DOM keeps the initially rendered branch.
 * `what` carries the surface's spelling (`'@if condition'` / `'if
 * condition'`).
 */
export const validateCondition = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	test: AstNode,
	what: string,
): boolean => {
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
 * sigil spelling vs. the `.tsx` expression spelling) and arrive through
 * `wording`.
 */
export const validateComposedChildren = (
	ctx: ExtractContext,
	children: TemplateNode[],
	wording: SurfaceWording,
): void => {
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
	wording: SurfaceWording,
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
	validateComposedChildren(ctx, children, wording)
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
	wording: SurfaceWording,
): TemplateNode & { kind: 'element' } => {
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
	wording: SurfaceWording,
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
					? lowerComposeElement(
							ctx,
							child,
							tag,
							signals,
							fors,
							lowering,
							wording,
						)
					: lowerElement(ctx, child, signals, fors, lowering, wording)
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
 * `what` carries the surface's spelling (`'@empty arm'` / `'empty-state
 * arm'`).
 */
export const validateEmptyArm = (
	ctx: ExtractContext,
	arm: TemplateNode[],
	kind: ForIR['kind'],
	fors: ReadonlyMap<AstNode, ForIR>,
	at: number | undefined,
	what: string,
): TemplateNode[] | null => {
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
				`Client constructs (events, reactive bindings, refs, composed elements, loops, boundaries) inside an ${what} (the arm renders static and server-known content only)`,
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
					`A non-element root in the ${what} of a reactive-list loop (the client toggles each root's \`hidden\` as the list empties and fills, so every root must be an element)`,
				),
			)
			return null
		}
	}
	return arm
}
