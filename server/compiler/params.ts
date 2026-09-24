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
	CONTEXT_NAMES,
	collectBoundNames,
	FACTORY_CONTEXT_MEMBERS,
	identifierName,
	isNode,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import { ambientRecordViolations } from './fold-inputs'
import { isOptionalBinding } from './infer-type'
import type { ExtractContext } from './ir'

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
				fn.start,
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
				diagnostic.defaultOnRequiredProp(ctx.source, prop.start, bindingName),
			)
	}
	// LT-258 (ADR 0034 s4): the reserved `i18n` record yields only the
	// declared page-ambient members.
	ctx.diagnostics.push(...ambientRecordViolations(ctx.source, paramsNode))

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
					contextNode.start,
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
				diagnostic.badFactoryContextParam(ctx.source, contextNode.start, bad),
			)
			return null
		}
		contextParam = {
			names,
			annotationName: contextAnnotationName(fn, contextNode),
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
 *
 * Two AST shapes carry it: the `.tsx` converter strips type annotations
 * but attaches the original TypeScript function node (`tsNode`), whose
 * parameter's type reads back as text — duck-typed, so this shared module
 * never imports `typescript` (browser purity, ADR 0025 sub-design 6). The
 * `.tsrx` parser keeps an estree-shaped `typeAnnotation` on the node.
 */
const contextAnnotationName = (
	fn: AstNode,
	contextNode: AstNode,
): 'FactoryContext' | 'FormFactoryContext' | null => {
	const written = (
		fn as {
			tsNode?: {
				parameters?: ReadonlyArray<{
					type?: { getText?: () => string }
				}>
			}
		}
	).tsNode?.parameters?.[1]?.type?.getText?.()
	if (typeof written === 'string') {
		const name = /^([A-Za-z_$][\w$]*)/.exec(written)?.[1]
		if (name === 'FactoryContext' || name === 'FormFactoryContext') return name
		return null
	}
	if (isNode(contextNode.typeAnnotation)) {
		const wrapped = contextNode.typeAnnotation as AstNode
		const literal =
			wrapped.type === 'TSTypeAnnotation' && isNode(wrapped.typeAnnotation)
				? (wrapped.typeAnnotation as AstNode)
				: wrapped
		if (literal.type === 'TSTypeReference') {
			const name = identifierName(literal.typeName)
			if (name === 'FactoryContext' || name === 'FormFactoryContext')
				return name
		}
	}
	return null
}
