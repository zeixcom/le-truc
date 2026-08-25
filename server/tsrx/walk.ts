/**
 * The one structural `TemplateNode` visitor (LT-042, regrouping move M3 of
 * LE_TRUC_COMPILER.md §7). Traversal — element/compose children, `@if`
 * branches, `@switch` arms, `@try` arms, and the two cross-cutting rules
 * (whether `@pending` arms and composed children are entered) — is encoded
 * HERE, once; consumers express only what they collect per node.
 *
 * Scope note: walks whose recursion is itself the SEMANTICS stay with their
 * passes and are deliberately not expressed through this visitor — the
 * selector engine's branch-exclusivity counting (`countForSelector`'s
 * max-vs-sum arithmetic), the element-chain-only searches (`parentOf`,
 * `findHoleParent`, `findMirror`), depth-guarded (`hasDeepConstruct`) and
 * pass-interleaved walks (`recordSites`), and loop-output-scoped validation
 * in the front end. A new `TemplateNode` variant needs one `childNodes`
 * case here plus edits only in the modules that care about it.
 */

import type { AttributeIR, TemplateNode } from './ir'

/**
 * Immediate children of a node under the standard traversal, document order
 * preserved: element and compose children, both `@if` branches, every
 * `@switch` arm, and all present `@try` arms (pending last).
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
			return node.pendingChildren
				? [...node.children, ...node.catchChildren, ...node.pendingChildren]
				: [...node.children, ...node.catchChildren]
		default:
			return []
	}
}

export type WalkOptions = {
	/**
	 * Enter a `@try`'s `@pending` arm (async boundary). Default true.
	 * Consumers whose constructs cannot exist there (composed elements,
	 * ref declarations) pass false — preserving their pre-visitor reach.
	 */
	intoPending?: boolean
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
	const { intoPending = true, intoCompose = true } = options
	const walk = (current: TemplateNode, parent: TemplateNode | null): void => {
		visit(current, parent)
		if (current.kind === 'compose' && !intoCompose) return
		if (current.kind === 'try' && !intoPending) {
			for (const child of [...current.children, ...current.catchChildren])
				walk(child, current)
			return
		}
		for (const child of childNodes(current)) walk(child, current)
	}
	walk(node, null)
}

/**
 * Every `element`-kind attribute in traversal order (compose attributes are
 * `ComposeAttrIR`, a different vocabulary — deliberately not included, e.g.
 * compose `pass` thunks are not client-traced by import placement).
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
