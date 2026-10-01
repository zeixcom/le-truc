/**
 * The one structural `TemplateNode` visitor (LT-042, regrouping move M3 of
 * LE_TRUC_COMPILER.md §7). Traversal — element/compose children, `@if`
 * branches, `@switch` arms, `@try` arms, and whether composed children are
 * entered — is encoded HERE, once; consumers express only what they collect
 * per node.
 *
 * `@pending` policy (LT-230, one ruling for every walk): an async boundary's
 * pending arm is RENDERED markup — the server writes all three arms and the
 * client toggles `hidden` (ADR 0023 sub-design 13) — so every walk enters it.
 * The arm admits only static and server markup (`handleAsyncBoundary`
 * rejects client constructs there), so a walk looking for client constructs
 * finds nothing and pays nothing; a walk collecting what the DOM contains
 * (compose sites, ids, rendered props) must see it. A composed element
 * nested below the pending root is valid authoring — the LT-221 probe only
 * covered a compose site AS the root. Exclusivity arithmetic follows the
 * same fact: with a pending arm present the arms coexist (sum); without
 * one, body XOR catch renders (max).
 *
 * Authorized exceptions — walks whose recursion IS the semantics, so they
 * keep their own descent (structural steps still go through `childNodes`
 * where they apply):
 * - exclusivity counting: `countForSelector`, `countComposeBySource`
 *   (max-vs-sum per construct; `analysis/selectors.ts`, riding LT-245);
 * - path-context threading: `refBranchGuard` (guard conjunction),
 *   `inOptionalBranch` (optional-`@if` flag), `checkFoldInputs` (lexical
 *   scope per arm);
 * - element-chain-only searches that deliberately stop at control flow
 *   other than `@if`: `enclosingIfOf`/`enclosingIfIn`, `findMirror`,
 *   `parentOf`, `findHoleParent`, `hasClientConstructs`,
 *   `markPositionallyReactive`, and the depth-guarded `hasDeepConstruct`;
 * - pass-interleaved walks: `recordSites` (harvest), `emitTopEffects`
 *   (effect planning) and the server emitter (`emit`, `shape`);
 * - front-end validation scoped to one construct: a reactive-list body
 *   and a composed element's content (`lower-shared.ts`).
 *
 * A new `TemplateNode` variant needs one `childNodes` case here plus edits
 * only in the modules that care about it.
 */

import type { AttributeIR, ComponentIR, TemplateNode } from './ir'

/**
 * Immediate children of a node under the standard traversal, document order
 * preserved: element and compose children, both `@if` branches, every
 * `@switch` arm, and all present `@try` arms (pending last, entered by
 * policy — see the module doc).
 */
export const childNodes = (node: TemplateNode): readonly TemplateNode[] => {
	switch (node.kind) {
		case 'element':
		case 'compose':
			return node.children
		case 'if':
			return [...node.then, ...node.alternate]
		case 'switch':
			return node.cases.flatMap(arm => arm.children)
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
 * cross-file resolution against the corpus-wide registry (ADR 0023
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
 * client construct" check derives from it)? Every kind but `static`, with
 * two exceptions: a `server` attribute is render-only unless LT-122's
 * arg-and-prop coincidence (`bindsProp`) makes it bind too, and a
 * non-reactive `truc:html={ref}` is server-rendered only (LT-025) — the
 * reactive form lowers to a `dangerouslyBindInnerHTML` watch.
 */
export const isClientConstructAttr = (a: AttributeIR): boolean =>
	(a.kind === 'server' ? a.bindsProp != null : a.kind !== 'static') &&
	!(a.kind === 'html' && !a.reactive)
