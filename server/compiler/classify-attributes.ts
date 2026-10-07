/**
 * JSXAttribute → `AttributeIR`/`ComposeAttrIR` classification (ADR 0024 sub-
 * design 10). One parser (`classifyPassEntries`) shared by both element
 * kinds — raw dashed tags (`classifyAttribute`) and composed PascalCase
 * elements (`classifyComposeAttribute`) — so `pass={{ … }}` has exactly one
 * dispatch path, not two.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	attrName,
	eventNameFromAttr,
	identifierName,
	isHandlerArgName,
	isNode,
	text,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import type { ExtractContext } from './extract-context'
import type { AttributeIR, ComposeAttrIR, PassEntryIR } from './ir'
import { bindsExposedArg, dependencyClosure } from './reactivity'

/**
 * Parse `pass={{ prop: thunk, … }}` entries — shared by raw dashed tags and
 * composed elements (ADR 0024 sub-design 10: one dispatch path, not two). A
 * `{ get, set }` descriptor entry lowers to a two-way `pass()` accessor
 * (ADR 0012, LT-017); anything else is an outright invalid entry.
 */
export const classifyPassEntries = (
	ctx: ExtractContext,
	attr: AstNode,
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

/** The host-owned client-prop interop attribute, and its pre-LT-053 name. */
const PASS_ATTR = 'truc:pass'
const LEGACY_PASS_ATTR = 'pass'

const renamedPassReason =
	'`pass={{ … }}` is now `truc:pass={{ … }}` — host-owned attributes are namespaced so they cannot collide with a user prop called `pass`.'

/** The host-owned dynamic-rendering attribute, and its pre-LT-137 name. */
const HTML_ATTR = 'truc:html'
const LEGACY_HTML_ATTR = 'html'

const renamedHtmlReason =
	'`html={…}` is now `truc:html={…}` — host-owned attributes are namespaced so they cannot collide with a user prop called `html` (LT-128). Core TSRX defines no `{html expr}` keyword in any published release; it delegates raw markup to the host, and Le Truc owns this one because it routes the value through `sanitizeHtml` rather than assigning it raw.'

/**
 * The rest of the host-owned `truc:` namespace (LT-353). Only the names
 * above carry meaning; any other `truc:*` name used to fall through to the
 * ordinary attribute arms and render into the markup verbatim, where the
 * browser ignores it — silently wrong, the LT-222 failure for `class:`.
 * `truc:case`/`truc:case-type` were the pre-ICU plural spellings, retired
 * by ADR 0030 s4 (the variance lives in the message pattern now).
 */
const TRUC_NAMESPACE = 'truc:'
const RETIRED_TRUC_ATTRS: ReadonlySet<string> = new Set([
	'truc:case',
	'truc:case-type',
])

/**
 * The LTC006 reason for an unrecognized `truc:*` name, or `null` when the
 * name is outside the namespace. `known` is the vocabulary the element kind
 * accepts, named in the message so a typo has its fix in sight.
 */
const unknownTrucAttrReason = (
	name: string,
	known: readonly string[],
): string | null => {
	if (!name.startsWith(TRUC_NAMESPACE)) return null
	if (RETIRED_TRUC_ATTRS.has(name))
		return `\`${name}\` is retired (ADR 0030) — plural and select variance lives in the message's ICU pattern now. Declare the message in the \`i18n\` record, e.g. \`tasks: '{count, plural, one {task} other {tasks}}'\`, and render it as \`{t.tasks({ count })}\`.`
	const names = known.map(n => `\`${n}\``).join(' and ')
	return `\`${name}\` is not a Le Truc attribute — the \`truc:\` namespace is host-owned, so an unrecognized name would pass through as an ordinary attribute that nothing reads. Use ${names}, or drop the \`truc:\` prefix for an ordinary attribute.`
}

/**
 * React's DOM-property attribute names (LT-054). Rendered verbatim they are
 * not real HTML attributes — the browser ignores `className`/`htmlFor`
 * entirely, so the near-miss is silently broken rather than merely
 * non-idiomatic. TSRX has no JSX-to-DOM-property translation layer; `class`/
 * `for` are the real HTML attribute names.
 */
const REACT_ATTR_RENAMES: ReadonlyMap<string, string> = new Map([
	['className', 'class'],
	['htmlFor', 'for'],
])

/**
 * Classify one JSXAttribute into the attribute IR. The variant chosen is the
 * value's reactivity class (ADR 0024 s4: a function-valued attribute is
 * reactive), and every value-bearing variant records its dependency closure
 * (ADR 0040 s7) — decided here, once.
 */
export const classifyAttribute = (
	ctx: ExtractContext,
	attr: AstNode,
	/** Declared signal names — LT-122's exclusion (see `bindsExposedArg`). */
	signals: { has(name: string): boolean },
): AttributeIR | { kind: 'invalid'; reason: string } => {
	const name = attrName(attr)
	const depsOf = (expr: AstNode, hostProp?: string) =>
		dependencyClosure(expr, signals, ctx.argNames, hostProp)
	const value = attr.value
	if (name === PASS_ATTR) {
		const entries = classifyPassEntries(ctx, attr)
		if ('reason' in entries) return entries
		return { kind: 'pass', entries }
	}
	// The pre-LT-053 spelling. Caught explicitly rather than left to fall
	// through: `pass={{ … }}` would classify as a server attribute and render
	// `pass="[object Object]"` into the markup — silently wrong output, the
	// worst failure mode this compiler has. Every spelling is rejected, not
	// just the expression form: `pass` is not an HTML attribute, so there is
	// no legitimate author use to preserve.
	if (name === LEGACY_PASS_ATTR)
		return { kind: 'invalid', reason: renamedPassReason }
	// React's DOM-property attribute names (LT-054): not real HTML attributes,
	// so passed through verbatim they render into markup the browser ignores.
	const reactRename = REACT_ATTR_RENAMES.get(name)
	if (reactRename)
		return {
			kind: 'invalid',
			reason: `\`${name}\` is a React DOM-property name, not an HTML attribute — TSRX has no JSX-to-DOM-property translation, so this would render into the markup verbatim and the browser would ignore it. Use \`${reactRename}\` instead.`,
		}
	// The pre-LT-055 spelling: `ref={}` is retired outright, no deprecation
	// cycle (the compiler has never shipped). `first(selector, required)` in
	// setup replaces it — resolved structurally at compile time instead of
	// via magic attribute placement (see `first-refs.ts`), and works on both
	// raw and composed elements without a separate `ComposeAttrIR` variant.
	if (name === 'ref')
		return {
			kind: 'invalid',
			reason:
				"`ref={name}` is retired (LT-055) — use `const name = first(selector, required)` in setup instead, e.g. `const textbox = first('input', 'required')`. The compiler resolves the selector structurally at compile time.",
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
		// this, ADR 0024 LT-008).
		const resolvedName =
			isNode(raw) && raw.type === 'Identifier' ? identifierName(raw) : null
		// A handler arg placed on this element (LT-461): the composing parent
		// binds its own handler here, so the component emits nothing for it.
		const handlerArg = resolvedName ? ctx.handlerArgs.get(resolvedName) : null
		if (handlerArg && isNode(raw)) {
			ctx.handlerArgRefs.add(raw)
			return {
				kind: 'handler-arg',
				name,
				event: eventNameFromAttr(name),
				arg: handlerArg,
				node: raw,
			}
		}
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
	// Dynamic rendering: truc:html={dataRef} (LT-137). Host-owned and
	// namespaced: core TSRX defines no `{html expr}` keyword in any published
	// release — it delegates raw markup to the host, and the reference host
	// answers with a literal `innerHTML` attribute. Le Truc does not borrow
	// that name because it sanitizes rather than assigning raw (LT-128).
	// Only data references are accepted; the emitters route the value through
	// the runtime's sanitizeHtml before it reaches the output.
	// The bare spelling must NOT fall through to the ordinary-attribute path
	// below: `html` is not a real HTML attribute, so a silent reclassification
	// would render a dead `html="…"` and drop the sanitize/bind behaviour
	// entirely (LT-137).
	if (name === LEGACY_HTML_ATTR)
		return { kind: 'invalid', reason: renamedHtmlReason }
	if (name === HTML_ATTR) {
		const expr =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		if (isNode(expr) && expr.type === 'ArrowFunctionExpression') {
			// truc:html={() => …} (LT-025): a reactive thunk, lowered client-side to
			// dangerouslyBindInnerHTML — exprText/node stay the BODY expression
			// so server rendering (isServerEvaluable gating) is identical to the
			// non-reactive bare-reference form below.
			const body = expr.body
			if (!isNode(body))
				return {
					kind: 'invalid',
					reason: 'truc:html={() => …} must be a thunk with a body.',
				}
			return {
				kind: 'html',
				exprText: text(ctx.source, body),
				node: body,
				deps: depsOf(expr),
				reactive: true,
				thunk: expr,
				thunkText: text(ctx.source, expr),
			}
		}
		if (!isNode(expr) || !/^(Identifier|MemberExpression)$/.test(expr.type))
			return {
				kind: 'invalid',
				reason:
					'truc:html={…} expects a data reference (identifier or member expression) or a reactive thunk (truc:html={() => value}).',
			}
		return {
			kind: 'html',
			exprText: text(ctx.source, expr),
			node: expr,
			deps: depsOf(expr),
			reactive: false,
		}
	}
	// Any other `truc:*` name (LT-353): the namespace is host-owned, so an
	// unrecognized one is a typo or a retired spelling, never an attribute.
	const trucReason = unknownTrucAttrReason(name, [PASS_ATTR, HTML_ATTR])
	if (trucReason) return { kind: 'invalid', reason: trucReason }
	// The Svelte-style per-class spelling (LT-222): `class:`-prefixed names
	// used to slip past every check above into the ordinary fallthrough —
	// the server-evaluable call form rendered a literal `class:token`
	// attribute the browser ignores, and the thunk form classified reactive
	// and emitted a watch that read `.token` off the thunk's RESULT (a class
	// that could never apply). Both silently wrong; rejected outright, since
	// the class map below is the sanctioned spelling and the corpus never
	// used the prefix.
	if (name.startsWith('class:'))
		return {
			kind: 'invalid',
			reason:
				'`class:token={…}` is not a Le Truc spelling — the attribute would render into the markup as written, and the browser ignores it. Bind a class reactively with a class map: `class={() => ({ token: value })}`.',
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
					deps: depsOf(expr),
				}
			if (name === 'style' && isNode(body) && body.type === 'ObjectExpression')
				return {
					kind: 'style-map',
					thunkText: text(ctx.source, expr),
					thunk: expr,
					object: body,
					deps: depsOf(expr),
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
				deps: depsOf(expr),
			}
		}
		if (expr.type === 'FunctionExpression')
			return {
				kind: 'invalid',
				reason: `Attribute \`${name}\` uses an unsupported function form; write a thunk (() => value).`,
			}
		// LT-122: `disabled={disabled}`, where `disabled` is both a
		// server arg and an exposed prop, still renders from the arg
		// server-side — and additionally binds `() => host.disabled`
		// against the same element client-side, so an external prop
		// write reaches the DOM the component itself rendered.
		const bindsProp = bindsExposedArg(
			expr,
			ctx.argNames,
			ctx.exposedProps,
			signals,
			ctx.parserProps,
		)
		return {
			kind: 'server',
			name,
			exprText: text(ctx.source, expr),
			node: expr,
			deps: depsOf(expr, bindsProp ?? undefined),
			...(bindsProp !== null ? { bindsProp } : {}),
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
 * (ADR 0024 sub-design 10 — same dispatch as raw dashed tags); everything
 * else is a server arg forwarded verbatim into the child's `render<Name>()`
 * call — no reactive-shape inference (amends sub-design 4's raw-element
 * dispatch).
 */
export const classifyComposeAttribute = (
	ctx: ExtractContext,
	attr: AstNode,
): ComposeAttrIR | { kind: 'invalid'; reason: string } => {
	const name = attrName(attr)
	const value = attr.value
	if (name === PASS_ATTR) {
		const entries = classifyPassEntries(ctx, attr)
		if ('reason' in entries) return entries
		return { kind: 'pass', entries }
	}
	// The pre-LT-053 spelling. Caught explicitly rather than left to fall
	// through: `pass={{ … }}` would classify as a server attribute and render
	// `pass="[object Object]"` into the markup — silently wrong output, the
	// worst failure mode this compiler has. Every spelling is rejected, not
	// just the expression form: `pass` is not an HTML attribute, so there is
	// no legitimate author use to preserve.
	if (name === LEGACY_PASS_ATTR)
		return { kind: 'invalid', reason: renamedPassReason }
	// React's DOM-property attribute names (LT-054): not real HTML attributes,
	// so passed through verbatim they render into markup the browser ignores.
	const reactRename = REACT_ATTR_RENAMES.get(name)
	if (reactRename)
		return {
			kind: 'invalid',
			reason: `\`${name}\` is a React DOM-property name, not an HTML attribute — TSRX has no JSX-to-DOM-property translation, so this would render into the markup verbatim and the browser would ignore it. Use \`${reactRename}\` instead.`,
		}
	// Any other `truc:*` name (LT-353). `truc:pass` is the only host-owned
	// attribute a compose site accepts; anything else would be forwarded
	// as a server arg no child declares.
	const trucReason = unknownTrucAttrReason(name, [PASS_ATTR])
	if (trucReason) return { kind: 'invalid', reason: trucReason }
	// `ref={}` is retired on COMPOSED elements too (LT-127) — one addressing
	// mechanism for both element kinds. `first()`'s structural resolution
	// walks `kind: 'element'` nodes only (`first-refs.ts`), so a selector
	// naming a custom-element tag that matches no raw element is deferred to
	// the registry-aware second pass and resolved against compose sites
	// there (`analysis/compose-refs.ts`) — a composed child's eventual DOM
	// tag lives in another file's registry entry, not visible here inside
	// single-file `compileSource`.
	if (name === 'ref')
		return {
			kind: 'invalid',
			reason:
				"`ref={name}` is retired (LT-055/LT-127) — use `const name = first(selector, required)` in setup instead. A composed element is addressed by the tag it renders plus its own compose-site class/id, e.g. `const lightness = first('form-spinbutton.lightness', 'required')`.",
		}
	// The reserved `i18n` parameter (ADR 0030 sub-design 2, LT-173): the
	// compiler supplies it at every render call boundary — a caller-authored
	// `i18n` attribute here would collide with the compiler's own record
	// argument in the generated call. Same reserved-name posture as the
	// markup-between-tags channel for `children`.
	if (name === 'i18n')
		return {
			kind: 'invalid',
			reason:
				"`i18n` is a reserved parameter (ADR 0030) — the compiler supplies the locale record; callers never pass it. To set the child's locale, pass `lang` instead.",
		}
	// A handler arg (LT-461): never a server arg. The parent's client binds
	// the handler on the element the child places the arg on, so the value
	// takes an event attribute's forms — a function, or an identifier bound
	// to one by a hoisted `const` — plus the composing component's own
	// handler arg, which forwards the placement.
	if (isHandlerArgName(name)) {
		const raw =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		const rawName =
			isNode(raw) && raw.type === 'Identifier' ? identifierName(raw) : null
		const forward = rawName ? ctx.handlerArgs.get(rawName) : undefined
		if (forward && isNode(raw)) {
			ctx.handlerArgRefs.add(raw)
			return {
				kind: 'handler',
				name,
				handler: raw,
				handlerText: text(ctx.source, raw),
				forward,
			}
		}
		const resolved = rawName ? ctx.setupInits.get(rawName) : undefined
		const expr = resolved ?? raw
		if (!isNode(expr) || !/Function(Expression)?$/.test(expr.type))
			return {
				kind: 'invalid',
				reason: `Handler arg ${name}={…} must be a function, or an identifier bound to one by a hoisted \`const\` — the child binds it as an event listener.`,
			}
		return {
			kind: 'handler',
			name,
			handler: expr,
			handlerText: text(ctx.source, expr),
			forward: null,
		}
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
