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
	isDirtyFlagControlAttr,
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
	foldableRefGuards,
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
	resolveExclusiveSelectorIn,
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
 * Does this attribute carry a client construct? A non-reactive `truc:html={ref}`
 * is server-rendered only (LT-025); a reactive `truc:html={() => …}` lowers to a
 * `dangerouslyBindInnerHTML` watch, same as any other reactive attribute.
 */
const isClientConstructAttr = (a: AttributeIR): boolean =>
	// A server attribute is normally render-only — except LT-122's
	// arg-and-prop coincidence, which renders server-side AND binds.
	(a.kind === 'server' ? a.bindsProp != null : a.kind !== 'static') &&
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
		ambiguousComposeNodes,
	} = ctx
	const selectorFor = (el: ElementNode) => selectorForIn(component, el)
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)
	const countComposeBySource = (source2: string) =>
		countComposeBySourceIn(component.root, source2)
	const composeNodesBySource = (source2: string) =>
		composeNodesBySourceIn(component.root, source2)
	const loopFor = (node: TemplateNode): ForIR | null =>
		loopForIn(component, node)
	// LT-085/LT-118: the two substitutable sets for `hostDerivedFold`
	// below — host props with a known server truth, and refs whose
	// presence the server decides — computed once per component rather
	// than per attribute. Both must match what `emit-server.ts` will
	// actually fold, or TSRX034 warns about an attribute that does render.
	const derivableHostProps = foldableHostProps(component)
	const derivableRefGuards = foldableRefGuards(component)

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
			if (attr.kind === 'server' && attr.bindsProp) {
				// LT-122: a server-rendered attribute whose expression is
				// an arg that is also an exposed prop. `emit-server.ts`
				// renders it from the arg exactly as before — this adds
				// the client half, so a later prop write reaches the
				// attribute the component itself rendered. Dispatch is
				// always `property`: the source is a host-prop mirror by
				// construction, and mirrors never write through the
				// content attribute (see the `reactive` branch below).
				if (isCustom) {
					diagnostics.push(
						diagnostic.reactiveAttrOnCustomElement(
							source,
							attr.node.start,
							el.tag,
							attr.name,
						),
					)
					continue
				}
				// The synthesized thunk reads `host`, so the factory
				// destructuring needs it — there is no authored node
				// for `collectAmbient` to find the name in.
				ambient.add('host')
				sink.push({
					kind: 'watch-attr',
					query,
					attr: attr.name,
					thunkText: `() => host.${attr.bindsProp}`,
					// Attribute dispatch by default, exactly as an
					// authored thunk over a non-mirror source: the
					// site is whatever the author rendered, including
					// `data-*` seeds with no DOM property at all
					// (form-textbox's `data-remaining={description}`
					// — `bindProperty` there fails to typecheck, which
					// is how this was found). Property dispatch is
					// reserved for the one case where the attribute
					// genuinely stops tracking: a dirty-flag IDL
					// attribute on a native form control (LT-116).
					dispatch: isDirtyFlagControlAttr(el.tag, attr.name)
						? 'property'
						: 'attribute',
					// The thunk is synthesized, so there is no authored
					// body to inspect for a number return; the exposed
					// prop's own type decides.
					coerceToString: false,
					sourceStart: attr.node.start,
					sourceEnd: attr.node.end,
				})
				continue
			}
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
					hostDerivedFold(
						attr.thunk,
						derivableHostProps,
						derivableRefGuards,
					) === null &&
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
				// targets like `input.value`. LT-116: a dirty-flag IDL
				// attribute on a native form control (`value`/`checked`/
				// `selected` on input/select/textarea/option) dispatches as
				// a property too, mirror or not — once the control is dirty,
				// rewriting the content attribute no longer moves the live
				// property, so `bindAttribute` would silently stop tracking
				// (the form-radiogroup mutual-exclusion break, NOTES LT-092).
				// The thunk's own type is irrelevant to that hazard: the
				// divergence is a property of the target.
				const mirror = hostPropOf(attr.thunk)
				const dispatch: 'attribute' | 'property' =
					mirror !== null || isDirtyFlagControlAttr(el.tag, attr.name)
						? 'property'
						: 'attribute'
				sink.push({
					kind: 'watch-attr',
					query,
					attr: attr.name,
					thunkText: attr.thunkText,
					dispatch,
					// Number-valued thunks stringify under either dispatch:
					// `bindAttribute` takes string|boolean, and the dirty-flag
					// properties (`value` on input/textarea/select) are
					// DOMString-typed — the coercion keeps both typechecking.
					coerceToString: returnsNumber(attr.thunk.body, component.signals),
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
				// reactive truc:html={() => …} (LT-025): lowers to a
				// dangerouslyBindInnerHTML watch, the sanctioned XSS-aware sink
				// (ADR 0010) — never a raw innerHTML property binding.
				collectAmbient(attr.thunk)
				const bad = badFreeNames(attr.thunk)
				if (bad.length > 0) {
					diagnostics.push(
						diagnostic.unsupported(
							source,
							attr.thunk.start,
							`Reactive truc:html={…} references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')}; the client only knows signals, refs, context members, and globals`,
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
			if (child.bindsProp) {
				// `lazyWatchSource` spells this site's source as
				// `() => host.<prop>` (the arg is what the SERVER
				// splices), so the factory destructuring needs
				// `host` — the authored expression names only the arg.
				ambient.add('host')
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
	 * An element's author-declared `first()` reference, if it has one. Since
	 * LT-055 (raw) and LT-127 (composed) every `{kind:'ref'}` attr in the IR
	 * is one — the compiler attaches them from `first()` calls and nothing
	 * else does.
	 */
	const refOf = (el: ElementNode): { kind: 'ref'; name: string } | undefined =>
		el.attrs.find(a => a.kind === 'ref') as
			| { kind: 'ref'; name: string }
			| undefined

	/**
	 * A single branch whose root may not exist at all — the DOM-derived
	 * mirror of the hand-written `if (clearBtn) { … }` pattern. The root (if
	 * it carries client constructs) is addressed with a non-throwing
	 * `first()`; its own construct effects, plus any bare client-only
	 * statement sitting beside it in the branch (LT-008), are all wrapped in
	 * one `'guarded'` effect emitted client-side as `if (query) { … }`.
	 *
	 * Shared by a single-branch `@if` (no `@else`, `handleOptionalIfEffects`),
	 * a plain `@try`'s two mutually-exclusive arms (LT-025, `handleTryEffects`),
	 * and — since LT-118 — each branch of an `@if`/`@else` whose branch roots
	 * carry differing client constructs (`handlePerBranchIfEffects`): same
	 * DOM-existence-guarded shape either way, just a different `label` for
	 * diagnostics, a different `atNode` to attribute a bare-statement error
	 * to when the branch has no element at all, and — for the two-branch
	 * `@if`/`@else` case only — a `resolve` that yields each root's OWN
	 * selector instead of the union across both branches (the default
	 * `selectorFor` would union them, which is the other addressing mode).
	 */
	const handleOptionalBranch = (
		// Read-only: the body is filtered and iterated, never mutated. Declared
		// `readonly` so `handlePerBranchIfEffects` can pass a branch out of its
		// `readonly` tuple without a cast (LT-118).
		body: readonly TemplateNode[],
		atNode: { node: TsrxNode },
		label: string,
		resolve: (el: ElementNode) => { selector: string; unique: boolean } = (
			el: ElementNode,
		) => selectorFor(el),
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
		// LT-130: an element the author addressed with `first()` carries its
		// OWN query and its OWN presence guard — exactly as it would outside
		// a branch — so it is not being union-addressed and does not compete
		// for the branch's single addressable root. The one-root limit exists
		// because a branch ROOT with no ref is addressed by a synthesized
		// selector standing in for "whichever branch rendered"; only those
		// count. `refOf` is total over ref kinds: since LT-055/LT-127 every
		// `{kind:'ref'}` in the IR comes from an author's `first()` call.
		const unaddressed = constructedRoots.filter(el => !refOf(el))
		if (unaddressed.length > 1) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					atNode.node.start,
					`Multiple addressable elements with client constructs inside one ${label} — only one root can be addressed; give the extra element its own \`first()\` reference, or address it through a hoisted const referenced from the first`,
				),
			)
			return
		}
		const primary = unaddressed[0] ?? constructedRoots[0] ?? roots[0] ?? null
		// Every OTHER constructed root in this branch is ref-addressed (the
		// filter above proved it) and gets its own guarded effect below.
		const extras = constructedRoots.filter(el => el !== primary)
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
		const resolved = resolve(primary)
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
		const refAttr = refOf(primary)
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
		// LT-130: each ref-addressed sibling in the same branch, on its own
		// query and its own guard. Bare client-only statements stay with the
		// primary — they are guarded by "did this branch render", which the
		// primary's presence already answers; duplicating them under every
		// sibling's guard would run them once per element.
		for (const extra of extras) {
			const extraResolved = resolve(extra)
			if (!extraResolved.unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						extra.node.start,
						`No unique selector for the \`first()\`-addressed <${extra.tag}> inside ${label} — add a distinguishing static attribute`,
					),
				)
				continue
			}
			const extraName = refOf(extra)?.name
			if (!extraName) continue
			const extraQuery = addQuery(extraName, extraResolved.selector, 'maybe')
			const extraEffects: TopEffectPlan[] = []
			emitConstructEffects(extra, extraQuery, extraEffects)
			effects.push({
				kind: 'guarded',
				query: extraQuery,
				effects: extraEffects,
			})
		}
	}

	/** A single-branch `@if` (no `@else`) — see `handleOptionalBranch`. */
	const handleOptionalIfEffects = (node: IfNode): void =>
		handleOptionalBranch(node.then, node, 'a single-branch @if')

	/**
	 * One branch root's client-construct signature (LT-118): its construct
	 * attributes' `key=text` pairs, sorted. Two roots with equal signatures
	 * are interchangeable for union addressing (one query, one effect set,
	 * whichever branch rendered); differing signatures — a construct key
	 * present on only some roots (the old TSRX031 case) or the same key with
	 * different text (the old "constructs differ" case) — route to per-branch
	 * addressing instead. Same key/text extraction those diagnostics compared.
	 */
	const constructSignatureOf = (root: ElementNode): string => {
		const parts: string[] = []
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
			parts.push(`${key}=${attrText}`)
		}
		return parts.sort().join('|')
	}

	/**
	 * An `@if`/`@else` whose branch roots carry DIFFERING client constructs
	 * (LT-118) — addressed per branch: each branch root gets its own
	 * non-throwing `first()` and its constructs wrap in a `'guarded'` effect,
	 * exactly how a plain `@try`'s two arms are addressed (LT-025), because
	 * the branches are different content, not the same construct duplicated.
	 * An effect planned inside a branch only activates when that branch
	 * rendered — the branch that didn't render has no element, its guard is
	 * false, its effects never bind. Exclusivity is therefore structural:
	 * mutually-exclusive branches never double-bind.
	 *
	 * That soundness has one precondition, checked up front: each addressed
	 * root's selector must not match the OTHER branch's markup
	 * (`resolveExclusiveSelectorIn`) — two existence guards over one
	 * selector would both be true on the one rendered element. Roots
	 * indistinguishable by statics keep a TSRX007 error naming the fix,
	 * rather than a plausible-but-wrong double binding.
	 */
	const handlePerBranchIfEffects = (node: IfNode): void => {
		const branches: Array<
			[string, readonly TemplateNode[], readonly TemplateNode[]]
		> = [
			['@if', node.then, node.alternate],
			['@else', node.alternate, node.then],
		]
		// Validate every branch needing addressing BEFORE any effects are
		// planned — a collision diagnostic must not leave a half-planned @if.
		for (const [label, body, other] of branches) {
			const own = body.filter(isElement).filter(hasOwnConstruct)
			if (own.length === 0) continue
			const root = own[0] as ElementNode
			const resolved = resolveExclusiveSelectorIn(component.root, root, other)
			if (resolved.unique) continue
			const plain = resolveSelector(root)
			if (!plain.unique) continue // no unique selector at all — reported below
			const otherLabel = label === '@if' ? '@else' : '@if'
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					root.node.start,
					`Per-branch addressing of this @if needs a selector for the ${label} branch root <${root.tag}> that cannot match the ${otherLabel} branch — \`${plain.selector}\` is unique in the template but matches the ${otherLabel} branch too, so both branches' effects would bind whichever root rendered. Add distinguishing static attributes to the branch roots, or make the constructs identical across branches (union addressing).`,
				),
			)
			return
		}
		for (const [label, body, other] of branches)
			handleOptionalBranch(body, node, `the ${label} branch`, el =>
				resolveExclusiveSelectorIn(component.root, el, other),
			)
	}

	/**
	 * @if branches (LT-008): client constructs must sit on the branch ROOT
	 * elements. With IDENTICAL construct text on every branch root, the
	 * client addresses whichever branch rendered through a union selector
	 * (`first('textarea, input[type="text"]')`) — one effect covers all.
	 * With DIFFERING constructs (LT-118), each branch is addressed on its
	 * own — see `handlePerBranchIfEffects`. A branch with no `@else` may not
	 * render at all — see `handleOptionalIfEffects` for that
	 * (DOM-existence-guarded) case.
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
		// Each branch may only carry ONE UNADDRESSED element of its own —
		// the union query addresses "whichever branch rendered", not
		// multiple distinct siblings within a single branch. An element the
		// author addressed with `first()` has its own query and its own
		// guard and is exempt (LT-130); a branch carrying one routes to
		// per-branch addressing below, which is where those are emitted.
		for (const branch of [node.then, node.alternate]) {
			const constructedInBranch = branch
				.filter(isElement)
				.filter(hasOwnConstruct)
				.filter(el => !refOf(el))
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
		const constructedRoots = roots.filter(hasOwnConstruct)
		if (constructedRoots.length === 0) {
			for (const stmt of clientStmts)
				diagnostics.push(
					diagnostic.unsupported(
						source,
						stmt.node.start,
						'A bare client-only statement inside an @if with @else needs an addressed branch root to guard it — add a client construct to one branch root (per-branch addressing), or use a single-branch @if (no @else) instead',
					),
				)
			return
		}
		// LT-118 routing: identical construct signatures on every branch
		// root AND an element root in every branch → union addressing (one
		// query, one effect set, unchanged emission); any difference — a
		// construct on only some roots (the old TSRX031 hazard: union
		// emission reads the FIRST constructed root only, so a sibling
		// branch's construct was silently dropped, or worse, bound onto the
		// wrong branch's element) or the same key with different text (the
		// old "constructs differ" error) → per-branch addressing. A branch
		// with no ELEMENT root at all (text-only) also routes per-branch:
		// the union query is cardinality 'one' (an @else guarantees SOME
		// branch rendered), which would throw on the branch-less side.
		const signatures = roots.map(constructSignatureOf)
		const everyBranchHasElementRoot = [node.then, node.alternate].every(
			branch => branch.some(isElement),
		)
		// A branch carrying MORE than one element root cannot be union-
		// addressed even with matching signatures (LT-130): the union query
		// resolves to a single element per branch, so the siblings would go
		// unbound. Route those to per-branch addressing, which gives each
		// `first()`-addressed element its own query.
		const everyBranchHasOneElementRoot = [node.then, node.alternate].every(
			branch => branch.filter(isElement).length === 1,
		)
		const unionCompatible =
			everyBranchHasElementRoot &&
			everyBranchHasOneElementRoot &&
			signatures.length > 0 &&
			signatures.every(s => s !== '' && s === signatures[0])
		if (!unionCompatible) {
			handlePerBranchIfEffects(node)
			return
		}
		// Union path. A bare client-only statement stays rejected here: a
		// union query proves SOME branch rendered, never WHICH one, so a
		// statement authored in one branch would run when the other rendered.
		for (const stmt of clientStmts)
			diagnostics.push(
				diagnostic.unsupported(
					source,
					stmt.node.start,
					'A bare client-only statement inside an @if with @else — union addressing cannot tell which branch rendered; make the branch constructs differ (per-branch addressing) or use a single-branch @if (no @else) instead',
				),
			)
		// truc:html={dataRef} is server-rendered only — not a client construct.
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
	 * A `first()` reference and/or `pass={{ }}` on a composed element (ADR
	 * 0023 sub-design 10). Composed elements aren't otherwise addressed at
	 * all (server args aren't guaranteed to render as DOM attributes,
	 * LT-018's children are the only other construct they'll carry): the
	 * synthetic `ref` attr `analysis/compose-refs.ts` attaches for a
	 * matching `first()` (LT-127, replacing the authored `ref={}`) is
	 * required for BOTH — a bare reference (no `pass`) still needs the
	 * query so the name resolves in the factory (e.g. reading `textbox.value`
	 * from an event handler elsewhere in the template) — and the target must
	 * be the sole composed instance of that child in the template
	 * (`countComposeBySource`), UNLESS a static `class`/`id`/`data-*` on the
	 * compose site uniquely tells it apart from same-source siblings
	 * (`composeDiscriminatorClause`, LT-089) — three same-source
	 * `<FormSpinbutton class="lightness"|"chroma"|"hue">` instances, say.
	 */
	const emitComposeEffects = (node: ComposeNode): void => {
		// `composeRegistry` is `undefined` during the corpus-wide registry-
		// discovery pass (compileComponent's own tolerance, LT-015). Nothing
		// below it can run then — the child's tag isn't resolvable, and since
		// LT-127 the `ref` attr itself is attached by that same registry-aware
		// pass (`analysis/compose-refs.ts`), so demanding one here would
		// reject every composed `pass={{ }}` site before pass 2 ever compiles
		// the file. That pass needs only this component's OWN registry entry.
		if (!composeRegistry) return
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
			// An ambiguous `first()` already explained itself (TSRX027,
			// `analysis/compose-refs.ts`) — don't pile a second error on
			// the same mistake.
			if (ambiguousComposeNodes.has(node)) return
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
						`Multiple <${node.component}> instances compose the same child — first()/pass={{ }} need a target this milestone can uniquely identify (a distinguishing static class/id/data-* attribute on the compose site).`,
					),
				)
				return
			}
			discriminator = clause
		}
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
