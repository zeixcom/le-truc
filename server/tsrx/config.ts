/**
 * `export const config = { … }` extraction (ADR 0023 sub-design 8) and
 * `.tsrx` compose-import resolution (ADR 0023 sub-design 10) — two small,
 * self-contained parses `compiler.ts`'s `compileSource` calls once each.
 */

import { posix } from 'node:path'
import type { TsrxNode } from '@tsrx/core'
import { asArray, identifierName, isNode } from './ast-utils'
import type { ConfigIR, ExtractContext } from './compiler'
import { diagnostic } from './diagnostics'

/**
 * Extract and validate `export const config = { … }` — extension activation
 * (ADR 0023 sub-design 8). Unknown keys, wrong value shapes, and combined
 * form variants are errors; the observedAttributes ⊆ Parser-expose check
 * happens after the setup loop (expose is parsed later in source order).
 */
export const readConfig = (
	ctx: ExtractContext,
	stmt: TsrxNode,
): ConfigIR | null => {
	const decl =
		stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
			? stmt.declaration
			: stmt
	if (decl.type !== 'VariableDeclaration' || decl.kind !== 'const') return null
	const declarator = asArray(decl.declarations)[0] ?? null
	if (identifierName(declarator?.id) !== 'config' || !isNode(declarator?.init))
		return null
	const init = declarator.init
	if (init.type !== 'ObjectExpression') {
		ctx.diagnostics.push(
			diagnostic.invalidConfig(
				ctx.source,
				decl.start,
				'`export const config` must be an object literal.',
			),
		)
		return null
	}
	const config: ConfigIR = { form: null, observedAttributes: [] }
	for (const prop of asArray(init.properties)) {
		if (prop.type !== 'Property') continue
		const key = identifierName(prop.key)
		const value = prop.value
		if (!key || !isNode(value)) continue
		if (key === 'formAssociated' || key === 'formAssociatedCheckbox') {
			if (!(value.type === 'Literal' && value.value === true)) {
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						ctx.source,
						prop.start,
						`config.${key} must be \`true\`.`,
					),
				)
				continue
			}
			if (config.form) {
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						ctx.source,
						prop.start,
						'config cannot combine formAssociated and formAssociatedCheckbox — the runtime throws ExtensionCollisionError.',
					),
				)
				continue
			}
			config.form = key === 'formAssociated' ? 'value' : 'checked'
		} else if (key === 'observedAttributes') {
			if (value.type !== 'ArrayExpression') {
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						ctx.source,
						prop.start,
						'config.observedAttributes must be an array of string literals.',
					),
				)
				continue
			}
			for (const element of asArray(value.elements)) {
				if (
					isNode(element) &&
					element.type === 'Literal' &&
					typeof element.value === 'string'
				)
					config.observedAttributes.push(String(element.value))
				else
					ctx.diagnostics.push(
						diagnostic.invalidConfig(
							ctx.source,
							isNode(element) ? element.start : value.start,
							'config.observedAttributes must contain string literals only.',
						),
					)
			}
		} else {
			ctx.diagnostics.push(
				diagnostic.invalidConfig(
					ctx.source,
					prop.start,
					`Unknown config key \`${key}\`. Known keys: formAssociated, formAssociatedCheckbox, observedAttributes.`,
				),
			)
		}
	}
	return config
}

/**
 * Named imports of other `.tsrx` modules (ADR 0023 sub-design 10): local
 * binding name → import specifier resolved to a repo-relative path.
 * `filename` is itself repo-relative, so the specifier resolves against its
 * directory. Only `.tsrx` specifiers compose — anything else (a `.ts`
 * component, a library import) is not a composable import.
 */
export const parseComposeImports = (
	ast: TsrxNode,
	filename: string,
): Map<string, string> => {
	const imports = new Map<string, string>()
	const dir = posix.dirname(filename)
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		const specifierNode = stmt.source
		const specifier =
			isNode(specifierNode) &&
			specifierNode.type === 'Literal' &&
			typeof specifierNode.value === 'string'
				? specifierNode.value
				: null
		if (!specifier || !specifier.endsWith('.tsrx')) continue
		const resolved = posix.normalize(posix.join(dir, specifier))
		for (const spec of asArray(stmt.specifiers)) {
			if (spec.type !== 'ImportSpecifier') continue
			const local = identifierName(spec.local)
			if (local) imports.set(local, resolved)
		}
	}
	return imports
}
