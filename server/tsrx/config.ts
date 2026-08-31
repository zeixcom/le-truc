/**
 * `export const config = { … }` extraction (ADR 0023 sub-design 8) —
 * extension activation, one small self-contained parse `compiler.ts`'s
 * `compileSource` calls per module-level statement. (Compose-import
 * resolution moved to `imports.ts`, LT-044.)
 */

import type { TsrxNode } from '@tsrx/core'
import { asArray, identifierName, isNode } from './ast-utils'
import { diagnostic } from './diagnostics'
import type { ConfigIR, ExtractContext } from './ir'

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
	const config: ConfigIR = {
		form: null,
		observedAttributes: [],
	}
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
