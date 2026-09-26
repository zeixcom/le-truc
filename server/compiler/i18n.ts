/**
 * The reserved `i18n` parameter's compiler-side vocabulary (ADR 0030,
 * LT-173). Three concerns live here, all pure:
 *
 * - `readI18nDecl` — extraction of `export const i18n = { key: 'Source', … }`,
 *   the component's own message keys with their source-locale strings inline
 *   (ADR 0030 sub-design 4: no per-component catalog file — a sibling file
 *   would reintroduce the three-file drift ADR 0024 cures). Same extraction
 *   posture as `readConfig` (config.ts), one module-level statement per file.
 *   Each value is an ICU MessageFormat 1 pattern (LT-250), parsed here so the
 *   extraction result carries every key's argument signature.
 * - `langBindingOf` / `langArgDefaultOf` — where the component's EFFECTIVE
 *   locale is bound and what its authored `lang` default is (ADR 0030
 *   sub-design 3's precedence: an authored `lang` arg, or one supplied at a
 *   compose site, wins over the record's locale).
 * - `PLURAL_CATEGORIES` — the six CLDR cardinal category names, for
 *   validating `truc:case` (the per-locale pruning marker, ADR 0030
 *   sub-design 6). The CATEGORY SET a locale uses is never read from this
 *   table — that comes from the platform at render time
 *   (`runtime.ts`'s `pluralCategories`); this is only the spelling check.
 */

import type { AstNode } from './ast-node'
import { asArray, collectBoundNames, identifierName, isNode } from './ast-utils'
import { diagnostic } from './diagnostics'
import { type MessageArg, parseMessage } from './icu/parse'
import type { ExtractContext } from './ir'

/** The CLDR cardinal plural categories a `truc:case` value may name. */
export const PLURAL_CATEGORIES: ReadonlySet<string> = new Set([
	'zero',
	'one',
	'two',
	'few',
	'many',
	'other',
])

const messagesKey = (node: unknown): string | null => {
	if (!isNode(node)) return null
	if (node.type === 'Identifier') return String(node.name)
	// LT-190: quoted keys — the `<key>.<category>` convention spells its dot
	// in a string literal (`'task.other'`), which no bare identifier can be.
	if (node.type === 'Literal' && typeof node.value === 'string')
		return node.value
	return null
}

/** A component's `export const i18n` declaration, as extracted. */
export type I18nDecl = {
	/** Message key → source-locale pattern, verbatim. */
	messages: Record<string, string>
	/**
	 * Message key → the arguments its source pattern takes (LT-250): empty
	 * for an argument-less message (`t.<key>` is a string), else the names
	 * and kinds a call site must pass (`t.<key>({ … })`). A key whose source
	 * pattern failed to parse is absent — LTC055 already reported it.
	 */
	args: Record<string, readonly MessageArg[]>
}

/**
 * Extract and validate `export const i18n = { key: 'Source string', … }` —
 * the component's message keys with their source-locale strings inline
 * (ADR 0030 sub-design 4). Values must be string literals: the source
 * string IS the fallback every locale resolves against, so a computed value
 * would have no stable bytes for the staleness manifest to hash. Null when
 * the statement is not an i18n declaration; a MALFORMED one reports
 * LTC008 (source shape) and still returns null. Each value must parse as an
 * ICU MessageFormat 1 pattern — the source locale has no fallback to fall
 * to, so an unparseable source pattern is LTC055 (LT-250).
 */
export const readI18nDecl = (
	ctx: ExtractContext,
	stmt: AstNode,
): I18nDecl | null => {
	const decl =
		stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
			? stmt.declaration
			: stmt
	if (decl.type !== 'VariableDeclaration' || decl.kind !== 'const') return null
	const declarator = asArray(decl.declarations)[0] ?? null
	if (identifierName(declarator?.id) !== 'i18n' || !isNode(declarator?.init))
		return null
	const init = declarator.init
	if (init.type !== 'ObjectExpression') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				declarator.start,
				'`export const i18n` must be an object literal mapping message keys to their source-locale strings (ADR 0030).',
			),
		)
		return null
	}
	const messages: Record<string, string> = {}
	const args: Record<string, readonly MessageArg[]> = {}
	for (const prop of asArray(init.properties)) {
		if (prop.type !== 'Property') continue
		const key = messagesKey(prop.key)
		const value = prop.value
		if (!key || !isNode(value)) continue
		if (value.type === 'Literal' && typeof value.value === 'string') {
			messages[key] = value.value
			const parsed = parseMessage(value.value)
			if (parsed.ok) args[key] = parsed.args
			else
				ctx.diagnostics.push(
					diagnostic.unparseableMessage(
						ctx.source,
						value.start,
						key,
						parsed.error,
					),
				)
		} else {
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					ctx.source,
					value.start,
					`\`export const i18n\` value for \`${key}\` must be a string literal — the inline source string is the fallback every locale resolves against and the bytes the staleness manifest hashes.`,
				),
			)
		}
	}
	// LT-190: a dotted key's suffix must be a CLDR plural category — the
	// `<key>.<category>` convention is how per-category word forms (Welsh
	// tasg/tasgiau, Arabic's six forms, English's irregular person/people)
	// ride the flat catalog. A typo'd suffix (`task.onee`) would otherwise
	// silently never resolve; the census treats the suffix as reachability
	// input, so non-category suffixes would corrupt that too.
	for (const key of Object.keys(messages)) {
		const dot = key.lastIndexOf('.')
		if (dot === -1) continue
		const suffix = key.slice(dot + 1)
		if (!PLURAL_CATEGORIES.has(suffix))
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					ctx.source,
					init.start,
					`\`export const i18n\` key \`${key}\` — a dotted key must end in a CLDR plural category (zero, one, two, few, many, other), e.g. \`task.one\` / \`task.other\` (ADR 0030 sub-design 4, LT-190). Rename the key with a category suffix, or drop the dot.`,
				),
			)
	}
	return { messages, args }
}

/**
 * The identifier the component's parameter pattern binds for `lang`, or
 * null. Searched at the top level of the pattern and inside a nested
 * `i18n` destructuring (`i18n: { lang }` — ADR 0030's example shape), so
 * either spelling gives the emitter a render-scope name for the effective
 * locale (the root `lang` attribute and `truc:case` pruning both need it).
 * A component binding `lang` in BOTH places cannot compile (duplicate
 * binding), so first match wins is unambiguous.
 */
export const langBindingOf = (paramsNode: AstNode | null): string | null => {
	if (!paramsNode || paramsNode.type !== 'ObjectPattern') return null
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property') continue
		const key = identifierName(prop.key)
		const value = prop.value
		if (!key || !isNode(value)) continue
		if (key === 'lang') {
			const bound = new Set<string>()
			collectBoundNames(value, bound)
			const name = [...bound][0]
			if (name) return name
		}
		if (key === 'i18n' && value.type === 'ObjectPattern') {
			for (const inner of asArray(value.properties)) {
				if (inner.type !== 'Property') continue
				if (identifierName(inner.key) !== 'lang') continue
				if (!isNode(inner.value)) continue
				const bound = new Set<string>()
				collectBoundNames(inner.value, bound)
				const name = [...bound][0]
				if (name) return name
			}
		}
	}
	return null
}

/**
 * The component's authored `lang` default (`lang = 'en'` in the parameter
 * pattern), or null. This is ADR 0030 sub-design 3's precedence anchor: at
 * a compose site the record's locale is the site's own `lang` arg when one
 * is authored, else this default, else the build's page locale.
 */
export const langArgDefaultOf = (paramsNode: AstNode | null): string | null => {
	if (!paramsNode || paramsNode.type !== 'ObjectPattern') return null
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property') continue
		if (identifierName(prop.key) !== 'lang') continue
		const value = prop.value
		if (
			isNode(value) &&
			value.type === 'AssignmentPattern' &&
			isNode(value.right) &&
			value.right.type === 'Literal' &&
			typeof value.right.value === 'string'
		)
			return value.right.value
		return null
	}
	return null
}

/**
 * Whether the parameter pattern declares the reserved `i18n` parameter
 * (top-level property named `i18n` — `collectBoundNames` sees only leaf
 * bindings, so the reserved name itself has to be looked up by key).
 */
export const declaresI18nOf = (paramsNode: AstNode | null): boolean => {
	if (!paramsNode || paramsNode.type !== 'ObjectPattern') return false
	return asArray(paramsNode.properties).some(
		prop => prop.type === 'Property' && identifierName(prop.key) === 'i18n',
	)
}

/**
 * The names a parameter pattern binds for the reserved record's `t`
 * (`i18n: { t }`, `i18n: { t: tr }`) and for the whole record (`{ i18n }`,
 * read as `i18n.t.<key>`) — the two spellings a message site can take.
 */
const messageBindingsOf = (
	paramsNode: AstNode | null,
): { tNames: Set<string>; recordNames: Set<string> } => {
	const tNames = new Set<string>()
	const recordNames = new Set<string>()
	if (!paramsNode || paramsNode.type !== 'ObjectPattern')
		return { tNames, recordNames }
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property' || identifierName(prop.key) !== 'i18n')
			continue
		const value = prop.value
		if (isNode(value) && value.type === 'Identifier')
			recordNames.add(String(value.name))
		if (!isNode(value) || value.type !== 'ObjectPattern') continue
		for (const inner of asArray(value.properties)) {
			if (inner.type !== 'Property' || identifierName(inner.key) !== 't')
				continue
			const name = identifierName(inner.value)
			if (name) tNames.add(name)
		}
	}
	return { tNames, recordNames }
}

/** `{ a, b }` → `a` and `b`, for a closed list in copy. */
const argList = (names: readonly string[]): string =>
	names.map(name => `\`${name}\``).join(', ')

/**
 * Check every `t.<key>` site in the component function against the key's
 * parsed source pattern (LT-250, ADR 0030 s4) — LTC055. Runs in the shared
 * post-lowering pass so the rule cannot drift between the two authored
 * surfaces: it walks the function's ESTree (parameters and body), which
 * both front ends produce, rather than either surface's lowered template.
 *
 * - An argument message (`args` non-empty) must be CALLED with one object
 *   literal naming exactly its arguments — no spread, no computed key: the
 *   build checks the record statically, and a record it cannot see is one
 *   it cannot check. A bare read renders a function.
 * - An argument-less message is a string; calling it is an error.
 *
 * A key with no entry in `args` (undeclared — the TypeScript channel's,
 * LT-308 — or unparseable, already LTC055) is skipped, and so is a
 * computed `t[key]` whose key is not a string literal. Shadowing is not tracked: a local named like the `t`
 * binding would be checked too, which no corpus component does.
 */
export const reportMessageCallSites = (
	ctx: ExtractContext,
	componentFn: AstNode,
	args: Readonly<Record<string, readonly MessageArg[]>>,
): void => {
	const params = asArray(componentFn.params)[0] ?? null
	const { tNames, recordNames } = messageBindingsOf(params)
	if (tNames.size === 0 && recordNames.size === 0) return
	const keyOf = (member: AstNode): string | null => {
		if (member.type !== 'MemberExpression') return null
		// A string-literal computed key (`t['task.one']`) is as static as a
		// dotted one; any other computed key is not a site this can check.
		const property = member.property
		const key = !member.computed
			? identifierName(property)
			: isNode(property) &&
					property.type === 'Literal' &&
					typeof property.value === 'string'
				? property.value
				: null
		if (key === null) return null
		const object = member.object
		if (!isNode(object)) return null
		const isT =
			(object.type === 'Identifier' && tNames.has(String(object.name))) ||
			(object.type === 'MemberExpression' &&
				!object.computed &&
				identifierName(object.property) === 't' &&
				isNode(object.object) &&
				object.object.type === 'Identifier' &&
				recordNames.has(String(object.object.name)))
		return isT ? key : null
	}
	const check = (member: AstNode, key: string, call: AstNode | null): void => {
		const expected = args[key]
		if (expected === undefined) return
		const report = (problem: string) =>
			ctx.diagnostics.push(
				diagnostic.messageArgumentMismatch(
					ctx.source,
					(call ?? member).start,
					key,
					problem,
				),
			)
		const names = expected.map(arg => arg.name)
		if (expected.length === 0) {
			if (call)
				report(
					'is called, but its pattern takes no arguments — it is a plain string. Drop the call',
				)
			return
		}
		if (!call) {
			report(
				`is read without a call, but its pattern takes ${argList(names)} — it is a function, and would render as one. Call it: \`t.${key}({ ${names.join(', ')} })\``,
			)
			return
		}
		const callArgs = asArray(call.arguments)
		const record = callArgs[0]
		if (callArgs.length !== 1 || record?.type !== 'ObjectExpression') {
			report(
				`must be called with one object literal naming its arguments (${argList(names)})`,
			)
			return
		}
		const passed: string[] = []
		for (const prop of asArray(record.properties)) {
			const name =
				prop.type === 'Property' && !prop.computed
					? (identifierName(prop.key) ??
						(isNode(prop.key) &&
						prop.key.type === 'Literal' &&
						typeof prop.key.value === 'string'
							? prop.key.value
							: null))
					: null
			if (name === null) {
				report(
					'is called with a spread or computed key — the build can only check an argument record whose keys it can read',
				)
				return
			}
			passed.push(name)
		}
		const missing = names.filter(name => !passed.includes(name))
		const extra = passed.filter(name => !names.includes(name))
		if (missing.length === 0 && extra.length === 0) return
		report(
			[
				missing.length > 0 ? `is missing ${argList(missing)}` : '',
				extra.length > 0
					? `passes ${argList(extra)}, which its pattern never reads`
					: '',
			]
				.filter(Boolean)
				.join(' and '),
		)
	}
	const visit = (node: unknown, parent: AstNode | null): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child, parent)
			return
		}
		if (!isNode(node)) return
		const key = keyOf(node)
		if (key !== null) {
			const call =
				parent?.type === 'CallExpression' && parent.callee === node
					? parent
					: null
			check(node, key, call)
		}
		for (const [field, value] of Object.entries(node)) {
			if (field === 'loc' || field === 'range' || field === 'parent') continue
			if (value && typeof value === 'object') visit(value, node)
		}
	}
	visit(componentFn.body, componentFn)
}
