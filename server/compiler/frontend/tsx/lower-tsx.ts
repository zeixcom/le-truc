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
 * - The `@try` family gets two real-JS spellings: a try/catch IIFE for the
 *   plain error boundary, and the recognized ambient
 *   `boundary({ ok, nil, err })` call for the async boundary (which
 *   arm ships stays a compiler decision; only the authored shape changed).
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
	controlFlow: 'A control-flow expression (ternary/map/boundary)',
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
): TemplateNode[] =>
	node.type === 'JSXFragment'
		? lowerChildren(ctx, node, signals, fors)
		: [lowerElement(ctx, node, signals, fors)]

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
				'A `.map()` loop as a conditional arm (the only conditional-plus-loop shape is the empty state, `{xs.length === 0 ? <empty/> : xs.map(…)}`)',
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
	const cases: Array<{ testText: string | null; children: TemplateNode[] }> = []
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

/* === @try family → try/catch IIFE + boundary({ ok, nil, err }) === */

/**
 * The plain error boundary: `{(() => { try { return <ok/> } catch (e) { return <fallback/> } })()}`
 * — a real try/catch IIFE. Body and handler must each be a single `return
 * <jsx/>`; no `finally` (same gate as `@finally`).
 */
const lowerTryIife = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const fn = node.callee as AstNode | undefined
	const body = fn?.body as AstNode | undefined
	if (!isNode(body) || body.type !== 'BlockStatement') return null
	const stmts = asArray(body.body)
	const tryStmt = stmts.find(s => s.type === 'TryStatement') as
		| AstNode
		| undefined
	if (!tryStmt || stmts.length !== 1) return null
	if (isNode(tryStmt.finalizer)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				tryStmt.finalizer.start,
				'finally arms on try boundaries',
			),
		)
		return null
	}
	const returnedJsx = (block: AstNode | undefined): AstNode | null => {
		if (!isNode(block) || block.type !== 'BlockStatement') return null
		const inner = asArray(block.body)
		const ret = inner.find(s => s.type === 'ReturnStatement') as
			| AstNode
			| undefined
		const arg = ret?.argument as AstNode | undefined
		return inner.length === 1 && isJsxNode(arg) ? arg : null
	}
	const okSrc = returnedJsx(tryStmt.block as AstNode | undefined)
	const handler = tryStmt.handler as AstNode | undefined
	const catchSrc = handler
		? returnedJsx(handler.body as AstNode | undefined)
		: null
	if (!okSrc || !catchSrc || !handler) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'A try/catch IIFE boundary must be `try { return <jsx/> } catch (e) { return <jsx/> }` — exactly one return per arm, no other statements',
			),
		)
		return null
	}
	const catchParam = isNode(handler.param)
		? identifierName(handler.param)
		: null
	return lowerTryArms(
		ctx,
		node,
		okSrc,
		catchSrc,
		catchParam,
		null,
		signals,
		fors,
	)
}

/**
 * The async boundary: `{boundary({ ok, nil, err })}` — a recognized
 * ambient call. All arms render, `hidden`-toggled by which state won at
 * render time; which arm SHIPS stays the compiler decision it was under
 * `@try`/`@pending`/`@catch`. The err arm's arrow parameter is the catch
 * parameter.
 *
 * Three arms map onto the Task-state vocabulary `watch()` already speaks:
 * `nil` is the no-value-yet pending arm (the `.tsrx` `@pending` arm's exact
 * IR). There is no `stale` arm — the owner withdrew it on 2026-09-18
 * (LT-211): the client never re-renders arm content, it toggles
 * `hidden`/`disabled` on server-rendered arms, so a re-fetching state has
 * no arm to show; the reactive idiom for that is an `isPending(signal)`
 * read beside the boundary (`class={ isPending(data) ? 'dimmed' : null }`),
 * which the compiler folds server-side and watches client-side.
 */
const lowerBoundaryCall = (
	ctx: ExtractContext,
	node: AstNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const arg = asArray(node.arguments)[0]
	if (!isNode(arg) || arg.type !== 'ObjectExpression') return null
	const armOf = (key: string): AstNode | null => {
		for (const prop of asArray(arg.properties)) {
			if (prop.type === 'Property' && identifierName(prop.key) === key)
				return (prop.value as AstNode | undefined) ?? null
		}
		return null
	}
	const ok = armOf('ok')
	const nil = armOf('nil')
	const errFn = armOf('err')
	if (!isJsxNode(ok) || !isJsxNode(nil) || !isNode(errFn)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'boundary({ … }) expects ok and nil as JSX elements and err as an arrow: boundary({ ok: <div/>, nil: <p/>, err: (e) => <p/> })',
			),
		)
		return null
	}
	if (nodeType(errFn) !== 'ArrowFunctionExpression') {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				errFn.start,
				"boundary's err arm must be an arrow function — its parameter is the catch parameter",
			),
		)
		return null
	}
	const catchParam = identifierName(asArray(errFn.params)[0]) ?? null
	const errArm = (errFn.body as AstNode | undefined) ?? null
	if (!isJsxNode(errArm)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				errFn.start,
				"boundary's err arm must return JSX",
			),
		)
		return null
	}
	return lowerTryArms(ctx, node, ok, errArm, catchParam, nil, signals, fors)
}

/** Shared arm lowering for both async/plain spellings. */
const lowerTryArms = (
	ctx: ExtractContext,
	node: AstNode,
	okSrc: AstNode,
	catchSrc: AstNode,
	catchParam: string | null,
	nilSrc: AstNode | null,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<AstNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const lowerValue = (src: AstNode | null): TemplateNode[] =>
		src !== null && isJsxNode(src) ? lowerJsxValue(ctx, src, signals, fors) : []
	const children = lowerValue(okSrc)
	const catchChildren = lowerValue(catchSrc)
	const pendingChildren = nilSrc === null ? null : lowerValue(nilSrc)
	if (pendingChildren !== null) {
		if (!singleRootOf(children)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					(okSrc.start ?? node.start) as number,
					"An async boundary's ok arm must render exactly one root element (its own `hidden` toggle and client addressing need a single target)",
				),
			)
			return null
		}
		if (!singleRootOf(pendingChildren as TemplateNode[])) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					(nilSrc?.start ?? node.start) as number,
					'nil arm must render exactly one root element',
				),
			)
			return null
		}
		if (!singleRootOf(catchChildren)) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					(catchSrc.start ?? node.start) as number,
					'err arm of an async boundary must render exactly one root element',
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
				if (expr.type === 'CallExpression') {
					const calleeName = identifierName(expr.callee)
					if (calleeName === 'boundary') {
						const lowered = lowerBoundaryCall(ctx, expr, signals, fors)
						if (lowered) out.push(lowered)
						return true
					}
					if (asIife(expr)) {
						const fn = expr.callee as AstNode
						const body = fn.body as AstNode
						const inner = asArray(body.body)
						if (inner.some(s => s.type === 'SwitchStatement')) {
							const lowered = lowerSwitchIife(ctx, expr, signals, fors)
							if (lowered) out.push(lowered)
							return true
						}
						if (inner.some(s => s.type === 'TryStatement')) {
							const lowered = lowerTryIife(ctx, expr, signals, fors)
							if (lowered) out.push(lowered)
							return true
						}
						// A non-recognized IIFE is an ordinary expression child —
						// usually a string-producing block, legal and static.
					}
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
