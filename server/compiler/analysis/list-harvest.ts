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
import type { LocalDiagnostic } from '../diagnostics'
import { diagnostic } from '../diagnostics'
import type {
	ComponentIR,
	DeclaredSignalIR,
	ListItemFieldIR,
	ReconcileForIR,
	TemplateNode,
} from '../ir'
import {
	type ByKeyRead,
	byKeyReadsOf,
	harvestsPerField,
	isAliasHarvestable,
} from '../key-alias'
import { wordingOf } from '../surface'
import { DIRTY_FLAG_ATTRS } from '../vocabulary'
import { childNodes, hasArmSet } from '../walk'
import { reportServerOnlyNames } from './effects'
import { formattingOf } from './harvest'
import type {
	HarvestPlan,
	ListFieldPlan,
	PassShared,
	ReconcilePlan,
} from './plan'
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

/**
 * Plan each field of an arg-seeded list's item, read from `output` — the
 * root of the scope that renders the item through `item` — or report why a
 * field cannot be planned and return null. `missingSite` builds the
 * diagnostic for a field with no site and no formatted one.
 */
const planFields = (
	shared: PassShared,
	signal: DeclaredSignalIR,
	output: ElementNode,
	item: string,
	missingSite: (field: string) => LocalDiagnostic,
): ListFieldPlan[] | null => {
	const { component, source, diagnostics } = shared
	const listItem = signal.listItem
	const marker = signal.harvest?.kind === 'list' ? signal.harvest : undefined
	const seedNode = signal.init
	const seedText = seedNode ? text(source, seedNode) : signal.name
	const seedSite = marker?.call ?? seedNode ?? undefined
	const entries = new Map(
		(marker?.entries ?? []).map(entry => [entry.field, entry]),
	)
	const typed: ListItemFieldIR[] =
		listItem?.shape.kind === 'fields' ? listItem.shape.fields : []
	// An unreadable item type lists its fields only through `harvest()`.
	if (!marker && listItem?.shape.kind === 'opaque') {
		diagnostics.push(
			diagnostic.listFieldWithoutParser(
				source,
				seedSite,
				signal.name,
				null,
				listItem.typeText ?? '',
				seedText,
				false,
			),
		)
		return null
	}
	const names = [
		...typed.map(field => field.name),
		...[...entries.keys()].filter(name => !typed.some(f => f.name === name)),
	]
	const { sites, formatted } = collectSites(output, item, shared)
	const reported = diagnostics.length
	const fields: ListFieldPlan[] = []
	for (const name of names) {
		const entry = entries.get(name)
		const declared = typed.find(field => field.name === name)
		// The key field reads `data-key`; any other field its first site.
		let site: ListFieldPlan['site'] | null = null
		if (listItem?.keyField === name) site = { kind: 'key' }
		else {
			const found = sites.get(name)
			if (found) {
				const selector =
					found.element === output
						? null
						: resolveScopedSelector(
								output,
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
					: missingSite(name),
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
					declared?.typeText ?? listItem?.typeText ?? '',
					seedText,
					!!marker,
				),
			)
			continue
		}
		fields.push({ field: name, site, parser })
	}
	return diagnostics.length > reported ? null : fields
}

/** The template nodes from `root` down to `target`, both included, or null. */
const pathTo = (
	root: TemplateNode,
	target: TemplateNode,
): TemplateNode[] | null => {
	if (root === target) return [root]
	for (const child of childNodes(root)) {
		const found = pathTo(child, target)
		if (found) return [root, ...found]
	}
	return null
}

/** The declaring call of list signal `name`: host-level, or in an enclosing item's setup. */
const listCallOf = (
	component: ComponentIR,
	name: string,
	enclosing: readonly ReconcileForIR[],
): AstNode | null => {
	for (const loop of [...enclosing].reverse()) {
		const stmt = loop.setup.find(s => s.kind === 'signal' && s.name === name)
		if (stmt) return stmt.node
	}
	return component.setup.find(s => s.name === name)?.node ?? null
}

/**
 * The parameter name of a `keyConfig` that keys each item by itself
 * (`s => s`) in any options object of `call`, else null.
 */
const identityKeyOf = (call: AstNode | null): string | null => {
	for (const arg of asArray(call?.arguments)) {
		if (nodeType(arg) !== 'ObjectExpression') continue
		for (const prop of asArray(arg.properties)) {
			if (prop.type !== 'Property' || identifierName(prop.key) !== 'keyConfig')
				continue
			const fn = prop.value as AstNode | undefined
			const params = asArray(fn?.params)
			const param = params.length === 1 ? identifierName(params[0]) : null
			return nodeType(fn) === 'ArrowFunctionExpression' &&
				param !== null &&
				identifierName(fn?.body) === param
				? param
				: null
		}
	}
	return null
}

/* === Exported Functions === */

export { harvestsPerField }

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
	const fields = planFields(shared, signal, loop.output, loop.itemName, name =>
		diagnostic.listFieldWithoutSite(
			shared.source,
			loop.output.node,
			signal.name,
			name,
		),
	)
	if (!fields) {
		shared.rawSourceRefused.add(signal.name)
		return null
	}
	return { kind: 'list', signal: signal.name, seed: { container, fields } }
}

/**
 * Plan the harvest of a host-level arg-seeded list through its key alias
 * (ADR 0047, LT-453), or report why it cannot be planned and return null.
 * Undefined when nothing in any item setup reads the list by key: the list
 * is not alias-harvested, and the caller plans it as any other signal.
 *
 * The four s1 conditions are LTC080's, one message each: the aliasing list
 * keys each item by itself; every `byKey` read is the alias statement
 * over the loop key; one alias scope per list; every field renders at a
 * site in the alias scope (LTC059 and LTC076 as for any per-field
 * harvest). The client reads the alias roots across every enclosing list
 * item, so an arm set, a server-data loop or a composed child between the
 * host and the alias scope is refused: no connect-time path crosses it.
 */
export const planKeyAliasHarvest = (
	shared: PassShared,
	signal: DeclaredSignalIR,
	reconcilePlans: ReadonlyMap<ReconcileForIR, ReconcilePlan>,
): HarvestPlan | null | undefined => {
	const { component, source, diagnostics } = shared
	if (!isAliasHarvestable(component, signal) || !harvestsPerField(signal))
		return undefined
	const reads = byKeyReadsOf(component, signal.name)
	if (reads.length === 0) return undefined
	const reported = diagnostics.length
	const refuse = (): null => {
		shared.rawSourceRefused.add(signal.name)
		return null
	}
	let first: ByKeyRead | null = null
	for (const read of reads) {
		const overKey =
			read.loop.keyName !== null &&
			identifierName(read.arg) === read.loop.keyName
		if (read.alias === null || !overKey) {
			diagnostics.push(
				diagnostic.keyAliasRefused(source, read.call, signal.name, {
					kind: 'read',
					loopList: read.loop.listSignal,
					key: read.loop.keyName,
				}),
			)
			continue
		}
		if (first === null) {
			first = read
			continue
		}
		if (read.stmt === first.stmt) continue
		diagnostics.push(
			diagnostic.keyAliasRefused(source, read.stmt.range, signal.name, {
				kind: 'second-scope',
				alias: read.alias,
				first: first.alias as string,
				firstList: first.loop.listSignal,
			}),
		)
	}
	if (first === null) return refuse()
	const alias = first.alias as string
	const scope = first.loop

	// The client walks from the host's outermost list down to the alias
	// scope's container; every step must be a list item.
	const path = pathTo(component.root, scope.output) ?? []
	const byOutput = new Map<TemplateNode, ReconcileForIR>()
	for (const loop of component.fors.values())
		if (loop.kind === 'reconcile') byOutput.set(loop.output, loop)
	const crossed = path
		.slice(1, -1)
		.find(
			node =>
				hasArmSet(node) ||
				node.kind === 'compose' ||
				[...component.fors.values()].some(
					loop => loop.kind === 'each' && loop.output === node,
				),
		)
	if (crossed) {
		diagnostics.push(
			diagnostic.unsupported(
				source,
				first.stmt.range,
				`The key alias \`${alias}\` of list \`${signal.name}\`, inside a conditional arm, a server-data ${wordingOf(component).loop} or a composed child,`,
				`The client rebuilds \`${signal.name}\` at connect from the alias scope's items, reached through enclosing list items only — render the ${wordingOf(component).loop} that holds the alias outside conditional arms, server-data loops and composed children.`,
			),
		)
		return refuse()
	}
	const enclosing = path.slice(0, -1).flatMap(node => byOutput.get(node) ?? [])

	const call = listCallOf(component, scope.listSignal, enclosing)
	if (identityKeyOf(call) === null)
		diagnostics.push(
			diagnostic.keyAliasRefused(
				source,
				call ?? first.stmt.range,
				signal.name,
				{
					kind: 'item-key',
					alias,
					loopList: scope.listSignal,
					item: scope.itemName,
				},
			),
		)

	// The container of each nested list, inside the item root of the list
	// enclosing it: null when that item root is the container.
	const through: Array<string | null> = []
	const lists = [...enclosing, scope]
	for (let i = 1; i < lists.length; i++) {
		const outer = (lists[i - 1] as ReconcileForIR).output
		const inner = (lists[i] as ReconcileForIR).output
		const at = path.indexOf(inner)
		const container = path
			.slice(0, at)
			.reverse()
			.find(node => isElement(node)) as ElementNode | undefined
		if (!container || container === outer) {
			through.push(null)
			continue
		}
		const resolved = resolveScopedSelector(
			outer,
			container,
			component.composedShapes,
		)
		if (!resolved.unique)
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					container.node,
					`No unique selector for the container <${container.tag}> the client reads the key alias \`${alias}\` of list \`${signal.name}\` through — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
				),
			)
		through.push(resolved.selector)
	}
	const outermost = reconcilePlans.get(lists[0] as ReconcileForIR)

	const fields = planFields(shared, signal, scope.output, alias, name =>
		diagnostic.keyAliasRefused(source, scope.output.node, signal.name, {
			kind: 'field',
			alias,
			field: name,
		}),
	)
	if (!fields || !outermost || diagnostics.length > reported) return refuse()
	return {
		kind: 'list',
		signal: signal.name,
		seed: { container: outermost.container, fields, through },
	}
}
