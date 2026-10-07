/**
 * The Children Region (ADR 0048 s1, LT-472): content a parent passes as
 * `children` belongs to the parent. At a compiled compose site the server
 * writes `data-children="<owner-tag>"` on the child's element that encloses
 * the `{children}` insertion; that element stays the child's, and its
 * descendants form the region.
 *
 * One module for the three consumers of that fact: the server emitter
 * (which element carries the marker, and whose tag it names), the registry
 * (what a child renders inside its region besides the content), and the
 * selector algebra (the runtime query's re-include clause, which the
 * lowered style guard shares — LT-473).
 */

import type { RenderedShape, TemplateNode } from './ir'
import { childNodes, walkTemplate } from './walk'

/* === Types === */

type ElementNode = Extract<TemplateNode, { kind: 'element' }>
type ComposeNode = Extract<TemplateNode, { kind: 'compose' }>

/** Where a template inserts its `children`, and how each insertion is marked. */
export type ChildrenInsertions = {
	/** Elements that directly enclose an insertion: each carries the marker. */
	holders: Set<ElementNode>
	/**
	 * Compose sites whose content is exactly `{children}`: the content passes
	 * straight through, so the original owner's tag rides along.
	 */
	forwards: Set<ComposeNode>
	/**
	 * An insertion sits in a compose site's content beside other content.
	 * That compose site's region is this component's, so no marker names the
	 * original owner of the inserted content.
	 */
	unmarked: boolean
}

/**
 * What a component renders around the content it inserts, recorded on its
 * registry entry (ADR 0048 s1). Present exactly when the template has a
 * `{children}` insertion.
 */
export type ChildrenRegion = {
	/**
	 * Every shape the component renders inside a marked element besides the
	 * inserted content — its own markup that shares the owner's region.
	 */
	shapes: RenderedShape[]
	/** Sources of the composed children the content is forwarded to. */
	forwards: string[]
	/** See {@link ChildrenInsertions.unmarked}. */
	unmarked: boolean
}

/* === Constants === */

/** The region marker attribute. */
export const CHILDREN_MARKER = 'data-children'

/* === Exported Functions === */

/** The bare `{children}` insertion point (ADR 0024 s10). */
export const isChildrenInsertion = (node: TemplateNode): boolean =>
	node.kind === 'expr' &&
	node.reactivity === 'server' &&
	node.expr.type === 'Identifier' &&
	node.exprText === 'children'

/** The selector for every region `tag` owns. */
export const ownRegion = (tag: string): string =>
	`[${CHILDREN_MARKER}="${tag}"]`

/**
 * Exclude the elements `terms` selects, except inside a region `owner`
 * owns — where only the terms rebased on that region still exclude:
 *
 * `:not(:is(<terms at outer>):not(:is(<region> *):not(:is(<terms at region>))))`
 *
 * `terms(prefix)` spells the excluded set below an anchor written as
 * `prefix` (`''` for none, `'<sel> '` otherwise). The runtime query passes
 * one `<child-tag> *` term per composed child; the lowered style guard
 * passes its boundary terms (LT-473). Same algebra, one spelling.
 */
export const excludeUnlessOwned = (
	owner: string,
	outerPrefix: string,
	terms: (prefix: string) => readonly string[],
): string => {
	const region = ownRegion(owner)
	return `:not(:is(${terms(outerPrefix).join(', ')}):not(:is(${region} *):not(:is(${terms(`${region} `).join(', ')}))))`
}

/**
 * Every `{children}` insertion under `root`, classified by the element or
 * compose site that encloses it. Control flow is transparent: an insertion
 * inside a server-rendered branch is enclosed by the element holding the
 * branch.
 */
export const childrenInsertionsOf = (
	root: TemplateNode,
): ChildrenInsertions => {
	const result: ChildrenInsertions = {
		holders: new Set(),
		forwards: new Set(),
		unmarked: false,
	}
	const visit = (
		node: TemplateNode,
		enclosing: ElementNode | ComposeNode | null,
	): void => {
		if (isChildrenInsertion(node)) {
			if (enclosing?.kind === 'element') result.holders.add(enclosing)
			else if (enclosing?.kind === 'compose') {
				const content = enclosing.children.filter(
					child => !(child.kind === 'text' && child.value.trim() === ''),
				)
				if (content.length === 1) result.forwards.add(enclosing)
				else result.unmarked = true
			}
			return
		}
		const next =
			node.kind === 'element' || node.kind === 'compose' ? node : enclosing
		for (const child of childNodes(node)) visit(child, next)
	}
	visit(root, null)
	return result
}

/**
 * The registry record of a template's Children Region, or `undefined` when
 * it inserts no `children`. `shapesOf` is the registry's own per-node shape
 * reading (`renderedShapesOf`), so both records describe an element alike;
 * the inserted content itself is not recorded.
 */
export const childrenRegionOf = (
	root: TemplateNode,
	shapesOf: (node: TemplateNode) => readonly RenderedShape[],
): ChildrenRegion | undefined => {
	const insertions = childrenInsertionsOf(root)
	if (
		insertions.holders.size === 0 &&
		insertions.forwards.size === 0 &&
		!insertions.unmarked
	)
		return undefined
	const shapes: RenderedShape[] = []
	for (const holder of insertions.holders)
		for (const child of holder.children)
			walkTemplate(child, node => {
				for (const shape of shapesOf(node))
					if (shape.kind !== 'children') shapes.push(shape)
			})
	return {
		shapes,
		forwards: [...insertions.forwards].map(node => node.source),
		unmarked: insertions.unmarked,
	}
}
