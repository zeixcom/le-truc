/**
 * The one structural `TemplateNode` visitor (LT-042, regrouping move M3 of
 * LE_TRUC_COMPILER.md §7). Traversal — element/compose children, `@if`
 * branches, `@switch` arms, `@try` arms, and whether composed children are
 * entered — is encoded HERE, once; consumers express only what they collect
 * per node.
 *
 * `@pending` policy (LT-230, one ruling for every walk): an async boundary's
 * pending arm is RENDERED markup — the live winner while the task has no
 * value, and template content otherwise (ADR 0037 s4) — so every walk
 * enters it, as it enters every conditional arm. The arm admits only static
 * and server markup (`handleAsyncBoundary` rejects client constructs
 * there), so a walk looking for client constructs finds nothing and pays
 * nothing; a walk collecting what the DOM contains (compose sites, ids,
 * rendered props) must see it. A composed element nested below the pending
 * root is valid authoring — the LT-221 probe only covered a compose site AS
 * the root. Exclusivity arithmetic follows the same fact: one arm of a
 * boundary is in the document at a time, with or without a pending arm
 * (max).
 *
 * Authorized exceptions — walks whose recursion IS the semantics, so they
 * keep their own descent (structural steps still go through `childNodes`
 * where they apply):
 * - probe materialization: `serializeNodes`
 *   (`analysis/probe.ts`, LT-379/LT-382) — the selector proof's
 *   serializer, whose recursion threads each element's exclusive-arm path
 *   (stamped as an attribute the aggregation reads: max over exclusive
 *   arms, sum over coexisting ones);
 * - path-context threading: `refBranchGuard` (guard conjunction),
 *   `inOptionalBranch` (optional-`@if` flag), `checkFoldInputs` (lexical
 *   scope per arm);
 * - element-chain-only searches that deliberately stop at control flow
 *   other than `@if`: `enclosingIfOf`/`enclosingIfIn`, `findMirror`,
 *   `findHoleParent`, `hasClientConstructs`,
 *   `markPositionallyReactive`, and the depth-guarded `hasDeepConstruct`;
 * - pass-interleaved walks: `recordSites` (harvest), `emitTopEffects`
 *   (effect planning) and the server emitter (`emit`, `shape`);
 * - front-end validation scoped to one construct: a reactive-list body
 *   and a composed element's content (`lower-shared.ts`).
 *
 * A new `TemplateNode` variant needs one `childNodes` case here plus edits
 * only in the modules that care about it.
 */

import type {
	AttributeIR,
	ComponentIR,
	ForIR,
	ReconcileForIR,
	TemplateNode,
} from './ir'
import { attributeReactivity } from './reactivity'

/* === Conditionals === */

/** A conditional node (ADR 0043 s4), either construct, either mode. */
export type ConditionalNode = Extract<TemplateNode, { kind: 'conditional' }>
/** An `@if`/`@else` (or `.tsx` ternary/`&&`): arms `then` and `else`. */
export type IfNode = ConditionalNode & { construct: 'if' }
/** An `@switch`/`@case` (or `.tsx` switch IIFE): one arm per case. */
export type SwitchNode = ConditionalNode & { construct: 'switch' }

export const isIf = (node: TemplateNode | null | undefined): node is IfNode =>
	node?.kind === 'conditional' && node.construct === 'if'

export const isSwitch = (
	node: TemplateNode | null | undefined,
): node is SwitchNode =>
	node?.kind === 'conditional' && node.construct === 'switch'

/** An `@if`'s `then` branch. */
export const thenOf = (node: IfNode): TemplateNode[] =>
	node.arms[0]?.children ?? []

/** An `@if`'s `else` branch — empty when the conditional has none. */
export const elseOf = (node: IfNode): TemplateNode[] =>
	node.arms[1]?.children ?? []

/**
 * Does `node` switch its arms on the client through `reconcile()` (ADR
 * 0037) — a reactive conditional, or an async boundary (s4)?
 */
export const hasArmSet = (node: TemplateNode): boolean =>
	(node.kind === 'conditional' && node.mode === 'reactive') ||
	(node.kind === 'try' && node.pendingChildren !== null)

/**
 * An arm set's index: its position among the component's reactive
 * conditionals and async boundaries in document order. The server stamps it
 * on the arm templates (`data-arms`) and the client queries by it, so both
 * emitters derive it from the IR, never from emitter state.
 */
export const armSetOf = (root: TemplateNode, target: TemplateNode): number => {
	let index = -1
	let found = -1
	walkTemplate(root, node => {
		if (found >= 0 || !hasArmSet(node)) return
		index++
		if (node === target) found = index
	})
	return found
}

/**
 * A reactive list's index (ADR 0046 s2): its position among the component's
 * reconcile loops in document order (pre-order, so an outer list precedes
 * the lists nested in its item, LT-424). The server stamps it on the
 * extracted item template (`data-list`), hoisted to the host's end, and the
 * client queries it from the host (`:scope > template[data-list="N"]`), so
 * both emitters derive it from the IR, never from emitter state — the same
 * rule as `armSetOf`, and what lifts the one-list-per-component limit.
 */
export const listIndexOf = (
	root: TemplateNode,
	fors: ReadonlyMap<unknown, ForIR>,
	target: ReconcileForIR,
): number => {
	const outputs = new Set<TemplateNode>()
	for (const loop of fors.values())
		if (loop.kind === 'reconcile') outputs.add(loop.output)
	let index = -1
	let found = -1
	walkTemplate(root, node => {
		if (found >= 0 || !outputs.has(node)) return
		index++
		if (node === target.output) found = index
	})
	return found
}

/**
 * The reactive lists whose item holds `target`, outermost first (ADR 0046
 * s2): their item and key bindings are unbound wherever `target`'s list
 * template renders, because that template renders once, at the host's end.
 * A list is not counted as enclosing its own output.
 */
export const enclosingLists = (
	root: TemplateNode,
	fors: ReadonlyMap<unknown, ForIR>,
	target: TemplateNode,
): ReconcileForIR[] => {
	const byOutput = new Map<TemplateNode, ReconcileForIR>()
	for (const loop of fors.values())
		if (loop.kind === 'reconcile') byOutput.set(loop.output, loop)
	const search = (
		node: TemplateNode,
		stack: ReconcileForIR[],
	): ReconcileForIR[] | null => {
		if (node === target) return stack
		const own = byOutput.get(node)
		const inner = own ? [...stack, own] : stack
		for (const child of childNodes(node)) {
			const found = search(child, inner)
			if (found !== null) return found
		}
		return null
	}
	return search(root, []) ?? []
}

/**
 * Does `target` sit inside a Mount Scope other than the host (ADR 0046 s1)
 * — in an arm of an arm set, or inside a reactive-list item? Strict: an arm
 * set or a list is itself nested when its POSITION is, so a list whose
 * output sits in an arm is nested, and the item root is not counted as
 * inside its own item. A nested construct emits into its nearest enclosing
 * scope's mount (LT-424), never as a host-level query.
 */
export const inNestedScope = (
	root: TemplateNode,
	fors: ReadonlyMap<unknown, ForIR>,
	target: TemplateNode,
): boolean => {
	const outputs = new Set<TemplateNode>()
	for (const loop of fors.values())
		if (loop.kind === 'reconcile') outputs.add(loop.output)
	const search = (node: TemplateNode, scoped: boolean): boolean | null => {
		if (node === target) return scoped
		const inner = scoped || hasArmSet(node) || outputs.has(node)
		for (const child of childNodes(node)) {
			const found = search(child, inner)
			if (found !== null) return found
		}
		return null
	}
	return search(root, false) ?? false
}

/**
 * Immediate children of a node under the standard traversal, document order
 * preserved: element and compose children, every conditional arm, and all present `@try` arms (pending last, entered by
 * policy — see the module doc).
 */
export const childNodes = (node: TemplateNode): readonly TemplateNode[] => {
	switch (node.kind) {
		case 'element':
		case 'compose':
			return node.children
		case 'conditional':
			return node.arms.flatMap(arm => arm.children)
		case 'try':
			return [
				...node.children,
				...node.catchChildren,
				...(node.pendingChildren ?? []),
			]
		default:
			return []
	}
}

export type WalkOptions = {
	/**
	 * Recurse into composed children. Default true; the compose node itself
	 * is always visited. Consumers that treat composition as a boundary
	 * (element collection, compose-element collection) pass false.
	 */
	intoCompose?: boolean
}

/** Called once per visited node, pre-order, with its parent (null for the root). */
export type TemplateVisitor = (
	node: TemplateNode,
	parent: TemplateNode | null,
) => void

export const walkTemplate = (
	node: TemplateNode,
	visit: TemplateVisitor,
	options: WalkOptions = {},
): void => {
	const { intoCompose = true } = options
	const walk = (current: TemplateNode, parent: TemplateNode | null): void => {
		visit(current, parent)
		if (current.kind === 'compose' && !intoCompose) return
		for (const child of childNodes(current)) walk(child, current)
	}
	walk(node, null)
}

/**
 * Does `predicate` hold for any node under the standard traversal? Pre-order,
 * stopping at the first hit — the short-circuiting sibling of
 * {@link walkTemplate} for presence searches and first-offender validation.
 */
export const someNode = (
	node: TemplateNode,
	predicate: (node: TemplateNode) => boolean,
	options: WalkOptions = {},
): boolean => {
	const { intoCompose = true } = options
	const search = (current: TemplateNode): boolean =>
		predicate(current) ||
		(!(current.kind === 'compose' && !intoCompose) &&
			childNodes(current).some(search))
	return search(node)
}

/**
 * Every `element`-kind attribute in traversal order (compose attributes are
 * `ComposeAttrIR`, a different vocabulary — deliberately not included here;
 * `imports.ts`'s `clientExprNodes` walks compose `pass` thunks separately,
 * LT-088).
 */
export const collectAttrs = (
	node: TemplateNode,
	options?: WalkOptions,
): AttributeIR[] => {
	const out: AttributeIR[] = []
	walkTemplate(
		node,
		current => {
			if (current.kind === 'element') out.push(...current.attrs)
		},
		options,
	)
	return out
}

/**
 * Every composed (PascalCase) element in a component's template, for
 * cross-file resolution against the corpus-wide registry (ADR 0024
 * sub-design 10). Traversal via `walkTemplate` (LT-042): composition is a
 * boundary (composed children are the child component's own template);
 * `@pending` arms are entered like every arm (LT-230) — a compose site
 * nested below the pending root renders and must resolve.
 *
 * Lives at the machinery level (LT-206): a pure `ComponentIR` walk the
 * shared pipeline consumes, so the machinery does not depend on a front
 * end for it.
 */
export const collectComposeElements = (
	component: ComponentIR,
): Array<TemplateNode & { kind: 'compose' }> => {
	const out: Array<TemplateNode & { kind: 'compose' }> = []
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'compose') out.push(node)
	}
	walkTemplate(component.root, visit, { intoCompose: false })
	for (const loop of component.fors.values())
		walkTemplate(loop.output, visit, { intoCompose: false })
	return out
}

/**
 * Does this attribute carry a client construct — something the client
 * module binds or addresses (LT-231: the one answer; every "has its own
 * client construct" check derives from it)? Read off the recorded class
 * (ADR 0040 s7, none re-derives): a `reactive` value is bound — including
 * LT-122's arg-and-prop `server` attribute and a reactive `truc:html` — and
 * the kinds with no template value (event, `truc:pass`, ref) are addressed.
 * A `static` or `server` value — a non-reactive `truc:html={ref}` included
 * (LT-025) — is render-only.
 */
export const isClientConstructAttr = (a: AttributeIR): boolean => {
	const reactivity = attributeReactivity(a)
	return reactivity === 'reactive' || reactivity === null
}
