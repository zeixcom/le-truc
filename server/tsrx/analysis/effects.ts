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
	SEMANTICALLY_LOADED_ATTRS,
	sanitizeVarName,
} from '../ast-utils'
import { diagnostic } from '../diagnostics'
import {
	containsImpureAmbient,
	dependenciesOf,
	foldableHostProps,
	hostDerivedFold,
} from '../evaluability'
import type { AttributeIR, ForIR, PassEntryIR, TemplateNode } from '../ir'
import { lazyWatchSource, returnsNumber } from './harvest'
import { uniqueName } from './naming'
import type { AnalysisContext, TopEffectPlan } from './plan'
import {
	allComposeNodes,
	type ComposeNode,
	composeDiscriminatorClause,
	composeNodesBySource as composeNodesBySourceIn,
	composeStaticAttrs,
	countComposeBySource as countComposeBySourceIn,
	type ElementNode,
	type ExprNode,
	type IfNode,
	isElement,
	loopFor as loopForIn,
	resolveSelector as resolveSelectorIn,
	type SwitchNode,
	selectorFor as selectorForIn,
	type TryNode,
} from './selectors'

/**
 * Native form-control tags a form-associated component's `disabled`/
 * `checked` omission (TSRX034) escalates to an ERROR for (LT-062/LT-085):
 * a real submittable control, not the host itself. Compiler-side duplicate
 * of `compiler.ts`'s `NAMED_FORM_CONTROL_TAGS` (LT-059) — front-end/
 * analysis-layer duplication is the established pattern here (same
 * precedent as `MANAGED_FORM_MEMBERS`, ast-utils.ts) rather than an import
 * against the documented front-end → analysis direction.
 */
const SUBMITTABLE_FORM_CONTROL_TAGS: ReadonlySet<string> = new Set([
	'input',
	'select',
	'textarea',
	'button',
])

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
		usedNames,
	} = ctx
	const selectorFor = (el: ElementNode) => selectorForIn(component, el)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const countComposeBySource = (source2: string) =>
		countComposeBySourceIn(component.root, source2)
	const composeNodesBySource = (source2: string) =>
		composeNodesBySourceIn(component.root, source2)
	const loopFor = (node: TemplateNode): ForIR | null =>
		loopForIn(component, node)
	// LT-085: the substitutable host-prop set for `hostDerivedFold` below,
	// computed once per component rather than per attribute.
	const derivableHostProps = foldableHostProps(component)

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
				// CHECKLIST §4 / TSRX033: this thunk's free names are otherwise
				// all server-known — it would have folded to an initial server
				// value — but it also reads an impure ambient (Date/Intl/
				// Math.random/toLocaleString/getTimezoneOffset). `isServerEvaluable`
				// (evaluability.ts) already refuses to fold it (the attribute is
				// omitted server-side, same as any non-portable thunk); this warns
				// so the omission doesn't read as an unrelated bug.
				if (
					dependenciesOf(attr.thunk).isSubsetOf(component.serverKnown) &&
					containsImpureAmbient(attr.thunk)
				)
					diagnostics.push(
						diagnostic.impureServerFold(source, attr.thunk.start, attr.name),
					)
				// CHECKLIST §5 / TSRX034: omission is not neutral for these
				// attribute names — `hidden` omitted means visible, `disabled`
				// omitted means enabled AND submittable, same for `checked`/
				// `selected`/`aria-expanded`. A host-prop mirror, a derived
				// `host.<prop>` fold (LT-085, `hostDerivedFold` below), and a
				// server-evaluable thunk all render an initial value — all
				// three safe. Anything else (a sensor, or any other
				// non-portable dependency) would be silently OMITTED
				// (`emit-server.ts`'s `case 'reactive'` pushes nothing at all
				// when none of the three paths applies), rendering the
				// interactive/visible/submittable default regardless of what
				// the author intended — the worst of the two possible
				// defaults, not a neutral one.
				if (
					SEMANTICALLY_LOADED_ATTRS.has(attr.name) &&
					hostPropOf(attr.thunk) === null &&
					hostDerivedFold(attr.thunk, derivableHostProps) === null &&
					!(
						dependenciesOf(attr.thunk).isSubsetOf(component.serverKnown) &&
						!containsImpureAmbient(attr.thunk)
					)
				)
					diagnostics.push(
						diagnostic.unsafeLoadedAttributeDefault(
							source,
							attr.thunk.start,
							attr.name,
							// LT-062/LT-085: escalate to ERROR only for `disabled`/
							// `checked` on a real submittable native form control
							// inside a form-associated component — there, the wrong
							// default is a submission-correctness bug, not a
							// cosmetic flash.
							(attr.name === 'disabled' || attr.name === 'checked') &&
								component.config?.form != null &&
								SUBMITTABLE_FORM_CONTROL_TAGS.has(el.tag),
						),
					)
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
		// LT-115 (folded in by the LT-114 review): the EMISSION gate the root
		// branch has had since LT-114, mirrored onto the nested path.
		// `bindText` replaces the element's ENTIRE textContent, so the one
		// sanctioned shape is a lazy child that is the element's sole content
		// — multiple lazy children race last-write-wins on the shared
		// textContent, and static text is wiped (element children REMOVED) by
		// the first write. Before this, the nested loop silently emitted a
		// plausible-looking but wrong binding for both mixes (NOTES LT-114's
		// hazard flag). Per-child checks below run regardless of this gate —
		// independent findings, same posture as the root branch.
		const lazyChildren = el.children.filter(
			(c): c is ExprNode => c.kind === 'expr' && c.lazy,
		)
		const contentSiblings = el.children.filter(
			c => c.kind !== 'client-stmt' && !(c.kind === 'expr' && c.lazy),
		)
		for (const child of lazyChildren) {
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
			// CHECKLIST §4 / TSRX033: same "would have folded, refuse to fold,
			// warn" as the reactive-attribute site above, for a lazy text child
			// (the checklist's own example: `{formatRemaining(maxlength, length)}`
			// shaped, but reading `Date`/`Intl`/`Math.random` instead).
			if (
				dependenciesOf(child.expr).isSubsetOf(component.serverKnown) &&
				containsImpureAmbient(child.expr)
			)
				diagnostics.push(
					diagnostic.impureServerFold(source, child.node.start, null),
				)
			if (lazyChildren.length > 1) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						lazyChildren[1]?.node.start,
						`Multiple lazy text children on <${el.tag}> — bindText() replaces the element's entire textContent, so a second lazy child's writes would silently overwrite the first's. Combine them into one expression.`,
					),
				)
				continue
			}
			if (contentSiblings.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						child.node.start,
						`A lazy text child must be <${el.tag}>'s only content — bindText() replaces the element's entire textContent, wiping static text and removing element children on the first write. Move mixed content into a dedicated child element.`,
					),
				)
				continue
			}
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
		// Root elements (not just texts) carrying each key, keyed the same
		// way — lets TSRX031 name which branch has the construct and which
		// is missing it, distinct from the "differs" check below.
		const rootsByKey = new Map<string, ElementNode[]>()
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
				const withKey = rootsByKey.get(key) ?? []
				withKey.push(root)
				rootsByKey.set(key, withKey)
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
		// TSRX031: a construct present on only SOME branch roots is silently
		// dropped entirely — `emitConstructEffects(primary, …)` below only
		// ever reads `primary`'s own attrs, so a construct unique to a
		// non-primary branch never gets emitted, with no diagnostic before
		// this check existed (found migrating form-textbox.tsrx, LT-060).
		for (const [key, withKey] of rootsByKey) {
			const [present] = withKey
			if (present && withKey.length < roots.length) {
				const missing = roots.find(r => !withKey.includes(r))
				if (missing)
					diagnostics.push(
						diagnostic.asymmetricBranchConstruct(
							source,
							node.node.start,
							key,
							present.tag,
							missing.tag,
						),
					)
			}
		}
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
		// The synthetic `<fieldset disabled>` `emit-server.ts` wraps around
		// each arm root (LT-077, CHECKLIST §8) is addressed structurally, not
		// via a CSS query (LT-086): `emit-server.ts` always makes it the arm
		// root's IMMEDIATE parent, so the client reads `<armRoot>.parentElement`
		// instead of re-querying — no selector to keep in sync with the
		// emitter, and no dependency on `:has()`, which is outside
		// REQUIREMENTS.md's 2020 Web Platform browser baseline and would throw
		// `InvalidSelectorError` on an unsupporting engine (a live
		// `querySelector()` call, unlike this codebase's existing CSS-only
		// `:has()` use in `form-tokenbox.css`, which degrades gracefully
		// instead of throwing). Only the variable name is reserved here;
		// `emit-client.ts` emits the `.parentElement` declaration itself.
		const okFieldsetQuery = uniqueName(
			usedNames,
			`${sanitizeVarName(okRoot.tag)}Fieldset`,
		)
		const pendingFieldsetQuery = uniqueName(
			usedNames,
			`${sanitizeVarName(pendingRoot.tag)}Fieldset`,
		)
		const errFieldsetQuery = uniqueName(
			usedNames,
			`${sanitizeVarName(errRoot.tag)}Fieldset`,
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
			pendingFieldsetQuery,
			okFieldsetQuery,
			errFieldsetQuery,
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
	/**
	 * Static `id` attribute values under a subtree (CHECKLIST §8's duplicate-
	 * id rule) — walks every element, not just roots, since an id collision
	 * anywhere under an arm is just as real a document-validity/ARIA-
	 * relationship bug as one on the arm root itself.
	 */
	const staticIdsUnder = (nodes: readonly TemplateNode[]): string[] => {
		const ids: string[] = []
		// Only recurses into ELEMENT children — a nested `@if`/`@try`/`@for`
		// inside an arm isn't walked (each has its own distinct nesting
		// shape). Acceptable scoping gap: catches the common case (a literal
		// `id` on a plain element in the arm) without a full generic
		// template-node visitor.
		const visit = (n: TemplateNode): void => {
			if (isElement(n)) {
				const idAttr = n.attrs.find(
					(a): a is Extract<AttributeIR, { kind: 'static' }> =>
						a.kind === 'static' && a.name === 'id' && a.value !== null,
				)
				if (idAttr) ids.push(idAttr.value as string)
				for (const child of n.children) visit(child)
			}
		}
		for (const n of nodes) visit(n)
		return ids
	}

	const handleTryEffects = (node: TryNode): void => {
		// CHECKLIST §8: all three arms render into the initial HTML at once
		// (two hidden, not removed) — a literal `id` duplicated across arms
		// is two elements sharing an id in the SAME document simultaneously,
		// same failure whether or not `@pending` is present.
		const branches: Array<[string, readonly TemplateNode[]]> = [
			['@try body', node.children],
			['@catch arm', node.catchChildren],
		]
		if (node.pendingChildren !== null)
			branches.push(['@pending arm', node.pendingChildren])
		const seenIn = new Map<string, string>()
		for (const [label, branch] of branches)
			for (const id of staticIdsUnder(branch)) {
				const firstLabel = seenIn.get(id)
				if (firstLabel && firstLabel !== label)
					diagnostics.push(
						diagnostic.duplicateIdAcrossArms(
							source,
							node.node.start,
							id,
							firstLabel,
							label,
						),
					)
				else if (!firstLabel) seenIn.set(id, label)
			}
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
	 * (`countComposeBySource`), UNLESS a static `class`/`id`/`data-*` on the
	 * compose site uniquely tells it apart from same-source siblings
	 * (`composeDiscriminatorClause`, LT-089) — three same-source
	 * `<FormSpinbutton class="lightness"|"chroma"|"hue">` instances, say.
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
		let discriminator = ''
		if (countComposeBySource(node.source) !== 1) {
			const siblings = composeNodesBySource(node.source)
			const clause = composeDiscriminatorClause(node, siblings)
			if (!clause) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						node.node.start,
						`Multiple <${node.component}> instances compose the same child — ref={{ }}/pass={{ }} need a target this milestone can uniquely identify (a distinguishing static class/id/data-* attribute on the compose site).`,
					),
				)
				return
			}
			discriminator = clause
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
		const query = addQuery(refAttr.name, `${childTag}${discriminator}`, 'one')
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
			// LT-114: the root's lazy text CHILDREN are the text-binding
			// counterpart of the style-map/class-map root exemptions above
			// (LT-028/LT-032). A nested element binds its lazy children
			// through the element's own query; the root has none, so the
			// target is the ambient `host` — before this, the root branch
			// never visited children at all and the generated client
			// silently emitted no `watch(source, bindText(...))`, leaving
			// the component permanently empty on hydration-only pages
			// (found cutting basic-number over, NOTES LT-092).
			const lazyChildren = component.root.children.filter(
				(c): c is ExprNode => c.kind === 'expr' && c.lazy,
			)
			if (lazyChildren.length > 0) {
				// Per-child checks run regardless of the emission gate below —
				// they are independent findings (same posture as the nested
				// path's loop inside emitConstructEffects).
				for (const child of lazyChildren) {
					// A managed form prop as a reactive child requires the
					// widened FormFactoryContext — formAssociated() must lead
					// the extensions (same gate as the nested path).
					const managed = managedPropRead(child.expr)
					if (
						managed !== null &&
						!component.exposeProps.has(managed) &&
						!component.config?.form
					)
						diagnostics.push(
							diagnostic.managedPropWithoutForm(
								source,
								child.node.start,
								managed,
							),
						)
					collectAmbient(child.expr)
					// CHECKLIST §4 / TSRX033: same "would have folded, refuse
					// to fold, warn" as the nested path's lazy-child site —
					// the server omits the child and the client's first
					// binding pass corrects it, which the author should not
					// mistake for an unrelated bug.
					if (
						dependenciesOf(child.expr).isSubsetOf(component.serverKnown) &&
						containsImpureAmbient(child.expr)
					)
						diagnostics.push(
							diagnostic.impureServerFold(source, child.node.start, null),
						)
				}
				// Emission gate: bindText() replaces the element's ENTIRE
				// textContent, so the one sanctioned shape is a lazy child
				// that is the root's sole content. Multiple lazy children
				// would race last-write-wins; static text would be wiped on
				// the first write; element children would be REMOVED by the
				// textContent assignment itself. Reject with a clear message
				// instead of emitting a plausible-looking but wrong binding
				// (the nested path tolerates these silently — a pre-existing
				// hazard there, not a precedent to copy).
				const contentSiblings = component.root.children.filter(
					c => c.kind !== 'client-stmt' && !(c.kind === 'expr' && c.lazy),
				)
				if (lazyChildren.length > 1) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							lazyChildren[1]?.node.start,
							"Multiple lazy text children on the component root — bindText() replaces the element's entire textContent, so a second lazy child's writes would silently overwrite the first's. Combine them into one expression.",
						),
					)
				} else if (contentSiblings.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							lazyChildren[0]?.node.start,
							"A lazy text child must be the component root's only content — bindText() replaces the element's entire textContent, wiping static text and removing element children on the first write. Move mixed content into a dedicated child element.",
						),
					)
				} else {
					ambient.add('host')
					effects.push({
						kind: 'watch-text',
						query: 'host',
						source: lazyWatchSource(lazyChildren[0] as ExprNode),
					})
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

	// LT-090: a static `id` on a compose site materializes on that
	// instance's host element (`composeHostAttrs`) — duplicated across
	// sites it is two elements sharing an id in the same rendered
	// document, invalid HTML, and id-based addressing resolves to at most
	// one of them. Same rationale as TSRX035's across-arms rule,
	// generalized to compose sites.
	const idSites = new Map<string, ComposeNode[]>()
	for (const composeNode of allComposeNodes(component.root)) {
		const id = composeStaticAttrs(composeNode).get('id')
		if (id == null) continue
		const sites = idSites.get(id) ?? []
		sites.push(composeNode)
		idSites.set(id, sites)
	}
	for (const [id, sites] of idSites) {
		const [, second] = sites
		if (!second) continue
		diagnostics.push(
			diagnostic.duplicateComposeId(
				source,
				second.node.start,
				id,
				sites.length,
			),
		)
	}
}
