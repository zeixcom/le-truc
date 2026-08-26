/**
 * Per-construct client effect planning (LT-022, regrouping move M5):
 * Pass 4 — the document-ordered walk lowering every client construct
 * (reactive attributes, class/style maps, pass entries, events, lazy text
 * children) into `TopEffectPlan`s, plus the structural handlers for `@if`
 * (union and optional addressing), `@switch`/`@try` (construct-free arms),
 * async boundaries, loops, and composed elements.
 */

import type { TsrxNode } from '@tsrx/core'
import {
	hostPropOf,
	isNode,
	MANAGED_TEXT_PROPS,
	nodeType,
	objectKeys,
	sanitizeVarName,
} from '../ast-utils'
import { diagnostic } from '../diagnostics'
import type { AttributeIR, ForIR, PassEntryIR, TemplateNode } from '../ir'
import { lazyWatchSource, returnsNumber } from './harvest'
import type { AnalysisContext, TopEffectPlan } from './plan'
import {
	type ComposeNode,
	countComposeBySource as countComposeBySourceIn,
	type ElementNode,
	type IfNode,
	isElement,
	loopFor as loopForIn,
	resolveSelector as resolveSelectorIn,
	type SwitchNode,
	selectorFor as selectorForIn,
	type TryNode,
} from './selectors'

/**
 * The managed form prop a reactive child reads, or null. Since LT-052 that
 * is a `host.<prop>` member read; the retired `{'<prop>'}` string-literal
 * spelling is still recognised so a stale source reports the managed-prop
 * message instead of a downstream type error.
 */
const managedPropRead = (expr: TsrxNode): string | null => {
	if (nodeType(expr) === 'Literal' && typeof expr.value === 'string') {
		const prop = String(expr.value)
		return MANAGED_TEXT_PROPS.has(prop) ? prop : null
	}
	if (nodeType(expr) !== 'MemberExpression' || expr.computed) return null
	const obj = expr.object
	if (!isNode(obj) || obj.type !== 'Identifier' || String(obj.name) !== 'host')
		return null
	const prop = expr.property
	if (!isNode(prop) || prop.type !== 'Identifier') return null
	const name = String(prop.name)
	return MANAGED_TEXT_PROPS.has(name) ? name : null
}

/**
 * Does this attribute carry a client construct? A non-reactive `html={ref}`
 * is server-rendered only (LT-025); a reactive `html={() => …}` lowers to a
 * `dangerouslyBindInnerHTML` watch, same as any other reactive attribute.
 */
const isClientConstructAttr = (a: AttributeIR): boolean =>
	a.kind !== 'static' &&
	a.kind !== 'server' &&
	!(a.kind === 'html' && !a.reactive)

/* === Exported Functions === */

/** Pass 4: the document-ordered client effect walk. */
export const runEffects = (ctx: AnalysisContext): void => {
	const {
		component,
		source,
		diagnostics,
		registry,
		composeRegistry,
		effects,
		ambient,
		addQuery,
		collectAmbient,
		badFreeNames,
		forPlans,
		reconcilePlans,
	} = ctx
	const selectorFor = (el: ElementNode) => selectorForIn(component, el)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const countComposeBySource = (source2: string) =>
		countComposeBySourceIn(component.root, source2)
	const loopFor = (node: TemplateNode): ForIR | null =>
		loopForIn(component, node)

	/**
	 * Validate and lower one target's `pass={{ }}` entries into `pass` effect
	 * plans — shared by raw dashed-tag elements and composed elements, the
	 * two `pass={{ }}` addressing paths (ADR 0023 sub-design 10).
	 */
	const emitPassEntries = (
		entries: PassEntryIR[],
		query: string,
		sink: TopEffectPlan[] = effects,
	): void => {
		for (const entry of entries) {
			collectAmbient(entry.thunk)
			const bad = badFreeNames(entry.thunk)
			if (bad.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						entry.thunk.start,
						`pass entry \`${entry.prop}\` references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
					),
				)
			}
			if (entry.setThunk) {
				collectAmbient(entry.setThunk)
				const badSet = badFreeNames(entry.setThunk)
				if (badSet.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							entry.setThunk.start,
							`pass entry \`${entry.prop}\` (set) references server-only name(s) ${badSet.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
						),
					)
				}
			}
			sink.push({
				kind: 'pass',
				query,
				prop: entry.prop,
				thunkText: entry.thunkText,
				sourceStart: entry.thunk.start,
				sourceEnd: entry.thunk.end,
				setThunkText: entry.setThunkText,
				setSourceStart: entry.setThunk?.start,
				setSourceEnd: entry.setThunk?.end,
			})
		}
	}

	/**
	 * Emit the effects of one element's client constructs against `query` —
	 * the shared body for plain elements and @if branch-root unions alike.
	 */
	const emitConstructEffects = (
		el: ElementNode,
		query: string,
		sink: TopEffectPlan[] = effects,
	): void => {
		const isCustom = el.tag.includes('-')
		for (const attr of el.attrs) {
			if (attr.kind === 'reactive') {
				collectAmbient(attr.thunk)
				const bad = badFreeNames(attr.thunk)
				if (bad.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							attr.thunk.start,
							`Reactive attribute \`${attr.name}\` references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
						),
					)
				}
				if (isCustom) {
					// ADR 0023 sub-design 4 (amended by sub-design 10): a
					// function-valued attribute is only ever a reactive binding
					// on NATIVE elements. Custom-element interop is solely
					// through the explicit `pass={{ }}` attribute below — one
					// dispatch path, not two shape-inferred ones.
					diagnostics.push(
						diagnostic.reactiveAttrOnCustomElement(
							source,
							attr.thunk.start,
							el.tag,
							attr.name,
						),
					)
					continue
				}
				// A host-prop mirror always dispatches as a property —
				// attribute dispatch would be wrong for property-backed
				// targets like `input.value`.
				const mirror = hostPropOf(attr.thunk)
				sink.push({
					kind: 'watch-attr',
					query,
					attr: attr.name,
					thunkText: attr.thunkText,
					dispatch: mirror !== null ? 'property' : 'attribute',
					coerceToString: mirror === null && returnsNumber(attr.thunk.body),
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'pass') {
				if (!isCustom || !registry.has(el.tag)) {
					diagnostics.push(
						diagnostic.passTargetNotCustom(source, el.node.start, el.tag),
					)
					continue
				}
				emitPassEntries(attr.entries, query, sink)
			} else if (attr.kind === 'class-map') {
				collectAmbient(attr.object)
				sink.push({
					kind: 'watch-class',
					query,
					keys: objectKeys(attr.object, { allowStrings: false }),
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'style-map') {
				collectAmbient(attr.object)
				sink.push({
					kind: 'watch-style',
					query,
					keys: objectKeys(attr.object, { allowStrings: true }),
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			} else if (attr.kind === 'event') {
				collectAmbient(attr.handler)
				sink.push({
					kind: 'on',
					query,
					event: attr.event,
					handlerText: attr.handlerText,
					sourceStart: attr.handler.start,
					sourceEnd: attr.handler.end,
				})
			} else if (attr.kind === 'html' && attr.reactive) {
				// reactive html={() => …} (LT-025): lowers to a
				// dangerouslyBindInnerHTML watch, the sanctioned XSS-aware sink
				// (ADR 0010) — never a raw innerHTML property binding.
				collectAmbient(attr.thunk)
				const bad = badFreeNames(attr.thunk)
				if (bad.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							attr.thunk.start,
							`Reactive html={…} references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
						),
					)
				}
				sink.push({
					kind: 'watch-html',
					query,
					thunkText: attr.thunkText,
					sourceStart: attr.thunk.start,
					sourceEnd: attr.thunk.end,
				})
			}
		}
		for (const child of el.children) {
			if (child.kind !== 'expr' || !child.lazy) continue
			// A managed form prop as a reactive child requires the widened
			// FormFactoryContext — formAssociated() must lead the extensions.
			// Since LT-052 the spelling is a `host.<prop>` read; the retired
			// string-literal form is still matched so a stale source gets this
			// message rather than a confusing downstream type error.
			const managed = managedPropRead(child.expr)
			if (
				managed !== null &&
				!component.exposeProps.has(managed) &&
				!component.config?.form
			)
				diagnostics.push(
					diagnostic.managedPropWithoutForm(source, child.node.start, managed),
				)
			collectAmbient(child.expr)
			sink.push({
				kind: 'watch-text',
				query,
				source: lazyWatchSource(child),
			})
		}
	}

	/** Does this element carry a construct of its own (not a nested one)? */
	const hasOwnConstruct = (el: ElementNode): boolean =>
		el.attrs.some(isClientConstructAttr) ||
		el.children.some(c => c.kind === 'expr' && c.lazy)

	// A lazy text child of the branch ROOT itself is a legitimate construct
	// (watched via the root's own query, exactly like a reactive attribute)
	// — only a NESTED element's own lazy child or construct attrs make the
	// construct unaddressable, hence the depth guard.
	const hasDeepConstruct = (el: ElementNode, depth = 0): boolean =>
		el.children.some(
			child =>
				(depth > 0 && child.kind === 'expr' && child.lazy) ||
				(child.kind === 'element' &&
					(child.attrs.some(isClientConstructAttr) ||
						hasDeepConstruct(child, depth + 1))),
		)

	/**
	 * A single branch whose root may not exist at all — the DOM-derived
	 * mirror of the hand-written `if (clearBtn) { … }` pattern. The root (if
	 * it carries client constructs) is addressed with a non-throwing
	 * `first()`; its own construct effects, plus any bare client-only
	 * statement sitting beside it in the branch (LT-008), are all wrapped in
	 * one `'guarded'` effect emitted client-side as `if (query) { … }`.
	 *
	 * Shared by a single-branch `@if` (no `@else`, `handleOptionalIfEffects`)
	 * and a plain `@try`'s two mutually-exclusive arms (LT-025,
	 * `handleTryEffects`) — same DOM-existence-guarded shape either way, just
	 * a different `label` for diagnostics and a different `atNode` to
	 * attribute a bare-statement error to when the branch has no element at
	 * all.
	 */
	const handleOptionalBranch = (
		body: TemplateNode[],
		atNode: { node: TsrxNode },
		label: string,
	): void => {
		const roots = body.filter(isElement)
		for (const root of roots)
			if (hasDeepConstruct(root))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						root.node.start,
						`Client constructs inside ${label} must sit on its root element — deeper elements exist only when it rendered`,
					),
				)
		const clientStmts = body.filter(
			(n): n is TemplateNode & { kind: 'client-stmt' } =>
				n.kind === 'client-stmt',
		)
		const constructedRoots = roots.filter(hasOwnConstruct)
		if (constructedRoots.length > 1) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					atNode.node.start,
					`Multiple addressable elements with client constructs inside one ${label} — only one root can be addressed; address the extra element through a hoisted const referenced from the first`,
				),
			)
			return
		}
		const primary = constructedRoots[0] ?? roots[0] ?? null
		const hasConstructs =
			clientStmts.length > 0 || (primary ? hasOwnConstruct(primary) : false)
		if (!hasConstructs) return
		if (!primary) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					atNode.node.start,
					`A bare client-only statement inside ${label} needs an element sibling to test whether it rendered`,
				),
			)
			return
		}
		const resolved = selectorFor(primary)
		if (!resolved.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					primary.node.start,
					`No unique selector for ${label}'s root <${primary.tag}> — add a distinguishing static attribute`,
				),
			)
			return
		}
		const refAttr = primary.attrs.find(a => a.kind === 'ref') as
			| { kind: 'ref'; name: string }
			| undefined
		const query = addQuery(
			refAttr?.name ?? sanitizeVarName(primary.tag),
			resolved.selector,
			'maybe',
		)
		const guarded: TopEffectPlan[] = []
		for (const stmt of body) {
			if (stmt.kind === 'client-stmt') {
				collectAmbient(stmt.node)
				guarded.push({
					kind: 'raw',
					text: stmt.text,
					sourceStart: stmt.node.start,
					sourceEnd: stmt.node.end,
				})
				continue
			}
			if (stmt === primary) emitConstructEffects(primary, query, guarded)
		}
		effects.push({ kind: 'guarded', query, effects: guarded })
	}

	/** A single-branch `@if` (no `@else`) — see `handleOptionalBranch`. */
	const handleOptionalIfEffects = (node: IfNode): void =>
		handleOptionalBranch(node.then, node, 'a single-branch @if')

	/**
	 * @if branches (LT-008): client constructs must sit on the branch ROOT
	 * elements; the client addresses whichever branch rendered through a
	 * union selector (`first('textarea, input[type="text"]')`). Construct
	 * texts must be identical across branches — one effect covers all. A
	 * branch with no `@else` may not render at all — see
	 * `handleOptionalIfEffects` for that (DOM-existence-guarded) case.
	 */
	const handleIfEffects = (node: IfNode): void => {
		if (node.alternate.length === 0) {
			handleOptionalIfEffects(node)
			return
		}
		const roots = [...node.then, ...node.alternate].filter(isElement)
		for (const root of roots)
			if (hasDeepConstruct(root))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						root.node.start,
						'Client constructs inside @if branches must sit on the branch root elements — deeper elements exist only when their branch rendered',
					),
				)
		const clientStmts = [...node.then, ...node.alternate].filter(
			(n): n is TemplateNode & { kind: 'client-stmt' } =>
				n.kind === 'client-stmt',
		)
		for (const stmt of clientStmts)
			diagnostics.push(
				diagnostic.unsupported(
					source,
					stmt.node.start,
					'A bare client-only statement inside an @if with @else — union addressing needs identical constructs in every branch; use a single-branch @if (no @else) instead',
				),
			)
		// Each branch may only carry ONE addressable element of its own —
		// the union query addresses "whichever branch rendered", not
		// multiple distinct siblings within a single branch.
		for (const branch of [node.then, node.alternate]) {
			const constructedInBranch = branch
				.filter(isElement)
				.filter(hasOwnConstruct)
			if (constructedInBranch.length > 1) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						'Multiple addressable elements with client constructs inside one @if branch — union addressing addresses a single root per branch; split into separate @if blocks, or address the extra element through a hoisted const referenced from the first',
					),
				)
				return
			}
		}
		// html={dataRef} is server-rendered only — not a client construct.
		const hasConstructs = roots.some(hasOwnConstruct)
		if (!hasConstructs) return
		const primary = roots.find(r => r.attrs.some(isClientConstructAttr))
		if (!primary) return
		const resolved = selectorFor(primary)
		if (!resolved.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					primary.node.start,
					`No unique selector for the @if branch root <${primary.tag}> — add a distinguishing static attribute`,
				),
			)
			return
		}
		const refAttr = primary.attrs.find(a => a.kind === 'ref') as
			| { kind: 'ref'; name: string }
			| undefined
		const query = addQuery(
			refAttr?.name ?? sanitizeVarName(primary.tag),
			resolved.selector,
			'one',
		)
		// Same-named constructs must agree across branches.
		const textsByKey = new Map<string, Set<string>>()
		for (const root of roots)
			for (const attr of root.attrs) {
				if (attr.kind === 'static' || attr.kind === 'server') continue
				const key = `${attr.kind === 'event' ? 'on' : 'bind'}:${'name' in attr ? attr.name : attr.kind}`
				const attrText =
					attr.kind === 'event'
						? attr.handlerText
						: attr.kind === 'reactive' ||
								attr.kind === 'class-map' ||
								attr.kind === 'style-map'
							? attr.thunkText
							: ''
				const texts = textsByKey.get(key) ?? new Set<string>()
				texts.add(attrText)
				textsByKey.set(key, texts)
			}
		for (const [key, texts] of textsByKey)
			if (texts.size > 1)
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						`@if branch constructs differ for \`${key}\` — union addressing requires identical client behavior in every branch`,
					),
				)
		emitConstructEffects(primary, query)
	}

	/** Does a subtree carry client constructs (client-side-only elements)? */
	const hasClientConstructs = (node: TemplateNode): boolean => {
		if (node.kind === 'client-stmt') return true
		if (node.kind === 'expr') return node.lazy
		if (node.kind === 'if' || node.kind === 'switch' || node.kind === 'try')
			return false
		if (!isElement(node)) return false
		if (node.attrs.some(isClientConstructAttr)) return true
		return node.children.some(hasClientConstructs)
	}

	/**
	 * @switch arms render exclusively — a construct in one arm would make
	 * its element missing whenever another arm renders, so arms must be
	 * construct-free markup (use @if with identical branch constructs for
	 * interactive alternatives).
	 */
	const handleSwitchEffects = (node: SwitchNode): void => {
		for (const arm of node.cases)
			for (const child of arm.children)
				if (hasClientConstructs(child))
					diagnostics.push(
						diagnostic.unsupported(
							source,
							(child as ElementNode).node?.start ?? node.node.start,
							'Client constructs inside @switch arms — arms render exclusively, so the element is not guaranteed to exist. Keep arms to static/server markup, or use @if branches with identical constructs (union addressing).',
						),
					)
	}

	/** A direct lazy child of `el` whose expr is a bare Identifier, if any. */
	const directLazyIdentifier = (el: ElementNode): string | null => {
		for (const child of el.children) {
			if (
				child.kind === 'expr' &&
				child.lazy &&
				nodeType(child.expr) === 'Identifier'
			)
				return String((child.expr as TsrxNode).name)
		}
		return null
	}

	/**
	 * A direct lazy child of `el` referencing the catch param — bare (`e`) or
	 * a non-computed member read (`e.message`) — as the client-side error
	 * expression (`error`/`error.message`), or null if no such child exists.
	 */
	const directLazyCatchRef = (
		el: ElementNode,
		catchParam: string,
	): string | null => {
		for (const child of el.children) {
			if (child.kind !== 'expr' || !child.lazy) continue
			const expr = child.expr
			if (
				nodeType(expr) === 'Identifier' &&
				String((expr as TsrxNode).name) === catchParam
			)
				return 'error'
			if (
				nodeType(expr) === 'MemberExpression' &&
				!(expr as TsrxNode).computed
			) {
				const obj = (expr as TsrxNode).object
				const prop = (expr as TsrxNode).property
				if (
					nodeType(obj) === 'Identifier' &&
					String((obj as TsrxNode).name) === catchParam &&
					nodeType(prop) === 'Identifier'
				)
					return `error.${String((prop as TsrxNode).name)}`
			}
		}
		return null
	}

	/**
	 * An async boundary (`@try`/`@pending`/`@catch`, ADR 0023 sub-design 13,
	 * LT-012): `lowerTry` already proved each arm has exactly one root
	 * element. All three render server-side (`emit-server.ts`), toggled
	 * `hidden` by which state won at render time; the client wires a single
	 * `watch(signal, { ok, err, nil })` call that flips the same `hidden`
	 * property going forward — pure enhance, no client DOM creation.
	 */
	const handleAsyncBoundary = (node: TryNode): void => {
		const okRoot = node.children.find(isElement) as ElementNode
		const pendingRoot = (node.pendingChildren as TemplateNode[]).find(
			isElement,
		) as ElementNode
		const errRoot = node.catchChildren.find(isElement) as ElementNode
		const catchParam = node.catchParam

		if (
			hasDeepConstruct(okRoot) ||
			hasDeepConstruct(pendingRoot) ||
			hasDeepConstruct(errRoot)
		) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node.start,
					"Client constructs inside an async boundary must sit on each arm's own root element — deeper elements have no addressing (ADR 0023 sub-design 13)",
				),
			)
			return
		}
		if (hasOwnConstruct(pendingRoot)) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					pendingRoot.node.start,
					'@pending arm of an async boundary must be static/server markup — nothing watches it once resolved',
				),
			)
			return
		}

		const okLazyName = directLazyIdentifier(okRoot)
		const boundaryCandidates = component.signals.filter(
			s => s.constructor === 'deriveCell' && s.name === okLazyName,
		)
		if (!okLazyName || boundaryCandidates.length !== 1) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					okRoot.node.start,
					"An async boundary's @try body must render the async signal it guards as a direct lazy child (e.g. `&{data}`), where `data` is a `deriveCell(async …)` signal — the compiler discovers which signal drives isPending() routing from that reference.",
				),
			)
			return
		}
		const signal = boundaryCandidates[0]?.name as string

		if (okRoot.attrs.some(isClientConstructAttr)) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					okRoot.node.start,
					"An async boundary's @try body root may only carry static/server attributes and its one lazy signal child — other reactive constructs have no addressing here yet",
				),
			)
			return
		}
		if (errRoot.attrs.some(isClientConstructAttr)) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					errRoot.node.start,
					'@catch arm of an async boundary may only carry static/server attributes and its one lazy error child',
				),
			)
			return
		}

		const okSelector = resolveSelector(okRoot)
		const pendingSelector = resolveSelector(pendingRoot)
		const errSelector = resolveSelector(errRoot)
		for (const [label, resolved, el] of [
			['@try body', okSelector, okRoot],
			['@pending arm', pendingSelector, pendingRoot],
			['@catch arm', errSelector, errRoot],
		] as const) {
			if (!resolved.unique)
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						el.node.start,
						`No unique selector for the ${label}'s root <${el.tag}> of an async boundary; add a distinguishing static attribute (role, class, or data-*).`,
					),
				)
		}
		const okQuery = addQuery(
			sanitizeVarName(okRoot.tag),
			okSelector.selector,
			'one',
		)
		const pendingQuery = addQuery(
			sanitizeVarName(pendingRoot.tag),
			pendingSelector.selector,
			'one',
		)
		const errQuery = addQuery(
			sanitizeVarName(errRoot.tag),
			errSelector.selector,
			'one',
		)

		const errText = catchParam ? directLazyCatchRef(errRoot, catchParam) : null
		if (
			errRoot.children.some(c => c.kind === 'expr' && c.lazy) &&
			errText === null
		) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					errRoot.node.start,
					`@catch arm's lazy child must reference the catch param \`${catchParam ?? 'e'}\` (bare, or a member read like \`${catchParam ?? 'e'}.message\`)`,
				),
			)
			return
		}

		effects.push({
			kind: 'async',
			signal,
			pendingQuery,
			okQuery,
			errQuery,
			okText: true,
			errText,
		})
	}

	/**
	 * @try error boundaries: the body and catch arm render mutually
	 * exclusively — whichever one the server actually rendered is the only
	 * one that exists in the DOM, exactly the DOM-existence-guarded shape a
	 * single-branch `@if` has (LT-025: each arm gets its own
	 * `handleOptionalBranch` call, independently — NOT union addressing like
	 * `@if`/`@else`, since the two arms are different content, not the same
	 * construct duplicated).
	 *
	 * A `@pending` arm present routes to `handleAsyncBoundary` instead (ADR
	 * 0023 sub-design 13, LT-012) — a fundamentally different shape (all
	 * three arms render unconditionally, toggled `hidden`) from this plain
	 * mutually-exclusive error boundary.
	 */
	const handleTryEffects = (node: TryNode): void => {
		if (node.pendingChildren !== null) {
			handleAsyncBoundary(node)
			return
		}
		handleOptionalBranch(node.children, node, 'a @try body')
		handleOptionalBranch(node.catchChildren, node, 'a @catch arm')
	}

	/**
	 * `ref={name}` and/or `pass={{ }}` on a composed element (ADR 0023
	 * sub-design 10). Composed elements aren't otherwise addressed at all yet
	 * (server args aren't guaranteed to render as DOM attributes, LT-018's
	 * children are the only other construct they'll carry): an explicit
	 * `ref` is required for BOTH — a bare `ref` (no `pass`) still needs the
	 * query so the name resolves in the factory (e.g. reading `textbox.value`
	 * from an event handler elsewhere in the template) — and the target must
	 * be the sole composed instance of that child in the template
	 * (`countComposeBySource`) since there's no attribute-based discriminator
	 * to fall back on.
	 */
	const emitComposeEffects = (node: ComposeNode): void => {
		const passAttrs = node.attrs.filter(
			(a): a is Extract<(typeof node.attrs)[number], { kind: 'pass' }> =>
				a.kind === 'pass',
		)
		const refAttr = node.attrs.find(
			(a): a is Extract<(typeof node.attrs)[number], { kind: 'ref' }> =>
				a.kind === 'ref',
		)
		if (passAttrs.length === 0 && !refAttr) return
		if (!refAttr) {
			diagnostics.push(
				diagnostic.composedPassRequiresRef(
					source,
					node.node.start,
					node.component,
				),
			)
			return
		}
		if (countComposeBySource(node.source) !== 1) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					node.node.start,
					`Multiple <${node.component}> instances compose the same child — ref={{ }}/pass={{ }} need a target this milestone can uniquely identify.`,
				),
			)
			return
		}
		// `composeRegistry` is `undefined` during the corpus-wide registry-
		// discovery pass (compileComponent's own tolerance, LT-015) — this
		// component's OWN entry is all that pass needs; the composed child's
		// tag isn't resolvable yet, and that's fine, not an error.
		if (!composeRegistry) return
		const childTag = composeRegistry.get(node.source)?.tag ?? null
		if (!childTag) {
			diagnostics.push(
				diagnostic.composedComponentNotCompiled(
					source,
					node.node.start,
					node.component,
					node.source,
				),
			)
			return
		}
		const query = addQuery(refAttr.name, childTag, 'one')
		if (passAttrs.length > 0)
			emitPassEntries(
				passAttrs.flatMap(a => a.entries),
				query,
			)
	}

	const emitTopEffects = (node: TemplateNode): void => {
		if (node.kind === 'if') {
			handleIfEffects(node)
			return
		}
		if (node.kind === 'switch') {
			handleSwitchEffects(node)
			return
		}
		if (node.kind === 'try') {
			handleTryEffects(node)
			return
		}
		if (node.kind === 'compose') {
			emitComposeEffects(node)
			return
		}
		if (!isElement(node)) return
		if (node !== component.root && loopFor(node)) {
			const loop = loopFor(node) as ForIR
			if (loop.listSignal) {
				const plan = reconcilePlans.get(loop)
				if (plan) effects.push({ kind: 'reconcile', for: plan })
				return
			}
			const plan = forPlans.get(loop)
			if (plan) effects.push({ kind: 'each', for: plan })
			return
		}
		if (node === component.root) {
			for (const attr of component.root.attrs) {
				if (attr.kind === 'style-map') {
					// LT-028: the root's own reactive style is the one construct
					// addressable without a query — the target is the ambient
					// `host`, not a queried descendant.
					collectAmbient(attr.object)
					ambient.add('host')
					effects.push({
						kind: 'watch-style',
						query: 'host',
						keys: objectKeys(attr.object, { allowStrings: true }),
						thunkText: attr.thunkText,
						sourceStart: attr.thunk.start,
						sourceEnd: attr.thunk.end,
					})
					continue
				}
				if (attr.kind === 'class-map') {
					// LT-032: same root exemption as style-map — targets the
					// ambient `host`, not a queried descendant.
					collectAmbient(attr.object)
					ambient.add('host')
					effects.push({
						kind: 'watch-class',
						query: 'host',
						keys: objectKeys(attr.object, { allowStrings: false }),
						thunkText: attr.thunkText,
						sourceStart: attr.thunk.start,
						sourceEnd: attr.thunk.end,
					})
					continue
				}
				if (
					attr.kind === 'event' ||
					attr.kind === 'reactive' ||
					attr.kind === 'html' ||
					attr.kind === 'ref' ||
					attr.kind === 'pass'
				) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							component.root.node.start,
							'Reactive constructs on the component root element',
						),
					)
					break
				}
			}
		} else {
			const hasClientConstruct =
				node.attrs.some(isClientConstructAttr) ||
				node.children.some(c => c.kind === 'expr' && c.lazy)
			if (hasClientConstruct) {
				const { selector, unique } = resolveSelector(node)
				if (!unique) {
					diagnostics.push(
						diagnostic.unaddressableElement(
							source,
							node.node.start,
							`No unique selector for <${node.tag}> in the rendered template; add a distinguishing static attribute (role, class, or data-*).`,
						),
					)
				}
				const refAttr = node.attrs.find(a => a.kind === 'ref') as
					| { kind: 'ref'; name: string }
					| undefined
				const query = addQuery(
					refAttr?.name ?? sanitizeVarName(node.tag),
					selector,
					'one',
				)
				emitConstructEffects(node, query)
			}
		}
		for (const child of node.children) emitTopEffects(child)
	}
	emitTopEffects(component.root)
}
