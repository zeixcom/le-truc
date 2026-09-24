/**
 * Template lowering for `.tsrx` sources: `@if`/`@switch`/`@try`/`@for` →
 * `TemplateNode` IR. The surface-independent core — condition validation,
 * element/compose lowering, the expression-child lift rule, positional
 * reactivity — lives in `lower-shared.ts` (LT-202, ADR 0032 sub-design 6's
 * anti-drift contract); this module owns the grammar's control-flow
 * DIRECTIVES and their dispatch. Mutually recursive by nature (an element's
 * children may themselves be control-flow directives or nested elements),
 * so `compiler.ts`'s `compileSource` calls in at `lowerChildren` for the
 * component's root template.
 */

import type { AstNode } from '../../ast-node'
import {
	asArray,
	CONTEXT_NAMES,
	collapseJsxText,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	jsxName,
	text,
} from '../../ast-utils'
import { isTemplateForOfNode } from '../../core'
import { diagnostic } from '../../diagnostics'
import { dependenciesOf, isServerEvaluable } from '../../evaluability'
import type {
	EachForIR,
	ExtractContext,
	ForIR,
	ReconcileForIR,
	SignalIR,
	TemplateNode,
} from '../../ir'
import {
	type Lowering,
	lowerChildrenSkeleton,
	lowerComposeElement as lowerComposeElementShared,
	lowerElement as lowerElementShared,
	markPositionallyReactive,
	type SurfaceWording,
	singleRootOf,
	validateCondition,
	validateEmptyArm,
} from '../../lower-shared'

/**
 * The `.tsrx` surface vocabulary for diagnostics that name authored shapes:
 * the `&{expr}` sigil spelling and the directive names. (`.tsx`'s set lives
 * in `lower-tsx.ts`.)
 */
export const TSRX_SURFACE_WORDING: SurfaceWording = {
	lazyChild: 'A lazy child (&{expr})',
	controlFlow: 'A control-flow directive (@if/@switch/@try)',
	composedPosition: '@for output',
}

/* === Condition validation === */

/**
 * Lower an `@if` directive: the condition must be server-known at render
 * time (args, setup names, globals) — client-side conditional rendering is
 * outside the enhance-don't-render model. Branch bodies lower like any
 * children; client constructs must sit on the branch ROOT elements (the
 * analyzer union-addresses them).
 */
export const lowerIf = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'if' }) | null => {
	const test = node.test
	if (!isNode(test)) return null
	if (!validateCondition(ctx, signals, test, '@if condition')) return null
	const lowerBranch = (block: unknown): TemplateNode[] =>
		lowerBodyStatements(
			ctx,
			isNode(block) && Array.isArray(block.body) ? block.body : [],
			signals,
			fors,
		)
	const then = lowerBranch(node.consequent)
	const alternate = lowerBranch(node.alternate)
	if (then.length === 0 && alternate.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@if branches must contain output elements',
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

/**
 * Lower an `@switch` directive (`@case expr: { … }` / `@default: { … }`
 * arms) — the multi-branch sibling of `@if`.
 */
export const lowerSwitch = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'switch' }) | null => {
	const discriminant = node.discriminant
	if (!isNode(discriminant)) return null
	if (!validateCondition(ctx, signals, discriminant, '@switch discriminant'))
		return null
	const rawCases = Array.isArray(node.cases) ? node.cases : []
	if (rawCases.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@switch must contain at least one @case or @default arm',
			),
		)
		return null
	}
	const cases: Array<{ testText: string | null; children: TemplateNode[] }> = []
	for (const raw of rawCases as AstNode[]) {
		const children = lowerBodyStatements(ctx, raw.consequent, signals, fors)
		if (children.length === 0) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					raw.start ?? node.start,
					'@case/@default arms must contain output elements',
				),
			)
			return null
		}
		cases.push({
			testText: isNode(raw.test) ? text(ctx.source, raw.test) : null,
			children,
		})
	}
	return {
		kind: 'switch',
		discriminantText: text(ctx.source, discriminant),
		discriminant,
		cases,
		node,
	}
}

/**
 * Lower a control-flow branch body (a statement list): elements, text,
 * fragments, and NESTED control-flow directives — a branch body is a
 * complete output context with the same contract as `lowerChildren`;
 * anything unsupported reports a diagnostic instead of being silently
 * dropped. (Branch bodies are a statement list only in the `.tsrx` grammar —
 * `.tsx` arms are JSX-valued expressions, dispatched in `lower-tsx.ts`.)
 */
const lowerBodyStatements = (
	ctx: ExtractContext,
	statements: unknown,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode[] => {
	const body = Array.isArray(statements) ? statements : []
	const out: TemplateNode[] = []
	for (const stmt of body) {
		if (stmt.type === 'JSXElement') {
			const tag = jsxName(
				isNode(stmt.openingElement) ? stmt.openingElement.name : null,
			)
			const lowered =
				tag && /^[A-Z]/.test(tag)
					? lowerComposeElement(ctx, stmt, tag, signals, fors)
					: lowerElement(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXText') {
			const collapsed = collapseJsxText(String(stmt.value ?? ''))
			if (collapsed) out.push({ kind: 'text', value: collapsed, node: stmt })
			continue
		}
		if (stmt.type === 'JSXFragment') {
			out.push(...lowerChildren(ctx, stmt, signals, fors))
			continue
		}
		if (isTemplateForOfNode(stmt)) {
			const lowered = lowerFor(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered, ...(fors.get(stmt)?.emptyArm ?? []))
			continue
		}
		if (stmt.type === 'JSXIfExpression') {
			const lowered = lowerIf(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXSwitchExpression') {
			const lowered = lowerSwitch(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXTryExpression') {
			const lowered = lowerTry(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXStyleElement') {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					stmt.start,
					'<style> blocks inside control-flow branches (styles are component-scoped)',
				),
			)
			continue
		}
		if (stmt.type === 'ExpressionStatement' && isNode(stmt.expression)) {
			// A bare client-only side effect beside conditionally rendered
			// markup (`internals?.states.add('clearable')` next to the
			// button it describes) — same free-name contract as a top-level
			// clientSetup statement (host/internals/signals/globals only).
			// analyze.ts decides whether the enclosing branch can guard it.
			const free = freeIdentifiers(stmt.expression)
			const bad = [...free].filter(
				name =>
					!JS_GLOBALS.has(name) &&
					!CONTEXT_NAMES.has(name) &&
					!signals.has(name),
			)
			if (bad.length === 0) {
				out.push({
					kind: 'client-stmt',
					text: text(ctx.source, stmt),
					node: stmt,
				})
				continue
			}
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				'Statements inside control-flow branches other than output elements and nested directives',
			),
		)
	}
	return out
}

/**
 * Lower an `@try { … } @catch (e) { … }` error boundary, in one of two
 * distinct modes:
 *
 * - No `@pending` arm: a render-time error boundary — the server renders the
 *   body inside a real try/catch, so a throwing server expression falls back
 *   to the catch arm; mutually exclusive, like `@switch`.
 * - A `@pending` arm present: an ASYNC BOUNDARY (ADR 0023 sub-design 13,
 *   LT-012) — `@try`/`@pending`/`@catch` route on `isPending(signal)` against
 *   the ONE async-derived signal (`deriveCell(async …)`) the body renders.
 *   Unlike the plain error boundary, all three arms render UNCONDITIONALLY
 *   (each needs exactly one root element, toggled `hidden` server-side by
 *   which state won at render time, then reactively by the client's single
 *   `watch(signal, { ok, err, nil })` call — no client DOM creation, pure
 *   enhance, mirroring `module-lazyload.ts`'s hand-written shape).
 *
 * `@finally` is gated outright in both modes. The grammar has no stale arm
 * and never will — the four-arm `.tsx` spelling that briefly added one was
 * withdrawn by the owner (LT-211): a re-fetching state has no arm, only the
 * reactive `isPending` idiom beside the boundary. Both surfaces now lower
 * the same three-arm shape.
 */
export const lowerTry = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const lowerBlock = (block: unknown): TemplateNode[] =>
		lowerBodyStatements(
			ctx,
			isNode(block) && Array.isArray(block.body) ? block.body : [],
			signals,
			fors,
		)
	if (isNode(node.finalizer)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.finalizer.start,
				'@finally arms on template @try blocks',
			),
		)
		return null
	}
	const children = lowerBlock(node.block)
	const handler = isNode(node.handler) ? node.handler : null
	let catchParam: string | null = null
	let catchChildren: TemplateNode[] = []
	if (handler) {
		catchParam = identifierName(handler.param)
		catchChildren = lowerBlock(handler.body)
	}
	let pendingChildren: TemplateNode[] | null = null
	if (isNode(node.pending)) {
		pendingChildren = lowerBlock(node.pending)
		if (!handler) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.start,
					'@pending requires a @catch (e) arm — an async boundary routes pending/ok/err together (ADR 0023 sub-design 13)',
				),
			)
			return null
		}
		if (!singleRootOf(children)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					(isNode(node.block) ? node.block.start : node.start) as number,
					"An async boundary's @try body must render exactly one root element (its own `hidden` toggle and client addressing need a single target)",
				),
			)
			return null
		}
		if (!singleRootOf(pendingChildren)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.pending.start,
					'@pending arm must render exactly one root element',
				),
			)
			return null
		}
		if (!singleRootOf(catchChildren)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					(node.handler as AstNode).start,
					'@catch arm of an async boundary must render exactly one root element',
				),
			)
			return null
		}
	}
	if (children.length === 0 && catchChildren.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@try blocks must contain output elements',
			),
		)
		return null
	}
	// The `@catch` arm's error child reads the catch parameter, which is
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

/**
 * Lower template children into IR. `&{expr}` arrives from the parser as a
 * `JSXText("&")` node immediately preceding a `JSXExpressionContainer` —
 * the sigil is detected by that adjacency. A plain `{expr}` child lifts to
 * reactive by analysis instead (LT-051, `reactivity.ts`).
 */
export const lowerChildren = (
	ctx: ExtractContext,
	parent: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode[] =>
	lowerChildrenSkeleton(
		ctx,
		parent,
		signals,
		fors,
		TSRX_LOWERING,
		TSRX_SURFACE_WORDING,
		{
			onText: (ctx, child, next) => {
				// The retired `&{expr}` lazy child (LT-052). `&{`/`&[` are TSRX's
				// lazy DESTRUCTURING introducers and live in binding position;
				// there is no `&{}` template-child form. The compiler never got a
				// lazy node from the parser for this — it matched a `JSXText`
				// ending in '&' beside an expression container, which also meant
				// `<span>Q&{a}</span>` silently swallowed the '&'. Reactivity is
				// decided by `reactivity.ts` now, so the sigil is redundant as
				// well as wrong: diagnose it rather than keep parsing it.
				if (
					next?.type === 'JSXExpressionContainer' &&
					String(child.value ?? '').endsWith('&')
				) {
					const expr = next.expression
					ctx.diagnostics.push(
						diagnostic.retiredLazySigil(
							ctx.source,
							child.start,
							isNode(expr) ? text(ctx.source, expr) : '…',
						),
					)
				}
			},
			dispatchChild: (ctx, child, out, signals, fors) => {
				if (isTemplateForOfNode(child)) {
					const lowered = lowerFor(ctx, child, signals, fors)
					if (lowered) out.push(lowered, ...(fors.get(child)?.emptyArm ?? []))
					return true
				}
				if (child.type === 'JSXIfExpression') {
					const lowered = lowerIf(ctx, child, signals, fors)
					if (lowered) out.push(lowered)
					return true
				}
				if (child.type === 'JSXSwitchExpression') {
					const lowered = lowerSwitch(ctx, child, signals, fors)
					if (lowered) out.push(lowered)
					return true
				}
				if (child.type === 'JSXTryExpression') {
					const lowered = lowerTry(ctx, child, signals, fors)
					if (lowered) out.push(lowered)
					return true
				}
				if (
					child.type === 'JSXForExpression' &&
					String(child.statementType) === 'ForInStatement'
				) {
					ctx.diagnostics.push(
						diagnostic.unsupported(
							ctx.source,
							child.start,
							'@for-in loops (iterating object keys) — use @for-of over an array',
						),
					)
					return true
				}
				if (child.type === 'JSXStyleElement') {
					// Style blocks become placeholder elements (tag 'style'); the
					// CSS is extracted via getStyleElementStylesheet, never
					// rendered.
					out.push({
						kind: 'element',
						tag: 'style',
						attrs: [],
						children: [],
						node: child,
					})
					return true
				}
				return false
			},
		},
	)

export const lowerElement = (
	ctx: ExtractContext,
	element: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode & { kind: 'element' } =>
	lowerElementShared(
		ctx,
		element,
		signals,
		fors,
		TSRX_LOWERING,
		TSRX_SURFACE_WORDING,
	)

export const lowerComposeElement = (
	ctx: ExtractContext,
	element: AstNode,
	tag: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'compose' }) | null =>
	lowerComposeElementShared(
		ctx,
		element,
		tag,
		signals,
		fors,
		TSRX_LOWERING,
		TSRX_SURFACE_WORDING,
	)

/**
 * Lower a `@for`'s `@empty { … }` arm (LT-212): `null` when the loop has
 * none, `false` when the arm was diagnosed (the loop is dropped).
 */
const lowerEmptyArm = (
	ctx: ExtractContext,
	node: AstNode,
	kind: ForIR['kind'],
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode[] | null | false => {
	if (!isNode(node.empty)) return null
	const arm = lowerBodyStatements(ctx, asArray(node.empty.body), signals, fors)
	if (arm.length === 0) return null
	return (
		validateEmptyArm(ctx, arm, kind, fors, node.empty.start, '@empty arm') ??
		false
	)
}

/**
 * Lower a `@for` loop. Server-data iterables lower to `each()`; reactive
 * `createList` iterables to the milestone-3 reconcile lowering; other
 * reactive sources stay gated (LTC001).
 */
export const lowerFor = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'element' }) | null => {
	const declarations = isNode(node.left) ? asArray(node.left.declarations) : []
	const itemName =
		declarations.length === 1 ? (identifierName(declarations[0]?.id) ?? '') : ''
	if (!itemName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for with a destructuring loop variable',
			),
		)
		return null
	}
	const iterableName = identifierName(node.right)
	const iterableSignal = iterableName ? signals.get(iterableName) : undefined
	if (iterableSignal) {
		if (iterableSignal.constructor !== 'createList') {
			ctx.diagnostics.push(
				diagnostic.reactiveForNotSupported(
					ctx.source,
					node.start,
					iterableSignal.name,
				),
			)
			return null
		}
		return lowerListFor(ctx, node, itemName, iterableSignal.name, signals, fors)
	}
	if (isNode(node.key)) {
		ctx.diagnostics.push(
			diagnostic.keyOnServerDataFor(ctx.source, node.key.start),
		)
		return null
	}
	const bodyStmts = isNode(node.body) ? asArray(node.body.body) : []
	const hoisted: EachForIR['hoisted'] = []
	let outputNode: AstNode | null = null
	for (const stmt of bodyStmts) {
		if (stmt.type === 'VariableDeclaration') {
			if (stmt.kind !== 'const') {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						stmt.start,
						'Non-const declarations inside @for bodies',
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
							'Destructuring declarations inside @for bodies',
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
		if (stmt.type === 'JSXElement' && !outputNode) {
			outputNode = stmt
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				'Statements other than const declarations inside @for bodies',
			),
		)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for bodies must contain an output element',
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	if (!output.tag) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for output must be a single element',
			),
		)
		return null
	}
	const emptyArm = lowerEmptyArm(ctx, node, 'each', signals, fors)
	if (emptyArm === false) return null
	const forIR: EachForIR = {
		kind: 'each',
		itemName,
		indexName: identifierName(node.index),
		iterableText: text(ctx.source, node.right as AstNode),
		iterableName,
		hoisted,
		output,
		node,
		emptyArm,
	}
	fors.set(node, forIR)
	return output
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
 * read names outside `serverKnown`), refs, and control flow stay rejected:
 * the slot-fill contract has no channel for a per-item value.
 */
const validateListBody = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	itemName: string,
): void => {
	const offenderNames = (node: AstNode): string =>
		[...dependenciesOf(node)]
			.filter(name => !ctx.serverKnown.has(name))
			.join(', ')
	const notBuildTime = (node: AstNode): string => {
		const offenders = offenderNames(node)
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
						`Lazy children inside a reactive-list @for body must be the bare item ({${itemName}}) — the slot fill; {${node.exprText}} derives per item, and the extracted <template> has no per-item binding channel (ADR 0024 sub-design 5).`,
					),
				)
			else if (!isServerEvaluable(node.expr, ctx.serverKnown))
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`{${node.exprText}} inside a reactive-list @for body ${notBuildTime(node.expr)} — only server-known build-time values (server args, the i18n record's \`t\`) can be interpolated here (ADR 0024 sub-design 5).`,
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
						'Control-flow directives (@if/@switch/@try) inside a reactive-list @for body — the extracted template is static markup',
					),
				)
			return
		}
		for (const attr of node.attrs) {
			if (attr.kind === 'event') continue
			if (attr.kind === 'static') continue
			if (attr.kind === 'ref')
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						'ref={…} inside a reactive-list @for body (per-item element refs are bindItem-scoped, not host-scoped)',
					),
				)
			else if (
				attr.kind === 'server' &&
				isServerEvaluable(attr.node, ctx.serverKnown)
			)
				continue
			else
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Dynamic attribute \`${'name' in attr ? attr.name : attr.kind}\` inside a reactive-list @for body${attr.kind === 'server' ? ` ${notBuildTime(attr.node)}` : ''} — only server-known build-time values (server args, the i18n record's \`t\`) can be interpolated here (ADR 0024 sub-design 5, LT-215).`,
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
				`A reactive-list @for body must render the item exactly once via {${itemName}} — that hole is the template slot the client fills (found ${holes}).`,
			),
		)
	}
}

export const lowerListFor = (
	ctx: ExtractContext,
	node: AstNode,
	itemName: string,
	listSignal: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'element' }) | null => {
	const indexNode = isNode(node.index) ? node.index : null
	const indexName = identifierName(indexNode)
	if (indexName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				indexNode?.start,
				'Index bindings in a reactive-list @for — index identity does not survive keyed reconciliation',
			),
		)
		return null
	}
	let keyName: string | null = null
	if (isNode(node.key)) {
		keyName = identifierName(node.key)
		if (!keyName) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.key.start,
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
				node.start,
				'Loop variable or key binding named `first`/`element` — reserved parameters of reconcile() bindItem',
			),
		)
		return null
	}
	const bodyStmts = isNode(node.body) ? asArray(node.body.body) : []
	let outputNode: AstNode | null = null
	for (const stmt of bodyStmts) {
		if (stmt.type === 'JSXElement' && !outputNode) {
			outputNode = stmt
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				stmt.type === 'VariableDeclaration'
					? 'Hoisted consts inside a reactive-list @for body (derive at use sites; per-item const rebinding is outside the milestone-3 subset)'
					: 'Statements other than the output element inside a reactive-list @for body',
			),
		)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for bodies must contain an output element',
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	// The item binding is the slot fill — reactive by position, not a
	// declared signal, so the lift rule alone would leave it static and
	// `validateListBody` would then see zero holes.
	markPositionallyReactive([output], new Set([itemName]))
	validateListBody(ctx, output, itemName)
	const emptyArm = lowerEmptyArm(ctx, node, 'reconcile', signals, fors)
	if (emptyArm === false) return null
	const forIR: ReconcileForIR = {
		kind: 'reconcile',
		itemName,
		listSignal,
		keyText: isNode(node.key) ? text(ctx.source, node.key) : null,
		keyName,
		output,
		node,
		emptyArm,
	}
	fors.set(node, forIR)
	return output
}

const TSRX_LOWERING: Lowering = { lowerChildren }
