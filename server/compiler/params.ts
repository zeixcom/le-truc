/**
 * The component function's params contract, shared by both front ends
 * (LT-202, ADR 0032 sub-design 6: the anti-drift half of the dual
 * front-end contract): exactly one destructured args object (LTC008)
 * plus, per the LT-209 convention, an optional author-annotated
 * factory-context parameter. Front-end-neutral like the other front-end
 * stage modules: no parser values, only the loose `AstNode` type.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	collectBoundNames,
	identifierName,
	isHandlerArgName,
	isNode,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import type { ExtractContext } from './extract-context'
import { ambientRecordViolations } from './fold-inputs'
import { isOptionalBinding } from './infer-type'
import type { ChildrenContractIR } from './ir'
import { CONTEXT_NAMES, FACTORY_CONTEXT_MEMBERS } from './vocabulary'

/** The component function's destructured args parameter, extracted. */
export type ComponentParams = {
	paramsNode: AstNode | null
	paramNames: Set<string>
	/**
	 * The authored second (factory-context) parameter, when present — the
	 * `.tsx` precision convention (LT-209; `.tsrx` keeps the ambient
	 * vocabulary). Already validated by `extractParams`: a destructured
	 * object whose bound names are all factory-context vocabulary. The
	 * generated factory destructures the SAME names from its own context,
	 * so body lowering is unchanged. `annotationName` is the written type's
	 * name when it names `FactoryContext`/`FormFactoryContext` — the input
	 * to LTC050's surface check (which needs `config`, known later).
	 */
	contextParam: {
		names: ReadonlySet<string>
		annotationName: 'FactoryContext' | 'FormFactoryContext' | null
		/**
		 * The written type reference, when `annotationName` names one of
		 * the two checked types (LT-358b) — LTC050 reports its range.
		 */
		annotation: AstNode | null
	} | null
}

/**
 * Validate the component function's parameter list: exactly one destructured
 * args object (LTC008) — plus, per the LT-209 convention, an optional
 * second, author-annotated factory-context parameter. Pushes the diagnostic
 * and returns null otherwise. A destructured default paired with a
 * non-optional type is LTC032 (CHECKLIST §10): the type annotation is what
 * callers see, and it says the prop is required, so the default is
 * unreachable for any external caller.
 */
export const extractParams = (
	ctx: ExtractContext,
	filename: string,
	fn: AstNode,
): ComponentParams | null => {
	const params = asArray(fn.params)
	const paramsNode = (params[0] as AstNode | undefined) ?? null
	if (params.length > 2 || paramsNode?.type !== 'ObjectPattern') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				fn,
				`${filename}: the component function must take a single destructured args object (plus, optionally, a typed factory-context parameter: \`, { host, expose }: FactoryContext<Props>\`).`,
			),
		)
		return null
	}
	const paramNames = new Set<string>()
	if (paramsNode) collectBoundNames(paramsNode, paramNames)
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property' || !isNode(prop.value)) continue
		if (prop.value.type !== 'AssignmentPattern') continue
		const bindingName = identifierName(prop.value.left)
		if (bindingName && !isOptionalBinding(paramsNode, bindingName))
			ctx.diagnostics.push(
				diagnostic.defaultOnRequiredProp(ctx.source, prop, bindingName),
			)
	}
	// LT-258 (ADR 0034 s4): the reserved `i18n` record yields only the
	// declared page-ambient members.
	ctx.diagnostics.push(...ambientRecordViolations(ctx.source, paramsNode))
	ctx.handlerArgs = readHandlerArgs(ctx, paramsNode)
	ctx.childrenContract = readChildrenContract(ctx, paramsNode)

	// The factory-context parameter (LT-209): the author's opt IN to precise
	// context typing. Names shadow the profile ambients at function scope;
	// the compiler only validates the vocabulary — the generated factory
	// destructures the same names, so body lowering is unchanged. Type-only
	// imports of the annotation never reach generated output
	// (`parseLeTrucImports` skips type-only statements; LTC037 keeps the
	// vocabulary out of value imports).
	let contextParam: ComponentParams['contextParam'] = null
	const contextNode = (params[1] as AstNode | undefined) ?? undefined
	if (contextNode !== undefined) {
		if (contextNode.type !== 'ObjectPattern') {
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					ctx.source,
					contextNode,
					`${filename}: the factory-context parameter must be a destructured object: \`, { host, expose }: FactoryContext<Props>\`.`,
				),
			)
			return null
		}
		const names = new Set<string>()
		collectBoundNames(contextNode, names)
		const bad = [...names].filter(
			n => !FACTORY_CONTEXT_MEMBERS.has(n) && !CONTEXT_NAMES.has(n),
		)
		if (bad.length > 0) {
			ctx.diagnostics.push(
				diagnostic.badFactoryContextParam(ctx.source, contextNode, bad),
			)
			return null
		}
		contextParam = {
			names,
			...contextAnnotationName(contextNode),
		}
	}
	return { paramsNode, paramNames, contextParam }
}

/**
 * The written type's name for the factory-context parameter's annotation —
 * `FactoryContext`/`FormFactoryContext` when the annotation names either
 * (bare or generic), null for anything else (an inline type literal, an
 * alias the compiler cannot see through — nothing to check against, the
 * same don't-flag-what-you-can't-see posture as `isOptionalBinding`).
 * `annotation` is the written type, for LTC050's range (LT-358b).
 *
 * Both parsers keep an estree-shaped `typeAnnotation` on the parameter
 * pattern.
 */
const contextAnnotationName = (
	contextNode: AstNode,
): {
	annotationName: 'FactoryContext' | 'FormFactoryContext' | null
	annotation: AstNode | null
} => {
	if (isNode(contextNode.typeAnnotation)) {
		const wrapped = contextNode.typeAnnotation as AstNode
		const literal =
			wrapped.type === 'TSTypeAnnotation' && isNode(wrapped.typeAnnotation)
				? (wrapped.typeAnnotation as AstNode)
				: wrapped
		if (literal.type === 'TSTypeReference') {
			const name = identifierName(literal.typeName)
			if (name === 'FactoryContext' || name === 'FormFactoryContext')
				return { annotationName: name, annotation: literal }
		}
	}
	return { annotationName: null, annotation: null }
}

/**
 * The handler args of the args pattern (LT-461), binding name → arg name:
 * every top-level arg named `on` plus a capital letter. Its type is read
 * syntactically from the parameter annotation — an inline type literal, a
 * same-file alias or interface, an intersection of those — with no checker;
 * one that is not a function type (optionally `| undefined`), or that
 * cannot be read, is LTC081 and declares no handler arg.
 */
const readHandlerArgs = (
	ctx: ExtractContext,
	paramsNode: AstNode,
): Map<string, string> => {
	const handlers = new Map<string, string>()
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property' || prop.computed) continue
		const arg = identifierName(prop.key)
		if (!arg || !isHandlerArgName(arg)) continue
		const value = isNode(prop.value) ? prop.value : null
		const binding = identifierName(
			value?.type === 'AssignmentPattern' ? value.left : value,
		)
		if (!binding) continue
		const type = argTypeOf(ctx, paramsNode.typeAnnotation, arg)
		if (type === null || !isFunctionType(ctx, type)) {
			ctx.diagnostics.push(
				diagnostic.unaddressableHandlerArg(ctx.source, prop, arg, {
					kind: 'not-function',
				}),
			)
			continue
		}
		handlers.set(binding, arg)
	}
	return handlers
}

/** The written type with its `TSTypeAnnotation` wrapper peeled. */
const unwrapType = (node: unknown): AstNode | null => {
	if (!isNode(node)) return null
	return node.type === 'TSTypeAnnotation' && isNode(node.typeAnnotation)
		? (node.typeAnnotation as AstNode)
		: node
}

/** The declared type of `arg` in the args annotation, or null. */
const argTypeOf = (
	ctx: ExtractContext,
	annotation: unknown,
	arg: string,
	depth = 0,
): AstNode | null => {
	const type = unwrapType(annotation)
	if (!type || depth > 8) return null
	const membersOf = (members: unknown): AstNode | null => {
		for (const member of asArray(members))
			if (
				member.type === 'TSPropertySignature' &&
				identifierName(member.key) === arg
			)
				return unwrapType(member.typeAnnotation)
		return null
	}
	switch (type.type) {
		case 'TSTypeLiteral':
			return membersOf(type.members)
		case 'TSIntersectionType':
			for (const part of asArray(type.types)) {
				const found = argTypeOf(ctx, part, arg, depth + 1)
				if (found) return found
			}
			return null
		case 'TSTypeReference': {
			const name = identifierName(type.typeName)
			const decl = name ? ctx.moduleTypes.get(name) : undefined
			if (!decl) return null
			if (decl.type === 'TSInterfaceDeclaration' && isNode(decl.body))
				return membersOf(decl.body.body)
			if (decl.type === 'TSTypeAliasDeclaration')
				return argTypeOf(ctx, decl.typeAnnotation, arg, depth + 1)
			return null
		}
		default:
			return null
	}
}

/**
 * The declared contract of the component's `children` arg (ADR 0048 s2,
 * LT-474), read from its `Children<Roles, Model>` annotation: the roles the
 * child may address the passed content through and the declared content
 * model. The shape is the IR's `ChildrenContractIR` — the record rides the
 * IR for the analysis layer (LTC083's deferred-reference leg).
 */
export type ChildrenContract = ChildrenContractIR

/**
 * The `Children<…>` type reference in `type`, or null: an inline
 * reference, or a same-file alias resolving to one (the same
 * can't-read-it-don't-invent-it posture as `isFunctionType` — tsc owns
 * everything the compiler cannot see).
 */
const childrenReferenceOf = (
	ctx: ExtractContext,
	type: AstNode | null,
	depth = 0,
): AstNode | null => {
	if (!type || depth > 8) return null
	if (type.type !== 'TSTypeReference') return null
	const name = identifierName(type.typeName)
	if (name === 'Children') return type
	const decl = name ? ctx.moduleTypes.get(name) : undefined
	return decl?.type === 'TSTypeAliasDeclaration' && isNode(decl.typeAnnotation)
		? childrenReferenceOf(ctx, unwrapType(decl.typeAnnotation), depth + 1)
		: null
}

/** A type-literal roles argument: the inline literal, or its same-file alias. */
const rolesLiteralOf = (
	ctx: ExtractContext,
	arg: AstNode | undefined,
	depth = 0,
): AstNode | null => {
	if (!arg || !isNode(arg) || depth > 8) return null
	if (arg.type === 'TSTypeLiteral') return arg
	if (arg.type === 'TSTypeReference') {
		const name = identifierName(arg.typeName)
		const decl = name ? ctx.moduleTypes.get(name) : undefined
		const aliased =
			decl?.type === 'TSTypeAliasDeclaration' && isNode(decl.typeAnnotation)
				? unwrapType(decl.typeAnnotation)
				: null
		return aliased !== null ? rolesLiteralOf(ctx, aliased, depth + 1) : null
	}
	return null
}

/**
 * The model argument as a string literal: the inline literal, or its
 * same-file alias — the same readable shape `rolesLiteralOf` accepts.
 * Anything else (an imported name, a union) reads null: tsc owns it, the
 * `Model` union constraint rejects anything but `'any'`/`'non-interactive'`
 * at authored typecheck (LT-477).
 */
const modelLiteralOf = (
	ctx: ExtractContext,
	arg: AstNode | undefined,
	depth = 0,
): string | null => {
	if (!arg || !isNode(arg) || depth > 8) return null
	if (
		arg.type === 'TSLiteralType' &&
		isNode(arg.literal) &&
		(arg.literal as AstNode).type === 'Literal' &&
		typeof (arg.literal as AstNode).value === 'string'
	)
		return (arg.literal as AstNode).value as string
	if (arg.type === 'TSTypeReference') {
		const name = identifierName(arg.typeName)
		const decl = name ? ctx.moduleTypes.get(name) : undefined
		const aliased =
			decl?.type === 'TSTypeAliasDeclaration' && isNode(decl.typeAnnotation)
				? unwrapType(decl.typeAnnotation)
				: null
		return aliased !== null ? modelLiteralOf(ctx, aliased, depth + 1) : null
	}
	return null
}

/** The declared contract of `children` in the args annotation, or null. */
export const readChildrenContract = (
	ctx: ExtractContext,
	paramsNode: AstNode,
): ChildrenContract | null => {
	const member = argTypeOf(ctx, paramsNode.typeAnnotation, 'children')
	const reference = childrenReferenceOf(ctx, member)
	// An annotation the compiler cannot see through — an imported alias of
	// `Children`, a qualified name, an imported custom type — may still
	// declare roles the author wrote (LT-474 review): recorded as
	// `unreadable`, so LTC083's copy does not name a role the author
	// declared. A readable non-reference (`children?: string`) declares no
	// roles and keeps the plain read.
	if (!reference)
		return member?.type === 'TSTypeReference'
			? { roles: new Map(), model: 'any', unreadable: true }
			: null
	const typeArgs = asArray(
		isNode(reference.typeArguments)
			? ((reference.typeArguments as AstNode).params as unknown)
			: [],
	)
	const roles = new Map<string, string | null>()
	const rolesLiteral = rolesLiteralOf(ctx, typeArgs[0] as AstNode | undefined)
	// A roles argument that is present but unreadable — an imported name,
	// a union, anything but an inline type literal or its same-file alias —
	// is the same recorded unreadability (LT-474 review). An ABSENT
	// argument declares no roles and reads plain.
	const unreadable = rolesLiteral === null && typeArgs[0] !== undefined
	if (rolesLiteral)
		for (const memberNode of asArray(rolesLiteral.members)) {
			if (memberNode.type !== 'TSPropertySignature') continue
			const keyNode = isNode(memberNode.key) ? memberNode.key : null
			const key =
				identifierName(memberNode.key) ??
				(keyNode &&
				keyNode.type === 'Literal' &&
				typeof keyNode.value === 'string'
					? keyNode.value
					: null)
			if (!key) continue
			const tag = unwrapType(memberNode.typeAnnotation)
			roles.set(
				key,
				tag &&
					tag.type === 'TSLiteralType' &&
					isNode(tag.literal) &&
					(tag.literal as AstNode).type === 'Literal' &&
					typeof (tag.literal as AstNode).value === 'string'
					? ((tag.literal as AstNode).value as string)
					: null,
			)
		}
	const modelArg = typeArgs[1]
	const modelValue = modelLiteralOf(ctx, modelArg as AstNode | undefined)
	const model =
		modelValue === 'any' || modelValue === 'non-interactive'
			? modelValue
			: // A model argument present but unreadable — an imported name, a
				// union, anything but the inline literal or its same-file alias —
				// is not a declaration the compiler can act on (LT-477): tsc
				// owns it, and the absence of a readable 'non-interactive'
				// keeps the compose-site check off.
				modelValue === null && modelArg !== undefined
				? null
				: 'any'
	return unreadable ? { roles, model, unreadable } : { roles, model }
}

/**
 * Is `type` a function type: a function type literal, a union of one with
 * `undefined`/`null`, or a same-file alias of either?
 */
const isFunctionType = (
	ctx: ExtractContext,
	type: AstNode,
	depth = 0,
): boolean => {
	if (depth > 8) return false
	switch (type.type) {
		case 'TSFunctionType':
			return true
		case 'TSUnionType': {
			const members = asArray(type.types)
			const fns = members.filter(m => isFunctionType(ctx, m, depth + 1))
			return (
				fns.length > 0 &&
				members.every(
					m =>
						fns.includes(m) ||
						m.type === 'TSUndefinedKeyword' ||
						m.type === 'TSNullKeyword',
				)
			)
		}
		case 'TSTypeReference': {
			const name = identifierName(type.typeName)
			const decl = name ? ctx.moduleTypes.get(name) : undefined
			const aliased =
				decl?.type === 'TSTypeAliasDeclaration'
					? unwrapType(decl.typeAnnotation)
					: null
			return aliased !== null && isFunctionType(ctx, aliased, depth + 1)
		}
		default:
			return false
	}
}
