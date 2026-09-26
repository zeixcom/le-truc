/**
 * TSX spike (LT-183): TypeScript-AST → estree-shaped `AstNode` converter.
 *
 * The reuse thesis is that `ComponentIR` is the seam and
 * everything downstream of the front end — `ast-utils.ts` walks,
 * `reactivity.ts`, `evaluability.ts`, `analysis/*`, both emitters, `sim/` —
 * consumes the estree-shaped loose `AstNode` structural type declared by
 * `server/compiler/ast-node.ts` (`{ type: string; start?; end?; … }`). This
 * module is the NEW bridge the `.tsx` front end needs: it converts the
 * `typescript` package's own AST into exactly those estree shapes, with
 * `start`/`end` brackets that slice the authored `.tsx` source verbatim
 * (`ast-utils.ts`'s `text()`), so every verbatim-slice guarantee carries
 * over unchanged.
 *
 * Coverage is deliberately the sanctioned vocabulary: statements, patterns,
 * expressions, and JSX. Type-only children (annotations, type arguments,
 * return types) are NOT converted — they name types, not values, and the
 * existing walks already refuse to count them (`freeIdentifiers`'s
 * skip-list). The one exception is a function PARAMETER's annotation, which
 * the shared stages read for arg types (LT-298, `withParamAnnotation`). Constructs outside the vocabulary pass through as TS-named
 * passthrough nodes with no value children, so the generic `Object.entries`
 * walks stay conservative (they may miss a read, never invent one); every
 * construct the corpus's authored code uses has a real mapping.
 *
 * Node-kind dispatch uses `ts.*` type guards exclusively: TS 6.0 renamed
 * several `SyntaxKind` display strings (a `const` statement prints as
 * `FirstStatement`), so kind-name switches are wrong by construction.
 */

import * as ts from 'typescript'
import type { AstNode } from '../../ast-node'

export type { AstNode }

/** Exact token-bracket offsets of `node` in `sf` (estree semantics). */
const span = (
	node: ts.Node,
	sf: ts.SourceFile,
): { start: number; end: number } => ({
	start: node.getStart(sf),
	end: node.end,
})

/** A node with only `type` and source span — for unhandled constructs. */
const passthrough = (
	type: string,
	node: ts.Node,
	sf: ts.SourceFile,
): AstNode => ({
	type,
	...span(node, sf),
})

/** Convert a possibly-absent node; `undefined` becomes `null` in parents. */
const conv = (node: ts.Node | undefined, sf: ts.SourceFile): AstNode | null =>
	node === undefined ? null : convert(node, sf)

const convAll = (
	nodes: readonly ts.Node[] | undefined,
	sf: ts.SourceFile,
): AstNode[] =>
	nodes === undefined
		? []
		: nodes.map(n => convert(n, sf)).filter((n): n is AstNode => n !== null)

/** One binding pattern (params, declarator ids) → estree pattern node. */
const convertPattern = (node: ts.Node, sf: ts.SourceFile): AstNode | null => {
	if (ts.isIdentifier(node))
		return { type: 'Identifier', ...span(node, sf), name: node.text }
	if (ts.isObjectBindingPattern(node))
		return {
			type: 'ObjectPattern',
			...span(node, sf),
			properties: node.elements
				.map(el => convertPattern(el, sf))
				.filter((p): p is AstNode => p !== null),
		}
	if (ts.isArrayBindingPattern(node))
		return {
			type: 'ArrayPattern',
			...span(node, sf),
			// An array element has no key: `[a, b = 1, ...rest]` is a bare
			// pattern, not the shorthand `Property` an object element becomes
			// (LT-347: `([entry]) => …` left `entry` free, so the binding
			// walk reported it as a server-only name).
			elements: node.elements.map(el => {
				if (ts.isOmittedExpression(el)) return null
				if (el.dotDotDotToken)
					return {
						type: 'RestElement',
						...span(el, sf),
						argument: convertPattern(el.name, sf),
					}
				const target = convertPattern(el.name, sf)
				return el.initializer
					? {
							type: 'AssignmentPattern',
							...span(el, sf),
							left: target,
							right: conv(el.initializer, sf),
						}
					: target
			}),
		}
	if (ts.isBindingElement(node)) {
		if (node.dotDotDotToken)
			return {
				type: 'RestElement',
				...span(node, sf),
				argument: conv(node.name, sf),
			}
		// `{ a: b }` / `{ i18n: { t } }`: the KEY is `propertyName`, the
		// value the (possibly nested) binding — reading the key off the value
		// lost every renamed or nested arg (LT-298: the reserved `i18n` arg).
		const keyNode = node.propertyName ?? node.name
		const key = ts.isIdentifier(keyNode)
			? { type: 'Identifier', ...span(keyNode, sf), name: keyNode.text }
			: conv(keyNode, sf)
		const target = convertPattern(node.name, sf)
		const value = node.initializer
			? {
					type: 'AssignmentPattern',
					// Bracket the whole `x = d` so the initializer text slices
					// include the element verbatim.
					...span(node, sf),
					left: target,
					right: conv(node.initializer, sf),
				}
			: target
		return {
			type: 'Property',
			...span(node, sf),
			key,
			value,
			computed:
				!!node.propertyName && ts.isComputedPropertyName(node.propertyName),
			shorthand: !node.propertyName,
			kind: 'init',
		}
	}
	return passthrough(`TS${ts.SyntaxKind[node.kind]}`, node, sf)
}

/** estree `Literal` (cooked value + raw text) from a TS literal token. */
const literal = (
	node: ts.Node,
	sf: ts.SourceFile,
	value: string | number | boolean | null,
): AstNode => ({
	type: 'Literal',
	...span(node, sf),
	value,
	raw: sf.text.slice(node.getStart(sf), node.end),
})

/** estree template literal with quasis and substitution expressions. */
const convertTemplate = (
	node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral,
	sf: ts.SourceFile,
): AstNode => ({
	type: 'TemplateLiteral',
	...span(node, sf),
	quasis: (ts.isTemplateExpression(node)
		? [node.head, ...node.templateSpans.map(s => s.literal)]
		: [node]
	).map(q => ({
		type: 'TemplateElement',
		start: q.getStart(sf),
		end: q.end,
		value: { raw: q.text, cooked: q.text },
	})),
	expressions: ts.isTemplateExpression(node)
		? convAll(
				node.templateSpans.map(s => s.expression),
				sf,
			)
		: [],
})

/** Prefix/postfix operator token text for Unary/Update expressions. */
const unaryOperator = (
	node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression,
): string => {
	const op = node.operator as number
	switch (op) {
		case ts.SyntaxKind.PlusPlusToken:
			return '++'
		case ts.SyntaxKind.MinusMinusToken:
			return '--'
		case ts.SyntaxKind.PlusToken:
			return '+'
		case ts.SyntaxKind.MinusToken:
			return '-'
		case ts.SyntaxKind.ExclamationToken:
			return '!'
		case ts.SyntaxKind.TildeToken:
			return '~'
		default:
			return (
				(ts.SyntaxKind as unknown as Record<number, string>)[op] ?? String(op)
			)
	}
}

/**
 * A type node → the estree-TS shape the shared stages read (LT-298). Only
 * what `infer-type.ts` and `paramPropsOf` inspect gets structure: inline
 * type literals with their property signatures (`optional` included), the
 * three primitive keywords, and named references. Anything else is a
 * spanned passthrough, so `text()` still slices its written form.
 */
const convertType = (node: ts.TypeNode, sf: ts.SourceFile): AstNode => {
	if (ts.isTypeLiteralNode(node))
		return {
			type: 'TSTypeLiteral',
			...span(node, sf),
			members: node.members.map(member =>
				ts.isPropertySignature(member) && ts.isIdentifier(member.name)
					? {
							type: 'TSPropertySignature',
							...span(member, sf),
							key: {
								type: 'Identifier',
								...span(member.name, sf),
								name: member.name.text,
							},
							optional: !!member.questionToken,
							typeAnnotation: member.type
								? typeAnnotationOf(member.type, sf)
								: null,
						}
					: passthrough(`TS${ts.SyntaxKind[member.kind]}`, member, sf),
			),
		}
	if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName))
		return {
			type: 'TSTypeReference',
			...span(node, sf),
			typeName: {
				type: 'Identifier',
				...span(node.typeName, sf),
				name: node.typeName.text,
			},
		}
	switch (node.kind) {
		case ts.SyntaxKind.StringKeyword:
			return passthrough('TSStringKeyword', node, sf)
		case ts.SyntaxKind.NumberKeyword:
			return passthrough('TSNumberKeyword', node, sf)
		case ts.SyntaxKind.BooleanKeyword:
			return passthrough('TSBooleanKeyword', node, sf)
		default:
			return passthrough(`TS${ts.SyntaxKind[node.kind]}`, node, sf)
	}
}

const typeAnnotationOf = (node: ts.TypeNode, sf: ts.SourceFile): AstNode => ({
	type: 'TSTypeAnnotation',
	...span(node, sf),
	typeAnnotation: convertType(node, sf),
})

/**
 * A parameter's annotation rides its pattern as `typeAnnotation`, and the
 * pattern's span extends over it — both the shape the `.tsrx` parser
 * produces (LT-298). The args type decides harvest parsers, arg optionality
 * and `string` channels, LTC032, and the server render signature
 * (`paramsText` slices the pattern). Walks already skip the
 * `typeAnnotation` key, so type names never count as value reads.
 */
const withParamAnnotation = (
	pattern: AstNode,
	param: ts.ParameterDeclaration,
	sf: ts.SourceFile,
): AstNode =>
	param.type
		? {
				...pattern,
				end: param.type.end,
				typeAnnotation: typeAnnotationOf(param.type, sf),
			}
		: pattern

/** One function-like (arrow, function expression, declaration). */
const convertFunctionLike = (
	node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
	sf: ts.SourceFile,
	type: string,
): AstNode => ({
	type,
	...span(node, sf),
	id: node.name
		? { type: 'Identifier', ...span(node.name, sf), name: node.name.text }
		: null,
	params: node.parameters.map(p =>
		p.dotDotDotToken
			? ({
					type: 'RestElement',
					...span(p, sf),
					argument: convertPattern(p.name, sf),
				} as AstNode)
			: withParamAnnotation(convertPattern(p.name, sf) as AstNode, p, sf),
	),
	body: conv(node.body, sf),
	async: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
	generator: !!node.asteriskToken,
	// The original TS node, for param-pattern span queries. Safe to attach:
	// every downstream walker guards on `isNode` (a `type` string), and TS
	// nodes carry `.kind` numbers — they are invisible to the walks.
	tsNode: node,
})

/** A JSX attribute name / element tag → estree JSX name node. */
const convertJsxName = (
	node: ts.JsxTagNameExpression,
	sf: ts.SourceFile,
): AstNode | null => {
	if (ts.isIdentifier(node))
		return { type: 'JSXIdentifier', ...span(node, sf), name: node.text }
	if (ts.isJsxNamespacedName(node))
		return {
			type: 'JSXNamespacedName',
			...span(node, sf),
			namespace: {
				type: 'JSXIdentifier',
				...span(node.namespace, sf),
				name: node.namespace.text,
			},
			name: {
				type: 'JSXIdentifier',
				...span(node.name, sf),
				name: node.name.text,
			},
		}
	if (
		node.kind ===
		(ts.SyntaxKind as { JsxMemberExpression?: number }).JsxMemberExpression
	) {
		const member = node as unknown as {
			left: ts.Node & { text?: string }
			right: ts.Node & { text: string }
		}
		return {
			type: 'JSXMemberExpression',
			...span(node, sf),
			object:
				typeof member.left.text === 'string'
					? {
							type: 'JSXIdentifier',
							start: member.left.getStart(sf),
							end: member.left.end,
							name: member.left.text,
						}
					: convertJsxName(
							member.left as unknown as ts.JsxTagNameExpression,
							sf,
						),
			property: { type: 'JSXIdentifier', name: member.right.text },
		}
	}
	return null
}

const convertJsxElementLike = (
	node: ts.JsxElement | ts.JsxSelfClosingElement,
	sf: ts.SourceFile,
): AstNode => {
	// `JsxElement` keeps its attributes on `openingElement`; only the
	// self-closing form carries them directly.
	const attrsParent = ts.isJsxSelfClosingElement(node)
		? node
		: node.openingElement
	const tagName = attrsParent.tagName
	const attributes = attrsParent.attributes.properties.map(attr => {
		if (ts.isJsxAttribute(attr)) {
			const name = convertJsxName(attr.name, sf)
			let value: AstNode | null = null
			const init = attr.initializer
			if (init !== undefined) {
				if (ts.isStringLiteral(init)) value = literal(init, sf, init.text)
				else if (ts.isJsxExpression(init))
					value = {
						type: 'JSXExpressionContainer',
						...span(init, sf),
						expression:
							init.expression === undefined
								? null
								: convert(init.expression, sf),
					}
				else value = convert(init, sf)
			}
			return {
				type: 'JSXAttribute',
				...span(attr, sf),
				name,
				value,
			} as AstNode
		}
		return {
			type: 'JSXSpreadAttribute',
			...span(attr, sf),
			argument:
				attr.expression === undefined ? null : convert(attr.expression, sf),
		} as AstNode
	})
	return {
		type: 'JSXElement',
		...span(node, sf),
		openingElement: {
			type: 'JSXOpeningElement',
			...span(attrsParent, sf),
			name: convertJsxName(tagName, sf),
			attributes,
			selfClosing: ts.isJsxSelfClosingElement(node),
		},
		children: ts.isJsxElement(node) ? convAll(node.children, sf) : [],
		closingElement:
			ts.isJsxElement(node) && node.closingElement
				? {
						type: 'JSXClosingElement',
						...span(node.closingElement, sf),
					}
				: null,
		tsNode: node,
	}
}

/** One JSX child: text, expression container, element, or fragment. */
const convertJsxChild = (
	node: ts.JsxChild,
	sf: ts.SourceFile,
): AstNode | null => {
	if (ts.isJsxText(node)) {
		// `getStart()` trims leading whitespace as trivia; the RAW text
		// (what `collapseJsxText` consumes) is the full [pos, end) slice.
		return { type: 'JSXText', start: node.pos, end: node.end, value: node.text }
	}
	if (ts.isJsxExpression(node))
		return {
			type: 'JSXExpressionContainer',
			...span(node, sf),
			expression:
				node.expression === undefined ? null : convert(node.expression, sf),
		}
	if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
		return convertJsxElementLike(node, sf)
	if (ts.isJsxFragment(node))
		return {
			type: 'JSXFragment',
			...span(node, sf),
			children: convAll(node.children, sf),
			tsNode: node,
		}
	return null
}

/**
 * A declaration list → estree `VariableDeclaration`. Shared by variable
 * statements and the `for`/`for…of`/`for…in` initializer, which carries the
 * bare list: without this, a `.tsx` loop variable lost its declaration and
 * its reads counted as free names (LT-108, `for (const slide of …)`).
 */
const convertDeclarationList = (
	list: ts.VariableDeclarationList,
	sf: ts.SourceFile,
): AstNode => ({
	type: 'VariableDeclaration',
	...span(list, sf),
	kind:
		list.flags & ts.NodeFlags.Const
			? 'const'
			: list.flags & ts.NodeFlags.Let
				? 'let'
				: 'var',
	declarations: list.declarations.map(d => ({
		type: 'VariableDeclarator',
		...span(d, sf),
		id: convertPattern(d.name, sf),
		init: d.initializer === undefined ? null : convert(d.initializer, sf),
	})),
})

/** One statement → estree statement node. */
const convertStatement = (
	node: ts.Statement,
	sf: ts.SourceFile,
): AstNode | null => {
	if (ts.isVariableStatement(node))
		return {
			...convertDeclarationList(node.declarationList, sf),
			...span(node, sf),
		}
	if (ts.isExpressionStatement(node))
		return {
			type: 'ExpressionStatement',
			...span(node, sf),
			expression: conv(node.expression, sf),
		}
	if (ts.isReturnStatement(node))
		return {
			type: 'ReturnStatement',
			...span(node, sf),
			argument: conv(node.expression, sf),
		}
	if (ts.isSwitchStatement(node))
		return {
			type: 'SwitchStatement',
			...span(node, sf),
			discriminant: conv(node.expression, sf),
			cases: node.caseBlock.clauses.map(c => ({
				type: 'SwitchCase',
				...span(c, sf),
				test: ts.isCaseClause(c) ? conv(c.expression, sf) : null,
				consequent: convAll(c.statements, sf),
			})),
		}
	if (ts.isIfStatement(node))
		return {
			type: 'IfStatement',
			...span(node, sf),
			test: conv(node.expression, sf),
			// TS 6 renamed the old `.statement` to `thenStatement`.
			consequent: convert(node.thenStatement, sf),
			alternate: node.elseStatement ? convert(node.elseStatement, sf) : null,
		}
	if (ts.isForStatement(node))
		return {
			type: 'ForStatement',
			...span(node, sf),
			init: node.initializer ? convert(node.initializer, sf) : null,
			test: node.condition ? convert(node.condition, sf) : null,
			update: node.incrementor ? convert(node.incrementor, sf) : null,
			body: convert(node.statement, sf),
		}
	if (ts.isForOfStatement(node) || ts.isForInStatement(node))
		return {
			type: ts.isForOfStatement(node) ? 'ForOfStatement' : 'ForInStatement',
			...span(node, sf),
			left: convert(node.initializer, sf),
			right: convert(node.expression, sf),
			body: convert(node.statement, sf),
		}
	if (ts.isWhileStatement(node) || ts.isDoStatement(node))
		return {
			type: ts.isWhileStatement(node) ? 'WhileStatement' : 'DoWhileStatement',
			...span(node, sf),
			test: conv(node.expression, sf),
			body: convert(node.statement, sf),
		}
	if (ts.isThrowStatement(node))
		return {
			type: 'ThrowStatement',
			...span(node, sf),
			argument: conv(node.expression, sf),
		}
	if (ts.isTryStatement(node))
		return {
			type: 'TryStatement',
			...span(node, sf),
			block: convert(node.tryBlock, sf),
			handler: node.catchClause
				? {
						type: 'CatchClause',
						...span(node.catchClause, sf),
						param: node.catchClause.variableDeclaration
							? convertPattern(node.catchClause.variableDeclaration.name, sf)
							: null,
						body: convert(node.catchClause.block, sf),
					}
				: null,
			finalizer: node.finallyBlock ? convert(node.finallyBlock, sf) : null,
		}
	if (ts.isFunctionDeclaration(node))
		return convertFunctionLike(node, sf, 'FunctionDeclaration')
	if (ts.isImportDeclaration(node)) {
		const clause = node.importClause
		const specifiers: AstNode[] = []
		if (clause?.name)
			specifiers.push({
				type: 'ImportDefaultSpecifier',
				...span(clause, sf),
				local: {
					type: 'Identifier',
					...span(clause.name, sf),
					name: clause.name.text,
				},
			})
		if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings))
			for (const e of clause.namedBindings.elements)
				specifiers.push({
					type: 'ImportSpecifier',
					...span(e, sf),
					imported: e.propertyName
						? {
								type: 'Identifier',
								...span(e.propertyName, sf),
								name: e.propertyName.text,
							}
						: undefined,
					local: { type: 'Identifier', ...span(e.name, sf), name: e.name.text },
					importKind: e.isTypeOnly ? 'type' : undefined,
				})
		return {
			type: 'ImportDeclaration',
			...span(node, sf),
			specifiers,
			source: {
				type: 'Literal',
				...span(node.moduleSpecifier, sf),
				value: (node.moduleSpecifier as ts.StringLiteral).text,
			},
			importKind: clause?.isTypeOnly ? 'type' : undefined,
		}
	}
	if (ts.isModuleDeclaration(node))
		return {
			type: 'TSModuleDeclaration',
			...span(node, sf),
			kind: ts.isStringLiteral(node.name) ? node.name.text : 'global',
		}
	// Type declarations: kept for verbatim text and name extraction —
	// `readModuleDecls` finds `<Component>Props` by `id` (LT-298: these
	// branches sat after `convert`'s statement dispatch, unreachable, so
	// `.tsx` clients lost their `defineComponent<Props>` type argument).
	if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
		return {
			type: ts.isTypeAliasDeclaration(node)
				? 'TSTypeAliasDeclaration'
				: 'TSInterfaceDeclaration',
			...span(node, sf),
			id: { type: 'Identifier', ...span(node.name, sf), name: node.name.text },
		}
	return passthrough(`TS${ts.SyntaxKind[node.kind]}`, node, sf)
}

/** The full dispatch. Returns `null` only for nodes with no value shape. */
export const convert = (node: ts.Node, sf: ts.SourceFile): AstNode | null => {
	/* --- Statements --- */
	if (ts.isStatement(node) && !ts.isBlock(node))
		return convertStatement(node, sf)
	if (ts.isVariableDeclarationList(node))
		return convertDeclarationList(node, sf)
	if (ts.isBlock(node))
		return {
			type: 'BlockStatement',
			...span(node, sf),
			body: convAll(node.statements, sf),
		}

	/* --- JSX --- */
	if (
		ts.isJsxElement(node) ||
		ts.isJsxSelfClosingElement(node) ||
		ts.isJsxFragment(node) ||
		ts.isJsxText(node) ||
		ts.isJsxExpression(node)
	)
		return convertJsxChild(node as ts.JsxChild, sf)

	/* --- Expressions --- */
	if (ts.isIdentifier(node))
		return { type: 'Identifier', ...span(node, sf), name: node.text }
	if (ts.isStringLiteral(node)) return literal(node, sf, node.text)
	if (ts.isNumericLiteral(node)) return literal(node, sf, Number(node.text))
	if (node.kind === ts.SyntaxKind.TrueKeyword) return literal(node, sf, true)
	if (node.kind === ts.SyntaxKind.FalseKeyword) return literal(node, sf, false)
	if (node.kind === ts.SyntaxKind.NullKeyword) return literal(node, sf, null)
	if (ts.isBigIntLiteral(node)) return literal(node, sf, node.text)
	if (ts.isRegularExpressionLiteral(node)) {
		const raw = sf.text.slice(node.getStart(sf), node.end)
		const lastSlash = raw.lastIndexOf('/')
		return {
			type: 'Literal',
			...span(node, sf),
			value: new RegExp(raw.slice(1, lastSlash), raw.slice(lastSlash + 1)),
			raw,
		}
	}
	if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node))
		return convertTemplate(node, sf)
	if (ts.isPropertyAccessExpression(node))
		return {
			type: 'MemberExpression',
			...span(node, sf),
			object: conv(node.expression, sf),
			property: ts.isIdentifier(node.name)
				? { type: 'Identifier', ...span(node.name, sf), name: node.name.text }
				: conv(node.name, sf),
			computed: false,
			optional: !!node.questionDotToken,
		}
	if (ts.isElementAccessExpression(node))
		return {
			type: 'MemberExpression',
			...span(node, sf),
			object: conv(node.expression, sf),
			property:
				node.argumentExpression === undefined
					? null
					: convert(node.argumentExpression, sf),
			computed: true,
			optional: !!node.questionDotToken,
		}
	if (ts.isCallExpression(node))
		return {
			type: node.questionDotToken ? 'OptionalCallExpression' : 'CallExpression',
			...span(node, sf),
			callee: conv(node.expression, sf),
			arguments: convAll(node.arguments, sf),
		}
	if (ts.isNewExpression(node))
		return {
			type: 'NewExpression',
			...span(node, sf),
			callee: conv(node.expression, sf),
			arguments:
				node.arguments === undefined ? [] : convAll(node.arguments, sf),
		}
	if (ts.isArrowFunction(node))
		return convertFunctionLike(node, sf, 'ArrowFunctionExpression')
	if (ts.isFunctionExpression(node))
		return convertFunctionLike(node, sf, 'FunctionExpression')
	if (ts.isConditionalExpression(node))
		return {
			type: 'ConditionalExpression',
			...span(node, sf),
			test: conv(node.condition, sf),
			consequent: conv(node.whenTrue, sf),
			alternate: conv(node.whenFalse, sf),
		}
	if (ts.isBinaryExpression(node)) {
		const op = node.operatorToken.getText(sf)
		return {
			type:
				op === '&&' || op === '||' || op === '??'
					? 'LogicalExpression'
					: 'BinaryExpression',
			...span(node, sf),
			operator: op,
			left: conv(node.left, sf),
			right: conv(node.right, sf),
		}
	}
	if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
		return {
			type: ts.isPostfixUnaryExpression(node)
				? 'UpdateExpression'
				: 'UnaryExpression',
			...span(node, sf),
			operator: unaryOperator(
				node as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression,
			),
			prefix: ts.isPrefixUnaryExpression(node),
			argument: conv(node.operand, sf),
		}
	// No AssignmentExpression or SequenceExpression arm (LT-222): template
	// expressions are emitted verbatim and never reach `conv` as either —
	// verified by instrumentation 2026-09-18; the arms were unreachable.
	if (ts.isObjectLiteralExpression(node))
		return {
			type: 'ObjectExpression',
			...span(node, sf),
			properties: node.properties.map((p): AstNode => {
				if (ts.isPropertyAssignment(p))
					return {
						type: 'Property',
						...span(p, sf),
						key: ts.isIdentifier(p.name)
							? { type: 'Identifier', ...span(p.name, sf), name: p.name.text }
							: ts.isStringLiteral(p.name)
								? literal(p.name, sf, p.name.text)
								: conv(p.name, sf),
						value: conv(p.initializer, sf),
						computed: ts.isComputedPropertyName(p.name),
						kind: 'init',
						shorthand: false,
					}
				if (ts.isShorthandPropertyAssignment(p))
					return {
						type: 'Property',
						...span(p, sf),
						key: { type: 'Identifier', ...span(p.name, sf), name: p.name.text },
						value: p.objectAssignmentInitializer
							? {
									type: 'AssignmentPattern',
									...span(p, sf),
									left: {
										type: 'Identifier',
										...span(p.name, sf),
										name: p.name.text,
									},
									right: conv(p.objectAssignmentInitializer, sf),
								}
							: { type: 'Identifier', ...span(p.name, sf), name: p.name.text },
						computed: false,
						kind: 'init',
						shorthand: true,
					}
				if (ts.isSpreadAssignment(p))
					return {
						type: 'SpreadElement',
						...span(p, sf),
						argument: conv(p.expression, sf),
					}
				if (ts.isMethodDeclaration(p))
					return {
						type: 'Property',
						...span(p, sf),
						key: ts.isIdentifier(p.name)
							? { type: 'Identifier', ...span(p.name, sf), name: p.name.text }
							: conv(p.name, sf),
						value: p.body
							? convertFunctionLike(
									p as unknown as ts.FunctionExpression,
									sf,
									'FunctionExpression',
								)
							: null,
						computed: false,
						kind: 'init',
						shorthand: false,
					}
				return passthrough(`TS${ts.SyntaxKind[p.kind]}`, p, sf)
			}),
		}
	if (ts.isArrayLiteralExpression(node))
		return {
			type: 'ArrayExpression',
			...span(node, sf),
			elements: node.elements.map(el =>
				ts.isOmittedExpression(el)
					? null
					: ts.isSpreadElement(el)
						? ({
								type: 'SpreadElement',
								...span(el, sf),
								argument: conv(el.expression, sf),
							} as AstNode)
						: convert(el, sf),
			),
		}
	if (ts.isSpreadElement(node))
		return {
			type: 'SpreadElement',
			...span(node, sf),
			argument: conv(node.expression, sf),
		}
	if (ts.isAwaitExpression(node))
		return {
			type: 'AwaitExpression',
			...span(node, sf),
			argument: conv(node.expression, sf),
		}
	if (ts.isYieldExpression(node))
		return {
			type: 'YieldExpression',
			...span(node, sf),
			argument: conv(node.expression, sf),
		}
	if (ts.isTaggedTemplateExpression(node))
		return {
			type: 'TaggedTemplateExpression',
			...span(node, sf),
			tag: conv(node.tag, sf),
			quasi: convert(node.template, sf),
		}
	if (ts.isParenthesizedExpression(node)) return conv(node.expression, sf)
	// A const assertion keeps its annotation (LT-308): `export const i18n =
	// { … } as const` is the declaration's authored shape, and the i18n
	// extraction reads it the way the `.tsrx` parser presents it.
	if (ts.isAsExpression(node) && ts.isConstTypeReference(node.type))
		return {
			type: 'TSAsExpression',
			...span(node, sf),
			expression: conv(node.expression, sf),
			typeAnnotation: {
				type: 'TSTypeReference',
				...span(node.type, sf),
				typeName: { type: 'Identifier', ...span(node.type, sf), name: 'const' },
			},
		}
	if (
		ts.isAsExpression(node) ||
		ts.isSatisfiesExpression(node) ||
		ts.isNonNullExpression(node)
	)
		return {
			type: `TS${ts.SyntaxKind[node.kind]}`,
			...span(node, sf),
			expression: conv(node.expression, sf),
		}
	if (ts.isTypeAssertionExpression(node))
		return {
			type: 'TSTypeAssertion',
			...span(node, sf),
			expression: conv(node.expression, sf),
		}
	if (ts.isVoidExpression(node))
		return {
			type: 'UnaryExpression',
			...span(node, sf),
			operator: 'void',
			prefix: true,
			argument: conv(node.expression, sf),
		}
	if (ts.isDeleteExpression(node))
		return {
			type: 'UnaryExpression',
			...span(node, sf),
			operator: 'delete',
			prefix: true,
			argument: conv(node.expression, sf),
		}
	if (ts.isTypeOfExpression(node))
		return {
			type: 'UnaryExpression',
			...span(node, sf),
			operator: 'typeof',
			prefix: true,
			argument: conv(node.expression, sf),
		}

	/* --- Everything else: TS-named leaf (no value children). --- */
	return passthrough(`TS${ts.SyntaxKind[node.kind]}`, node, sf)
}

/**
 * Parse a `.tsx` module into an estree-shaped `Program` — the same entry
 * shape `@tsrx/core`'s `parseModule` produces for `.tsrx`: `body` holds
 * converted top-level statements, with exported declarations wrapped in
 * `ExportNamedDeclaration` (`declaration` = the converted inner statement,
 * whose own span starts at the `export` keyword — consumers slice the
 * WRAPPER for verbatim text and read only names/kinds from the inner).
 */
export const parseTsxModule = (source: string, filename: string): AstNode => {
	const sf = ts.createSourceFile(
		filename,
		source,
		ts.ScriptTarget.ESNext,
		true,
		ts.ScriptKind.TSX,
	)
	const body: AstNode[] = []
	for (const stmt of sf.statements) {
		const mods = (stmt as ts.Node & { modifiers?: readonly ts.Modifier[] })
			.modifiers
		if (
			mods?.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.ExportKeyword)
		) {
			const inner = convert(stmt, sf)
			if (inner)
				body.push({
					type: 'ExportNamedDeclaration',
					start: stmt.getStart(sf),
					end: stmt.end,
					declaration: inner,
				})
			continue
		}
		const converted = convertStatement(stmt, sf)
		if (converted) body.push(converted)
	}
	return { type: 'Program', start: 0, end: source.length, body }
}
