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
	collapseJsxText,
	freeIdentifiers,
	identifierName,
	isNode,
	jsxName,
	text,
} from '../../ast-utils'
import { isTemplateForOfNode } from '../../core'
import { diagnostic } from '../../diagnostics'
import type { ExtractContext } from '../../extract-context'
import type { ForIR, SignalIR, TemplateNode } from '../../ir'
import {
	finishIf,
	finishSwitch,
	finishTry,
	type Lowering,
	lowerChildrenSkeleton,
	lowerComposeElement as lowerComposeElementShared,
	lowerElement as lowerElementShared,
	lowerLoop,
	reportEmptySwitch,
	validateCondition,
	validateEmptyArm,
} from '../../lower-shared'
import { wordingOf } from '../../surface'
import { CONTEXT_NAMES, JS_GLOBALS } from '../../vocabulary'
import type { IfNode, SwitchNode } from '../../walk'

/* === Condition validation === */

/**
 * Lower an `@if` directive: a server-known condition (args, setup names,
 * globals) picks its branch at render time; one that reads a signal or
 * `host` switches template-cloned branches on the client (ADR 0037).
 * Branch bodies lower like any children; the analysis decides how the
 * client addresses them.
 */
export const lowerIf = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): IfNode | null => {
	const test = node.test
	if (!isNode(test)) return null
	const mode = validateCondition(ctx, signals, test, 'if')
	if (mode === null) return null
	const lowerBranch = (block: unknown): TemplateNode[] =>
		lowerBodyStatements(
			ctx,
			isNode(block) && Array.isArray(block.body) ? block.body : [],
			signals,
			fors,
		)
	return finishIf(
		ctx,
		node,
		test,
		lowerBranch(node.consequent),
		lowerBranch(node.alternate),
		mode,
	)
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
): SwitchNode | null => {
	const discriminant = node.discriminant
	if (!isNode(discriminant)) return null
	const mode = validateCondition(ctx, signals, discriminant, 'switch')
	if (mode === null) return null
	const rawCases = Array.isArray(node.cases) ? node.cases : []
	if (rawCases.length === 0) {
		reportEmptySwitch(ctx, node, 'switch')
		return null
	}
	const cases: Array<{ test: AstNode | null; children: TemplateNode[] }> = []
	for (const raw of rawCases as AstNode[]) {
		const children = lowerBodyStatements(ctx, raw.consequent, signals, fors)
		if (children.length === 0) {
			reportEmptySwitch(ctx, raw.start === undefined ? node : raw, 'arm')
			return null
		}
		cases.push({ test: isNode(raw.test) ? raw.test : null, children })
	}
	return finishSwitch(ctx, node, discriminant, cases, mode)
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
					stmt,
					'A `<style>` block inside a control-flow branch',
					'Styles are component-scoped — move the block beside the root element.',
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
				stmt,
				'A statement other than an output element or a nested directive inside a control-flow branch',
				'Move the statement into setup.',
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
 * - A `@pending` arm present: an ASYNC BOUNDARY (ADR 0024 sub-design 13,
 *   LT-012) — `@try`/`@pending`/`@catch` route on `isPending(signal)` against
 *   the ONE async-derived signal (`deriveCell(async …)`) the body renders.
 *   The arm that won at render time renders live and every arm ships as an
 *   inert template (each needs exactly one root element); the client
 *   switches arms as the task settles (ADR 0037 s4, LT-276).
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
				node.finalizer,
				'A `@finally` arm on a template `@try` block',
				'Remove the arm — a template boundary has `@pending` and `@catch` arms only.',
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
	const pendingChildren = isNode(node.pending) ? lowerBlock(node.pending) : null
	if (pendingChildren !== null && !handler) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node,
				'A `@pending` arm without a `@catch (e)` arm',
				'An async boundary routes the pending, resolved and error states together (ADR 0024 sub-design 13) — add a `@catch (e)` arm.',
			),
		)
		return null
	}
	return finishTry(ctx, node, {
		children,
		catchParam,
		catchChildren,
		pendingChildren,
		at: {
			body: isNode(node.block) ? node.block : node,
			pending: isNode(node.pending) ? node.pending : node,
			catch: handler?.start === undefined ? node : handler,
		},
	})
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
	lowerChildrenSkeleton(ctx, parent, signals, fors, TSRX_LOWERING, {
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
						child,
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
						child,
						'A `@for-in` loop over object keys',
						'Loop with `@for-of` over an array, for example `Object.keys(record)`.',
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
	})

export const lowerElement = (
	ctx: ExtractContext,
	element: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode & { kind: 'element' } =>
	lowerElementShared(ctx, element, signals, fors, TSRX_LOWERING)

export const lowerComposeElement = (
	ctx: ExtractContext,
	element: AstNode,
	tag: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'compose' }) | null =>
	lowerComposeElementShared(ctx, element, tag, signals, fors, TSRX_LOWERING)

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
	return validateEmptyArm(ctx, arm, kind, fors, node.empty) ?? false
}

/**
 * Lower a `@for` loop: parse the directive's header — the `const` binding,
 * `index`, `key`, and the body's statements, whose output is its element —
 * into a `LoopSource`; `lowerLoop` (shared) routes and validates the rest.
 *
 * An `@try` statement in the body is the `.tsrx` twin of `.tsx`'s
 * `<truc:try>` map-body guard (LTC053, LT-358a): the loop body's root is
 * what the client addresses each item through, so a boundary there is
 * refused by name rather than left to the generic "statement other than
 * the output element" rule, whose fix is wrong for a boundary. An `@try`
 * can never be a `@for` body's output (`outputOf` accepts JSXElement
 * only), so every body-level `@try` takes this rule.
 */
export const lowerFor = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'element' }) | null => {
	const statements = isNode(node.body) ? asArray(node.body.body) : []
	const tryStmt = statements.find(s => s.type === 'JSXTryExpression')
	if (isNode(tryStmt)) {
		ctx.diagnostics.push(
			diagnostic.boundaryAsLoopRoot(ctx.source, tryStmt, wordingOf(ctx)),
		)
		return null
	}
	const declarations = isNode(node.left) ? asArray(node.left.declarations) : []
	const indexNode = isNode(node.index) ? node.index : null
	const indexName = identifierName(indexNode)
	return lowerLoop(
		ctx,
		{
			node,
			itemName:
				declarations.length === 1
					? identifierName(declarations[0]?.id) || null
					: null,
			index: indexName ? { name: indexName, at: indexNode } : null,
			iterable: node.right as AstNode,
			key: isNode(node.key) ? node.key : null,
			extraParams: false,
			statements: isNode(node.body) ? asArray(node.body.body) : [],
			outputOf: stmt => (stmt.type === 'JSXElement' ? stmt : null),
			expressionOutput: null,
			lowerEmptyArm: kind => lowerEmptyArm(ctx, node, kind, signals, fors),
		},
		signals,
		fors,
		TSRX_LOWERING,
	)
}

const TSRX_LOWERING: Lowering = { lowerChildren }
