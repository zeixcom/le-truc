/**
 * Template lowering: JSX/`@if`/`@switch`/`@try`/`@for` → `TemplateNode` IR.
 * Mutually recursive by nature (an element's children may themselves be
 * control-flow directives or nested elements), so this cluster moves as one
 * unit — `compiler.ts`'s `compileSource` calls in at `lowerChildren` for the
 * component's root template.
 */

import type { TsrxNode } from '@tsrx/core'
import {
	asArray,
	attrName,
	collapseJsxText,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	jsxName,
	text,
} from './ast-utils'
import {
	classifyAttribute,
	classifyComposeAttribute,
} from './classify-attributes'
import type {
	AttributeIR,
	ComposeAttrIR,
	ExtractContext,
	ForIR,
	SignalIR,
	TemplateNode,
} from './compiler'
import { isForOfNode } from './compiler'
import { diagnostic } from './diagnostics'

/**
 * Validate a control-flow condition (`@if` test, `@switch` discriminant):
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

/**
 * Lower an `@if` directive: the condition must be server-known at render
 * time (args, setup names, globals) — client-side conditional rendering is
 * outside the enhance-don't-render model. Branch bodies lower like any
 * children; client constructs must sit on the branch ROOT elements (the
 * analyzer union-addresses them).
 */
export const lowerIf = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
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
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
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
	for (const raw of rawCases as TsrxNode[]) {
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
 * dropped.
 */
const lowerBodyStatements = (
	ctx: ExtractContext,
	statements: unknown,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
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
					? lowerComposeElement(ctx, stmt, tag)
					: lowerElement(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXText') {
			const collapsed = collapseJsxText(String(stmt.value ?? ''))
			if (collapsed) out.push({ kind: 'text', value: collapsed })
			continue
		}
		if (stmt.type === 'JSXFragment') {
			out.push(...lowerChildren(ctx, stmt, signals, fors))
			continue
		}
		if (isForOfNode(stmt)) {
			const lowered = lowerFor(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
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
 * Lower an `@try { … } @catch (e) { … }` error boundary: a render-time
 * boundary — the server renders the body inside a real try/catch, so a
 * throwing server expression falls back to the catch arm. `@pending` arms
 * (async boundaries) are gated until the LT-012 lowering lands
 * (deriveCell(async …) + isPending(signal) branch routing — the async data
 * itself is authorable today); `@finally` is gated outright.
 */
export const lowerTry = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const lowerBlock = (block: unknown): TemplateNode[] =>
		lowerBodyStatements(
			ctx,
			isNode(block) && Array.isArray(block.body) ? block.body : [],
			signals,
			fors,
		)
	if (isNode(node.pending)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.pending.start,
				'@pending arms (async boundaries) await their lowering (LT-012): deriveCell(async …, { initial }) + isPending(signal) branch routing. Async data itself is authorable today — the await lives inside the async arrow, which is legal in the sync setup. Use @try/@catch (a render-time error boundary) meanwhile',
			),
		)
		return null
	}
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
	return {
		kind: 'try',
		children,
		catchParam,
		catchChildren,
		pendingChildren: null,
		node,
	}
}

/**
 * Lower a composed (PascalCase) element: resolve its tag against the file's
 * `import { Name } from '….tsrx'` map, classify attributes as server args
 * (regardless of value shape), `ref`, or `pass={{ }}` (client-prop interop,
 * ADR 0023 sub-design 10), and diagnose the constructs this milestone does
 * not support yet — children (default-slot substitution, follow-up task).
 */
export const lowerComposeElement = (
	ctx: ExtractContext,
	element: TsrxNode,
	tag: string,
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
	const hasChildren = asArray(element.children).some(
		child =>
			child.type !== 'JSXText' ||
			collapseJsxText(String(child.value ?? '')) !== '',
	)
	if (hasChildren)
		ctx.diagnostics.push(
			diagnostic.composedElementUnsupported(
				ctx.source,
				element.start,
				'Children (default-slot substitution)',
			),
		)
	return {
		kind: 'compose',
		component: tag,
		source,
		attrs,
		children: [],
		node: element,
	}
}

/**
 * Lower template children into IR. `&{expr}` arrives from the parser as a
 * `JSXText("&")` node immediately preceding a `JSXExpressionContainer` —
 * the sigil is detected by that adjacency.
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
	let i = 0
	while (i < children.length) {
		const child = children[i] as TsrxNode
		if (child.type === 'JSXText') {
			const next = children[i + 1] as TsrxNode | undefined
			const raw = String(child.value ?? '')
			// `&{expr}` lazy child: the parser emits the sigil as a text node
			// ENDING in '&' immediately before the expression container — the
			// '&' may carry leading whitespace when formatted on its own line.
			if (next?.type === 'JSXExpressionContainer' && raw.endsWith('&')) {
				const leading = collapseJsxText(raw.slice(0, -1))
				if (leading) out.push({ kind: 'text', value: leading })
				const expr = next.expression
				if (isNode(expr))
					out.push({
						kind: 'expr',
						expr,
						exprText: text(ctx.source, expr),
						lazy: true,
						node: next as TsrxNode,
					})
				i += 2
				continue
			}
			const collapsed = collapseJsxText(raw)
			if (collapsed) out.push({ kind: 'text', value: collapsed })
			i += 1
			continue
		}
		if (child.type === 'JSXExpressionContainer') {
			const expr = child.expression
			if (isNode(expr))
				out.push({
					kind: 'expr',
					expr,
					exprText: text(ctx.source, expr),
					lazy: false,
					node: child,
				})
			i += 1
			continue
		}
		if (isForOfNode(child)) {
			const lowered = lowerFor(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXIfExpression') {
			const lowered = lowerIf(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXSwitchExpression') {
			const lowered = lowerSwitch(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXTryExpression') {
			const lowered = lowerTry(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
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
			i += 1
			continue
		}
		if (child.type === 'JSXStyleElement') {
			// Style blocks become placeholder elements (tag 'style'); the CSS
			// is extracted via getStyleElementStylesheet, never rendered.
			out.push({
				kind: 'element',
				tag: 'style',
				attrs: [],
				children: [],
				node: child,
			})
			i += 1
			continue
		}
		if (child.type === 'JSXElement') {
			const tag = jsxName(
				isNode(child.openingElement) ? child.openingElement.name : null,
			)
			const lowered =
				tag && /^[A-Z]/.test(tag)
					? lowerComposeElement(ctx, child, tag)
					: lowerElement(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXFragment') {
			out.push(...lowerChildren(ctx, child, signals, fors))
			i += 1
			continue
		}
		i += 1
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
				`Composed element \`<${tag}>\` in this position (@for output, or another non-child-list context)`,
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
			const classified = classifyAttribute(ctx, attr)
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
	return {
		kind: 'element',
		tag,
		attrs,
		children: lowerChildren(ctx, element, signals, fors),
		node: element,
	}
}

/**
 * Lower a `@for` loop. Server-data iterables lower to `each()`; reactive
 * `createList` iterables to the milestone-3 reconcile lowering; other
 * reactive sources stay gated (TSRX001).
 */
export const lowerFor = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
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
	if (isNode(node.empty)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(ctx.source, node.start, '@empty blocks'),
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
	const bodyStmts = isNode(node.body) ? asArray(node.body.body) : []
	const hoisted: ForIR['hoisted'] = []
	let outputNode: TsrxNode | null = null
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
	const forIR: ForIR = {
		itemName,
		indexName: identifierName(node.index),
		keyText: isNode(node.key) ? text(ctx.source, node.key) : null,
		keyName: isNode(node.key) ? identifierName(node.key) : null,
		listSignal: null,
		iterableText: text(ctx.source, node.right as TsrxNode),
		iterableName,
		hoisted,
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}

/**
 * Validate the reactive-list body shape (ADR 0023 sub-design 5): statics and
 * event attributes anywhere, exactly one lazy `&{item}` hole (the slot fill),
 * no dynamic attributes, refs, or non-item expressions — those need per-item
 * client bindings beyond the slot-fill contract and are gated so the emitted
 * template is provably complete.
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
				node.lazy &&
				node.expr.type === 'Identifier' &&
				node.exprText === itemName
			if (isItemHole) holes++
			else if (node.lazy)
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Lazy children inside a reactive-list @for body must be the bare item (&{${itemName}}) — the slot fill. &{${node.exprText}} needs per-item bindings outside the milestone-3 subset.`,
					),
				)
			else
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Expressions inside a reactive-list @for body must be lazy (&{${itemName}}) — server-data interpolation {${node.exprText}} has no per-item client binding.`,
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
			else
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Dynamic attribute \`${'name' in attr ? attr.name : attr.kind}\` inside a reactive-list @for body — per-item attribute bindings are outside the milestone-3 subset`,
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
				`A reactive-list @for body must render the item exactly once via &{${itemName}} — that hole is the template slot the client fills (found ${holes}).`,
			),
		)
	}
}

export const lowerListFor = (
	ctx: ExtractContext,
	node: TsrxNode,
	itemName: string,
	listSignal: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
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
	let outputNode: TsrxNode | null = null
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
	validateListBody(ctx, output, itemName)
	const forIR: ForIR = {
		itemName,
		indexName: null,
		keyText: isNode(node.key) ? text(ctx.source, node.key) : null,
		keyName,
		listSignal,
		iterableText: text(ctx.source, node.right as TsrxNode),
		iterableName: listSignal,
		hoisted: [],
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}
