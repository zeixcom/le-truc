/**
 * Loop planning (LT-022, regrouping move M5): Pass 1 — server-data `@for`
 * → `each()` plans (output selector, collection naming, hoisted-const
 * rebinding, loop-scoped effects); Pass 1b — reactive-list `@for` over a
 * declared `createList` → `reconcile()` plans (container addressing, the
 * `data-list` stamp, the item hole; the item's Mount Scope itself is planned
 * in pass 4, analysis/effects.ts).
 */

import type { AstNode } from '../ast-node'
import { hostPropOf, nodeType, objectKeys, sanitizeVarName } from '../ast-utils'
import { diagnostic } from '../diagnostics'
import { dependenciesOf } from '../evaluability'
import type {
	AttributeIR,
	EachForIR,
	ReconcileForIR,
	TemplateNode,
} from '../ir'
import { wordingOf } from '../surface'
import { isDirtyFlagControlAttr } from '../vocabulary'
import {
	inNestedScope,
	isClientConstructAttr,
	listIndexOf,
	walkTemplate,
} from '../walk'
import { reportServerOnlyNames } from './effects'
import { returnsNumber } from './harvest'
import type {
	ForClientPlan,
	LoopEffectPlan,
	LoopPlans,
	PassShared,
	RebindingPlan,
	ReconcilePlan,
} from './plan'
import {
	type ElementNode,
	isElement,
	resolveScopedSelector,
	resolveSelector as resolveSelectorIn,
	resolveSelectorIn as resolveSelectorScoped,
	staticAttrs,
} from './selectors'

/* === Internal Functions === */

/**
 * A client construct a server-data loop body addresses (LT-231: derived
 * from the one `isClientConstructAttr` answer). A `ref` is not one: its
 * `first()` query addresses the element itself, never per item.
 */
const isLoopConstruct = (a: AttributeIR): boolean =>
	isClientConstructAttr(a) && a.kind !== 'ref'

/** A loop construct `each()` has no lowering for — reported, not dropped. */
const isLoopUnloweredConstruct = (a: AttributeIR): boolean =>
	isLoopConstruct(a) &&
	a.kind !== 'reactive' &&
	a.kind !== 'class-map' &&
	a.kind !== 'event'

/** How a loop-body diagnostic names an unlowered construct. */
const loopConstructLabel = (a: AttributeIR): string => {
	switch (a.kind) {
		case 'style-map':
			return 'A reactive style map'
		case 'html':
			return 'A reactive `html` binding'
		case 'pass':
			return 'A `pass` binding'
		default:
			return `The prop-bound attribute \`${'name' in a ? a.name : a.kind}\``
	}
}

/** What planning one server-data loop reads from the pass context. */
type EachLoopContext = Pick<
	PassShared,
	| 'component'
	| 'source'
	| 'diagnostics'
	| 'addQuery'
	| 'usedNames'
	| 'collectAmbient'
	| 'badFreeNames'
	| 'badListBodyNames'
>

/**
 * One server-data `@for` → its `each()` plan (output selector, collection
 * naming, hoisted-const rebinding, loop-scoped effects), or null when the
 * body binds nothing. `scope` places a loop nested in a Mount Scope (ADR
 * 0046 s2, LT-424): its items are fixed for the life of the clone, so the
 * collection is a static query against the scope root (`root`, the root's
 * local; `tree`, the root element the selector is proved within) — no
 * `all()`, no MutationObserver. A host-level loop (`scope` null) keeps the
 * `each(all())` collection query.
 */
export const planEachLoop = (
	shared: EachLoopContext,
	loop: EachForIR,
	scope: { root: string; tree: ElementNode } | null,
): ForClientPlan | null => {
	const {
		component,
		source,
		diagnostics,
		addQuery,
		usedNames,
		collectAmbient,
		badListBodyNames,
	} = shared
	const wording = wordingOf(component)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const output = loop.output
	const loopBound = new Set<string>([loop.itemName])
	if (loop.indexName) loopBound.add(loop.indexName)
	// Map hoisted const → attribute it was rendered into as a bare value.
	const constAttr = new Map<string, string>()
	for (const attr of output.attrs) {
		if (attr.kind === 'server' && nodeType(attr.node) === 'Identifier')
			constAttr.set(attr.exprText, attr.name)
	}

	const referencedConsts = new Set<string>()
	/**
	 * Validate free names of a client construct inside the loop: loop
	 * variables are the hoist-first error; referenced hoisted consts are
	 * rebuilt per item; anything else follows the positive server-only
	 * rule (`badListBodyNames`, LT-349).
	 */
	const checkClientNames = (node: AstNode, what: string): void => {
		collectAmbient(node)
		const free = dependenciesOf(node)
		const loopRefs = [...free].filter(name => loopBound.has(name))
		if (loopRefs.length > 0) {
			diagnostics.push(
				diagnostic.loopVariableInReactiveThunk(source, node, loopRefs),
			)
			return
		}
		for (const name of free)
			if (loop.hoisted.some(h => h.name === name)) referencedConsts.add(name)
		reportServerOnlyNames(
			shared,
			node,
			`${what} inside the ${wording.loop} body`,
			badListBodyNames(node).filter(name => !referencedConsts.has(name)),
		)
	}

	/** Each referenced hoisted const, re-read off the item element. */
	const rebindingsFor = (itemParam: string): RebindingPlan[] => {
		const rebindings: RebindingPlan[] = []
		for (const hoisted of loop.hoisted) {
			if (!referencedConsts.has(hoisted.name)) continue
			const attr = constAttr.get(hoisted.name)
			if (!attr) {
				diagnostics.push(
					diagnostic.constNotRebindable(
						source,
						hoisted.node,
						hoisted.name,
						output.tag,
					),
				)
				continue
			}
			rebindings.push({
				name: hoisted.name,
				expr:
					attr === 'id'
						? `${itemParam}.id`
						: `${itemParam}.getAttribute('${attr}')!`,
			})
		}
		return rebindings
	}

	const effectsPlan: LoopEffectPlan[] = []
	const collectAttrs = (el: ElementNode, target: string | null): void => {
		for (const attr of el.attrs) {
			if (attr.kind === 'reactive') {
				checkClientNames(attr.thunk, `Reactive attribute \`${attr.name}\``)
				// LT-116: same dispatch rule the top-level path applies —
				// a bare host-prop mirror OR a dirty-flag IDL attr
				// (`value`/`checked`/`selected`) on a native form control
				// lowers to a property write. Inside `each()` this is
				// exactly what the hand-written twin did
				// (`radio.checked = isChecked`): once the user clicks a
				// radio, attribute removal no longer clears the live
				// property, so `bindAttribute` mirrors stop tracking and
				// mutual exclusion breaks (NOTES LT-092).
				const mirror = hostPropOf(attr.thunk)
				effectsPlan.push({
					kind: 'watch-attr',
					attr: attr.name,
					thunkText: attr.thunkText,
					dispatch:
						mirror !== null || isDirtyFlagControlAttr(el.tag, attr.name)
							? 'property'
							: 'attribute',
					coerceToString: returnsNumber(attr.thunk.body, component.signals),
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
					target,
				})
			} else if (attr.kind === 'class-map') {
				checkClientNames(attr.object, 'Reactive class map')
				effectsPlan.push({
					kind: 'watch-class',
					keys: objectKeys(attr.object),
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
					target,
				})
			} else if (attr.kind === 'event') {
				checkClientNames(attr.handler, `Event handler \`${attr.name}\``)
				effectsPlan.push({
					kind: 'on',
					event: attr.event,
					handlerText: attr.handlerText,
					sourceStart: attr.handler.start,
					sourceEnd: attr.handler.end,
					target,
				})
			} else if (isLoopUnloweredConstruct(attr)) {
				// LT-231: any other client construct used to be dropped
				// without a word — compiled clean, never bound.
				diagnostics.push(
					diagnostic.unsupported(
						source,
						el.node,
						`${loopConstructLabel(attr)} on an element in a server-data ${wording.loop} body`,
						'`each()` binds reactive attributes, class maps and event handlers only — bind it outside the loop, or render the value from server data.',
					),
				)
			}
		}
	}
	collectAttrs(output, null)
	// LT-037: descendants of the loop's output root (nested inside its
	// own subtree — a native <input> inside a wrapping <label>, etc.)
	// get their reactive attrs/events addressed too, via a selector
	// resolved WITHIN the output's own subtree (never the whole
	// template — the same element shape repeats once per item, so a
	// selector unique against the global template would be meaningless;
	// `resolveSelectorIn(output, descendant)` scopes the uniqueness
	// count to just this one item's rendered markup instead).
	const collectDescendants = (el: ElementNode): void => {
		for (const child of el.children) {
			if (child.kind !== 'element') continue
			const hasConstruct = child.attrs.some(isLoopConstruct)
			if (hasConstruct) {
				const resolved = resolveSelectorScoped(
					output,
					child,
					component.composedShapes,
				)
				if (!resolved.unique) {
					diagnostics.push(
						diagnostic.unaddressableElement(
							source,
							child.node,
							`No unique selector for <${child.tag}> inside the ${wording.loop} output <${output.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
						),
					)
				}
				collectAttrs(child, resolved.selector)
			}
			collectDescendants(child)
		}
	}
	collectDescendants(output)
	const gatedLazyChild = (node: TemplateNode): unknown => {
		if (node.kind === 'expr' && node.reactivity === 'reactive') {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node,
					`A lazy child in a server-data ${wording.loop} body`,
					'An `each()` scope owns no template slot to bind it to — render the value from server data, or bind it reactively on an attribute of the item element.',
				),
			)
		}
		if (node.kind === 'element')
			for (const child of node.children) gatedLazyChild(child)
		return undefined
	}
	gatedLazyChild(loop.output)

	// LT-322: a body with no client constructs needs no `each()` — and no
	// collection query, whose required form would throw on an empty list.
	if (effectsPlan.length === 0) return null
	if (scope !== null) {
		// The scope's static query: proved within the scope root, so it
		// matches nothing in a nested scope's content (ADR 0046 s2).
		const scoped = resolveScopedSelector(
			scope.tree,
			output,
			component.composedShapes,
		)
		if (!scoped.unique)
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node,
					`No unique selector for the ${wording.loop} output <${output.tag}> inside its scope root <${scope.tree.tag}> — no \`class\`, \`role\`, \`data-*\` attribute or child path tells it apart from the other elements there, nested arms and list items included. Give it a unique \`class\`.`,
				),
			)
		const rebindings = rebindingsFor(loop.itemName)
		return {
			collection: '',
			scoped: { root: scope.root, selector: scoped.selector },
			itemParam: loop.itemName,
			rebindings,
			effects: effectsPlan,
		}
	}
	const { selector, unique } = resolveSelector(output)
	if (!unique) {
		diagnostics.push(
			diagnostic.unaddressableElement(
				source,
				output.node,
				`No unique selector for the ${wording.loop} output <${output.tag}> in the rendered template — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
			),
		)
	}
	// Collection naming: the iterable's name when still free, else the
	// plural of the output's role (last segment), else tag + 's'.
	const roleValue = staticAttrs(output).get('role')
	const fallbackBase =
		roleValue !== undefined && roleValue !== null
			? `${roleValue.split('-').pop() ?? roleValue}s`
			: `${output.tag}s`
	const base =
		loop.iterableName && !usedNames.has(loop.iterableName)
			? loop.iterableName
			: fallbackBase
	const collection = addQuery(base, selector, 'many')

	const itemParam =
		loop.itemName === collection ? `${loop.itemName}El` : loop.itemName
	return {
		collection,
		scoped: null,
		itemParam,
		rebindings: rebindingsFor(itemParam),
		effects: effectsPlan,
	}
}

/**
 * Pass 1: server-data `@for` → `each()` plans at host level. A loop nested
 * in a Mount Scope (an arm, a reactive-list item) is planned with its scope
 * in pass 4 (`analysis/effects.ts`, LT-424).
 */
const runEachLoops = (shared: PassShared): Map<EachForIR, ForClientPlan> => {
	const { component } = shared
	const forPlans = new Map<EachForIR, ForClientPlan>()
	for (const loop of component.fors.values()) {
		if (loop.kind !== 'each') continue // reactive loops → runReconcileLoops
		if (inNestedScope(component.root, component.fors, loop.output)) continue
		const plan = planEachLoop(shared, loop, null)
		if (plan) forPlans.set(loop, plan)
	}
	return forPlans
}

/**
 * The list owns its container's children (ADR 0017) — the sibling checks,
 * for a host-level list and a nested one alike.
 */
const checkContainerSiblings = (
	shared: Pick<PassShared, 'component' | 'source' | 'diagnostics'>,
	loop: ReconcileForIR,
	container: ElementNode,
): void => {
	const { source, diagnostics } = shared
	const wording = wordingOf(shared.component)
	const output = loop.output
	// The list owns its container's children (ADR 0017): an authored
	// element beside the loop that carries no `data-unreconciled` is
	// removed on the list's first run (LT-186, the compiler half of
	// LT-185's DEV_MODE advisory). An authored `data-key` is no
	// exemption (LT-431): `reconcile()` removes a key the source lacks
	// and adopts a matching one as that item. A server-mode
	// conditional renders its taken arm's elements as container
	// children, so every arm is checked — the winner depends on render
	// args — with the same rules, recursing into a nested one; text
	// needs none (`reconcile()` classifies elements only). A non-async
	// `try` is walked the same way, body and catch arm. Arm sets in
	// the container (a reactive conditional, an async boundary) are
	// LTC063's — their inert templates can never be container children
	// through a legal compile — and the `@empty` arm's roots also sit
	// here as `output`'s siblings, but the server stamps them
	// `data-unreconciled`, so they are exempt. A composed element's
	// attributes are ComposeAttrIR (ref/arg/pass), so it can carry no
	// `data-unreconciled` and its fix-it moves it out.
	const exempt = new Set(loop.emptyArm ?? [])
	const checkSiblings = (children: TemplateNode[]): void => {
		for (const child of children) {
			if (child === output || exempt.has(child)) continue
			if (child.kind === 'compose') {
				diagnostics.push(
					diagnostic.unkeyedSiblingInReconcileContainer(
						source,
						child.node,
						child.component,
						true,
						wording,
					),
				)
			} else if (
				child.kind === 'element' &&
				!child.attrs.some(a => 'name' in a && a.name === 'data-unreconciled')
			) {
				diagnostics.push(
					diagnostic.unkeyedSiblingInReconcileContainer(
						source,
						child.node,
						child.tag,
						false,
						wording,
					),
				)
			} else if (child.kind === 'conditional' && child.mode === 'server') {
				for (const arm of child.arms) checkSiblings(arm.children)
			} else if (child.kind === 'try' && child.pendingChildren === null) {
				// A non-async boundary is server-rendered too: the body or
				// the catch arm wins on whether the body throws at render.
				checkSiblings(child.children)
				checkSiblings(child.catchChildren)
			}
		}
	}
	checkSiblings(container.children)
}

/**
 * The item value's DOM site for an arg-seeded List's harvest (ADR 0003): the
 * scoped selector of the first bare `{item}` hole's parent, or null.
 */
const holeSelectorOf = (
	component: PassShared['component'],
	loop: ReconcileForIR,
): string | null => {
	const output = loop.output
	// The FIRST bare `{item}` hole's parent element — the item value's
	// DOM site, used by the arg-seeded List's harvest read (ADR 0003).
	// The item may render through several holes now (each gets its own
	// watch); the harvest reads the first in document order, the same
	// canonical-site rule every harvest follows.
	const findHoleParent = (node: TemplateNode): ElementNode | null => {
		// A hole may sit inside a server-rendered conditional's arm — the
		// item text is as per-item there as anywhere (ADR 0046 s1).
		if (node.kind === 'conditional' && node.mode === 'server') {
			for (const arm of node.arms)
				for (const armChild of arm.children) {
					const found = findHoleParent(armChild)
					if (found) return found
				}
			return null
		}
		if (!isElement(node)) return null
		for (const child of node.children) {
			if (
				child.kind === 'expr' &&
				child.reactivity === 'reactive' &&
				child.exprText === loop.itemName
			)
				return node
			const found = findHoleParent(child)
			if (found) return found
		}
		return null
	}
	const holeParent = findHoleParent(output)
	const holeSelector = holeParent
		? resolveSelectorScoped(output, holeParent, component.composedShapes)
				.selector
		: null
	return holeSelector
}

/**
 * Pass 1b: reactive-list `@for` over a declared `createList` →
 * `reconcile()` plans (container addressing, the `data-list` stamp, the
 * item hole). The item's OWN effects — its Mount Scope (ADR 0046 s1) — are
 * planned in pass 4 (`planReconcileItem`, analysis/effects.ts), which shares
 * the arm machinery; this pass only pins what the plan table and the
 * harvest need before it.
 */
const runReconcileLoops = (
	shared: PassShared,
): Map<ReconcileForIR, ReconcilePlan> => {
	const { component, source, diagnostics, addQuery } = shared
	const wording = wordingOf(component)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const reconcilePlans = new Map<ReconcileForIR, ReconcilePlan>()

	// The element directly holding `target`, through any control flow above
	// it (a list nested in an arm, LT-424); null when `target` sits directly
	// in a control-flow arm rather than in an element.
	const parentOf = (target: TemplateNode): ElementNode | null => {
		let found: ElementNode | null = null
		walkTemplate(component.root, (node, parent) => {
			if (node === target && parent !== null && isElement(parent))
				found = parent
		})
		return found
	}

	for (const loop of component.fors.values()) {
		if (loop.kind !== 'reconcile') continue
		const output = loop.output
		// A list nested in a Mount Scope (an arm, an item; ADR 0046 s1) is
		// addressed in pass 4 through its scope's own `first`
		// (`analysis/effects.ts`); here it only gets the plan the harvest and
		// that pass fill in, and the container checks that need no address.
		const nested = inNestedScope(component.root, component.fors, output)
		if (nested) {
			const container = parentOf(output)
			if (container) checkContainerSiblings(shared, loop, container)
			reconcilePlans.set(loop, {
				tag: component.tag,
				container: '',
				listIndex: listIndexOf(component.root, component.fors, loop),
				signal: loop.listSignal,
				itemParam: loop.itemName,
				keyParam: loop.keyName,
				holeSelector: holeSelectorOf(component, loop),
				itemScope: {
					root: null,
					locals: [],
					keyAttrs: [],
					effects: [],
					setup: loop.setup,
				},
				emptyQueries: [],
				scoped: true,
			})
			continue
		}

		// An authored <template> would collide with the compiler-extracted
		// item template; LTC061 refuses it in lowering (LT-383), on every
		// component, so the loop analysis no longer checks for one.

		// Container: the parent element holding the loop output. The host
		// itself cannot be the container (no self-query).
		const container = parentOf(output)
		if (!container || container === component.root) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					output.node,
					`A reactive-list ${wording.loop} directly under the component root`,
					'`reconcile()` needs a container element other than the host — wrap the loop in one.',
				),
			)
			continue
		}
		const containerSelector = resolveSelector(container)
		if (!containerSelector.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					container.node,
					`No unique selector for the ${wording.loop} container <${container.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
				),
			)
		}
		const containerName = addQuery(
			'container',
			containerSelector.selector,
			'one',
		)

		// The extracted `<template>` is a direct child of the host (ADR 0046
		// s2), queried as `:scope > template[data-list="N"]` — the
		// direct-child step keeps any other component's markup from
		// answering, the stamp lifts the one-list-per-component limit.
		shared.ambient.add('host')

		checkContainerSiblings(shared, loop, container)

		// The extracted template is stamped `data-list="N"` (ADR 0046 s2) and
		// queried from the host inside the generated `reconcile` call — no
		// factory query for the template itself, and no
		// one-list-per-component limit: the stamp tells same-container and
		// sibling lists apart.
		const listIndex = listIndexOf(component.root, component.fors, loop)

		// The @empty arm's roots (LT-212): server-rendered in the container,
		// `hidden` toggled by the client — each root needs its own query.
		const emptyQueries: string[] = []
		for (const root of loop.emptyArm ?? []) {
			if (!isElement(root)) continue
			const resolved = resolveSelector(root)
			if (!resolved.unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						root.node,
						`No unique selector for the ${wording.emptyArm} root <${root.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
					),
				)
				continue
			}
			emptyQueries.push(addQuery('empty', resolved.selector, 'one'))
		}

		const holeSelector = holeSelectorOf(component, loop)

		reconcilePlans.set(loop, {
			tag: component.tag,
			container: containerName,
			listIndex,
			signal: loop.listSignal,
			itemParam: loop.itemName,
			keyParam: loop.keyName,
			holeSelector,
			itemScope: {
				root: null,
				locals: [],
				keyAttrs: [],
				effects: [],
				setup: loop.setup,
			},
			emptyQueries,
			scoped: false,
		})
	}
	return reconcilePlans
}

/* === Exported Functions === */

/**
 * Passes 1+1b: every `@for` in the template gets its client plan. Each
 * loops before reconcile — the query-registration order the goldens pin.
 */
export const runLoops = (shared: PassShared): LoopPlans => {
	const forPlans = runEachLoops(shared)
	const reconcilePlans = runReconcileLoops(shared)
	return { forPlans, reconcilePlans }
}
