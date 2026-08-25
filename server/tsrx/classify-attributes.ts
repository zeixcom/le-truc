/**
 * JSXAttribute → `AttributeIR`/`ComposeAttrIR` classification (ADR 0023 sub-
 * design 10). One parser (`classifyPassEntries`) shared by both element
 * kinds — raw dashed tags (`classifyAttribute`) and composed PascalCase
 * elements (`classifyComposeAttribute`) — so `pass={{ … }}` has exactly one
 * dispatch path, not two.
 */

import type { TsrxNode } from '@tsrx/core'
import {
	asArray,
	attrName,
	eventNameFromAttr,
	identifierName,
	isNode,
	text,
} from './ast-utils'
import type {
	AttributeIR,
	ComposeAttrIR,
	ExtractContext,
	PassEntryIR,
} from './ir'

/**
 * Parse `pass={{ prop: thunk, … }}` entries — shared by raw dashed tags and
 * composed elements (ADR 0023 sub-design 10: one dispatch path, not two). A
 * `{ get, set }` descriptor entry lowers to a two-way `pass()` accessor
 * (ADR 0012, LT-017); anything else is an outright invalid entry.
 */
export const classifyPassEntries = (
	ctx: ExtractContext,
	attr: TsrxNode,
): PassEntryIR[] | { kind: 'invalid'; reason: string } => {
	const value = attr.value
	const expr =
		isNode(value) && value.type === 'JSXExpressionContainer'
			? value.expression
			: null
	if (!isNode(expr) || expr.type !== 'ObjectExpression')
		return {
			kind: 'invalid',
			reason:
				'pass={{ … }} expects an object literal of prop: thunk entries (pass={{ value: () => x.get() }}).',
		}
	const entries: PassEntryIR[] = []
	for (const prop of asArray(expr.properties)) {
		const propName = identifierName(prop.key)
		if (prop.type !== 'Property' || !propName)
			return {
				kind: 'invalid',
				reason: 'pass={{ … }} entries must be named properties.',
			}
		const entryValue = prop.value
		if (isNode(entryValue) && entryValue.type === 'ArrowFunctionExpression') {
			if (!isNode(entryValue.body))
				return {
					kind: 'invalid',
					reason: `pass entry \`${propName}\` must be a thunk with a body (() => value).`,
				}
			entries.push({
				prop: propName,
				thunk: entryValue,
				thunkText: text(ctx.source, entryValue),
			})
			continue
		}
		if (isNode(entryValue) && entryValue.type === 'ObjectExpression') {
			const props = asArray(entryValue.properties)
			const find = (key: string) =>
				props.find(
					p => p.type === 'Property' && (identifierName(p.key) ?? '') === key,
				)
			const getProp = find('get')
			const setProp = find('set')
			const getFn = getProp && isNode(getProp.value) ? getProp.value : null
			const setFn = setProp && isNode(setProp.value) ? setProp.value : null
			if (
				getFn?.type === 'ArrowFunctionExpression' &&
				setFn?.type === 'ArrowFunctionExpression' &&
				isNode(getFn.body) &&
				isNode(setFn.body)
			) {
				entries.push({
					prop: propName,
					thunk: getFn,
					thunkText: text(ctx.source, getFn),
					setThunk: setFn,
					setThunkText: text(ctx.source, setFn),
				})
				continue
			}
			return {
				kind: 'invalid',
				reason: `{ get, set } pass entry \`${propName}\` must have both get and set as thunks (() => value).`,
			}
		}
		return {
			kind: 'invalid',
			reason: `pass entry \`${propName}\` must be a thunk (() => value) or a { get, set } descriptor.`,
		}
	}
	return entries
}

/** Classify one JSXAttribute into the attribute IR. */
export const classifyAttribute = (
	ctx: ExtractContext,
	attr: TsrxNode,
): AttributeIR | { kind: 'invalid'; reason: string } => {
	const name = attrName(attr)
	const value = attr.value
	if (name === 'pass') {
		const entries = classifyPassEntries(ctx, attr)
		if ('reason' in entries) return entries
		return { kind: 'pass', entries }
	}
	if (name === 'ref') {
		const target =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		const refName = identifierName(target)
		if (!refName)
			return {
				kind: 'invalid',
				reason: 'ref={…} expects a bare identifier (ref={textbox}).',
			}
		return { kind: 'ref', name: refName }
	}
	if (/^on[A-Z]/.test(name)) {
		const raw =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		// A bare identifier (`{onInput}`, i.e. `onInput={onInput}`) resolves
		// against a hoisted setup const — the handler is exactly its
		// initializer, so two `@if` branches sharing the identifier get
		// identical handler text automatically (union addressing requires
		// this, ADR 0023 LT-008).
		const resolvedName =
			isNode(raw) && raw.type === 'Identifier' ? identifierName(raw) : null
		const resolved = resolvedName ? ctx.setupInits.get(resolvedName) : undefined
		const expr = resolved ?? raw
		if (!isNode(expr) || !/Function(Expression)?$/.test(expr.type))
			return {
				kind: 'invalid',
				reason: `Event attribute ${name}={…} must be a function, or an identifier bound to one by a hoisted \`const\`.`,
			}
		return {
			kind: 'event',
			name,
			event: eventNameFromAttr(name),
			handler: expr,
			handlerText: text(ctx.source, expr),
		}
	}
	// Dynamic rendering: html={dataRef} — the .tsrx spelling of the upstream
	// {html expr} keyword (newer grammar than the pinned parser). Only data
	// references are accepted; the emitters route the value through the
	// runtime's sanitizeHtml before it reaches the output.
	if (name === 'html') {
		const expr =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		if (isNode(expr) && expr.type === 'ArrowFunctionExpression') {
			// html={() => …} (LT-025): a reactive thunk, lowered client-side to
			// dangerouslyBindInnerHTML — exprText/node stay the BODY expression
			// so server rendering (isServerEvaluable gating) is identical to the
			// non-reactive bare-reference form below.
			const body = expr.body
			if (!isNode(body))
				return {
					kind: 'invalid',
					reason: 'html={() => …} must be a thunk with a body.',
				}
			return {
				kind: 'html',
				exprText: text(ctx.source, body),
				node: body,
				reactive: true,
				thunk: expr,
				thunkText: text(ctx.source, expr),
			}
		}
		if (!isNode(expr) || !/^(Identifier|MemberExpression)$/.test(expr.type))
			return {
				kind: 'invalid',
				reason:
					'html={…} expects a data reference (identifier or member expression) or a reactive thunk (html={() => value}).',
			}
		return {
			kind: 'html',
			exprText: text(ctx.source, expr),
			node: expr,
			reactive: false,
		}
	}
	if (!isNode(value)) return { kind: 'static', name, value: null }
	if (value.type === 'Literal')
		return { kind: 'static', name, value: String(value.value ?? '') }
	if (value.type === 'JSXExpressionContainer') {
		const expr = value.expression
		if (!isNode(expr)) return { kind: 'static', name, value: '' }
		if (expr.type === 'ArrowFunctionExpression') {
			const body = expr.body
			if (name === 'class' && isNode(body) && body.type === 'ObjectExpression')
				return {
					kind: 'class-map',
					thunkText: text(ctx.source, expr),
					thunk: expr,
					object: body,
				}
			if (name === 'style' && isNode(body) && body.type === 'ObjectExpression')
				return {
					kind: 'style-map',
					thunkText: text(ctx.source, expr),
					thunk: expr,
					object: body,
				}
			if (!isNode(body))
				return {
					kind: 'invalid',
					reason: `Reactive attribute ${name}={…} must be a thunk with a body (() => value).`,
				}
			return {
				kind: 'reactive',
				name,
				thunk: expr,
				thunkText: text(ctx.source, expr),
			}
		}
		if (expr.type === 'FunctionExpression')
			return {
				kind: 'invalid',
				reason: `Attribute \`${name}\` uses an unsupported function form; write a thunk (() => value).`,
			}
		return {
			kind: 'server',
			name,
			exprText: text(ctx.source, expr),
			node: expr,
		}
	}
	return {
		kind: 'invalid',
		reason: `Attribute \`${name}\` uses an unsupported value form.`,
	}
}

/**
 * Classify one JSXAttribute on a composed (PascalCase) element. `ref` keeps
 * its usual meaning; `pass={{ … }}` is the sole client-prop interop channel
 * (ADR 0023 sub-design 10 — same dispatch as raw dashed tags); everything
 * else is a server arg forwarded verbatim into the child's `render<Name>()`
 * call — no reactive-shape inference (amends sub-design 4's raw-element
 * dispatch).
 */
export const classifyComposeAttribute = (
	ctx: ExtractContext,
	attr: TsrxNode,
): ComposeAttrIR | { kind: 'invalid'; reason: string } => {
	const name = attrName(attr)
	const value = attr.value
	if (name === 'pass') {
		const entries = classifyPassEntries(ctx, attr)
		if ('reason' in entries) return entries
		return { kind: 'pass', entries }
	}
	if (name === 'ref') {
		const target =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		const refName = identifierName(target)
		if (!refName)
			return {
				kind: 'invalid',
				reason: 'ref={…} expects a bare identifier (ref={textbox}).',
			}
		return { kind: 'ref', name: refName }
	}
	if (!isNode(value)) return { kind: 'arg', name, exprText: 'true', node: null }
	if (value.type === 'Literal')
		return {
			kind: 'arg',
			name,
			exprText: JSON.stringify(value.value ?? ''),
			node: null,
		}
	if (value.type === 'JSXExpressionContainer') {
		const expr = value.expression
		if (!isNode(expr))
			return { kind: 'invalid', reason: `Attribute \`${name}\` is empty.` }
		return { kind: 'arg', name, exprText: text(ctx.source, expr), node: expr }
	}
	return {
		kind: 'invalid',
		reason: `Attribute \`${name}\` uses an unsupported value form.`,
	}
}
