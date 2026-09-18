/**
 * The reserved `i18n` parameter's compiler-side vocabulary (ADR 0030,
 * LT-173). Three concerns live here, all pure:
 *
 * - `readI18nDecl` — extraction of `export const i18n = { key: 'Source', … }`,
 *   the component's own message keys with their source-locale strings inline
 *   (ADR 0030 sub-design 4: no per-component catalog file — a sibling file
 *   would reintroduce the three-file drift ADR 0024 cures). Same extraction
 *   posture as `readConfig` (config.ts), one module-level statement per file.
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

import type { TsrxNode } from '@tsrx/core'
import { asArray, collectBoundNames, identifierName, isNode } from './ast-utils'
import { diagnostic } from './diagnostics'
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

/**
 * Extract and validate `export const i18n = { key: 'Source string', … }` —
 * the component's message keys with their source-locale strings inline
 * (ADR 0030 sub-design 4). Values must be string literals: the source
 * string IS the fallback every locale resolves against, so a computed value
 * would have no stable bytes for the staleness manifest to hash. Null when
 * the statement is not an i18n declaration; a MALFORMED one reports
 * TSRX008 (source shape) and still returns null.
 */
export const readI18nDecl = (
	ctx: ExtractContext,
	stmt: TsrxNode,
): Record<string, string> | null => {
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
	for (const prop of asArray(init.properties)) {
		if (prop.type !== 'Property') continue
		const key = messagesKey(prop.key)
		const value = prop.value
		if (!key || !isNode(value)) continue
		if (value.type === 'Literal' && typeof value.value === 'string') {
			messages[key] = value.value
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
	return messages
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
export const langBindingOf = (paramsNode: TsrxNode | null): string | null => {
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
export const langArgDefaultOf = (
	paramsNode: TsrxNode | null,
): string | null => {
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
export const declaresI18nOf = (paramsNode: TsrxNode | null): boolean => {
	if (!paramsNode || paramsNode.type !== 'ObjectPattern') return false
	return asArray(paramsNode.properties).some(
		prop => prop.type === 'Property' && identifierName(prop.key) === 'i18n',
	)
}
