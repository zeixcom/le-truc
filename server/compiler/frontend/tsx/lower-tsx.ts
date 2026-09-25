/**
 * The `.tsx` front end's template lowering (LT-183 spike, productionized by
 * LT-202). Everything downstream consumes the same `TemplateNode` IR, so the
 * surface difference lives entirely at the lowering layer (ADR 0032
 * sub-design 2: "adapt at the lowering layer … do not fork IR variants").
 *
 * What is surface-specific here — the control-flow dispatch (ADR 0032
 * sub-design 2):
 *
 * - The control-flow DIRECTIVES become JSX expression shapes in child
 *   position: `{c ? <a/> : <b/>}` and `{c && <a/>}` → `if`; `{xs.map((x, i)
 *   => …)}` → `for` (server data → `each()`, a declared `createList` → the
 *   reconcile path, decided by the EXISTING analysis, not by syntax); an
 *   IIFE whose body is a `switch` returning JSX per arm → `switch`.
 * - The `@try` family has no honest expression spelling, so it is a
 *   `truc:`-namespaced intrinsic element (ADR 0041): `<truc:try
 *   catch={e => …}>` is the error boundary, and a `pending` arm makes it the
 *   async boundary (which arm ships stays a compiler decision; only the
 *   authored shape changed). Every other `truc:*` tag stays LTC053.
 * - Bare statements inside a branch are NOT expressible in JSX child
 *   position — an IIFE arm must return JSX — so `client-stmt` inside a
 *   branch retires with the grammar (ADR 0024 s11 already restricted it).
 * - The `&{expr}` lazy sigil and the React near-miss diagnostics are gone
 *   with the grammar (TSRX018/020/021–024 retire; the React idioms are the
 *   correct spellings here).
 *
 * The surface-independent core — condition validation, element/compose
 * lowering, the expression-child lift rule, positional reactivity, and the
 * children skeleton — is SHARED with the `.tsrx` front end through
 * `server/compiler/lower-shared.ts` (LT-202, ADR 0032 sub-design 6's anti-drift
 * contract). Attribute classification is reused verbatim from
 * `server/compiler/classify-attributes.ts` — it consumes the same estree-shaped
 * JSXAttribute nodes this front end's `to-estree.ts` converter produces.
 */

import {
	asArray,
	identifierName,
	isNode,
	jsxName,
	nodeType,
	text,
} from '../../ast-utils'
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
	lowerElement as lowerElementShared,
	markPositionallyReactive,
	type SurfaceWording,
	singleRootOf,
	validateCondition,
	validateEmptyArm,
} from '../../lower-shared'
import type { AstNode } from './to-estree'

/**
 * The `.tsx` surface vocabulary for diagnostics that name authored shapes —
 * the expression spellings. (`.tsrx`'s set lives in `lower-template.ts`.)
 */
const TSX_SURFACE_WORDING: SurfaceWording = {
	lazyChild: 'A lazy child expression',
	controlFlow: 'A control-flow expression (ternary/map/switch/truc:try)',
	composedPosition: 'map output',
	conditionalTag: '{level === 2 ? <h2>…</h2> : <h3>…</h3>}',
}

/** Whether `node` is a JSX value (`<x/>` or `<>…</>`). */
const isJsxNode = (node: unknown): node is AstNode => {
	const t = isNode(node) ? String(node.type) : null
	return t === 'JSXElement' || t === 'JSXFragment'
}

/** Lower one JSX value (element/fragment) into a children list. */
const lowerJsxValue = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode[] => {
	if (node.type === 'JSXFragment')
		return lowerChildren(ctx, node, signals, fors)
	if (isTrucTry(node)) {
		const lowered = lowerTrucTry(ctx, node, signals, fors)
		return lowered ? [lowered] : []
	}
	return [lowerElement(ctx, node, signals, fors)]
}

/* === @if → ConditionalExpression / LogicalExpression === */

/**
 * Lower `{c ? <a/> : <b/>}` (both arms) or `{c && <a/>}` (single branch)
 * into the `if` IR — the same construct `@if` lowered in `.tsrx`.
 */
const lowerIfExpr = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'if' }) | null => {
	let test: AstNode | null = null
	let thenSrc: AstNode | null = null
	let alternateSrc: AstNode | null = null
	if (node.type === 'ConditionalExpression') {
		test = (node.test as AstNode | null) ?? null
		thenSrc = (node.consequent as AstNode | null) ?? null
		alternateSrc = (node.alternate as AstNode | null) ?? null
	} else if (
		node.type === 'LogicalExpression' &&
		String(node.operator) === '&&'
	) {
		test = (node.left as AstNode | null) ?? null
		thenSrc = (node.right as AstNode | null) ?? null
	}
	if (!isNode(test)) return null
	if (
		(isNode(thenSrc) && isMapCall(thenSrc)) ||
		(isNode(alternateSrc) && isMapCall(alternateSrc))
	) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'A `.map()` loop as a conditional arm',
				"Only the empty state combines a condition with a loop — write `{xs.length === 0 ? <empty/> : xs.map(…)}`, testing the mapped array's own `length`, or move the loop out of the conditional.",
			),
		)
		return null
	}
	if (!validateCondition(ctx, signals, test, 'if condition')) return null
	const then = isJsxNode(thenSrc)
		? lowerJsxValue(ctx, thenSrc, signals, fors)
		: []
	const alternate = isJsxNode(alternateSrc)
		? lowerJsxValue(ctx, alternateSrc, signals, fors)
		: []
	if (!isJsxNode(thenSrc) && !isJsxNode(alternateSrc)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'if arms must be JSX elements ({cond ? <el/> : <el/>} / {cond && <el/>})',
			),
		)
		return null
	}
	if (then.length === 0 && alternate.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'if arms must contain output elements',
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

/* === @switch → IIFE over a statement switch === */

/**
 * Lower `(() => { switch (d) { case 'a': return <x/>; default: return <y/>; } })()`
 * into the `switch` IR. The IIFE must contain exactly the switch statement;
 * every arm's body must be a single `return <jsx/>`.
 *
 * IIFE recognition is SHAPE-based (0-arg call of a 0-param arrow with a
 * block body): object identity between `callee` and `arguments[0]` does NOT
 * survive a TS→estree conversion — each subtree converts separately
 * (LT-183 spike findings fact 6, `adr/archive/0032-spike-findings.md`),
 * so an identity check would never match.
 */
const lowerSwitchIife = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'switch' }) | null => {
	const fn = node.callee as AstNode | undefined
	const body = fn?.body as AstNode | undefined
	if (!isNode(body) || body.type !== 'BlockStatement') return null
	const stmts = asArray(body.body)
	const switchStmt = stmts.find(s => s.type === 'SwitchStatement')
	if (!switchStmt) return null
	if (stmts.length !== 1) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'A switch IIFE must contain exactly the switch statement (set up consts in the component setup, not inside the arm)',
			),
		)
		return null
	}
	const discriminant = switchStmt.discriminant as AstNode | undefined
	if (!isNode(discriminant)) return null
	if (!validateCondition(ctx, signals, discriminant, 'switch discriminant'))
		return null
	const rawCases = asArray(switchStmt.cases)
	if (rawCases.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'switch must contain at least one case or default arm',
			),
		)
		return null
	}
	const cases: Array<{
		testText: string | null
		test: AstNode | null
		children: TemplateNode[]
	}> = []
	for (const raw of rawCases) {
		const armStmts = asArray(raw.consequent)
		const ret = armStmts.find(s => s.type === 'ReturnStatement') as
			| AstNode
			| undefined
		const arm = ret?.argument as AstNode | undefined
		if (armStmts.length !== 1 || !isJsxNode(arm)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					raw.start ?? node.start,
					'switch arms must be exactly `case <expr>: return <jsx/>` — statement-context arms are a grammar construct that retired with @switch',
				),
			)
			return null
		}
		const children = lowerJsxValue(ctx, arm, signals, fors)
		if (children.length === 0) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					raw.start ?? node.start,
					'switch arms must contain output elements',
				),
			)
			return null
		}
		cases.push({
			testText: isNode(raw.test) ? text(ctx.source, raw.test) : null,
			test: isNode(raw.test) ? raw.test : null,
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

/* === @try family → <truc:try pending catch> === */

/**
 * Whether `node` is a `<truc:try>` element (ADR 0041) — the one `truc:*`
 * intrinsic this front end lowers. Every other namespaced tag falls through
 * to `lowerElement`, which rejects it with LTC053.
 */
const isTrucTry = (node: unknown): node is AstNode => {
	if (!isNode(node) || node.type !== 'JSXElement') return false
	const opening = node.openingElement
	const name = isNode(opening) ? opening.name : null
	return (
		isNode(name) &&
		name.type === 'JSXNamespacedName' &&
		jsxName(name.namespace) === 'truc' &&
		jsxName(name.name) === 'try'
	)
}

/**
 * The `.tsx` spelling of `@try`/`@pending`/`@catch` (ADR 0041):
 * `<truc:try catch={e => <jsx/>}>ok</truc:try>` is the error boundary, and
 * adding `pending={<jsx/>}` makes it the async boundary — all arms render,
 * `hidden`-toggled by which state won at render time; which arm SHIPS
 * stays a compiler decision. The children are the success content; the
 * `catch` arrow's parameter is the catch parameter.
 *
 * `tsc` owns the arm types through the `IntrinsicElements['truc:try']`
 * entry (`catch` required, both arms `JSX.Element`, a repeated arm is
 * TS17001). What it cannot see is the SHAPE: the arms are compile-consumed,
 * never evaluated, so each must be written inline — a JSX element for
 * `pending`, an arrow with a JSX expression body for `catch`.
 *
 * There is no `stale` arm (LT-211): the client never re-renders arm
 * content, it toggles `hidden`/`disabled` on server-rendered arms, so a
 * re-fetching state has no arm to show; the reactive idiom for that is an
 * `isPending(signal)` read beside the boundary
 * (`class={() => (isPending(data) ? 'dimmed' : null)}`), which the
 * compiler folds server-side and watches client-side.
 */
const lowerTrucTry = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const opening = node.openingElement as AstNode
	let pendingSrc: AstNode | null = null
	let catchFn: AstNode | null = null
	let malformed = false
	for (const attr of asArray(opening.attributes)) {
		const name = attr.type === 'JSXAttribute' ? jsxName(attr.name) : null
		const value = isNode(attr.value) ? attr.value : null
		const expr =
			value?.type === 'JSXExpressionContainer' && isNode(value.expression)
				? value.expression
				: null
		if (name === 'pending' && isJsxNode(expr)) pendingSrc = expr
		else if (
			name === 'catch' &&
			isNode(expr) &&
			nodeType(expr) === 'ArrowFunctionExpression' &&
			isJsxNode(expr.body)
		)
			catchFn = expr
		else malformed = true
	}
	if (malformed || !catchFn) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'A `<truc:try>` boundary takes its arms inline — `catch={e => <jsx/>}` (an arrow whose body is the arm) and optionally `pending={<jsx/>}`, no other attributes — because the compiler consumes them and never evaluates them',
			),
		)
		return null
	}
	const catchParam = identifierName(asArray(catchFn.params)[0]) ?? null
	const catchSrc = catchFn.body as AstNode
	const children = lowerChildren(ctx, node, signals, fors)
	const catchChildren = lowerJsxValue(ctx, catchSrc, signals, fors)
	const pendingChildren =
		pendingSrc === null ? null : lowerJsxValue(ctx, pendingSrc, signals, fors)
	if (pendingChildren !== null) {
		if (!singleRootOf(children)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.start,
					"An async boundary's content (the `<truc:try>` children) must render exactly one root element (its own `hidden` toggle and client addressing need a single target)",
				),
			)
			return null
		}
		if (!singleRootOf(pendingChildren)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					pendingSrc?.start ?? node.start,
					'pending arm must render exactly one root element',
				),
			)
			return null
		}
		if (!singleRootOf(catchChildren)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					catchSrc.start ?? node.start,
					'catch arm of an async boundary must render exactly one root element',
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
				'try arms must contain output elements',
			),
		)
		return null
	}
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

/* === @for → `.map()` === */

/**
 * The empty-state idiom (LT-212): `{xs.length === 0 ? <empty/> : xs.map(…)}`
 * is `.tsx`'s spelling of `@for … @empty`. Recognized by SHAPE, like the
 * switch IIFE: the test compares the map receiver's own `length` to `0`,
 * so the loop and its arm lower together to one `ForIR` with an
 * `emptyArm`, and the test is never evaluated as an `if` condition (over a
 * reactive List it would read a signal). Any other conditional with a
 * `.map()` arm is diagnosed in `lowerIfExpr`.
 */
const emptyStateIdiomOf = (
	node: AstNode,
): { loop: AstNode; empty: AstNode } | null => {
	if (node.type !== 'ConditionalExpression') return null
	const test = node.test as AstNode | undefined
	const empty = node.consequent as AstNode | undefined
	const loop = node.alternate as AstNode | undefined
	if (!isNode(test) || test.type !== 'BinaryExpression') return null
	if (String(test.operator) !== '===') return null
	const left = test.left as AstNode | undefined
	const right = test.right as AstNode | undefined
	if (
		!isNode(left) ||
		left.type !== 'MemberExpression' ||
		left.computed ||
		identifierName(left.property) !== 'length'
	)
		return null
	if (!isNode(right) || right.type !== 'Literal' || right.value !== 0)
		return null
	if (!isJsxNode(empty) || !isNode(loop) || !isMapCall(loop)) return null
	const subject = identifierName(left.object)
	const receiver = identifierName((loop.callee as AstNode).object)
	if (!subject || subject !== receiver) return null
	return { loop, empty }
}

/**
 * Lower the empty-state idiom's arm (LT-212): `null` when the loop has
 * none, `false` when the arm was diagnosed (the loop is dropped).
 */
const lowerEmptyArm = (
	ctx: ExtractContext,
	emptySrc: AstNode | null,
	kind: ForIR['kind'],
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): TemplateNode[] | null | false => {
	if (!emptySrc) return null
	const arm = lowerJsxValue(ctx, emptySrc, signals, fors)
	if (arm.length === 0) return null
	return (
		validateEmptyArm(ctx, arm, kind, fors, emptySrc.start, 'empty-state arm') ??
		false
	)
}

/**
 * Whether `node` is an IIFE recognized by this lowering: `(() => { … })()`
 * with a single arrow argument and a block body. SHAPE-based — see
 * `lowerSwitchIife` on why identity does not survive the conversion.
 */
const asIife = (node: AstNode): AstNode | null => {
	if (node.type !== 'CallExpression') return null
	const callee = node.callee as AstNode | undefined
	if (
		!isNode(callee) ||
		callee.type !== 'ArrowFunctionExpression' ||
		asArray(callee.params).length !== 0 ||
		asArray(node.arguments).length !== 0
	)
		return null
	const body = callee.body as AstNode | undefined
	if (!isNode(body) || body.type !== 'BlockStatement') return null
	return node
}

/** Is this `.map()`-shaped call producing JSX (a loop)? */
const isMapCall = (node: AstNode): boolean => {
	if (node.type !== 'CallExpression') return false
	const callee = node.callee as AstNode | undefined
	return (
		isNode(callee) &&
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		identifierName(callee.property) === 'map' &&
		isNode(callee.object)
	)
}

/**
 * Lower `{xs.map((x, i) => …)}` into the `for` IR. Over server data this is
 * the `each()` plan; over a declared reactive `createList` the reconcile
 * plan — the EXISTING analysis decides (dual lowering is not syntax-visible,
 * which is the point: the loop's iterable type, not its spelling, routes it).
 *
 * `@for`'s `key k` clause has no `.map()` spelling; the reactive-list form
 * keys by the declared `createList`'s own `keyConfig`.
 */
export const lowerFor = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	/** The empty-state idiom's `<empty/>` arm, when the loop came from one. */
	emptySrc: AstNode | null = null,
): TemplateNode | null => {
	const callee = node.callee as AstNode
	const iterable = callee.object as AstNode
	const callback = asArray(node.arguments)[0]
	if (!isNode(callback) || !/Function(Expression)?$/.test(callback.type))
		return null
	const params = asArray(callback.params)
	const itemName = identifierName(params[0])
	if (!itemName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'map over a destructuring loop variable',
			),
		)
		return null
	}
	const iterableName = identifierName(iterable)
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
		return lowerListFor(
			ctx,
			node,
			itemName,
			iterableSignal.name,
			signals,
			fors,
			emptySrc,
		)
	}
	const indexName = identifierName(params[1])
	if (params.length > 2) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'map callbacks take at most (item, index) — the key clause is a reactive-List concern',
			),
		)
		return null
	}
	const body = callback.body as AstNode | undefined
	if (!isNode(body)) return null
	const hoisted: EachForIR['hoisted'] = []
	let outputNode: AstNode | null = null
	if (body.type === 'BlockStatement') {
		for (const stmt of asArray(body.body)) {
			if (stmt.type === 'VariableDeclaration') {
				if (stmt.kind !== 'const') {
					ctx.diagnostics.push(
						diagnostic.unsupported(
							ctx.source,
							stmt.start,
							'Non-const declarations inside map bodies',
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
								'Destructuring declarations inside map bodies',
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
			if (stmt.type === 'ReturnStatement' && !outputNode) {
				const arg = stmt.argument as AstNode | undefined
				if (isJsxNode(arg)) {
					outputNode = arg
					continue
				}
			}
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					stmt.start,
					'Statements other than const declarations inside map bodies (statements belong in setup; branches render via ternaries)',
				),
			)
		}
	} else if (isJsxNode(body)) {
		outputNode = body
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'map bodies must produce an output element',
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	const emptyArm = lowerEmptyArm(ctx, emptySrc, 'each', signals, fors)
	if (emptyArm === false) return null
	const forIR: EachForIR = {
		kind: 'each',
		itemName,
		indexName,
		iterableText: text(ctx.source, iterable),
		iterable,
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
 * Validate the reactive-list body shape (ported; ADR 0024 sub-design 5,
 * extended by LT-215): statics and event attributes anywhere, exactly one
 * lazy `{item}` hole, and — since LT-215 — expressions that classify
 * SERVER-STATIC (`isServerEvaluable` against `ctx.serverKnown`): they fold
 * identically into every item per render call, so the extracted template
 * bakes them at render time. Item-derived expressions and refs stay
 * rejected — the slot-fill contract has no channel for a per-item value.
 */
const validateListBody = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	itemName: string,
): void => {
	const notBuildTime = (node: AstNode): string => {
		// Join FIRST, then test the string: the offender list is an array,
		// and an empty array is truthy — testing it directly made the
		// impure-ambient arm unreachable and printed `reads , …` (LT-221
		// §1.1, the .tsrx twin's join-first shape).
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
						`Lazy children inside a reactive-list map body must be the bare item ({${itemName}}) — the slot fill; {${node.exprText}} derives per item, and the extracted <template> has no per-item binding channel (ADR 0024 sub-design 5).`,
					),
				)
			else if (!isServerEvaluable(node.expr, ctx.serverKnown))
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`{${node.exprText}} inside a reactive-list map body ${notBuildTime(node.expr)} — only server-known build-time values (server args, the i18n record's \`t\`) can be interpolated here (ADR 0024 sub-design 5).`,
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
						'Control-flow expressions inside a reactive-list map body — the extracted template is static markup',
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
					`Dynamic attribute \`${'name' in attr ? attr.name : attr.kind}\` inside a reactive-list map body${attr.kind === 'server' ? ` ${notBuildTime(attr.node)}` : ''} — only server-known build-time values (server args, the i18n record's \`t\`) can be interpolated here (ADR 0024 sub-design 5, LT-215).`,
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
				`A reactive-list map body must render the item exactly once via {${itemName}} — that hole is the template slot the client fills (found ${holes}).`,
			),
		)
	}
}

/**
 * The reactive-list loop: `{list.map(item => <li>{item}</li>)}` where `list`
 * is a declared `createList` signal. Index bindings stay gated (keyed
 * reconciliation); the key comes from the list's own `keyConfig`, so `.map()`
 * needs no key clause (the `@for … ; key k` spelling retired with the grammar).
 */
export const lowerListFor = (
	ctx: ExtractContext,
	node: AstNode,
	itemName: string,
	listSignal: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
	emptySrc: AstNode | null = null,
): (TemplateNode & { kind: 'element' }) | null => {
	const callback = asArray(node.arguments)[0] as AstNode | undefined
	const params = callback ? asArray(callback.params) : []
	const indexName = identifierName(params[1])
	if (indexName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				callback?.start,
				'Index bindings in a reactive-list map — index identity does not survive keyed reconciliation',
			),
		)
		return null
	}
	if (itemName === 'first' || itemName === 'element') {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'Loop variable named `first`/`element` — reserved parameters of reconcile() bindItem',
			),
		)
		return null
	}
	const body = (callback?.body ?? null) as AstNode | null
	const blockBody = body
	let outputNode: AstNode | null = null
	if (body && isJsxNode(body)) outputNode = body
	if (!outputNode && blockBody && blockBody.type === 'BlockStatement') {
		for (const stmt of asArray(blockBody.body)) {
			if (stmt.type === 'ReturnStatement' && !outputNode) {
				const arg = stmt.argument as AstNode | undefined
				if (isJsxNode(arg)) outputNode = arg
			}
		}
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'map bodies must produce an output element',
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	// The item binding is the slot fill — reactive by position.
	markPositionallyReactive([output], new Set([itemName]))
	validateListBody(ctx, output, itemName)
	const emptyArm = lowerEmptyArm(ctx, emptySrc, 'reconcile', signals, fors)
	if (emptyArm === false) return null
	const forIR: ReconcileForIR = {
		kind: 'reconcile',
		itemName,
		listSignal,
		keyText: null,
		keyName: null,
		output,
		node,
		emptyArm,
	}
	fors.set(node, forIR)
	return output
}

/* === Children / element lowering (shared skeleton, .tsx dispatch) === */

/**
 * Lower template children into IR. JSX text and expression containers are
 * the same shapes `@tsrx/core` produced; the directive slots are the
 * expression forms documented on the module.
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
		TSX_LOWERING,
		TSX_SURFACE_WORDING,
		{
			dispatchChild: (ctx, child, out, signals, fors) => {
				if (!isTrucTry(child)) return false
				const lowered = lowerTrucTry(ctx, child, signals, fors)
				if (lowered) out.push(lowered)
				return true
			},
			dispatchControlFlow: (ctx, expr, out, _container, signals, fors) => {
				// Control-flow shapes in child position:
				const idiom = emptyStateIdiomOf(expr)
				if (idiom) {
					const lowered = lowerFor(ctx, idiom.loop, signals, fors, idiom.empty)
					if (lowered)
						out.push(lowered, ...(fors.get(idiom.loop)?.emptyArm ?? []))
					return true
				}
				if (
					expr.type === 'ConditionalExpression' ||
					(expr.type === 'LogicalExpression' && String(expr.operator) === '&&')
				) {
					const lowered = lowerIfExpr(ctx, expr, signals, fors)
					if (lowered) out.push(lowered)
					return true
				}
				if (isMapCall(expr)) {
					const lowered = lowerFor(ctx, expr, signals, fors)
					if (lowered) out.push(lowered)
					return true
				}
				if (asIife(expr)) {
					const body = (expr.callee as AstNode).body as AstNode
					if (asArray(body.body).some(s => s.type === 'SwitchStatement')) {
						const lowered = lowerSwitchIife(ctx, expr, signals, fors)
						if (lowered) out.push(lowered)
						return true
					}
					// A non-recognized IIFE is an ordinary expression child —
					// usually a string-producing block, legal and static.
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
		TSX_LOWERING,
		TSX_SURFACE_WORDING,
	)

const TSX_LOWERING: Lowering = { lowerChildren }
