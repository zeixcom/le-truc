/**
 * Loop planning (LT-022, regrouping move M5): Pass 1 — server-data `@for`
 * → `each()` plans (output selector, collection naming, hoisted-const
 * rebinding, loop-scoped effects); Pass 1b — reactive-list `@for` over a
 * declared `createList` → `reconcile()` plans (container/template
 * addressing, item hole, bindItem-scoped events).
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
import { isClientConstructAttr, someNode } from '../walk'
import { reportServerOnlyNames } from './effects'
import { returnsNumber } from './harvest'
import type {
	ForClientPlan,
	LoopEffectPlan,
	LoopPlans,
	PassShared,
	RebindingPlan,
	ReconcileItemEvents,
	ReconcilePlan,
} from './plan'
import {
	type ElementNode,
	isElement,
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

/**
 * Pass 1: server-data `@for` → `each()` plans (output selector, collection
 * naming, hoisted-const rebinding, loop-scoped effects).
 */
const runEachLoops = (shared: PassShared): Map<EachForIR, ForClientPlan> => {
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
	const forPlans = new Map<EachForIR, ForClientPlan>()

	for (const loop of component.fors.values()) {
		if (loop.kind !== 'each') continue // reactive loops → runReconcileLoops
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
					diagnostic.loopVariableInReactiveThunk(source, node.start, loopRefs),
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
							el.node.start,
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
								child.node.start,
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
			if (node.kind === 'expr' && node.lazy) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
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
		if (effectsPlan.length === 0) continue
		const { selector, unique } = resolveSelector(output)
		if (!unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node.start,
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
		const rebindings: RebindingPlan[] = []
		for (const hoisted of loop.hoisted) {
			if (!referencedConsts.has(hoisted.name)) continue
			const attr = constAttr.get(hoisted.name)
			if (!attr) {
				diagnostics.push(
					diagnostic.constNotRebindable(
						source,
						hoisted.node.start,
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

		forPlans.set(loop, {
			collection,
			itemParam,
			rebindings,
			effects: effectsPlan,
		})
	}
	return forPlans
}

/**
 * Pass 1b: reactive-list `@for` over a declared `createList` →
 * `reconcile()` plans (container/template addressing, item hole,
 * bindItem-scoped events).
 */
const runReconcileLoops = (
	shared: PassShared,
): Map<ReconcileForIR, ReconcilePlan> => {
	const {
		component,
		source,
		diagnostics,
		addQuery,
		collectAmbient,
		badListBodyNames,
	} = shared
	const wording = wordingOf(component)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const reconcilePlans = new Map<ReconcileForIR, ReconcilePlan>()

	const parentOf = (target: TemplateNode): ElementNode | null => {
		const walk = (node: TemplateNode): ElementNode | null => {
			if (!isElement(node)) return null
			for (const child of node.children) {
				if (child === target) return node
				const found = walk(child)
				if (found) return found
			}
			return null
		}
		return walk(component.root)
	}

	for (const loop of component.fors.values()) {
		if (loop.kind !== 'reconcile') continue
		// One reactive list per component: every extracted template would
		// match the same `first('template')` query, and the second list's
		// reconcile would clone the FIRST list's item shape with no
		// diagnostic. Scoped template addressing (sibling selectors) is the
		// follow-up if a corpus component ever needs two lists.
		if (reconcilePlans.size > 0) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					loop.output.node.start,
					`A second reactive-list ${wording.loop} in one component`,
					'Both lists would share the selector of the extracted `<template>` — split the component, or render one list from server data.',
				),
			)
			continue
		}
		const output = loop.output

		// The extracted <template> is compiler-emitted; an authored one would
		// collide with the emitted selector. A structural tag scan, checked
		// BEFORE any selector resolution: since LT-379 the probe refuses to
		// materialize a `<template>` (css-select's HTML-mode traversal would
		// silently skip its content), so this diagnostic must fire first.
		if (someNode(component.root, n => isElement(n) && n.tag === 'template')) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node.start,
					`An authored <template> collides with the compiler-extracted item template of the reactive-list ${wording.loop}.`,
				),
			)
			continue
		}

		// Container: the parent element holding the loop output. The host
		// itself cannot be the container (no self-query).
		const container = parentOf(output)
		if (!container || container === component.root) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					output.node.start,
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
					container.node.start,
					`No unique selector for the ${wording.loop} container <${container.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
				),
			)
		}
		const containerName = addQuery(
			'container',
			containerSelector.selector,
			'one',
		)

		const templateName = addQuery('template', 'template', 'one')

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
						root.node.start,
						`No unique selector for the ${wording.emptyArm} root <${root.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
					),
				)
				continue
			}
			emptyQueries.push(addQuery('empty', resolved.selector, 'one'))
		}

		// The item hole's parent element — the item value's DOM site, used by
		// the arg-seeded harvest read.
		const findHoleParent = (node: TemplateNode): ElementNode | null => {
			if (!isElement(node)) return null
			for (const child of node.children) {
				if (
					child.kind === 'expr' &&
					child.lazy &&
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
			: output.tag

		// Per-item events, grouped per target element, bindItem-scoped.
		const itemEvents: ReconcileItemEvents[] = []
		const takenNames = new Set<string>([
			loop.itemName,
			...(loop.keyName ? [loop.keyName] : []),
			'first',
			'_element',
		])
		const checkItemHandler = (handler: AstNode, what: string): void => {
			collectAmbient(handler)
			const free = dependenciesOf(handler)
			if (free.has(loop.itemName)) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						handler.start,
						`${what} that reads the loop item \`${loop.itemName}\` in a reactive-list ${wording.loop} body`,
						`Inside \`reconcile()\`'s \`bindItem\` the item is a signal, not the value, so a handler cannot read it.${wording.listItemHandlerFix}`,
					),
				)
			}
			reportServerOnlyNames(
				shared,
				handler,
				`${what} inside a reactive-list ${wording.loop} body`,
				badListBodyNames(handler).filter(
					name => name !== loop.itemName && name !== loop.keyName,
				),
			)
		}
		const collectItemEvents = (
			node: TemplateNode,
			isItemRoot: boolean,
		): void => {
			if (!isElement(node)) return
			const elementEvents = node.attrs.filter(a => a.kind === 'event') as Array<
				Extract<AttributeIR, { kind: 'event' }>
			>
			if (elementEvents.length > 0) {
				let target: ReconcileItemEvents | undefined
				if (isItemRoot) {
					target = itemEvents.find(e => e.selector === null)
					if (!target) {
						target = {
							selector: null,
							name: '_element',
							message: '',
							events: [],
						}
						itemEvents.push(target)
					}
				} else {
					const scoped = resolveSelectorScoped(
						output,
						node,
						component.composedShapes,
					)
					if (!scoped.unique) {
						diagnostics.push(
							diagnostic.unaddressableElement(
								source,
								node.node.start,
								`No unique selector for <${node.tag}> inside the ${wording.loop} item template — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
							),
						)
					}
					target = itemEvents.find(e => e.selector === scoped.selector)
					if (!target) {
						let name = sanitizeVarName(node.tag)
						while (takenNames.has(name)) name = `${name}El`
						takenNames.add(name)
						target = {
							selector: scoped.selector,
							name,
							message: `${component.tag}: ${scoped.selector} missing`,
							events: [],
						}
						itemEvents.push(target)
					}
				}
				for (const attr of elementEvents) {
					checkItemHandler(attr.handler, `Event handler \`${attr.name}\``)
					target.events.push({
						event: attr.event,
						handlerText: attr.handlerText,
						sourceStart: attr.handler.start,
						sourceEnd: attr.handler.end,
					})
				}
			}
			for (const child of node.children) collectItemEvents(child, false)
		}
		collectItemEvents(output, true)

		reconcilePlans.set(loop, {
			tag: component.tag,
			container: containerName,
			template: templateName,
			signal: loop.listSignal,
			itemParam: loop.itemName,
			keyParam: loop.keyName,
			holeSelector,
			itemEvents,
			emptyQueries,
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
