/**
 * Per-field harvest of a list seeded from server args (ADR 0046 s7,
 * LT-429): Pass 3's plan for how the client rebuilds each adopted item
 * field by field from the item's markup.
 *
 * Each field is read from its canonical site in the item — `data-key` for
 * the field the `keyConfig` returns verbatim, else the first text child or
 * reactive attribute, in document order, whose expression reads exactly the
 * field (`item.f.get()` on a store item, `item.get().f` on any, optionally
 * through `String()`) — and through a parser: the `harvest()` entry when
 * there is one, else the one the field's type infers. A field with no site
 * fails LTC072 (LTC059 when its only site formats it); a field with a site
 * and no parser fails LTC076.
 */

import type { AstNode } from '../ast-node'
import {
	asArray,
	identifierName,
	nodeType,
	text,
	walkNodes,
} from '../ast-utils'
import { diagnostic } from '../diagnostics'
import type {
	DeclaredSignalIR,
	ListItemFieldIR,
	ReconcileForIR,
	TemplateNode,
} from '../ir'
import { DIRTY_FLAG_ATTRS } from '../vocabulary'
import { reportServerOnlyNames } from './effects'
import { formattingOf } from './harvest'
import type { HarvestPlan, ListFieldPlan, PassShared } from './plan'
import { type ElementNode, isElement, resolveScopedSelector } from './selectors'

/* === Internal Functions === */

/** Expression types a call can follow without parentheses. */
export const CALLABLE_AS_WRITTEN: ReadonlySet<string> = new Set([
	'Identifier',
	'CallExpression',
	'MemberExpression',
])

/** `item.<f>.get()` or `item.get().<f>` → `f`, else null. */
const fieldAccessOf = (node: unknown, item: string): string | null => {
	if (nodeType(node) === 'CallExpression') {
		const call = node as AstNode
		const callee = call.callee as AstNode | undefined
		if (
			asArray(call.arguments).length > 0 ||
			nodeType(callee) !== 'MemberExpression' ||
			callee?.computed ||
			identifierName(callee?.property) !== 'get'
		)
			return null
		const store = callee?.object as AstNode | undefined
		return nodeType(store) === 'MemberExpression' &&
			!store?.computed &&
			identifierName(store?.object) === item
			? identifierName(store?.property)
			: null
	}
	if (nodeType(node) === 'MemberExpression') {
		const member = node as AstNode
		if (member.computed) return null
		const read = member.object as AstNode | undefined
		const getter = read?.callee as AstNode | undefined
		return nodeType(read) === 'CallExpression' &&
			asArray(read?.arguments).length === 0 &&
			nodeType(getter) === 'MemberExpression' &&
			!getter?.computed &&
			identifierName(getter?.object) === item &&
			identifierName(getter?.property) === 'get'
			? identifierName(member.property)
			: null
	}
	return null
}

/**
 * The field an expression reads exactly and unformatted, or null: the
 * field access itself, inside a parameterless arrow, optionally through
 * `String()` (the server serializes a value the same way, ADR 0046 s7).
 */
const exactFieldOf = (expr: AstNode, item: string): string | null => {
	let node: unknown = expr
	if (
		nodeType(node) === 'ArrowFunctionExpression' &&
		asArray((node as AstNode).params).length === 0
	)
		node = (node as AstNode).body
	if (
		nodeType(node) === 'CallExpression' &&
		identifierName((node as AstNode).callee) === 'String' &&
		asArray((node as AstNode).arguments).length === 1
	)
		node = asArray((node as AstNode).arguments)[0]
	return fieldAccessOf(node, item)
}

/** Every field `expr` reads, in any position. */
const fieldsReadBy = (expr: AstNode, item: string): Set<string> => {
	const fields = new Set<string>()
	walkNodes(expr, node => {
		const field = fieldAccessOf(node, item)
		if (field) fields.add(field)
	})
	return fields
}

type FieldSite =
	| { kind: 'text'; element: ElementNode; node: AstNode }
	| { kind: 'attr'; element: ElementNode; attr: string; node: AstNode }

/**
 * The item's harvest sites per field, first in document order, and its
 * formatted text sites (LTC059's input). Only elements every adopted item
 * carries count: the walk stays out of conditions, nested lists and loops,
 * and composed children.
 */
const collectSites = (
	output: ElementNode,
	item: string,
	shared: PassShared,
): {
	sites: Map<string, FieldSite>
	formatted: Map<string, { node: AstNode; formatting: string }>
} => {
	const sites = new Map<string, FieldSite>()
	const formatted = new Map<string, { node: AstNode; formatting: string }>()
	const visit = (element: ElementNode): void => {
		for (const attr of element.attrs) {
			if (attr.kind !== 'reactive') continue
			const field = exactFieldOf(attr.thunk, item)
			if (field && !sites.has(field))
				sites.set(field, {
					kind: 'attr',
					element,
					attr: attr.name,
					node: attr.thunk,
				})
		}
		for (const child of element.children as TemplateNode[]) {
			if (isElement(child)) {
				visit(child)
				continue
			}
			if (child.kind !== 'expr' || child.reactivity !== 'reactive') continue
			const field = exactFieldOf(child.expr, item)
			if (field) {
				if (!sites.has(field))
					sites.set(field, { kind: 'text', element, node: child.expr })
				continue
			}
			const formatting = formattingOf(child.expr, shared.component)
			if (!formatting) continue
			for (const read of fieldsReadBy(child.expr, item))
				if (!formatted.has(read))
					formatted.set(read, { node: child.expr, formatting })
		}
	}
	visit(output)
	return { sites, formatted }
}

/* === Exported Functions === */

/**
 * Whether an arg-seeded list harvests per field (ADR 0046 s7): a
 * `harvest()` seed, or an item type that is not a primitive. A `string`
 * (or untyped) item keeps the whole-item read of its bare `{item}` hole.
 */
export const harvestsPerField = (signal: DeclaredSignalIR): boolean =>
	signal.harvest?.kind === 'list' ||
	signal.listItem?.shape.kind === 'fields' ||
	signal.listItem?.shape.kind === 'opaque'

/**
 * Plan an arg-seeded list's per-field harvest, or report why it cannot be
 * planned (LTC072, LTC059, LTC076) and return null. `container` is the
 * list container's query.
 */
export const planListFieldHarvest = (
	shared: PassShared,
	signal: DeclaredSignalIR,
	loop: ReconcileForIR,
	container: string,
): HarvestPlan | null => {
	const { component, source, diagnostics } = shared
	const item = signal.listItem
	const marker = signal.harvest?.kind === 'list' ? signal.harvest : undefined
	const seedNode = signal.init
	const seedText = seedNode ? text(source, seedNode) : signal.name
	const seedSite = marker?.call ?? seedNode ?? undefined
	const entries = new Map(
		(marker?.entries ?? []).map(entry => [entry.field, entry]),
	)
	const typed: ListItemFieldIR[] =
		item?.shape.kind === 'fields' ? item.shape.fields : []
	// An unreadable item type lists its fields only through `harvest()`.
	if (!marker && item?.shape.kind === 'opaque') {
		diagnostics.push(
			diagnostic.listFieldWithoutParser(
				source,
				seedSite,
				signal.name,
				null,
				item.typeText ?? '',
				seedText,
				false,
			),
		)
		shared.rawSourceRefused.add(signal.name)
		return null
	}
	const names = [
		...typed.map(field => field.name),
		...[...entries.keys()].filter(name => !typed.some(f => f.name === name)),
	]
	const { sites, formatted } = collectSites(loop.output, loop.itemName, shared)
	const reported = diagnostics.length
	const fields: ListFieldPlan[] = []
	for (const name of names) {
		const entry = entries.get(name)
		const declared = typed.find(field => field.name === name)
		// The key field reads `data-key`; any other field its first site.
		let site: ListFieldPlan['site'] | null = null
		if (item?.keyField === name) site = { kind: 'key' }
		else {
			const found = sites.get(name)
			if (found) {
				const selector =
					found.element === loop.output
						? null
						: resolveScopedSelector(
								loop.output,
								found.element,
								component.composedShapes,
							)
				if (selector && !selector.unique)
					diagnostics.push(
						diagnostic.unaddressableElement(
							source,
							found.element.node,
							`No unique selector for the harvest site of field \`${name}\` of list \`${signal.name}\` — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
						),
					)
				site =
					found.kind === 'text'
						? { kind: 'text', selector: selector?.selector ?? null }
						: {
								kind: 'attr',
								selector: selector?.selector ?? null,
								attr: found.attr,
								property: DIRTY_FLAG_ATTRS.has(found.attr),
								tag: found.element.tag,
							}
			}
		}
		if (!site) {
			const shown = formatted.get(name)
			diagnostics.push(
				shown
					? diagnostic.formattedWithoutRawSource(
							source,
							shown.node,
							`Field \`${name}\` of list \`${signal.name}\``,
							shown.formatting,
						)
					: diagnostic.listFieldWithoutSite(
							source,
							loop.output.node,
							signal.name,
							name,
						),
			)
			continue
		}
		let parser: ListFieldPlan['parser'] | null = null
		if (entry) {
			reportServerOnlyNames(
				shared,
				entry.value,
				`The \`harvest()\` parser of field \`${name}\``,
			)
			parser = {
				kind: 'authored',
				text: entry.text,
				start: entry.value.start as number,
				wrap: !CALLABLE_AS_WRITTEN.has(entry.value.type),
				keyText: text(source, entry.key),
				keyStart: entry.key.start as number,
			}
		} else if (declared?.parser) {
			parser = { kind: 'inferred', ...declared.parser }
		}
		if (!parser) {
			diagnostics.push(
				diagnostic.listFieldWithoutParser(
					source,
					seedSite,
					signal.name,
					name,
					declared?.typeText ?? item?.typeText ?? '',
					seedText,
					!!marker,
				),
			)
			continue
		}
		fields.push({ field: name, site, parser })
	}
	if (diagnostics.length > reported) {
		shared.rawSourceRefused.add(signal.name)
		return null
	}
	return { kind: 'list', signal: signal.name, seed: { container, fields } }
}
