/**
 * Query-table naming (LT-022, regrouping move M5): variable-name allocation
 * for the generated factory and the deduplicating query table. One home for
 * "what is this element called client-side".
 */

import type { ComponentIR } from '../ir'
import type { QueryPlan } from './plan'

/**
 * The next free variable name from `base` (`base`, `base2`, `base3`, …),
 * claiming it in `usedNames` — the factory's own closure names (queries,
 * rebindings) must never collide with signals, refs, or the context
 * destructuring.
 */
export const uniqueName = (usedNames: Set<string>, base: string): string => {
	let name = base
	let n = 2
	while (usedNames.has(name)) name = `${base}${n++}`
	usedNames.add(name)
	return name
}

/**
 * Register (or reuse) one element query and return its variable name.
 * Deduplicates by selector+cardinality across the whole analysis — two
 * constructs addressing the same element share one query — and records
 * registry-child tags for the generated client's type-flow side-effect
 * imports (the tag-map augmentation lives in the child's module).
 */
export const addQuery = (
	usedNames: Set<string>,
	queries: QueryPlan[],
	childTags: Set<string>,
	component: ComponentIR,
	registry: ReadonlySet<string>,
	base: string,
	selector: string,
	cardinality: 'one' | 'many' | 'maybe',
	explicitType?: string,
): string => {
	// LT-123: an author-declared optional ref stays optional
	// however unconditional its site looks — the component's
	// markup may be page-authored, and a page may omit a child
	// this template would have rendered.
	const effective: 'one' | 'many' | 'maybe' =
		cardinality === 'one' && component.optionalRefs.has(base)
			? 'maybe'
			: cardinality
	const existing = queries.find(
		q => q.selector === selector && q.cardinality === effective,
	)
	if (existing) return existing.name
	// Addressing another registry component means needing its element
	// interface — the generated client imports its module for the tag-map
	// augmentation (type flow by projection).
	const tag = selector.match(/^[a-z][a-z0-9-]*/)?.[0] ?? ''
	if (
		tag.includes('-') &&
		tag !== component.tag &&
		registry.has(tag) &&
		!childTags.has(tag)
	)
		childTags.add(tag)
	const name = uniqueName(usedNames, base)
	// A `first()`-declared reference's own required-reason text (LT-055)
	// flows into the generated MissingElementError message verbatim — the
	// one part of the author's call the compiler doesn't resynthesize (the
	// selector itself stays compiler-proven, same as `ref={}` before it).
	const message =
		component.refReasons.get(base) ?? `${component.tag}: ${selector} missing`
	queries.push(
		explicitType
			? { name, selector, cardinality: effective, message, explicitType }
			: { name, selector, cardinality: effective, message },
	)
	return name
}
