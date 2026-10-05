/**
 * The per-field harvest's front-end half (ADR 0046 s7, LT-429): a
 * `createList` declaration's item type, read syntactically, and the
 * `harvest()` marker's parser map.
 *
 * The compiler has no type checker, so the item type is resolved from the
 * source alone: the declaring call's first type argument, else the element
 * type of the seed arg's annotation, followed through a same-file `type`
 * alias or an `interface` without `extends`. A field's parser is inferred
 * from its type (`string` and string-literal unions → `asString`, `number`
 * → `asNumber`, `boolean` → `asBoolean`); anything else has none, and only
 * a `harvest()` entry can declare it.
 */

import type { AstNode } from './ast-node'
import { asArray, identifierName, isNode, nodeType, text } from './ast-utils'
import type { ExtractContext } from './extract-context'
import { claimMarker, markerOf } from './imports'
import type {
	HarvestSeedIR,
	InferredParserIR,
	ListItemFieldIR,
	ListItemIR,
} from './ir'

/* === Internal Functions === */

/** How deep alias chains are followed before the type counts as opaque. */
const MAX_ALIAS_DEPTH = 8

/** A `TSTypeAnnotation` wrapper's inner type, or the node itself. */
const unwrapAnnotation = (node: AstNode): AstNode =>
	node.type === 'TSTypeAnnotation' && isNode(node.typeAnnotation)
		? (node.typeAnnotation as AstNode)
		: node

/** A call's type arguments, under either parser's key. */
const typeArgumentsOf = (call: AstNode): AstNode[] => {
	const args = call.typeArguments ?? call.typeParameters
	return isNode(args) ? asArray(args.params) : []
}

/**
 * Follow a bare `TSTypeReference` to the same-file declaration it names: a
 * `type` alias's right-hand side, or an `interface` without `extends` (its
 * body). Anything else — a generic reference, an imported name, an
 * interface that extends — is returned unchanged.
 */
const followAlias = (
	node: AstNode,
	types: ReadonlyMap<string, AstNode>,
	depth = 0,
): AstNode => {
	if (depth > MAX_ALIAS_DEPTH || node.type !== 'TSTypeReference') return node
	if (typeArgumentsOf(node).length > 0) return node
	const name = identifierName(node.typeName)
	const decl = name ? types.get(name) : undefined
	if (!decl) return node
	if (decl.type === 'TSTypeAliasDeclaration' && isNode(decl.typeAnnotation))
		return followAlias(decl.typeAnnotation as AstNode, types, depth + 1)
	if (
		decl.type === 'TSInterfaceDeclaration' &&
		asArray(decl.extends).length === 0 &&
		isNode(decl.body)
	)
		return decl.body as AstNode
	return node
}

/** A string-literal type: `'a'`. */
const isStringLiteralType = (node: AstNode): boolean =>
	node.type === 'TSLiteralType' &&
	isNode(node.literal) &&
	typeof (node.literal as AstNode).value === 'string'

/** The parser a field type infers (LT-440's mapping), or null. */
const parserForField = (
	annotation: AstNode,
	types: ReadonlyMap<string, AstNode>,
	source: string,
): InferredParserIR | null => {
	const resolved = followAlias(unwrapAnnotation(annotation), types)
	switch (resolved.type) {
		case 'TSStringKeyword':
			return { name: 'asString', cast: null }
		case 'TSNumberKeyword':
			return { name: 'asNumber', cast: null }
		case 'TSBooleanKeyword':
			return { name: 'asBoolean', cast: null }
	}
	const literal =
		isStringLiteralType(resolved) ||
		(resolved.type === 'TSUnionType' &&
			asArray(resolved.types).length > 0 &&
			asArray(resolved.types).every(isStringLiteralType))
	return literal
		? { name: 'asString', cast: text(source, unwrapAnnotation(annotation)) }
		: null
}

/** The fields of a type literal or interface body, in declaration order. */
const fieldsOf = (
	members: AstNode[],
	types: ReadonlyMap<string, AstNode>,
	source: string,
): ListItemFieldIR[] => {
	const fields: ListItemFieldIR[] = []
	for (const member of members) {
		if (member.type !== 'TSPropertySignature' || member.computed) continue
		const key = member.key as AstNode | undefined
		const name =
			identifierName(key) ??
			(nodeType(key) === 'Literal' && typeof key?.value === 'string'
				? key.value
				: null)
		if (!name || !isNode(member.typeAnnotation)) continue
		const annotation = member.typeAnnotation as AstNode
		const authored = text(source, unwrapAnnotation(annotation))
		// An optional field may be `undefined` on the server, which no
		// inferred parser reproduces (an absent site reads the parser's
		// fallback): only a `harvest()` entry declares its parser.
		fields.push(
			member.optional
				? { name, typeText: `${authored} | undefined`, parser: null }
				: {
						name,
						typeText: authored,
						parser: parserForField(annotation, types, source),
					},
		)
	}
	return fields
}

/** An item type node's shape (ADR 0046 s7). */
const shapeOf = (
	node: AstNode,
	types: ReadonlyMap<string, AstNode>,
	source: string,
): ListItemIR['shape'] => {
	const resolved = followAlias(node, types)
	switch (resolved.type) {
		case 'TSStringKeyword':
		case 'TSNumberKeyword':
		case 'TSBooleanKeyword':
			return { kind: 'scalar' }
		case 'TSTypeLiteral':
			return {
				kind: 'fields',
				fields: fieldsOf(asArray(resolved.members), types, source),
			}
		case 'TSInterfaceBody':
			return {
				kind: 'fields',
				fields: fieldsOf(asArray(resolved.body), types, source),
			}
		default:
			return { kind: 'opaque' }
	}
}

/** `T[]`, `readonly T[]`, `Array<T>`, `ReadonlyArray<T>` → `T`, else null. */
const elementTypeOf = (
	node: AstNode,
	types: ReadonlyMap<string, AstNode>,
): AstNode | null => {
	const resolved = followAlias(unwrapAnnotation(node), types)
	if (resolved.type === 'TSArrayType' && isNode(resolved.elementType))
		return resolved.elementType as AstNode
	if (resolved.type === 'TSTypeOperator' && isNode(resolved.typeAnnotation))
		return elementTypeOf(resolved.typeAnnotation as AstNode, types)
	if (resolved.type === 'TSTypeReference') {
		const name = identifierName(resolved.typeName)
		const args = typeArgumentsOf(resolved)
		if ((name === 'Array' || name === 'ReadonlyArray') && args.length === 1)
			return args[0] as AstNode
	}
	// `rows?: T[]` arrives as the bare array type; an explicit
	// `T[] | undefined` keeps its one array member.
	if (resolved.type === 'TSUnionType') {
		const members = asArray(resolved.types).filter(
			m => m.type !== 'TSUndefinedKeyword' && m.type !== 'TSNullKeyword',
		)
		if (members.length === 1) return elementTypeOf(members[0] as AstNode, types)
	}
	return null
}

/** The annotation of a destructured server arg, through a same-file alias. */
const argAnnotation = (
	paramsNode: AstNode | null,
	name: string,
	types: ReadonlyMap<string, AstNode>,
): AstNode | null => {
	if (!paramsNode || !isNode(paramsNode.typeAnnotation)) return null
	const literal = followAlias(
		unwrapAnnotation(paramsNode.typeAnnotation as AstNode),
		types,
	)
	const members =
		literal.type === 'TSTypeLiteral'
			? asArray(literal.members)
			: literal.type === 'TSInterfaceBody'
				? asArray(literal.body)
				: []
	for (const member of members) {
		if (member.type !== 'TSPropertySignature') continue
		if (identifierName(member.key) === name && isNode(member.typeAnnotation))
			return member.typeAnnotation as AstNode
	}
	return null
}

/**
 * The field a `keyConfig` returns verbatim: `item => item.id`, or
 * `item => item['id']`. Any other key function derives the key, so no
 * field comes from `data-key`.
 */
const keyFieldOf = (options: unknown): string | null => {
	if (nodeType(options) !== 'ObjectExpression') return null
	for (const prop of asArray((options as AstNode).properties)) {
		if (prop.type !== 'Property' || identifierName(prop.key) !== 'keyConfig')
			continue
		const fn = prop.value as AstNode | undefined
		if (nodeType(fn) !== 'ArrowFunctionExpression') return null
		const params = asArray(fn?.params)
		const param = params.length === 1 ? identifierName(params[0]) : null
		const body = fn?.body as AstNode | undefined
		if (!param || nodeType(body) !== 'MemberExpression') return null
		if (identifierName(body?.object) !== param) return null
		const property = body?.property as AstNode | undefined
		if (!body?.computed) return identifierName(property)
		return nodeType(property) === 'Literal' &&
			typeof property?.value === 'string'
			? property.value
			: null
	}
	return null
}

/* === Exported Functions === */

/** The module's own `type` aliases and interfaces, by name (exported or not). */
export const collectModuleTypes = (
	ast: AstNode,
): ReadonlyMap<string, AstNode> => {
	const types = new Map<string, AstNode>()
	for (const stmt of asArray(ast.body)) {
		const decl =
			stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
				? (stmt.declaration as AstNode)
				: stmt
		if (
			decl.type !== 'TSTypeAliasDeclaration' &&
			decl.type !== 'TSInterfaceDeclaration'
		)
			continue
		const name = identifierName(decl.id)
		// A merged interface (two declarations of one name) or a generic
		// declaration is not one readable shape.
		if (!name || types.has(name) || isNode(decl.typeParameters)) {
			if (name) types.set(name, { type: 'Unreadable' })
			continue
		}
		types.set(name, decl)
	}
	return types
}

/**
 * A `createList` call's item type (ADR 0046 s7): the first type argument,
 * else the element type of the seed arg's annotation (`seed` is the seed a
 * `harvest()` marker wraps, when there is one).
 */
export const resolveListItem = (
	ctx: ExtractContext,
	call: AstNode,
	seed: AstNode | null,
	paramsNode: AstNode | null,
	paramNames: ReadonlySet<string>,
): ListItemIR => {
	const types = ctx.moduleTypes
	const keyField = keyFieldOf(asArray(call.arguments)[1])
	const explicit = typeArgumentsOf(call)[0]
	const seedName = identifierName(seed)
	const annotation =
		!explicit && seedName && paramNames.has(seedName)
			? argAnnotation(paramsNode, seedName, types)
			: null
	const itemType =
		explicit ?? (annotation ? elementTypeOf(annotation, types) : null)
	if (!itemType) return { typeText: null, shape: { kind: 'unknown' }, keyField }
	return {
		typeText: text(ctx.source, itemType),
		shape: shapeOf(itemType, types, ctx.source),
		keyField,
	}
}

/**
 * Why a `harvest()` call cannot be read, or its seed and parser. The list
 * form is `harvest(seed, { field: parser, … })` with a literal map of
 * plain keys; the scalar form is `harvest(seed, parser)` (LT-443).
 */
export type HarvestCall =
	| {
			form: 'list'
			seed: AstNode
			marker: Extract<HarvestSeedIR, { kind: 'list' }>
	  }
	| {
			form: 'scalar'
			seed: AstNode
			marker: Extract<HarvestSeedIR, { kind: 'scalar' }>
	  }
	| { form: 'malformed'; call: AstNode; what: string; fix: string }

/**
 * Read a `harvest()` marker call. `node` is a call expression; null when
 * its callee is not the marker (ADR 0034 s1: resolved by binding, through
 * the enclosing scopes' declarations in `enclosing`).
 */
export const harvestCallOf = (
	ctx: ExtractContext,
	node: unknown,
	enclosing: Iterable<string> = [],
): HarvestCall | null => {
	if (nodeType(node) !== 'CallExpression') return null
	const call = node as AstNode
	if (markerOf(ctx, call.callee, enclosing) !== 'harvest') return null
	// Read here, refused or not: whatever the caller reports names it, so
	// the unclaimed-marker sweep does not report it again.
	claimMarker(ctx, call.callee)
	const [seed, second, ...rest] = asArray(call.arguments)
	if (!seed || !second || rest.length > 0)
		return {
			form: 'malformed',
			call,
			what: 'A `harvest()` call other than `harvest(seed, { field: parser, … })` or `harvest(seed, parser)`',
			fix: 'Pass the seed, then an object literal with one `field: parser` entry per field — or, for a scalar seed, one parser.',
		}
	if (second.type === 'ObjectExpression') {
		const entries: Extract<HarvestSeedIR, { kind: 'list' }>['entries'] = []
		for (const prop of asArray((second as AstNode).properties)) {
			const key = prop.key as AstNode | undefined
			const field =
				prop.type === 'Property' && !prop.computed && prop.kind === 'init'
					? (identifierName(key) ??
						(nodeType(key) === 'Literal' && typeof key?.value === 'string'
							? key.value
							: null))
					: null
			if (!field || prop.method || !isNode(prop.value))
				return {
					form: 'malformed',
					call,
					what: 'A `harvest()` parser map entry other than `field: parser`',
					fix: 'Write each entry as `field: parser`, with a plain field name — no spread, method or computed key.',
				}
			const value = prop.value as AstNode
			entries.push({
				field,
				key: key as AstNode,
				value,
				text: text(ctx.source, value),
			})
		}
		return {
			form: 'list',
			seed,
			marker: { kind: 'list', call, entries },
		}
	}
	return {
		form: 'scalar',
		seed,
		marker: {
			kind: 'scalar',
			call,
			parser: second,
			parserText: text(ctx.source, second),
		},
	}
}
