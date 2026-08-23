/**
 * Signal value-type inference (`compiler.ts`'s `compileSource` uses this to
 * fill `SignalIR.inferredType`, consumed by parser/harvest-default
 * selection). A small, closed unit: given a signal's initializer expression
 * and the component's params/setup context, infer `string`/`number`/
 * `boolean`/`unknown` by walking literals, template literals, identifier
 * type annotations, and setup helper call/return types.
 */

import type { TsrxNode } from '@tsrx/core'
import { asArray, identifierName, isNode } from './ast-utils'

export type TypeContext = {
	paramsNode: TsrxNode | null
	setupInits: Map<string, TsrxNode>
}

/** Infer a signal's TS-ish value type, for parser and harvest defaults. */
export const inferType = (
	init: TsrxNode | null,
	ctx: TypeContext,
	depth = 0,
): 'string' | 'number' | 'boolean' | 'unknown' => {
	if (!init || depth > 6) return 'unknown'
	switch (init.type) {
		case 'Literal': {
			const value = init.value
			if (typeof value === 'number') return 'number'
			if (typeof value === 'boolean') return 'boolean'
			if (typeof value === 'string') return 'string'
			return 'unknown'
		}
		case 'TemplateLiteral':
			return 'string'
		case 'Identifier': {
			const name = String(init.name)
			const annotation = typeAnnotationForBinding(ctx.paramsNode, name)
			if (annotation) return typeOfAnnotation(annotation)
			const setupInit = ctx.setupInits.get(name)
			if (setupInit && setupInit !== init)
				return inferType(setupInit, ctx, depth + 1)
			return 'unknown'
		}
		case 'CallExpression':
		case 'OptionalCallExpression': {
			const calleeName = identifierName(init.callee)
			if (calleeName) {
				const fn = ctx.setupInits.get(calleeName)
				if (fn && fn !== init) return returnTypeOfFunction(fn, ctx, depth + 1)
			}
			return 'unknown'
		}
		default:
			return 'unknown'
	}
}

/** Return-type heuristic for setup helper arrows (`(id) => \`panel-${id}\``). */
export const returnTypeOfFunction = (
	fn: TsrxNode,
	ctx: TypeContext,
	depth: number,
): 'string' | 'number' | 'boolean' | 'unknown' => {
	if (isNode(fn.returnType)) {
		const t = typeOfAnnotation(fn.returnType as TsrxNode)
		if (t !== 'unknown') return t
	}
	const body = fn.body
	if (!isNode(body)) return 'unknown'
	if (body.type === 'BlockStatement') {
		const stmts = asArray(body.body)
		const ret = stmts.find(s => s.type === 'ReturnStatement')
		if (ret && isNode(ret.argument)) return inferType(ret.argument, ctx, depth)
		return 'unknown'
	}
	return inferType(body, ctx, depth)
}

export const typeAnnotationForBinding = (
	paramsNode: TsrxNode | null,
	bindingName: string,
): TsrxNode | null => {
	if (!paramsNode || !isNode(paramsNode.typeAnnotation)) return null
	const wrapped = paramsNode.typeAnnotation as TsrxNode
	const literal =
		wrapped.type === 'TSTypeAnnotation' && isNode(wrapped.typeAnnotation)
			? (wrapped.typeAnnotation as TsrxNode)
			: wrapped
	if (literal.type !== 'TSTypeLiteral') return null
	for (const member of asArray(literal.members)) {
		if (member.type !== 'TSPropertySignature') continue
		if (
			identifierName(member.key) === bindingName &&
			isNode(member.typeAnnotation)
		)
			return member.typeAnnotation as TsrxNode
	}
	return null
}

export const typeOfAnnotation = (
	annotation: TsrxNode,
): 'string' | 'number' | 'boolean' | 'unknown' => {
	const inner =
		annotation.type === 'TSTypeAnnotation' && isNode(annotation.typeAnnotation)
			? (annotation.typeAnnotation as TsrxNode)
			: annotation
	switch (inner.type) {
		case 'TSStringKeyword':
			return 'string'
		case 'TSNumberKeyword':
			return 'number'
		case 'TSBooleanKeyword':
			return 'boolean'
		default:
			return 'unknown'
	}
}
