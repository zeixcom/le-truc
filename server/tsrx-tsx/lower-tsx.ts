/**
 * TSX spike (LT-183): `.tsx` template lowering — ADAPTED from
 * `server/tsrx/lower-template.ts`. Everything downstream consumes the same
 * `TemplateNode` IR, so the adaptation lives entirely at the lowering layer
 * (TSX_SPIKE.md §4.1: "adapt at the lowering layer … do not fork IR
 * variants").
 *
 * What changed against the `.tsrx` original:
 *
 * - The control-flow DIRECTIVES become JSX expression shapes in child
 *   position (§5 surface mapping): `{c ? <a/> : <b/>}` and `{c && <a/>}` →
 *   `if`; `{xs.map((x, i) => …)}` → `for` (server data → `each()`, a
 *   declared `createList` → the reconcile path, decided by the EXISTING
 *   analysis, not by syntax); an IIFE whose body is a `switch` returning
 *   JSX per arm → `switch`.
 * - The `@try` family gets two real-JS spellings (§4.4): a try/catch IIFE
 *   for the plain error boundary, and a recognized ambient
 *   `boundary({ ok, pending, err })` call for the async three-arm boundary
 *   (which arm ships stays a compiler decision; only the authored shape
 *   changed).
 * - Bare statements inside a branch are NOT expressible in JSX child
 *   position — an IIFE arm must return JSX — so `client-stmt` inside a
 *   branch retires with the grammar (§4.4's decision: statements belong in
 *   setup; ADR 0024 s11 already restricted the construct).
 * - The `&{expr}` lazy sigil and the React near-miss diagnostics are gone
 *   with the grammar (TSRX018/020/021–024 retire; §4.1).
 *
 * Attribute classification is REUSED VERBATIM from
 * `server/tsrx/classify-attributes.ts` — it consumes the same estree-shaped
 * JSXAttribute nodes this spike's `to-estree.ts` converter produces.
 */

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
} from '../tsrx/ast-utils'
import {
	classifyAttribute,
	classifyComposeAttribute,
} from '../tsrx/classify-attributes'
import { diagnostic } from '../tsrx/diagnostics'
import { containsImpureAmbient } from '../tsrx/evaluability'
import type {
	AttributeIR,
	ComposeAttrIR,
	ExtractContext,
	ForIR,
	SignalIR,
	TemplateNode,
} from '../tsrx/ir'
import { bindsExposedArg, classifyChild } from '../tsrx/reactivity'
import type { TsrxNode } from './to-estree'

/* === Condition validation (ported from lower-template.ts) === */

/**
 * Validate a control-flow condition (`if` test, `switch` discriminant):
 * server-known at render time (args, setup consts, globals) and never a
 * signal read — the DOM keeps the initially rendered branch.
 */
const validateCondition = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	test: TsrxNode,
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

/** Whether `node` is a JSX value (`<x/>` or `<>…</>`). */
const isJsxNode = (node: unknown): node is TsrxNode => {
	const t = isNode(node) ? String(node.type) : null
	return t === 'JSXElement' || t === 'JSXFragment'
}

/** Lower one JSX value (element/fragment) into a children list. */
const lowerJsxValue = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode[] =>
	node.type === 'JSXFragment'
		? lowerChildren(ctx, node, signals, fors)
		: [lowerElement(ctx, node, signals, fors)]

/* === @if → ConditionalExpression / LogicalExpression (§5) === */

/**
 * Lower `{c ? <a/> : <b/>}` (both arms) or `{c && <a/>}` (single branch)
 * into the `if` IR — the same construct `@if` lowered in `.tsrx`.
 */
export const lowerIf = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'if' }) | null => {
	let test: TsrxNode | null = null
	let thenSrc: TsrxNode | null = null
	let alternateSrc: TsrxNode | null = null
	if (node.type === 'ConditionalExpression') {
		test = (node.test as TsrxNode | null) ?? null
		thenSrc = (node.consequent as TsrxNode | null) ?? null
		alternateSrc = (node.alternate as TsrxNode | null) ?? null
	} else if (node.type === 'LogicalExpression' && String(node.operator) === '&&') {
		test = (node.left as TsrxNode | null) ?? null
		thenSrc = (node.right as TsrxNode | null) ?? null
	}
	if (!isNode(test)) return null
	if (!validateCondition(ctx, signals, test, 'if condition')) return null
	const then = isJsxNode(thenSrc) ? lowerJsxValue(ctx, thenSrc, signals, fors) : []
	const alternate = isJsxNode(alternateSrc) ? lowerJsxValue(ctx, alternateSrc, signals, fors) : []
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

/* === @switch → IIFE over a statement switch (§4.4, §5) === */

/**
 * Lower `(() => { switch (d) { case 'a': return <x/>; default: return <y/>; } })()`
 * into the `switch` IR. The IIFE must contain exactly the switch statement;
 * every arm's body must be a single `return <jsx/>`.
 */
export const lowerSwitchIife = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'switch' }) | null => {
	const fn = node.callee as TsrxNode | undefined
	const body = fn?.body as TsrxNode | undefined
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
	const discriminant = switchStmt.discriminant as TsrxNode | undefined
	if (!isNode(discriminant)) return null
	if (!validateCondition(ctx, signals, discriminant, 'switch discriminant')) return null
	const rawCases = asArray(switchStmt.cases)
	if (rawCases.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(ctx.source, node.start, 'switch must contain at least one case or default arm'),
		)
		return null
	}
	const cases: Array<{ testText: string | null; children: TemplateNode[] }> = []
	for (const raw of rawCases) {
		const armStmts = asArray(raw.consequent)
		const ret = armStmts.find(s => s.type === 'ReturnStatement') as TsrxNode | undefined
		const arm = ret?.argument as TsrxNode | undefined
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

/* === @try family → try/catch IIFE + boundary({ ok, pending, err }) (§4.4) === */

/** The sole element child among an arm's children, or null. */
const singleRootOf = (
	children: TemplateNode[],
): (TemplateNode & { kind: 'element' }) | null => {
	const roots = children.filter(
		(c): c is TemplateNode & { kind: 'element' } => c.kind === 'element',
	)
	return roots.length === 1 ? (roots[0] as TemplateNode & { kind: 'element' }) : null
}

/**
 * Mark direct `{expr}` children of each root element reactive when they read
 * a name that is reactive *by position* — the catch parameter of an async
 * boundary's err arm, or a reactive loop body's item binding.
 */
const markPositionallyReactive = (
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
 * The plain error boundary: `{(() => { try { return <ok/> } catch (e) { return <fallback/> } })()}`
 * — a real try/catch IIFE. Body and handler must each be a single `return
 * <jsx/>`; no `finally` (same gate as `@finally`).
 */
export const lowerTryIife = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const fn = node.callee as TsrxNode | undefined
	const body = fn?.body as TsrxNode | undefined
	if (!isNode(body) || body.type !== 'BlockStatement') return null
	const stmts = asArray(body.body)
	const tryStmt = stmts.find(s => s.type === 'TryStatement') as TsrxNode | undefined
	if (!tryStmt || stmts.length !== 1) return null
	if (isNode(tryStmt.finalizer)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(ctx.source, tryStmt.finalizer.start, 'finally arms on try boundaries'),
		)
		return null
	}
	const returnedJsx = (block: TsrxNode | undefined): TsrxNode | null => {
		if (!isNode(block) || block.type !== 'BlockStatement') return null
		const inner = asArray(block.body)
		const ret = inner.find(s => s.type === 'ReturnStatement') as TsrxNode | undefined
		const arg = ret?.argument as TsrxNode | undefined
		return inner.length === 1 && isJsxNode(arg) ? arg : null
	}
	const okSrc = returnedJsx(tryStmt.block as TsrxNode | undefined)
	const handler = tryStmt.handler as TsrxNode | undefined
	const catchSrc = handler ? returnedJsx(handler.body as TsrxNode | undefined) : null
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
	const catchParam = isNode(handler.param) ? identifierName(handler.param) : null
	return lowerTryArms(ctx, node, okSrc, catchSrc, catchParam, null, signals, fors)
}

/**
 * The async boundary: `{boundary({ ok: <el/>, pending: <el/>, err: (e) => <el/> })}`
 * — a recognized ambient call (§4.4: "recognized three-arm spelling"). All
 * three arms render, `hidden`-toggled by which state won at render time;
 * which arm SHIPS stays the compiler decision it was under `@try/@pending/@catch`.
 * The err arm's arrow parameter is the catch parameter.
 */
export const lowerBoundaryCall = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const arg = asArray(node.arguments)[0]
	if (!isNode(arg) || arg.type !== 'ObjectExpression') return null
	const armOf = (key: string): TsrxNode | null => {
		for (const prop of asArray(arg.properties)) {
			if (prop.type === 'Property' && identifierName(prop.key) === key)
				return (prop.value as TsrxNode | undefined) ?? null
		}
		return null
	}
	const ok = armOf('ok')
	const pending = armOf('pending')
	const errFn = armOf('err')
	if (!isJsxNode(ok) || !isJsxNode(pending) || !isNode(errFn)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'boundary({ … }) expects ok and pending as JSX elements and err as an arrow: boundary({ ok: <div/>, pending: <p/>, err: (e) => <p/> })',
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
	const errArm = (errFn.body as TsrxNode | undefined) ?? null
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
	return lowerTryArms(ctx, node, ok, errArm, catchParam, pending, signals, fors)
}

/** Shared arm lowering for both `@try` spellings. */
const lowerTryArms = (
	ctx: ExtractContext,
	node: TsrxNode,
	okSrc: TsrxNode,
	catchSrc: TsrxNode,
	catchParam: string | null,
	pendingSrc: TsrxNode | null,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const lowerValue = (src: TsrxNode | null): TemplateNode[] =>
		src !== null && isJsxNode(src) ? lowerJsxValue(ctx, src, signals, fors) : []
	const children = lowerValue(okSrc)
	const catchChildren = lowerValue(catchSrc)
	const pendingChildren = pendingSrc === null ? null : lowerValue(pendingSrc)
	if (pendingSrc !== null) {
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
					(pendingSrc.start ?? node.start) as number,
					'pending arm must render exactly one root element',
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
			diagnostic.unsupported(ctx.source, node.start, 'try arms must contain output elements'),
		)
		return null
	}
	if (catchParam !== null) markPositionallyReactive(catchChildren, new Set([catchParam]))
	return {
		kind: 'try',
		children,
		catchParam,
		catchChildren,
		pendingChildren,
		node,
	}
}

/* === @for → `.map()` (§5) === */

/**
 * Whether `node` is an IIFE recognized by this lowering: `(() => { … })()`
 * with a single arrow argument and a block body.
 */
const asIife = (node: TsrxNode): TsrxNode | null => {
	if (node.type !== 'CallExpression') return null
	const callee = node.callee as TsrxNode | undefined
	if (
		!isNode(callee) ||
		callee.type !== 'ArrowFunctionExpression' ||
		asArray(callee.params).length !== 0 ||
		asArray(node.arguments).length !== 0
	)
		return null
	const body = callee.body as TsrxNode | undefined
	if (!isNode(body) || body.type !== 'BlockStatement') return null
	return node
}

/** Is this `.map()`-shaped call producing JSX (a loop)? */
const isMapCall = (node: TsrxNode): boolean => {
	if (node.type !== 'CallExpression') return false
	const callee = node.callee as TsrxNode | undefined
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
 * keys by the declared `createList`'s own `keyConfig` (prototype below).
 */
export const lowerFor = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode | null => {
	const callee = node.callee as TsrxNode
	const iterable = callee.object as TsrxNode
	const callback = asArray(node.arguments)[0]
	if (!isNode(callback) || !/Function(Expression)?$/.test(callback.type)) return null
	const params = asArray(callback.params)
	const itemName = identifierName(params[0])
	if (!itemName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(ctx.source, node.start, 'map over a destructuring loop variable'),
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
		return lowerListFor(ctx, node, itemName, iterableSignal.name, signals, fors)
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
	const body = callback.body as TsrxNode | undefined
	if (!isNode(body)) return null
	const hoisted: ForIR['hoisted'] = []
	let outputNode: TsrxNode | null = null
	if (body.type === 'BlockStatement') {
		for (const stmt of asArray(body.body)) {
			if (stmt.type === 'VariableDeclaration') {
				if (stmt.kind !== 'const') {
					ctx.diagnostics.push(
						diagnostic.unsupported(ctx.source, stmt.start, 'Non-const declarations inside map bodies'),
					)
					continue
				}
				for (const decl of asArray(stmt.declarations)) {
					const declName = identifierName(decl.id)
					if (!declName || !isNode(decl.init)) {
						ctx.diagnostics.push(
							diagnostic.unsupported(ctx.source, stmt.start, 'Destructuring declarations inside map bodies'),
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
				const arg = stmt.argument as TsrxNode | undefined
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
			diagnostic.unsupported(ctx.source, node.start, 'map bodies must produce an output element'),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	const forIR: ForIR = {
		itemName,
		indexName,
		keyText: null,
		keyName: null,
		listSignal: null,
		iterableText: text(ctx.source, iterable),
		iterableName,
		hoisted,
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}

/**
 * Validate the reactive-list body shape (ported): statics and event
 * attributes anywhere, exactly one lazy `{item}` hole, no dynamic
 * attributes or refs.
 */
const validateListBody = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	itemName: string,
): void => {
	let holes = 0
	const walk = (node: TemplateNode): void => {
		if (node.kind === 'expr') {
			const isItemHole =
				node.lazy && node.expr.type === 'Identifier' && node.exprText === itemName
			if (isItemHole) holes++
			else
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Expressions inside a reactive-list map body must be the bare item ({${itemName}}) — the slot fill; other expressions need per-item bindings outside the milestone-3 subset.`,
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
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.node.start,
					`Dynamic attribute \`${'name' in attr ? attr.name : attr.kind}\` inside a reactive-list map body — per-item attribute bindings are outside the milestone-3 subset`,
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
	node: TsrxNode,
	itemName: string,
	listSignal: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'element' }) | null => {
	const callback = asArray(node.arguments)[0] as TsrxNode | undefined
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
	const body = (callback?.body ?? null) as TsrxNode | null
	const blockBody = body
	let outputNode: TsrxNode | null = null
	if (body && isJsxNode(body)) outputNode = body
	if (!outputNode && blockBody && blockBody.type === 'BlockStatement') {
		for (const stmt of asArray(blockBody.body)) {
			if (stmt.type === 'ReturnStatement' && !outputNode) {
				const arg = stmt.argument as TsrxNode | undefined
				if (isJsxNode(arg)) outputNode = arg
			}
		}
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(ctx.source, node.start, 'map bodies must produce an output element'),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	// The item binding is the slot fill — reactive by position.
	markPositionallyReactive([output], new Set([itemName]))
	validateListBody(ctx, output, itemName)
	const forIR: ForIR = {
		itemName,
		indexName: null,
		keyText: null,
		keyName: null,
		listSignal,
		iterableText: text(ctx.source, (node.callee as TsrxNode).object as TsrxNode),
		iterableName: listSignal,
		hoisted: [],
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}

/* === Composed children validation (ported verbatim) === */

/**
 * Composed-element children: the markup between a composed element's tags
 * substitutes into the child's own template — anything that would need
 * CLIENT wiring is diagnosed instead of silently dropped.
 */
const validateComposedChildren = (
	ctx: ExtractContext,
	children: TemplateNode[],
): void => {
	const walk = (node: TemplateNode): void => {
		if (node.kind === 'text') return
		if (node.kind === 'expr') {
			if (node.lazy)
				ctx.diagnostics.push(
					diagnostic.composedElementUnsupported(
						ctx.source,
						node.node.start,
						'A lazy child expression',
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
						: 'A control-flow expression (ternary/map/boundary)',
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

/** Lower a composed (PascalCase) element (ported; classification reused). */
export const lowerComposeElement = (
	ctx: ExtractContext,
	element: TsrxNode,
	tag: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'compose' }) | null => {
	const source = ctx.composeImports.get(tag)
	if (!source) {
		ctx.diagnostics.push(
			diagnostic.unresolvedComposedComponent(ctx.source, element.start, tag),
		)
		return null
	}
	const opening = element.openingElement as TsrxNode | undefined
	const attrs: ComposeAttrIR[] = []
	if (isNode(opening) && Array.isArray(opening.attributes)) {
		for (const attr of asArray(opening.attributes)) {
			if (attr.type !== 'JSXAttribute') {
				ctx.diagnostics.push(
					diagnostic.unsupported(ctx.source, attr.start, 'Spread attributes on a composed element'),
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
	const children = lowerChildren(ctx, element, signals, fors)
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

/* === Child-expression lift (ported) === */

/**
 * Whether a plain `{expr}` child lifts into a `watch()` (ported from
 * `lower-template.ts`'s wrapper over `reactivity.ts`).
 */
const liftsToReactive = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	expr: TsrxNode,
	exprText: string,
	container: TsrxNode,
): boolean => {
	if (
		nodeType(expr) === 'Literal' &&
		typeof expr.value === 'string' &&
		ctx.exposedProps.has(String(expr.value))
	) {
		ctx.diagnostics.push(
			diagnostic.stringLiteralPropChild(ctx.source, container.start, String(expr.value)),
		)
		return false
	}
	const verdict = classifyChild(expr, signals)
	if (verdict.kind === 'opaque') {
		ctx.diagnostics.push(
			diagnostic.unliftableChild(ctx.source, container.start, verdict.names, exprText),
		)
		return false
	}
	if (verdict.kind === 'static' && containsImpureAmbient(expr))
		ctx.diagnostics.push(diagnostic.impureStaticChild(ctx.source, expr.start))
	return verdict.kind === 'reactive'
}

/* === Children / element lowering (adapted) === */

/**
 * Lower template children into IR. JSX text and expression containers are
 * the same shapes `@tsrx/core` produced; the directive slots become the
 * expression forms documented on the module.
 */
export const lowerChildren = (
	ctx: ExtractContext,
	parent: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode[] => {
	const out: TemplateNode[] = []
	const children =
		parent.type === 'JSXElement' || parent.type === 'JSXFragment'
			? asArray(parent.children)
			: []
	for (const child of children) {
		if (child.type === 'JSXText') {
			const collapsed = collapseJsxText(String(child.value ?? ''))
			if (collapsed) out.push({ kind: 'text', value: collapsed, node: child })
			continue
		}
		if (child.type === 'JSXExpressionContainer') {
			const expr = child.expression
			if (!isNode(expr)) continue
			// Control-flow shapes in child position (§5):
			if (
				expr.type === 'ConditionalExpression' ||
				(expr.type === 'LogicalExpression' && String(expr.operator) === '&&')
			) {
				const lowered = lowerIf(ctx, expr, signals, fors)
				if (lowered) out.push(lowered)
				continue
			}
			if (isMapCall(expr)) {
				const lowered = lowerFor(ctx, expr, signals, fors)
				if (lowered) out.push(lowered)
				continue
			}
			if (expr.type === 'CallExpression') {
				const calleeName = identifierName(expr.callee)
				if (calleeName === 'boundary') {
					const lowered = lowerBoundaryCall(ctx, expr, signals, fors)
					if (lowered) out.push(lowered)
					continue
				}
				if (asIife(expr)) {
					const fn = expr.callee as TsrxNode
					const body = fn.body as TsrxNode
					const inner = asArray(body.body)
					if (inner.some(s => s.type === 'SwitchStatement')) {
						const lowered = lowerSwitchIife(ctx, expr, signals, fors)
						if (lowered) out.push(lowered)
						continue
					}
					if (inner.some(s => s.type === 'TryStatement')) {
						const lowered = lowerTryIife(ctx, expr, signals, fors)
						if (lowered) out.push(lowered)
						continue
					}
					// A non-recognized IIFE is an ordinary expression child —
					// usually a string-producing block, legal and static.
				}
			}
			const exprText = text(ctx.source, expr)
			const bindsProp = bindsExposedArg(
				expr,
				ctx.argNames,
				ctx.exposedProps,
				signals,
				ctx.parserProps,
			)
			out.push({
				kind: 'expr',
				expr,
				exprText,
				lazy:
					bindsProp !== null ||
					liftsToReactive(ctx, signals, expr, exprText, child),
				...(bindsProp !== null ? { bindsProp } : {}),
				node: child,
			})
			continue
		}
		if (child.type === 'JSXElement') {
			const tag = jsxName(
				isNode(child.openingElement) ? child.openingElement.name : null,
			)
			if (tag === 'style') {
				// Style blocks become placeholder elements (tag 'style'); the
				// CSS is extracted from the raw source, never rendered.
				out.push({ kind: 'element', tag: 'style', attrs: [], children: [], node: child })
				continue
			}
			const lowered =
				tag && /^[A-Z]/.test(tag)
					? lowerComposeElement(ctx, child, tag, signals, fors)
					: lowerElement(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (child.type === 'JSXFragment') {
			out.push(...lowerChildren(ctx, child, signals, fors))
			continue
		}
	}
	return out
}

export const lowerElement = (
	ctx: ExtractContext,
	element: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode & { kind: 'element' } => {
	const opening = element.openingElement
	const tag = jsxName(isNode(opening) ? opening.name : null) ?? ''
	if (/^[A-Z]/.test(tag))
		ctx.diagnostics.push(
			diagnostic.composedElementUnsupported(
				ctx.source,
				element.start,
				`Composed element \`<${tag}>\` in this position (map output, or another non-child-list context)`,
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
			if (classified.kind === 'server' && containsImpureAmbient(classified.node))
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
		children: lowerChildren(ctx, element, signals, fors),
		node: element,
	}
}
