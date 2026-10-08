/**
 * The one-writer-per-property check (ADR 0048 s3, LT-476).
 *
 * A child acts on the content a parent passes only through declared roles
 * (ADR 0048 s2), and it does so with *runtime writes*: role-addressed
 * `first()` references whose `watch` bindings — `bindProperty`,
 * `bindAttribute`, `bindText`, `bindClass`, `bindVisible`, `bindStyle`,
 * `bindAria` — own a property on every element carrying the role's class.
 * The parent owns that content too (s1), and binds it through its own
 * `first()` references into the compose site. When both bind the same
 * property on the same role element, two writers fight forever: the child's
 * binding fires on its signals, the parent's on its own.
 *
 * Both halves are the same scan. {@link watchBindingsOf} reads the authored
 * factory statements — `watch(source, helper(ref, …))` calls, verbatim in
 * `setup`/`clientSetup` — for bindings a declared `first()` reference
 * targets. The child half ({@link roleWritesOf}) filters to role-addressed
 * references and becomes the registry entry's `roleWrites`; the parent half
 * ({@link findRoleWriterConflicts}) runs in the registry-aware pass at each
 * compose site with children, matching the site's content elements' role
 * classes against the child entry's recording. `on()` return updates write
 * host props, not role elements — out of scope by the task's ruling.
 *
 * Tier 1 Prevented (ADR 0028): statically decidable on both sides, no
 * runtime half.
 */

import type { AstNode } from '../ast-node'
import { asArray, identifierName, isNode, nodeType } from '../ast-utils'
import { childrenInsertionsOf } from '../children-region'
import { namesDeclaredRole } from '../first-refs'
import type { ComponentIR, TemplateNode } from '../ir'
import type { RegistryEntry } from '../registry'
import { walkTemplate } from '../walk'
import { allComposeNodes, type ComposeNode, refOf } from './selectors'

/* === Types === */

/** The authored binding helpers a role write can come from. */
export type RoleBindHelper =
	| 'bindProperty'
	| 'bindAttribute'
	| 'bindText'
	| 'bindClass'
	| 'bindVisible'
	| 'bindStyle'
	| 'bindAria'

/**
 * One property a client writes on role elements, read off a `watch`
 * binding. `name` is the property/attribute family — both dispatch to the
 * same underlying state for a given name, so one family — with ARIA
 * spellings normalized (`ariaSelected` reflects `aria-selected`, the
 * spelling a `bindAttribute` call or a template attribute uses);
 * `bindVisible` writes the `hidden` property. Unreadable arguments (a
 * computed name) are skipped: the check fires only where it can name what
 * is written.
 */
export type RoleWrite = {
	helper: RoleBindHelper
	target:
		| { channel: 'name'; name: string; authored: string }
		| { channel: 'text' }
		| { channel: 'class'; token: string }
		| { channel: 'style'; property: string }
}

/** One authored `watch` binding a declared `first()` reference targets. */
export type WatchBinding = {
	ref: string
	write: RoleWrite
	/** The binding helper call — where the check reports. */
	at: { start?: number | undefined; end?: number | undefined }
}

/** A conflict the compose-site half found, named for the message. */
export type RoleWriterConflict = {
	/** The parent's conflicting binding (the report site). */
	parent: WatchBinding
	childTag: string
	/** The role class the passed element carries. */
	role: string
	/** The child's write it collides with. */
	childWrite: RoleWrite
}

/* === Internal Functions === */

/**
 * The attribute spelling an ARIA IDL property reflects to (`ariaSelected`
 * → `aria-selected`); anything else is returned unchanged — `role` and the
 * ordinary property names are compared as authored, their channel
 * divergence being LT-116's dispatch detail, not a spelling difference the
 * check second-guesses.
 */
const normalizeWriteName = (name: string): string =>
	/^aria[A-Z]/.test(name)
		? name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
		: name

const stringLiterals = (node: unknown): string[] =>
	isNode(node) && nodeType(node) === 'ArrayExpression'
		? asArray((node as AstNode).elements)
				.filter(
					element =>
						isNode(element) &&
						nodeType(element) === 'Literal' &&
						typeof element.value === 'string',
				)
				.map(element => String((element as unknown as { value: string }).value))
		: []

/** What a helper call writes, from its arguments after the target ref. */
const writeTargetsOf = (
	helper: RoleBindHelper,
	args: unknown[],
): RoleWrite['target'][] => {
	const arg = args[1]
	if (helper === 'bindVisible')
		return [{ channel: 'name', name: 'hidden', authored: 'hidden' }]
	if (helper === 'bindText') return [{ channel: 'text' }]
	if (
		helper === 'bindProperty' ||
		helper === 'bindAttribute' ||
		helper === 'bindAria'
	) {
		const names =
			isNode(arg) &&
			nodeType(arg) === 'Literal' &&
			typeof arg.value === 'string'
				? [String(arg.value)]
				: helper === 'bindAria'
					? stringLiterals(arg)
					: []
		return names.map(name => ({
			channel: 'name',
			name: normalizeWriteName(name),
			authored: name,
		}))
	}
	// bindClass / bindStyle: a single literal or a list of them.
	const names =
		isNode(arg) && nodeType(arg) === 'Literal' && typeof arg.value === 'string'
			? [String(arg.value)]
			: stringLiterals(arg)
	const channel = helper === 'bindClass' ? 'class' : 'style'
	return names.map(name =>
		channel === 'class'
			? ({ channel: 'class', token: name } as const)
			: ({ channel: 'style', property: name } as const),
	)
}

/* === Exported Functions === */

/**
 * Every authored `watch` binding a declared `first()` reference targets, in
 * source order. A binding is `watch(<source>, <helper>(<ref>, …))` with
 * `<helper>` one of the seven bind helpers and `<ref>` an identifier naming
 * a `firstRefs` entry; anything else — a prop-key watch (`watch('value',
 * …)`), a custom handler, a helper over `host` or a non-ref name, a
 * computed name argument — is skipped: both halves record only what the
 * compiler can name. `bindAria` names are stored normalized (the ARIA
 * reflection's attribute spelling), so a `bindAria(tab, 'ariaSelected')`
 * collides with a parent `bindAttribute(el, 'aria-expanded')`.
 */
export const watchBindingsOf = (component: ComponentIR): WatchBinding[] => {
	const helpers: ReadonlySet<string> = new Set<RoleBindHelper>([
		'bindProperty',
		'bindAttribute',
		'bindText',
		'bindClass',
		'bindVisible',
		'bindStyle',
		'bindAria',
	])
	const bindings: WatchBinding[] = []
	for (const stmt of [...component.setup, ...component.clientSetup]) {
		const expr = stmt.node
		if (
			!isNode(expr) ||
			nodeType(expr) !== 'CallExpression' ||
			identifierName((expr as AstNode).callee) !== 'watch'
		)
			continue
		const handler = asArray((expr as AstNode).arguments)[1]
		if (
			!isNode(handler) ||
			nodeType(handler) !== 'CallExpression' ||
			!helpers.has(identifierName((handler as AstNode).callee) ?? '')
		)
			continue
		const helper = identifierName((handler as AstNode).callee) as RoleBindHelper
		const helperArgs = asArray((handler as AstNode).arguments)
		const targetArg = helperArgs[0]
		if (
			!isNode(targetArg) ||
			nodeType(targetArg) !== 'Identifier' ||
			!component.firstRefs.has(String(targetArg.name))
		)
			continue
		for (const target of writeTargetsOf(helper, helperArgs))
			bindings.push({
				ref: String(targetArg.name),
				write: { helper, target },
				at: { start: handler.start, end: handler.end },
			})
	}
	return bindings
}

/**
 * Every declared role the SUBJECT compound of a selector list names — the
 * collect counterpart of `first-refs.ts`' boolean `namesDeclaredRole`, so a
 * write is recorded under each role it conflicts through.
 */
export const subjectRolesOf = (
	selectorList: string,
	roles: ReadonlySet<string>,
): string[] => {
	if (roles.size === 0) return []
	const found: string[] = []
	for (const branch of selectorList.split(',')) {
		// The subject compound starts after the last combinator.
		const subject =
			branch
				.trim()
				.split(/[\s>+~]+/)
				.pop() ?? ''
		for (const token of subject.split('.')) {
			const name = token.trim()
			if (name !== '' && roles.has(name) && !found.includes(name))
				found.push(name)
		}
	}
	return found
}

/**
 * The registry entry's `roleWrites` (ADR 0048 s3, LT-476): the component's
 * watch bindings whose reference is role-addressed — the selector's subject
 * names a declared role, the template inserts `{children}` (without an
 * insertion the content can never arrive — the LT-474 review-2 posture),
 * and the reference resolved to no own-template element. A reference that
 * matched the child's OWN markup writes that element, not the passed
 * content — no conflict with a parent's binding is possible, so it is not
 * recorded; the same holds for a `deferred` reference a compose site
 * claimed (it addresses a composed child's host). One entry per role the
 * selector's subject names. Null when there is no roles contract, no
 * insertion, or no role-addressed binding: the field stays off the entry.
 */
export const roleWritesOf = (
	component: ComponentIR,
): Record<string, RoleWrite[]> | null => {
	const roles = component.childrenContract?.roles
	if (!roles || roles.size === 0) return null
	const insertions = childrenInsertionsOf(component.root)
	const inserts =
		insertions.holders.size > 0 ||
		insertions.forwards.size > 0 ||
		insertions.unmarked
	if (!inserts) return null
	const roleSet = new Set(roles.keys())
	// A `deferred` reference the compose-aware pass claimed (the `ref` attr
	// on a compose node, attached by `analysis/compose-refs.ts`) addresses a
	// composed child's host, not content.
	const claimedDeferred = new Set(
		allComposeNodes(component.root)
			.map(node => refOf(node)?.name)
			.filter((name): name is string => name !== undefined),
	)
	const byRole: Record<string, RoleWrite[]> = {}
	for (const binding of watchBindingsOf(component)) {
		const ref = component.firstRefs.get(binding.ref)
		if (!ref) continue
		if (
			ref.stage === 'deferred'
				? claimedDeferred.has(binding.ref)
				: ref.stage !== 'unmatched'
		)
			continue
		if (namesDeclaredRole(ref.selector, roleSet) !== true) continue
		for (const role of subjectRolesOf(ref.selector, roleSet)) {
			const writes = byRole[role] ?? []
			writes.push(binding.write)
			byRole[role] = writes
		}
	}
	return Object.keys(byRole).length > 0 ? byRole : null
}

/**
 * The compose-site half (ADR 0048 s3, LT-476): a parent `watch` binding on
 * a `first()` reference INTO a compose site's content, whose element
 * carries a role class the child's client also writes the same property on,
 * is a conflict — reported at the parent's binding, naming both writers.
 * Runs in the registry-aware pass only (it reads each child's entry).
 * Compose content admits `first()` references as its one client construct
 * (LTC011 refuses the rest), so the reference-targeted binding is the
 * parent's only runtime write channel into its passed content today; the
 * check reads the same authored statements the child half records from.
 */
export const findRoleWriterConflicts = (
	component: ComponentIR,
	composeRegistry: ReadonlyMap<string, RegistryEntry>,
): RoleWriterConflict[] => {
	const bindings = watchBindingsOf(component)
	if (bindings.length === 0) return []
	const findings: RoleWriterConflict[] = []
	for (const node of allComposeNodes(component.root)) {
		if (node.children.length === 0) continue
		const child = composeRegistry.get(node.source)
		if (!child?.roleWrites) continue
		for (const [ref, element] of contentRefsOf(node)) {
			const classes = classTokensOf(element)
			if (classes.length === 0) continue
			for (const binding of bindings) {
				if (binding.ref !== ref) continue
				for (const role of classes) {
					const childWrites = child.roleWrites[role]
					if (!childWrites) continue
					const hit = childWrites.find(write =>
						conflictsWith(binding.write, write),
					)
					if (hit)
						findings.push({
							parent: binding,
							childTag: child.tag,
							role,
							childWrite: hit,
						})
				}
			}
		}
	}
	return findings
}

/**
 * The parent's references into one compose site's content: ref name → the
 * referenced element. The same walk `planContentRefs` runs at effect
 * planning (analysis/effects.ts): the front end attached these ref attrs
 * because the element collection enters compose content (ADR 0048 s1), and
 * a nested compose site is LTC011's refusal, not content to walk.
 */
const contentRefsOf = (
	node: ComposeNode,
): Map<string, Extract<TemplateNode, { kind: 'element' }>> => {
	const refs = new Map<string, Extract<TemplateNode, { kind: 'element' }>>()
	for (const child of node.children)
		walkTemplate(
			child,
			inner => {
				if (inner.kind !== 'element') return
				const name = refOf(inner)?.name
				if (name !== undefined && !refs.has(name)) refs.set(name, inner)
			},
			{ intoCompose: false },
		)
	return refs
}

/** The static class attribute's tokens — the role-class carrier. */
const classTokensOf = (
	element: Extract<TemplateNode, { kind: 'element' }>,
): string[] => {
	for (const attr of element.attrs)
		if (attr.kind === 'static' && attr.name === 'class' && attr.value)
			return attr.value.split(/\s+/).filter(Boolean)
	return []
}

/**
 * Do a parent's and a child's write hit the same property? Same family and
 * same normalized name: property/attribute writes compare by name (the
 * channels converge for a given name — the divergence the dirty-flag rule
 * handles is LT-116's, a dispatch detail neither writer's intent changes);
 * class tokens, style properties and text compare within their family.
 */
const conflictsWith = (parent: RoleWrite, child: RoleWrite): boolean => {
	const a = parent.target
	const b = child.target
	if (a.channel !== b.channel) return false
	if (a.channel === 'name' && b.channel === 'name') return a.name === b.name
	if (a.channel === 'class' && b.channel === 'class') return a.token === b.token
	if (a.channel === 'style' && b.channel === 'style')
		return a.property === b.property
	return a.channel === 'text'
}
