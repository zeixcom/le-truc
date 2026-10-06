/**
 * Per-construct client effect planning (LT-022, regrouping move M5):
 * Pass 4 — the document-ordered walk lowering every client construct
 * (reactive attributes, class/style maps, pass entries, events, lazy text
 * children) into `TopEffectPlan`s, plus the structural handlers for `@if`
 * (union and optional addressing), `@switch`/`@try` (construct-free arms),
 * async boundaries, loops, and composed elements.
 */

import type { AstNode } from '../ast-node'
import {
	freeIdentifiers,
	hostPropOf,
	isNode,
	nodeType,
	objectKeys,
	sanitizeVarName,
} from '../ast-utils'
import { diagnostic, type LocalDiagnostic, type Site } from '../diagnostics'
import {
	containsImpureAmbient,
	dependenciesOf,
	foldableHostProps,
	foldableRefGuards,
	foldableRenderScope,
	hostDerivedFold,
} from '../evaluability'
import { initialFold } from '../initial-winner'
import type {
	AttributeIR,
	ComponentIR,
	EachForIR,
	ForIR,
	PassEntryIR,
	ReconcileForIR,
	TemplateNode,
} from '../ir'
import type { RegistryEntry } from '../registry'
import {
	SUPPRESSED_HOST_SELECTOR,
	type SuppressedSite,
} from '../simulation/contract.ts'
import { wordingOf } from '../surface'
import { type LocalRoutingSignal, rangeFields, resolutionOf } from '../tier'
import {
	isDirtyFlagControlAttr,
	MANAGED_TEXT_PROPS,
	SEMANTICALLY_LOADED_ATTRS,
} from '../vocabulary'
import {
	armSetOf,
	type ConditionalNode,
	childNodes,
	elseOf,
	hasArmSet,
	isClientConstructAttr,
	isIf,
	isSwitch,
	someNode,
	thenOf,
	walkTemplate,
} from '../walk'
import type { ComposeRefs } from './compose-refs'
import { lazyWatchSource, returnsNumber } from './harvest'
import { planEachLoop } from './loops'
import { renderOnlyBindings, uniqueName } from './naming'
import type {
	ArmPlan,
	EffectPlans,
	HarvestPlans,
	KeyAttrPlan,
	LoopPlans,
	PassShared,
	QueryPlan,
	ReconcilePlan,
	ScopeLocal,
	TopEffectPlan,
} from './plan'
import {
	allComposeNodes,
	type ComposeNode,
	composeDiscriminatorClause,
	composeNodesBySource as composeNodesBySourceIn,
	composeSharedPassClause,
	composeStaticAttrs,
	countComposeBySource as countComposeBySourceIn,
	type ElementNode,
	type ExprNode,
	type IfNode,
	isElement,
	loopFor as loopForIn,
	refOf,
	resolveComposeContentSelector,
	resolveExclusiveSelectorIn,
	resolveScopedSelector,
	resolveSelector as resolveSelectorIn,
	type SwitchNode,
	selectorFor as selectorForIn,
	type TryNode,
} from './selectors'

/**
 * Native form-control tags a form-associated component's `disabled`/
 * `checked` omission (LTC034) escalates to an ERROR for (LT-062/LT-085):
 * a real submittable control, not the host itself. Compiler-side duplicate
 * of `validate-lowered.ts`'s `NAMED_FORM_CONTROL_TAGS` (LT-059) — front-end/
 * analysis-layer duplication is the established pattern here (same
 * precedent as `MANAGED_FORM_MEMBERS`, vocabulary.ts) rather than an import
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
const managedPropRead = (expr: AstNode): string | null => {
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
 * Pass 4's shared state (LT-226): what `runEffects`'s nested closures used
 * to capture, threaded explicitly so each comment band — construct
 * lowering, control-flow addressing, compose, the compose-`id` validation —
 * is a module-scope unit. Built once at the top of `runEffects` and never
 * reassigned; the derived fold inputs are the same per-component values the
 * closure era computed lazily at the top of the walk.
 */
type EffectsContext = {
	component: ComponentIR
	source: string
	diagnostics: LocalDiagnostic[]
	routingSignals: LocalRoutingSignal[]
	suppressedSites: SuppressedSite[]
	registry: ReadonlySet<string>
	composeRefs: ComposeRefs
	queries: QueryPlan[]
	effects: TopEffectPlan[]
	ambient: Set<string>
	usedNames: Set<string>
	forPlans: LoopPlans['forPlans']
	reconcilePlans: LoopPlans['reconcilePlans']
	addQuery: (
		base: string,
		selector: string,
		cardinality: 'one' | 'many' | 'maybe',
	) => string
	collectAmbient: (node: AstNode | null | undefined) => void
	badFreeNames: (node: AstNode) => string[]
	/**
	 * `badFreeNames` for a list-body position (`analysis/plan.ts`, LT-349):
	 * the setup consts and authored imports no client-need walk reaches.
	 * Item-scoped planning (ADR 0046 s1) reports through this — a setup const
	 * read only inside an item is still never emitted client-side.
	 */
	badListBodyNames: (node: AstNode) => string[]
	/** Registry-child tags addressed (type-flow imports), from `PassShared`. */
	childTags: Set<string>
	/**
	 * The item and key bindings and the setup names (ADR 0046 s5) of the
	 * reactive-list items currently being planned (ADR 0046 s1), empty
	 * outside one. Item-scoped sites are
	 * per-item state the server deliberately omits in every tier — never a
	 * routing signal, and never a suppression record (the revert would
	 * undo per-item truth the mount re-establishes on every clone).
	 */
	itemNames: ReadonlySet<string>
	/**
	 * The key bindings and per-item consts of every enclosing reactive-list
	 * item (ADR 0046 s1 and s5, LT-424/LT-426), empty outside one — the
	 * clone-time names. A `server` attribute over these alone is set once at
	 * the mount of the scope that owns its element.
	 */
	keyNames: ReadonlySet<string>
	/**
	 * The server-only check for the current scope's positions: `badFreeNames`
	 * at host level and in host-level arms, `badListBodyNames` once inside a
	 * reactive-list item — arms and lists nested in an item included.
	 */
	scopeBadNames: (node: AstNode) => string[]
	/**
	 * Registry entries by TAG (LT-158). The compose registry is keyed by source
	 * path because composition resolves through import specifiers; a
	 * `pass={{ }}` on a raw dashed tag has only the tag, so it needs the
	 * other index. Built from the same map rather than threading a second
	 * one through: pass 1 puts every compilable file's entry in there, so
	 * the two indexes are the same set of components.
	 */
	entryByTag: Map<string, RegistryEntry>
	/**
	 * A reactive conditional's arm locals (ADR 0037) are `bindArm`-scoped
	 * variables, not factory queries: each one's selector over the whole
	 * template, for the suppressed-site records `selectorOf` writes.
	 */
	armSelectors: Map<string, string>
	// LT-085/LT-118: the two substitutable sets for `hostDerivedFold`
	// below — host props with a known server truth, and refs whose
	// presence the server decides — computed once per component rather
	// than per attribute. Both must match what `emit-server.ts` will
	// actually fold, or LTC034 warns about an attribute that does render.
	derivableHostProps: ReturnType<typeof foldableHostProps>
	derivableRefGuards: ReturnType<typeof foldableRefGuards>
	// LT-173 step 6: the render-scope names a host-derived fold may leave in
	// a spliced thunk (args, signals, transitive-pure setup consts). Must be
	// the same set `emit-server.ts` folds with, or this check warns about an
	// attribute that does render (or silences one that doesn't).
	foldScope: ReturnType<typeof foldableRenderScope>
}

/** The component-scoped selector adapters, parameterized on the pass context. */
const selectorFor = (fx: EffectsContext, el: ElementNode) =>
	selectorForIn(fx.component, el)
const resolveSelector = (fx: EffectsContext, el: ElementNode) =>
	resolveSelectorIn(fx.component, el)
const countComposeBySource = (fx: EffectsContext, source2: string) =>
	countComposeBySourceIn(fx.component.root, source2)
const composeNodesBySource = (fx: EffectsContext, source2: string) =>
	composeNodesBySourceIn(fx.component.root, source2)
const loopFor = (fx: EffectsContext, node: TemplateNode): ForIR | null =>
	loopForIn(fx.component, node)

/**
 * ADR 0029 sub-design 1 (LT-165 step 7): is this reactive expression
 * unresolvable — no server phase can answer it, because its value is a
 * function of the viewing moment or the build machine's own state (limb
 * b)? Such a site is omitted server-side in every tier and SILENT (step
 * 5), but the generated client still binds it and the realm replays that
 * module, so the site is recorded for the driver's serialization-time
 * suppression. Limb (a) (stubbed-API reads) is deliberately not
 * recorded — see {@link SuppressedSite}.
 */
const suppresses = (fx: EffectsContext, node: AstNode): boolean => {
	// An item-scoped site (ADR 0046 s1) is per-item state the mount
	// re-establishes on every clone — never a build-machine answer to
	// revert.
	if ([...dependenciesOf(node)].some(name => fx.itemNames.has(name)))
		return false
	const resolution = resolutionOf(node, fx.component.serverKnown)
	return resolution.by === 'none' && resolution.limb === 'not-a-server-fact'
}

/** The selector a plan query addresses; `'host'` stays the sentinel. */
const selectorOf = (fx: EffectsContext, query: string): string =>
	fx.queries.find(q => q.name === query)?.selector ??
	fx.armSelectors.get(query) ??
	query

/**
 * LTC005's server-only face: the generated client binds no server name — a
 * parameter (`t` included), a module-level declaration, a server-data loop
 * binding (`badFreeNames`, LT-348) — so any client-emitted position reading
 * one is a ReferenceError at connect. One check and one wording for every
 * such position (LT-347 audited them: reactive attributes, lazy text
 * children, class/style maps, event handlers, `truc:html`, pass entries,
 * `expose()` entries, client-needed setup consts and harvest-less signal
 * initializers; `loops.ts` routes list bodies here through
 * `badListBodyNames`, LT-349). `subject` opens
 * the sentence.
 */
export const reportServerOnlyNames = (
	ctx: Pick<
		EffectsContext,
		'component' | 'source' | 'diagnostics' | 'badFreeNames'
	>,
	node: AstNode,
	subject: string,
	bad: string[] = ctx.badFreeNames(node),
): void => {
	if (bad.length === 0) return
	const { component } = ctx
	// Split by binding class — each has its own fix. A name the server
	// binds takes precedence: a list body's setup-const class is only the
	// residue `badListBodyNames` adds (LT-349).
	const moduleNames = new Set(component.moduleBindings ?? [])
	const serverNames = renderOnlyBindings(component)
	const module = bad.filter(name => moduleNames.has(name))
	const server = bad.filter(
		name => !moduleNames.has(name) && serverNames.has(name),
	)
	const listBody = bad.filter(
		name => !moduleNames.has(name) && !serverNames.has(name),
	)
	// `lang` stays server-only under the client message channel (ADR 0030
	// s9): the locale reaches the client through the root attribute.
	const lang = component.langBinding
	// LT-358c: a record-spelled read (`i18n.t.<key>`) flags the RECORD
	// binding, not a `messageTBindings` entry, so the plain find misses it
	// and the report got the generic exposed-prop fix. The record spelling
	// stays server-only (ADR 0030 s9), so the fix is the same literal-key
	// sentence — spelled with the component's own `t` binding when it
	// declares one, else the canonical `t` the destructure binds. The
	// channel set keeps every message-channel name (t bindings + record
	// bindings) out of that generic fix, which would contradict the
	// literal-key sentence.
	const tNames = component.messageTBindings ?? []
	const recordNames = component.messageRecordBindings ?? []
	const t =
		server.find(name => tNames.includes(name)) ??
		(recordNames.some(name => server.includes(name))
			? (tNames[0] ?? 't')
			: null)
	const channel = [...tNames, ...recordNames].filter(name =>
		server.includes(name),
	)
	ctx.diagnostics.push(
		diagnostic.serverOnlyNames(
			ctx.source,
			node,
			subject,
			{ server, module, listBody },
			lang !== null && server.includes(lang) ? lang : null,
			t,
			channel,
		),
	)
}

/**
 * The lazy-text emission gate (LT-114's root branch, mirrored onto the
 * nested path by LT-115, deduplicated by LT-226): `bindText()` replaces the
 * element's ENTIRE textContent, so the one sanctioned shape is a lazy child
 * that is the element's sole content — multiple lazy children race
 * last-write-wins on the shared textContent, and static text is wiped
 * (element children REMOVED) by the first write. Both paths REJECT those
 * shapes with a clear message instead of emitting a plausible-looking but
 * wrong binding. Per-child checks run regardless of the gate — independent
 * findings, not precedents: a managed form prop as a reactive child
 * requires the widened FormFactoryContext (formAssociated() must lead the
 * extensions; since LT-052 the spelling is a `host.<prop>` read, with the
 * retired string-literal form still matched so a stale source gets the
 * managed-prop message rather than a confusing downstream type error), and
 * an impure-ambient lazy child (CHECKLIST §4) is omitted server-side,
 * corrected by the client's first binding pass, and silent (LT-165 step 5,
 * ADR 0029 s1 limb b).
 *
 * `targetLabel` names the element in the diagnostics (`<el.tag>` on the
 * nested path, `the component root` at the root). `suppressedSelector` is
 * the revert record's address: the query's resolved selector on the nested
 * path (via `selectorOf`) and the host sentinel at the root — deliberate,
 * because an author-named `first()` ref could collide with the literal
 * `'host'`. `addressHost` marks the root call: its watch-text targets the
 * ambient host element, so the factory needs `host` in its destructuring
 * whatever the child reads; a queried element needs it only for the
 * spliced `() => host.<prop>` source form.
 */
const emitLazyTextChildren = (
	fx: EffectsContext,
	el: ElementNode,
	query: string,
	sink: TopEffectPlan[],
	targetLabel: string,
	suppressedSelector: string,
	addressHost: boolean,
	badNames: (node: AstNode) => string[] = fx.badFreeNames,
): void => {
	const lazyChildren = el.children.filter(
		(c): c is ExprNode => c.kind === 'expr' && c.reactivity === 'reactive',
	)
	if (lazyChildren.length === 0) return
	for (const child of lazyChildren) {
		const managed = managedPropRead(child.expr)
		if (
			managed !== null &&
			!fx.component.exposeProps.get(managed)?.signalName &&
			!fx.component.config?.form
		)
			fx.diagnostics.push(
				diagnostic.managedPropWithoutForm(fx.source, child.node, managed),
			)
		fx.collectAmbient(child.expr)
		// The LT-122 form's source is synthesized (`() => host.<prop>`);
		// its `exprText` is the server arg by design.
		if (!child.bindsProp)
			reportServerOnlyNames(
				fx,
				child.expr,
				`Reactive text on ${targetLabel}`,
				badNames(child.expr),
			)
	}
	// The gate itself: one lazy child, alone.
	const contentSiblings = el.children.filter(
		c =>
			c.kind !== 'client-stmt' &&
			!(c.kind === 'expr' && c.reactivity === 'reactive'),
	)
	if (lazyChildren.length > 1) {
		fx.diagnostics.push(
			diagnostic.unsupported(
				fx.source,
				lazyChildren[1]?.node,
				`More than one lazy text child on ${targetLabel}`,
				"`bindText()` replaces the element's whole `textContent`, so each lazy child would overwrite the others — combine them into one expression.",
			),
		)
		return
	}
	if (contentSiblings.length > 0) {
		fx.diagnostics.push(
			diagnostic.unsupported(
				fx.source,
				(lazyChildren[0] as ExprNode).node,
				`A lazy text child beside other content on ${targetLabel}`,
				"`bindText()` replaces the element's whole `textContent`, so the first write would erase the static text and remove the child elements — move the lazy child into an element of its own.",
			),
		)
		return
	}
	const child = lazyChildren[0] as ExprNode
	if (child.bindsProp || addressHost) fx.ambient.add('host')
	sink.push({
		kind: 'watch-text',
		query,
		source: lazyWatchSource(child),
		exprText: child.exprText,
		sourceStart: startOf(child.expr),
	})
	// Same record for either form (LT-165 step 7): the emission gate makes
	// the site the element's whole textContent, so the element's pre-connect
	// text is the entire revert.
	if (suppresses(fx, child.expr))
		fx.suppressedSites.push({ kind: 'text', selector: suppressedSelector })
}

/** Does this element carry a construct of its own (not a nested one)? */
const hasOwnConstruct = (el: ElementNode): boolean =>
	el.attrs.some(isClientConstructAttr) ||
	el.children.some(c => c.kind === 'expr' && c.reactivity === 'reactive')

// A lazy text child of the branch ROOT itself is a legitimate construct
// (watched via the root's own query, exactly like a reactive attribute)
// — only a NESTED element's own lazy child or construct attrs make the
// construct unaddressable, hence the depth guard.
const hasDeepConstruct = (el: ElementNode, depth = 0): boolean =>
	el.children.some(
		child =>
			(depth > 0 && child.kind === 'expr' && child.reactivity === 'reactive') ||
			(child.kind === 'element' &&
				(child.attrs.some(isClientConstructAttr) ||
					hasDeepConstruct(child, depth + 1))),
	)

/**
 * One branch root's client-construct signature (LT-118): its construct
 * attributes' `key=text` pairs, sorted. Two roots with equal signatures
 * are interchangeable for union addressing (one query, one effect set,
 * whichever branch rendered); differing signatures — a construct key
 * present on only some roots (the old LTC031 case) or the same key with
 * different text (the old "constructs differ" case) — route to per-branch
 * addressing instead. The text is whatever the client effect would differ
 * by: an event's handler, a reactive/class-map/style-map thunk, a
 * `server` attribute's `bindsProp` name, a `pass` attribute's
 * `prop=thunk` entries, a reactive `html` attribute's value text
 * (LT-378 — those last three contributed an empty text before, so two
 * roots binding DIFFERENT sources to the same attribute compared equal
 * and were union-addressed onto the primary root's source).
 */
const constructSignatureOf = (root: ElementNode): string => {
	const parts: string[] = []
	for (const attr of root.attrs) {
		if (!isClientConstructAttr(attr)) continue
		const key = `${attr.kind === 'event' ? 'on' : 'bind'}:${'name' in attr ? attr.name : attr.kind}`
		const attrText =
			attr.kind === 'event'
				? attr.handlerText
				: attr.kind === 'reactive' ||
						attr.kind === 'class-map' ||
						attr.kind === 'style-map'
					? attr.thunkText
					: attr.kind === 'server'
						? (attr.bindsProp ?? '')
						: attr.kind === 'pass'
							? attr.entries
									.map(
										entry =>
											`${entry.prop}=${entry.thunkText}${
												entry.setThunkText ? ` set=${entry.setThunkText}` : ''
											}`,
									)
									.join(',')
							: attr.kind === 'html'
								? attr.exprText
								: ''
		parts.push(`${key}=${attrText}`)
	}
	return parts.sort().join('|')
}

/** Does a subtree carry client constructs (client-side-only elements)? */
const hasClientConstructs = (node: TemplateNode): boolean => {
	if (node.kind === 'client-stmt') return true
	if (node.kind === 'expr') return node.reactivity === 'reactive'
	if (node.kind === 'conditional' || node.kind === 'try') return false
	if (!isElement(node)) return false
	if (node.attrs.some(isClientConstructAttr)) return true
	return node.children.some(hasClientConstructs)
}

/** A direct lazy child of `el` whose expr is a bare Identifier, if any. */
const directLazyIdentifier = (el: ElementNode): string | null => {
	for (const child of el.children) {
		if (
			child.kind === 'expr' &&
			child.reactivity === 'reactive' &&
			nodeType(child.expr) === 'Identifier'
		)
			return String((child.expr as AstNode).name)
	}
	return null
}

/** The first direct lazy child of `el`, if any. */
const lazyChildOf = (el: ElementNode): ExprNode | undefined =>
	el.children.find(
		(c): c is ExprNode => c.kind === 'expr' && c.reactivity === 'reactive',
	)

/**
 * An async-boundary arm root: a plain element, or — since LT-460 — a
 * compose site, whose rendered root is the child's own element.
 */
export type BoundaryArmRoot = ElementNode | ComposeNode

export const isBoundaryArmRoot = (
	node: TemplateNode,
): node is BoundaryArmRoot => node.kind === 'element' || node.kind === 'compose'

/**
 * Whether `target` sits inside composed content under `root` — a descendant
 * of a compose node's children. Such elements are parent-authored markup
 * spliced into the child's rendered DOM: real elements the arm-scoped query
 * reaches, but invisible to the host-template selector counting, so their
 * selectors resolve against the arm subtree instead (`resolveComposeContentSelector`).
 */
const isInsideCompose = (
	root: TemplateNode,
	target: TemplateNode,
	inside = false,
): boolean => {
	if (root === target) return inside
	const children = root.kind === 'compose' ? root.children : childNodes(root)
	const childInside = inside || root.kind === 'compose'
	for (const child of children)
		if (isInsideCompose(child, target, childInside)) return true
	return false
}

/**
 * The err arm's message element (LT-449, compose-aware since LT-460): the
 * first child element of `el` whose direct reactive child reads the catch
 * parameter (bare or a member read) — reached either directly or through
 * one compose hop, inside the composed content (a composed callout's
 * message element: `<CardCallout class="danger"><p class="error">
 * {e.message}</p></CardCallout>`). The text write targets that element
 * through an arm-scoped `first()`. Null when the message sits on the root
 * itself (the depth-0 channel the boundary has always carried). Shared
 * with `emit-server.ts`, which must find the same live-arm child.
 */
export const lazyCatchMessageEl = (
	el: BoundaryArmRoot,
	catchParam: string | null,
): ElementNode | null => {
	if (!catchParam) return null
	const elementChildren = (children: readonly TemplateNode[]): ElementNode[] =>
		children.filter((c): c is ElementNode => c.kind === 'element')
	for (const child of elementChildren(el.children)) {
		if (directLazyCatchRef(child, catchParam) !== null) return child
	}
	// One compose hop: the message element is parent-authored content
	// spliced into the child's rendered markup — still inside the arm root,
	// so the arm-scoped query reaches it (LT-096).
	for (const child of el.children) {
		if (child.kind !== 'compose') continue
		for (const inner of elementChildren(child.children)) {
			if (directLazyCatchRef(inner, catchParam) !== null) return inner
		}
	}
	return null
}

/**
 * The offending construct below an async-boundary arm root, or null.
 * Compose-aware (LT-460): composed content is transparent one level — a
 * parent-authored element in it may carry exactly one lazy child reading
 * the catch parameter (the message element), its own attrs stay static,
 * and no deeper element or second reactive child is allowed. A reactive
 * expression directly inside composed content renders into the child's own
 * markup, where no write can address it — an offender; on a plain element
 * root a direct reactive child stays the sanctioned depth-0 channel.
 */
const boundaryDeepConstructOf = (
	root: BoundaryArmRoot,
	messageEl: ElementNode | null,
	catchParam: string | null,
): TemplateNode | null => {
	// Without a catch parameter there is no message element to exempt.
	const exempt =
		messageEl !== null && catchParam !== null
			? { el: messageEl, param: catchParam }
			: null
	let seenLazyInner = false
	const visit = (
		children: readonly TemplateNode[],
		depth: number,
	): TemplateNode | null => {
		for (const child of children) {
			if (exempt !== null && child === exempt.el) {
				if (child.attrs.some(isClientConstructAttr)) return child
				for (const inner of child.children) {
					if (inner.kind === 'element') return inner
					if (inner.kind === 'expr' && inner.reactivity === 'reactive') {
						if (seenLazyInner) return inner
						seenLazyInner = true
						if (directLazyCatchRef(exempt.el, exempt.param) === null)
							return inner
					}
				}
				continue
			}
			if (child.kind === 'compose') {
				// Composed content: entered for the message exemption only —
				// a nested composed element is refused at lowering.
				const deeper = visit(child.children, depth + 1)
				if (deeper !== null) return deeper
				continue
			}
			if (child.kind === 'expr' && child.reactivity === 'reactive') {
				// The depth-0 channel: a direct lazy child of a plain element
				// root. Inside composed content it renders into the child's
				// own markup, where no write can address it.
				if (depth === 0 && root.kind === 'element') continue
				return child
			}
			if (
				child.kind === 'element' &&
				(child.attrs.some(isClientConstructAttr) || hasDeepConstruct(child))
			)
				return child
		}
		return null
	}
	return visit(root.children, 0)
}

/**
 * The signal an async boundary's ok arm reads through a reactive
 * `truc:html={() => name.get()}` thunk on its arm root (LT-449) — the
 * attribute-channel counterpart of a direct lazy identifier child. The
 * thunk must be exactly a `.get()` read; anything else is not a boundary
 * driver. Shared with `emit-server.ts`, which must name the same signal
 * the analysis admitted.
 */
export const htmlThunkSignalName = (el: BoundaryArmRoot): string | null => {
	for (const attr of el.attrs) {
		if (attr.kind !== 'html' || !attr.reactive) continue
		const body = (attr.thunk as { body?: unknown }).body
		if (!isNode(body) || nodeType(body) !== 'CallExpression') continue
		const callee = (body as AstNode).callee
		if (!isNode(callee) || nodeType(callee) !== 'MemberExpression') continue
		if (callee.computed) continue
		const prop = callee.property
		if (!isNode(prop) || prop.type !== 'Identifier') continue
		if (String(prop.name) !== 'get') continue
		const object = callee.object
		if (isNode(object) && nodeType(object) === 'Identifier')
			return String(object.name)
	}
	return null
}

/** An AST node's source offset, for the span table (LT-011). */
const startOf = (node: AstNode | undefined): number | undefined =>
	typeof node?.start === 'number' ? node.start : undefined

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
		if (child.kind !== 'expr' || child.reactivity === 'server') continue
		const expr = child.expr
		if (
			nodeType(expr) === 'Identifier' &&
			String((expr as AstNode).name) === catchParam
		)
			return 'error'
		if (nodeType(expr) === 'MemberExpression' && !(expr as AstNode).computed) {
			const obj = (expr as AstNode).object
			const prop = (expr as AstNode).property
			if (
				nodeType(obj) === 'Identifier' &&
				String((obj as AstNode).name) === catchParam &&
				nodeType(prop) === 'Identifier'
			)
				return `error.${String((prop as AstNode).name)}`
		}
	}
	return null
}

/**
 * Decide each `pass={{ prop }}` against the TARGET component's own
 * `expose()` (LT-158, ADR 0028 sub-design 6) — the residual TypeScript
 * cannot carry, because a read-only prop is structurally identical to a
 * writable one.
 *
 * Silent when the target's entry is unknown: a hand-written (non-.tsrx)
 * child is in `registry` via `childImports` but never in
 * `composeRegistry`, and the discovery pass has no `composeRegistry` at
 * all. Both keep the Tier 2 runtime check, which is what ADR 0028 says
 * it is for — [M15] no-build components and foreign markup.
 */
const checkPassEntries = (
	fx: EffectsContext,
	entries: readonly PassEntryIR[],
	tag: string,
	node: AstNode,
): void => {
	const { entryByTag, source, diagnostics } = fx
	const entry = entryByTag.get(tag)
	if (!entry) return
	const exposed = entry.exposedProps
	for (const passed of entries) {
		const kind = exposed[passed.prop]
		if (kind === undefined)
			diagnostics.push(
				diagnostic.passPropNotExposed(
					source,
					node,
					tag,
					passed.prop,
					Object.keys(exposed),
				),
			)
		else if (kind !== 'slot')
			diagnostics.push(
				diagnostic.passPropNotSlotBacked(source, node, tag, passed.prop, kind),
			)
	}
}

/**
 * Validate and lower one target's `pass={{ }}` entries into `pass` effect
 * plans — shared by raw dashed-tag elements and composed elements, the
 * two `pass={{ }}` addressing paths (ADR 0024 sub-design 10).
 */
const emitPassEntries = (
	fx: EffectsContext,
	entries: PassEntryIR[],
	query: string,
	sink: TopEffectPlan[] = fx.effects,
	badNames: (node: AstNode) => string[] = fx.badFreeNames,
): void => {
	const { collectAmbient } = fx
	for (const entry of entries) {
		collectAmbient(entry.thunk)
		reportServerOnlyNames(
			fx,
			entry.thunk,
			`Pass entry \`${entry.prop}\``,
			badNames(entry.thunk),
		)
		if (entry.setThunk) {
			collectAmbient(entry.setThunk)
			reportServerOnlyNames(
				fx,
				entry.setThunk,
				`The setter of pass entry \`${entry.prop}\``,
				badNames(entry.setThunk),
			)
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
	fx: EffectsContext,
	el: ElementNode,
	query: string,
	sink: TopEffectPlan[] = fx.effects,
	badNames: (node: AstNode) => string[] = fx.badFreeNames,
): void => {
	const {
		component,
		source,
		diagnostics,
		ambient,
		routingSignals,
		suppressedSites,
		registry,
		collectAmbient,
		derivableHostProps,
		derivableRefGuards,
		foldScope,
	} = fx
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
						attr.node,
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
			reportServerOnlyNames(
				fx,
				attr.thunk,
				`Reactive attribute \`${attr.name}\``,
				badNames(attr.thunk),
			)
			// CHECKLIST §5 / LTC034: omission is not neutral for these
			// attribute names — `hidden` omitted means visible, `disabled`
			// omitted means enabled AND submittable, same for `checked`/
			// `selected`/`aria-expanded`. A host-prop mirror, a derived
			// `host.<prop>` fold (LT-085, `hostDerivedFold` below), and a
			// server-evaluable thunk all render an initial value — all
			// three safe. Anything else (a sensor, or any other
			// non-portable dependency) is OMITTED (`emit-server.ts`'s
			// `case 'reactive'` pushes nothing at all when none of the
			// three paths applies).
			//
			// ADR 0029 sub-design 5 (LT-165 step 5): every such site is a
			// ROUTING SIGNAL, not a diagnostic — "phase 1 cannot fold
			// this" was a statement about the harness, not the author's
			// code. The one exception is the severe form (`disabled`/
			// `checked` on a real submittable control), and it is scoped
			// per-EXPRESSION, not per-component (LT-184): the error fires
			// iff THIS site's own resolution is `none`, so no server phase
			// resolves it in any tier and the wrong default is permanent.
			// A component routed Simulated by some other realm-answerable
			// signal still omits this value, so a component-level Static
			// check would have missed it. Sound without a tier check: a
			// `none` resolution can never occur on a Folded-tier
			// component, since the signal recorded right here would have
			// made it non-Folded.
			if (
				SEMANTICALLY_LOADED_ATTRS.has(attr.name) &&
				hostPropOf(attr.thunk) === null &&
				hostDerivedFold(
					attr.thunk,
					derivableHostProps,
					derivableRefGuards,
					foldScope,
				) === null &&
				!(
					dependenciesOf(attr.thunk).isSubsetOf(component.serverKnown) &&
					!containsImpureAmbient(attr.thunk, component.serverKnown)
				)
			) {
				const resolution = resolutionOf(attr.thunk, component.serverKnown)
				// ADR 0029 sub-design 5 (LT-165 step 5), item exception (ADR
				// 0046 s1): an item-scoped site is per-item state no server
				// phase answers BY DESIGN — the template bakes it empty and the
				// mount writes it on every clone — so it routes no tier. The
				// severe form below still fires: a no-JS item whose control is
				// enabled-and-submittable is the same permanent wrong default.
				if (fx.itemNames.size === 0)
					routingSignals.push({
						origin: 'LTC034',
						detail: `\`${attr.name}\` on <${el.tag}> has no server-renderable value`,
						...rangeFields(source, attr.thunk),
						resolution,
					})
				if (
					resolution.by === 'none' &&
					(attr.name === 'disabled' || attr.name === 'checked') &&
					component.config?.form != null &&
					SUBMITTABLE_FORM_CONTROL_TAGS.has(el.tag)
				)
					diagnostics.push(
						diagnostic.unsafeLoadedAttributeDefault(
							source,
							attr.thunk,
							attr.name,
						),
					)
			}
			if (isCustom) {
				// ADR 0024 sub-design 4 (amended by sub-design 10): a
				// function-valued attribute is only ever a reactive binding
				// on NATIVE elements. Custom-element interop is solely
				// through the explicit `pass={{ }}` attribute below — one
				// dispatch path, not two shape-inferred ones.
				diagnostics.push(
					diagnostic.reactiveAttrOnCustomElement(
						source,
						attr.thunk,
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
			// ADR 0029 sub-design 1 (LT-165 step 7): the binding installs in
			// the shipped client even though phase 1 omits the site — record
			// where its connect-time write would land so the driver can
			// revert it after the connect window stabilizes.
			if (suppresses(fx, attr.thunk))
				suppressedSites.push({
					kind: 'attr',
					selector: selectorOf(fx, query),
					attr: attr.name,
					// Property dispatch (LT-116) writes the IDL property, which
					// a content-attribute revert alone does not undo.
					...(dispatch === 'property' ? { prop: attr.name } : {}),
				})
		} else if (attr.kind === 'pass') {
			if (!isCustom || !registry.has(el.tag)) {
				diagnostics.push(
					diagnostic.passTargetNotCustom(source, el.node, el.tag),
				)
				continue
			}
			checkPassEntries(fx, attr.entries, el.tag, el.node)
			emitPassEntries(fx, attr.entries, query, sink, badNames)
		} else if (attr.kind === 'class-map') {
			collectAmbient(attr.object)
			reportServerOnlyNames(
				fx,
				attr.thunk,
				'Reactive class map',
				badNames(attr.thunk),
			)
			sink.push({
				kind: 'watch-class',
				query,
				keys: objectKeys(attr.object),
				thunkText: attr.thunkText,
				sourceStart: attr.thunk.start,
				sourceEnd: attr.thunk.end,
			})
		} else if (attr.kind === 'style-map') {
			collectAmbient(attr.object)
			reportServerOnlyNames(
				fx,
				attr.thunk,
				'Reactive style map',
				badNames(attr.thunk),
			)
			sink.push({
				kind: 'watch-style',
				query,
				keys: objectKeys(attr.object),
				thunkText: attr.thunkText,
				sourceStart: attr.thunk.start,
				sourceEnd: attr.thunk.end,
			})
		} else if (attr.kind === 'event') {
			collectAmbient(attr.handler)
			reportServerOnlyNames(
				fx,
				attr.handler,
				`Event handler \`${attr.name}\``,
				badNames(attr.handler),
			)
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
			reportServerOnlyNames(
				fx,
				attr.thunk,
				'Reactive `truc:html`',
				badNames(attr.thunk),
			)
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
	// branch has had since LT-114, mirrored onto the nested path — one
	// shared implementation since LT-226 (see `emitLazyTextChildren`).
	emitLazyTextChildren(
		fx,
		el,
		query,
		sink,
		`<${el.tag}>`,
		selectorOf(fx, query),
		false,
		badNames,
	)
}

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
	fx: EffectsContext,
	// Read-only: the body is filtered and iterated, never mutated. Declared
	// `readonly` so `handlePerBranchIfEffects` can pass a branch out of its
	// `readonly` tuple without a cast (LT-118).
	body: readonly TemplateNode[],
	atNode: { node: AstNode },
	label: string,
	resolve: (el: ElementNode) => { selector: string; unique: boolean } = (
		el: ElementNode,
	) => selectorFor(fx, el),
): void => {
	const { source, diagnostics, effects, addQuery, collectAmbient } = fx
	const roots = body.filter(isElement)
	for (const root of roots)
		if (hasDeepConstruct(root))
			diagnostics.push(
				diagnostic.unsupported(
					source,
					root.node,
					`A client construct below the root element of ${label}`,
					'The deeper element exists only when the arm rendered — move the construct onto the root element.',
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
				atNode.node,
				`More than one element with client constructs in ${label}`,
				'The client addresses one root per arm — give the extra element its own `first()` reference, or address it through a hoisted const that the first element references.',
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
				atNode.node,
				`A bare client-only statement in ${label} with no element beside it`,
				'The client tests an element to learn whether the arm rendered — render an element beside the statement.',
			),
		)
		return
	}
	const resolved = resolve(primary)
	if (!resolved.unique) {
		diagnostics.push(
			diagnostic.unaddressableElement(
				source,
				primary.node,
				`No unique selector for ${label}'s root <${primary.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
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
		if (stmt === primary) emitConstructEffects(fx, primary, query, guarded)
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
					extra.node,
					`No unique selector for the \`first()\`-addressed <${extra.tag}> inside ${label} — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
				),
			)
			continue
		}
		const extraName = refOf(extra)?.name
		if (!extraName) continue
		const extraQuery = addQuery(extraName, extraResolved.selector, 'maybe')
		const extraEffects: TopEffectPlan[] = []
		emitConstructEffects(fx, extra, extraQuery, extraEffects)
		effects.push({
			kind: 'guarded',
			query: extraQuery,
			effects: extraEffects,
		})
	}
}

/** A single-branch `@if` (no `@else`) — see `handleOptionalBranch`. */
const handleOptionalIfEffects = (fx: EffectsContext, node: IfNode): void =>
	handleOptionalBranch(
		fx,
		thenOf(node),
		node,
		wordingOf(fx.component).singleBranchIf,
	)

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
 * indistinguishable by statics keep a LTC007 error naming the fix,
 * rather than a plausible-but-wrong double binding.
 */
const handlePerBranchIfEffects = (fx: EffectsContext, node: IfNode): void => {
	const { component, source, diagnostics } = fx
	const wording = wordingOf(component)
	const branches: Array<
		[string, readonly TemplateNode[], readonly TemplateNode[]]
	> = [
		[wording.thenBranch, thenOf(node), elseOf(node)],
		[wording.elseBranch, elseOf(node), thenOf(node)],
	]
	// Validate every branch needing addressing BEFORE any effects are
	// planned — a collision diagnostic must not leave a half-planned @if.
	for (const [label, body, other] of branches) {
		const own = body.filter(isElement).filter(hasOwnConstruct)
		if (own.length === 0) continue
		const root = own[0] as ElementNode
		const resolved = resolveExclusiveSelectorIn(
			component.root,
			root,
			other,
			component.composedShapes,
		)
		if (resolved.unique) continue
		const plain = resolveSelector(fx, root)
		if (!plain.unique) continue // no unique selector at all — reported below
		const otherLabel =
			label === wording.thenBranch ? wording.elseBranch : wording.thenBranch
		diagnostics.push(
			diagnostic.unaddressableElement(
				source,
				root.node,
				`The ${label} root <${root.tag}> of this ${wording.if} has no selector that excludes the ${otherLabel} — \`${plain.selector}\` is unique in the template but matches the ${otherLabel} root too, so the effects of both branches would bind whichever root rendered. Add distinguishing static attributes to the branch roots, or make the client constructs identical across branches (union addressing).`,
			),
		)
		return
	}
	for (const [label, body, other] of branches)
		handleOptionalBranch(fx, body, node, `the ${label}`, el =>
			resolveExclusiveSelectorIn(
				component.root,
				el,
				other,
				component.composedShapes,
			),
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
const handleIfEffects = (fx: EffectsContext, node: IfNode): void => {
	const { source, diagnostics, addQuery } = fx
	const wording = wordingOf(fx.component)
	if (elseOf(node).length === 0) {
		handleOptionalIfEffects(fx, node)
		return
	}
	const roots = [...thenOf(node), ...elseOf(node)].filter(isElement)
	for (const root of roots)
		if (hasDeepConstruct(root))
			diagnostics.push(
				diagnostic.unsupported(
					source,
					root.node,
					`A client construct below a branch root of this ${wording.if}`,
					'The deeper element exists only when its branch rendered — move the construct onto the branch root.',
				),
			)
	const clientStmts = [...thenOf(node), ...elseOf(node)].filter(
		(n): n is TemplateNode & { kind: 'client-stmt' } =>
			n.kind === 'client-stmt',
	)
	// Each branch may only carry ONE UNADDRESSED element of its own —
	// the union query addresses "whichever branch rendered", not
	// multiple distinct siblings within a single branch. An element the
	// author addressed with `first()` has its own query and its own
	// guard and is exempt (LT-130); a branch carrying one routes to
	// per-branch addressing below, which is where those are emitted.
	for (const branch of [thenOf(node), elseOf(node)]) {
		const constructedInBranch = branch
			.filter(isElement)
			.filter(hasOwnConstruct)
			.filter(el => !refOf(el))
		if (constructedInBranch.length > 1) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node,
					`More than one element with client constructs in one ${wording.ifBranch}`,
					`Union addressing binds one root per branch — split the markup into ${wording.separateIfs}, or address the extra element through a hoisted const that the first element references.`,
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
					stmt.node,
					`A bare client-only statement in ${wording.ifWithElse} with no addressed branch root`,
					`The client needs an addressed root to tell which branch rendered — add a client construct to one branch root (per-branch addressing), or use ${wording.singleBranchIfFix} instead.`,
				),
			)
		return
	}
	// LT-118 routing: identical construct signatures on every branch
	// root AND an element root in every branch → union addressing (one
	// query, one effect set, unchanged emission); any difference — a
	// construct on only some roots (the old LTC031 hazard: union
	// emission reads the FIRST constructed root only, so a sibling
	// branch's construct was silently dropped, or worse, bound onto the
	// wrong branch's element) or the same key with different text (the
	// old "constructs differ" error) → per-branch addressing. A branch
	// with no ELEMENT root at all (text-only) also routes per-branch:
	// the union query is cardinality 'one' (an @else guarantees SOME
	// branch rendered), which would throw on the branch-less side.
	const signatures = roots.map(constructSignatureOf)
	const everyBranchHasElementRoot = [thenOf(node), elseOf(node)].every(branch =>
		branch.some(isElement),
	)
	// A branch carrying MORE than one element root cannot be union-
	// addressed even with matching signatures (LT-130): the union query
	// resolves to a single element per branch, so the siblings would go
	// unbound. Route those to per-branch addressing, which gives each
	// `first()`-addressed element its own query.
	const everyBranchHasOneElementRoot = [thenOf(node), elseOf(node)].every(
		branch => branch.filter(isElement).length === 1,
	)
	const unionCompatible =
		everyBranchHasElementRoot &&
		everyBranchHasOneElementRoot &&
		signatures.length > 0 &&
		signatures.every(s => s !== '' && s === signatures[0])
	if (!unionCompatible) {
		handlePerBranchIfEffects(fx, node)
		return
	}
	// Union path. A bare client-only statement stays rejected here: a
	// union query proves SOME branch rendered, never WHICH one, so a
	// statement authored in one branch would run when the other rendered.
	for (const stmt of clientStmts)
		diagnostics.push(
			diagnostic.unsupported(
				source,
				stmt.node,
				`A bare client-only statement in ${wording.ifWithElse} with identical branch constructs`,
				`Union addressing cannot tell which branch rendered — make the branch constructs differ (per-branch addressing), or use ${wording.singleBranchIfFix} instead.`,
			),
		)
	// truc:html={dataRef} is server-rendered only — not a client construct.
	const primary = roots.find(r => r.attrs.some(isClientConstructAttr))
	if (!primary) return
	const resolved = selectorFor(fx, primary)
	if (!resolved.unique) {
		diagnostics.push(
			diagnostic.unaddressableElement(
				source,
				primary.node,
				`No unique selector for the ${wording.ifBranch} root <${primary.tag}> — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
			),
		)
		return
	}
	const refAttr = refOf(primary)
	const query = addQuery(
		refAttr?.name ?? sanitizeVarName(primary.tag),
		resolved.selector,
		'one',
	)
	emitConstructEffects(fx, primary, query)
}

/**
 * @switch arms render exclusively — a construct in one arm would make
 * its element missing whenever another arm renders, so arms must be
 * construct-free markup (use @if with identical branch constructs for
 * interactive alternatives).
 */
const handleSwitchEffects = (fx: EffectsContext, node: SwitchNode): void => {
	const { source, diagnostics } = fx
	const wording = wordingOf(fx.component)
	for (const arm of node.arms)
		for (const child of arm.children)
			if (hasClientConstructs(child))
				diagnostics.push(
					diagnostic.unsupported(
						source,
						(child as ElementNode).node ?? node.node,
						`A client construct in ${wording.switchArms}`,
						`Only one arm renders, so the element may not exist — keep the arms to static and server markup, or use ${wording.ifBranches} with identical constructs (union addressing).`,
					),
				)
}

/**
 * An async boundary (`@try`/`@pending`/`@catch`, ADR 0024 sub-design 13,
 * LT-012; ADR 0037 s4, LT-276): `lowerTry` already proved each arm has
 * exactly one root element. The server renders the winner live beside the
 * three arm templates (`emit-server.ts`); the client switches them through
 * `reconcile()`'s arm form, keyed by the guarded task's state, and the
 * `ok`/`err` mounts write the resolved value and the error text.
 */
const handleAsyncBoundary = (
	fx: EffectsContext,
	node: TryNode,
	scope: MountScope | null = null,
): void => {
	const {
		component,
		source,
		diagnostics,
		usedNames,
		badFreeNames: badNames,
	} = fx
	const wording = wordingOf(component)
	const okRoot = node.children.find(isBoundaryArmRoot) as BoundaryArmRoot
	const pendingRoot = (node.pendingChildren as TemplateNode[]).find(
		isBoundaryArmRoot,
	) as BoundaryArmRoot
	const errRoot = node.catchChildren.find(isBoundaryArmRoot) as BoundaryArmRoot
	const catchParam = node.catchParam

	const errMsgEl = lazyCatchMessageEl(errRoot, catchParam)
	// A composed element's server args are evaluated where the render call
	// is emitted — in the live arm AND in the arm templates, which sit
	// outside the catch binding (LT-460). A child's own rendering of an arg
	// has no client write channel, so a catch-parameter read in an arg has
	// no lowering: the message must travel through composed content instead,
	// where the arm's value channel writes it.
	if (catchParam !== null) {
		for (const [armRoot, which] of [
			[okRoot, wording.tryBody],
			[pendingRoot, wording.pendingArm],
			[errRoot, wording.catchArm],
		] as const) {
			let offender: { at: AstNode; arg: string } | null = null
			walkTemplate(
				armRoot,
				node => {
					if (node.kind !== 'compose' || offender !== null) return
					for (const attr of node.attrs) {
						if (attr.kind !== 'arg' || attr.node === null) continue
						if ([...freeIdentifiers(attr.node)].includes(catchParam)) {
							offender = { at: attr.node, arg: attr.name }
							return
						}
					}
				},
				{ intoCompose: false },
			)
			if (offender !== null) {
				const { at, arg } = offender as { at: AstNode; arg: string }
				diagnostics.push(
					diagnostic.unsupported(
						source,
						at,
						`A composed element's \`${arg}\` arg reading the catch parameter \`${catchParam}\` in the ${which} of an async boundary`,
						`An arm template renders outside the catch binding, and the child's own rendering of an arg has no client write. Render the message through composed content instead: \`<CardCallout><p class="error">{${catchParam}.message}</p></CardCallout>\` — the arm's value channel writes it on flip.`,
					),
				)
				return
			}
		}
	}
	// The ok/err arms' construct walk. An offender INSIDE composed content
	// renders into the child's markup, where no write can address it — the
	// fix is wrapping it in an element of the author's own, not moving it
	// onto the arm root (LT-460 rework: the generic advice is impossible
	// there, the root being a compose site or the construct sitting in the
	// composed content of a child).
	const okOffender = boundaryDeepConstructOf(okRoot, null, null)
	const errOffender = boundaryDeepConstructOf(errRoot, errMsgEl, catchParam)
	const constructHit =
		okOffender !== null
			? { root: okRoot, node: okOffender }
			: errOffender !== null
				? { root: errRoot, node: errOffender }
				: null
	if (constructHit !== null) {
		const { root: hitRoot, node: hitNode } = constructHit
		const inComposed = isInsideCompose(hitRoot, hitNode)
		diagnostics.push(
			diagnostic.unsupported(
				source,
				hitNode.node,
				'A client construct below the root element of an async-boundary arm',
				inComposed
					? `The composed content renders inside the child's markup, where no write can address it — wrap the read in an element of your own, for example \`<p class="error">{${catchParam ?? 'e'}.message}</p>\`, which the arm's value channel writes on flip.`
					: "Deeper elements have no addressing (ADR 0024 sub-design 13) — move the construct onto the arm's root element.",
			),
		)
		return
	}
	// The pending arm keeps the DEEP construct walk (LT-460 rework round 2):
	// `hasOwnConstruct` alone sees only the root's own attrs and direct lazy
	// children, so a reactive construct nested below the pending root
	// compiled silently after the ok/err walk grew offender attribution.
	const pendingOffender = boundaryDeepConstructOf(pendingRoot, null, null)
	if (
		pendingRoot.kind === 'element'
			? hasOwnConstruct(pendingRoot) || pendingOffender !== null
			: pendingOffender !== null
	) {
		const inComposed =
			pendingOffender !== null && isInsideCompose(pendingRoot, pendingOffender)
		diagnostics.push(
			diagnostic.unsupported(
				source,
				pendingOffender?.node ?? pendingRoot.node,
				`A client construct in the ${wording.pendingArm} of an async boundary`,
				inComposed
					? "The composed content renders inside the child's markup, where no write can address it — and nothing watches the pending arm once the signal resolves. Keep the arm to static and server markup."
					: 'Nothing watches the pending arm once the signal resolves — keep it to static and server markup.',
			),
		)
		return
	}

	const okLazyName =
		okRoot.kind === 'element' ? directLazyIdentifier(okRoot) : null
	const htmlSignalName = htmlThunkSignalName(okRoot)
	const driverName = okLazyName ?? htmlSignalName
	const boundaryCandidates = component.signals.filter(
		s =>
			(s.constructor === 'deriveCell' || s.constructor === 'createTask') &&
			s.name === driverName,
	)
	if (!driverName || boundaryCandidates.length !== 1) {
		diagnostics.push(
			diagnostic.unsupported(
				source,
				okRoot.node,
				`An async boundary whose ${wording.tryBody} neither renders its async signal as a direct lazy child nor reads it through a \`truc:html\` thunk`,
				'The compiler learns which signal drives the `isPending()` routing from that channel — render the `deriveCell(async …)` or `createTask(…)` signal directly, for example `{data}`, or read it on the arm root with `truc:html={() => data.get()}`.',
			),
		)
		return
	}
	const signal = boundaryCandidates[0]?.name as string
	// The attribute channel (LT-449): the value reaches the arm root through
	// the `truc:html` watch, so the root's own client constructs become the
	// ok arm's effects. The child channel keeps the child-only contract.
	// Element-root vocabulary: a compose root carries no `truc:html`.
	const okElement = okRoot.kind === 'element' ? okRoot : null
	const viaHtmlThunk =
		okElement !== null && okLazyName === null && htmlSignalName !== null
	if (
		!viaHtmlThunk &&
		okRoot.kind === 'element' &&
		okRoot.attrs.some(isClientConstructAttr)
	) {
		diagnostics.push(
			diagnostic.unsupported(
				source,
				okRoot.node,
				`A reactive construct on the ${wording.tryBody} root of an async boundary`,
				"That root takes static and server attributes and its one lazy signal child only — move the construct onto a child element, or read the signal through `truc:html={() => data.get()}` on the root, which plans root constructs as the ok arm's effects.",
			),
		)
		return
	}
	if (errRoot.kind === 'element' && errRoot.attrs.some(isClientConstructAttr)) {
		diagnostics.push(
			diagnostic.unsupported(
				source,
				errRoot.node,
				`A reactive construct in the ${wording.catchArm} of an async boundary`,
				'The arm takes static and server attributes and its one lazy error child only — remove the construct.',
			),
		)
		return
	}

	const directErrText =
		catchParam && errRoot.kind === 'element'
			? directLazyCatchRef(errRoot, catchParam)
			: null
	const errText =
		directErrText ??
		(errMsgEl && catchParam ? directLazyCatchRef(errMsgEl, catchParam) : null)
	if (
		errRoot.children.some(
			c => c.kind === 'expr' && c.reactivity === 'reactive',
		) &&
		directErrText === null
	) {
		diagnostics.push(
			diagnostic.unsupported(
				source,
				errRoot.node,
				`A lazy child in the ${wording.catchArm} that does not read the catch parameter \`${catchParam ?? 'e'}\``,
				`Render a text member of it, for example \`{${catchParam ?? 'e'}.message}\` — the parameter itself is an \`Error\`, which a text position does not take (ADR 0046 s6).`,
			),
		)
		return
	}
	// One catch read per arm: the err branch writes a single text target, so
	// a direct read on the root beside a nested message element would land
	// the root's text in the nested element and drop the nested read.
	if (directErrText !== null && errMsgEl !== null) {
		diagnostics.push(
			diagnostic.unsupported(
				source,
				errMsgEl.node,
				`A ${wording.catchArm} that reads the catch parameter \`${catchParam ?? 'e'}\` both on its root and in a nested element`,
				`Keep one read of \`${catchParam ?? 'e'}\` per arm — either directly in the root, for example \`{${catchParam ?? 'e'}.message}\`, or in one child element of the root.`,
			),
		)
		return
	}

	const container = armContainer(fx, node, `a ${wording.boundary}`, scope)
	if (container === null) return
	const arm = (key: string): ArmPlan => ({
		key,
		caseText: null,
		renders: true,
		root: null,
		locals: [],
		keyAttrs: [],
		effects: [],
	})
	const okArm = arm('ok')
	if (viaHtmlThunk && okElement !== null) {
		// The ok root's client constructs are the ok arm's effects (LT-449):
		// the `truc:html` watch is the value channel, and a reactive
		// style/class thunk rides beside it — both mounted inside
		// `bindArm`'s ok branch, dying with the arm. No descendants: the
		// deep-construct refusal above already kept the root the only
		// construct-bearing element.
		const rootName = uniqueName(usedNames, sanitizeVarName(okElement.tag))
		okArm.root = { name: rootName, tag: okElement.tag }
		fx.armSelectors.set(rootName, resolveSelector(fx, okElement).selector)
		emitConstructEffects(fx, okElement, rootName, okArm.effects, badNames)
	}
	// The nested message element (LT-449, through composed content since
	// LT-460) writes through an arm-scoped `first` local; the depth-0
	// channel keeps writing the root. Inside composed content the selector
	// must be a role or a class/id/data-* discriminator: the child renders
	// markup the compiler cannot see, so a bare tag could match one of ITS
	// elements and the arm's value would overwrite it (LT-460 rework).
	const errArm = arm('err')
	if (errMsgEl !== null) {
		const inComposed = isInsideCompose(component.root, errMsgEl)
		const resolved = inComposed
			? resolveComposeContentSelector(errMsgEl)
			: resolveSelector(fx, errMsgEl)
		if (resolved === null) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					errMsgEl.node,
					`The ${wording.catchArm}'s message element <${errMsgEl.tag}> inside composed content has no \`role\`, \`class\`, \`id\` or \`data-*\` attribute`,
					`The arm's write addresses it by selector, and the child's own markup can carry the same bare <${errMsgEl.tag}> — give the message element a distinguishing attribute, for example \`<p class="error">{${catchParam ?? 'e'}.message}</p>\`.`,
				),
			)
			return
		}
		errArm.locals.push({
			name: uniqueName(usedNames, 'errMessage'),
			selector: resolved.selector,
			message: `the ${wording.catchArm}'s message element`,
		})
	}
	;(scope?.sink ?? fx.effects).push({
		kind: 'arms',
		arms: {
			container,
			armSet: armSetOf(component.root, node),
			construct: 'try',
			testText: signal,
			sourceStart: undefined,
			elementParam: uniqueName(usedNames, 'armElement'),
			keyParam: uniqueName(usedNames, 'armKey'),
			arms: [okArm, arm('nil'), errArm],
			boundary: {
				signal,
				errText,
				okStart: startOf(okElement ? lazyChildOf(okElement)?.expr : undefined),
				errStart:
					startOf(
						errMsgEl !== null ? lazyChildOf(errMsgEl)?.expr : undefined,
					) ??
					startOf(
						errRoot.kind === 'element' ? lazyChildOf(errRoot)?.expr : undefined,
					),
			},
		},
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
 * 0024 sub-design 13, LT-012) — its arms switch on the client through
 * `reconcile()` (ADR 0037 s4), where this plain boundary's arms are
 * decided once, at render time.
 */
const handleTryEffects = (fx: EffectsContext, node: TryNode): void => {
	const wording = wordingOf(fx.component)
	if (node.pendingChildren !== null) {
		handleAsyncBoundary(fx, node)
		return
	}
	handleOptionalBranch(fx, node.children, node, `the ${wording.tryBody}`)
	handleOptionalBranch(fx, node.catchChildren, node, `the ${wording.catchArm}`)
}

/**
 * A compose site's `truc:pass` object as comparable text (LT-319): the
 * prop set in sorted order, each get/set thunk's source with whitespace
 * collapsed. Textual identity only — no semantic equivalence.
 */
const passObjectKey = (node: ComposeNode): string =>
	node.attrs
		.flatMap(a => (a.kind === 'pass' ? a.entries : []))
		.map(e =>
			[e.prop, e.thunkText, e.setThunkText ?? '']
				.map(t => t.replace(/\s+/g, ' ').trim())
				.join('\u0000'),
		)
		.sort()
		.join('\u0001')

/**
 * A `first()` reference and/or `pass={{ }}` on a composed element (ADR
 * 0024 sub-design 10). The query's selector is always the compiler's own:
 * the child's tag from the registry, plus — when this template composes
 * the same child more than once — a static `class`/`id`/`data-*` that
 * uniquely tells the site apart (`composeDiscriminatorClause`, LT-089;
 * three `<FormSpinbutton class="lightness"|"chroma"|"hue">` instances,
 * say). Those attributes reach the served DOM by invariant (LT-090,
 * LT-320), which is what makes the site addressable at all.
 *
 * An author `first()` matching the site (the synthetic `ref` attr
 * `analysis/compose-refs.ts` attaches, LT-127) names the query and
 * carries its required-reason text; a bare reference with no `pass` still
 * needs the query so the name resolves in the factory. A `pass` site with
 * no matching `first()` is named after the child tag, the same fallback
 * raw custom elements get (LT-338).
 */
const emitComposeEffects = (fx: EffectsContext, node: ComposeNode): void => {
	const { source, diagnostics, addQuery, composeRefs } = fx
	// Compose resolution is `skipped` during the corpus-wide registry-
	// discovery pass (compileComponent's own tolerance, LT-015). Nothing
	// below it can run then — the child's tag isn't resolvable. That pass
	// needs only this component's OWN registry entry.
	if (composeRefs.mode === 'skipped') return
	const { registry: composeRegistry, ambiguous: ambiguousComposeNodes } =
		composeRefs
	const passAttrs = node.attrs.filter(
		(a): a is Extract<(typeof node.attrs)[number], { kind: 'pass' }> =>
			a.kind === 'pass',
	)
	const refAttr = refOf(node)
	if (passAttrs.length === 0 && !refAttr) return
	// An ambiguous `first()` already explained itself (LTC027,
	// `analysis/compose-refs.ts`) — don't pile a second error on the same
	// mistake.
	if (!refAttr && ambiguousComposeNodes.has(node)) return
	const childTag = composeRegistry.get(node.source)?.tag ?? null
	if (!childTag) {
		diagnostics.push(
			diagnostic.composedComponentNotCompiled(
				source,
				node.node,
				node.component,
				node.source,
			),
		)
		return
	}
	let discriminator = ''
	if (countComposeBySource(fx, node.source) !== 1) {
		const siblings = composeNodesBySource(fx, node.source)
		const clause = composeDiscriminatorClause(node, siblings)
		if (!clause) {
			// LT-319: sites that share a clause and carry textually identical
			// `truc:pass` objects lower to ONE `pass(all(selector), …)`,
			// emitted at the group's first site; the other members add
			// nothing. An author `first()` is never part of this: a selector
			// matching several sites is already LTC027.
			const shared = refAttr ? null : composeSharedPassClause(node, siblings)
			if (shared && new Set(shared.members.map(passObjectKey)).size === 1) {
				if (shared.members[0] !== node) return
				const query = addQuery(
					`${sanitizeVarName(childTag)}s`,
					`${childTag}${shared.clause}`,
					'many',
				)
				const entries = passAttrs.flatMap(a => a.entries)
				checkPassEntries(fx, entries, childTag, node.node)
				emitPassEntries(fx, entries, query)
				return
			}
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					node.node,
					`Multiple <${node.component}> sites compose the same child, and no static class/id/data-* attribute tells this one apart — first() and truc:pass need a unique target. Give each site a distinct class. Sites that share a class can share one query only if every one of them carries a textually identical \`truc:pass\` object.`,
				),
			)
			return
		}
		discriminator = clause
	}
	const query = addQuery(
		refAttr?.name ?? sanitizeVarName(childTag),
		`${childTag}${discriminator}`,
		'one',
	)
	if (passAttrs.length > 0) {
		const entries = passAttrs.flatMap(a => a.entries)
		checkPassEntries(fx, entries, childTag, node.node)
		emitPassEntries(fx, entries, query)
	}
}

/**
 * A Mount Scope other than the host (ADR 0046 s1): an arm of an arm set or a
 * reactive-list item — an element subtree with its own mount and its own
 * `first`, bound to its root. Every construct inside it emits into its sink
 * through its locals (LT-424: recursive emission), and a construct that is a
 * scope of its own — a nested arm set, a nested list's item — plans into a
 * scope of its own the same way. `null` stands for the host scope, whose
 * addressing is the factory's queries.
 */
type MountScope = {
	/** The scope root element: the arm root, the item root. */
	root: ElementNode
	/** The root's local; naming it declares it in the mount. */
	rootRef: () => string
	/**
	 * The local naming `el` inside the scope (memoized; the root's own for
	 * the root), queried once per mount through the scope's `first` with a
	 * selector proved within the scope root. `optional` mints a
	 * non-throwing query (an element in a server-rendered branch); a later
	 * required request for the same element makes it required.
	 */
	localFor: (el: ElementNode, optional?: boolean) => string
	/** Is the local `name` an optional (non-throwing) query? */
	isOptional: (name: string) => boolean
	/** The scope's effects, in document order. */
	sink: TopEffectPlan[]
	/** The scope's key-derived attributes (ADR 0046 s1). */
	keyAttrs: KeyAttrPlan[]
	/** How diagnostics name the scope root (`the arm root <section>`). */
	label: string
}

/**
 * A scope's addressing over its plan's locals: descendants by selectors
 * proved within the root (`resolveScopedSelector` — a nested scope's
 * possible content counts, and a `:scope >` child path is synthesized when
 * no class, role or `data-*` tells the element apart), the root through
 * `rootRef`. A failed proof is LTC007, whose fix is a unique class.
 */
const mountScope = (
	fx: EffectsContext,
	init: {
		root: ElementNode
		rootRef: () => string
		locals: ScopeLocal[]
		sink: TopEffectPlan[]
		keyAttrs: KeyAttrPlan[]
		label: string
	},
): MountScope => {
	const { component, source, diagnostics, usedNames } = fx
	const names = new Map<ElementNode, string>()
	return {
		root: init.root,
		rootRef: init.rootRef,
		sink: init.sink,
		keyAttrs: init.keyAttrs,
		label: init.label,
		isOptional: name =>
			init.locals.some(local => local.name === name && local.optional),
		localFor: (el, optional = false) => {
			if (el === init.root) return init.rootRef()
			const known = names.get(el)
			if (known) {
				if (!optional) {
					const local = init.locals.find(l => l.name === known)
					if (local?.optional) delete local.optional
				}
				return known
			}
			const scoped = resolveScopedSelector(
				init.root,
				el,
				component.composedShapes,
			)
			if (!scoped.unique)
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						el.node,
						`No unique selector for <${el.tag}> inside ${init.label} — no \`class\`, \`role\`, \`data-*\` attribute or child path tells it apart from the other elements there, nested arms and list items included. Give it a unique \`class\`.`,
					),
				)
			const name = uniqueName(usedNames, sanitizeVarName(el.tag))
			names.set(el, name)
			init.locals.push({
				name,
				selector: scoped.selector,
				message: `${component.tag}: ${scoped.selector} missing`,
				...(optional ? { optional: true } : {}),
			})
			fx.armSelectors.set(name, resolveSelector(fx, el).selector)
			return name
		},
	}
}

/**
 * The nearest element holding `target` (control flow is transparent in the
 * DOM), or null at the template root.
 */
const holderOf = (
	fx: EffectsContext,
	target: TemplateNode,
): ElementNode | null => {
	const find = (
		node: TemplateNode,
		holder: ElementNode | null,
	): ElementNode | null | undefined => {
		if (node === target) return holder
		const next = isElement(node) ? node : holder
		for (const child of childNodes(node)) {
			const found = find(child, next)
			if (found !== undefined) return found
		}
		return undefined
	}
	return find(fx.component.root, null) ?? null
}

/**
 * A construct that is a Mount Scope of its own, or a loop, met while
 * planning `scope` (LT-424): plan it into the scope's sink through the
 * scope's locals and report true, so the caller does not descend. False for
 * everything else. `inBranch`: `node` sits in a server-rendered conditional
 * branch of the scope (an item's walk descends there; a reactive conditional
 * or boundary below one is refused), so a nested list's container may be
 * absent from the rendered markup (LT-455).
 */
const planNested = (
	fx: EffectsContext,
	scope: MountScope,
	node: TemplateNode,
	inBranch = false,
): boolean => {
	if (node.kind === 'conditional' && node.mode === 'reactive') {
		handleReactiveConditional(fx, node, scope)
		return true
	}
	if (node.kind === 'try' && node.pendingChildren !== null) {
		handleAsyncBoundary(fx, node, scope)
		return true
	}
	if (!isElement(node)) return false
	const loop = loopFor(fx, node)
	if (!loop) return false
	if (loop.kind === 'reconcile') planNestedList(fx, loop, scope, inBranch)
	else planNestedEach(fx, loop, scope)
	return true
}

/**
 * A reactive list nested in a Mount Scope (ADR 0046 s1–s2): its container
 * and its `@empty` roots are the scope's locals, and its item is a Mount
 * Scope of its own. The container may be the scope root itself: the
 * extracted template sits at the host's end and is queried from the host.
 * `inBranch`: the container sits in a server-rendered branch of the scope
 * (LT-455) — the branch folds per render call, the same for every clone,
 * but may leave the list out, so the container and `@empty` locals are
 * non-throwing queries and the mount binds under an `if` on the container.
 */
const planNestedList = (
	fx: EffectsContext,
	loop: ReconcileForIR,
	scope: MountScope,
	inBranch = false,
): void => {
	const plan = fx.reconcilePlans.get(loop)
	if (!plan) return
	// A nested list's output always has an element above it: the scope root
	// at the shallowest.
	const container = holderOf(fx, loop.output)
	if (container === null) return
	plan.container = scope.localFor(container, inBranch)
	fx.ambient.add('host')
	plan.emptyQueries = (loop.emptyArm ?? [])
		.filter(isElement)
		.map(root => scope.localFor(root, inBranch))
	if (inBranch) plan.inBranch = true
	planReconcileItem(fx, loop, plan)
	scope.sink.push({ kind: 'reconcile', for: plan })
}

/**
 * A server-data loop nested in a Mount Scope (ADR 0046 s2, LT-424): its items
 * are fixed for the life of the clone, so it lowers to a static query
 * against the scope root — no `all()`, no MutationObserver.
 */
const planNestedEach = (
	fx: EffectsContext,
	loop: EachForIR,
	scope: MountScope,
): void => {
	const plan = planEachLoop(fx, loop, { root: '', tree: scope.root })
	if (!plan?.scoped) return
	plan.scoped.root = scope.rootRef()
	scope.sink.push({ kind: 'each', for: plan })
}

/**
 * Key-derived attributes on `el` (ADR 0046 s1): `server` attributes reading
 * the enclosing items' key bindings alone. `validateListBody` refused every
 * other item or key read in a server attribute, so each survivor is
 * mount-time evaluable against the key parameters in scope.
 */
const keyAttrsOf = (
	fx: EffectsContext,
	el: ElementNode,
): Array<Extract<AttributeIR, { kind: 'server' }>> =>
	fx.keyNames.size === 0
		? []
		: el.attrs.filter(
				(attr): attr is Extract<AttributeIR, { kind: 'server' }> => {
					if (attr.kind !== 'server' || attr.bindsProp != null) return false
					const free = [...freeIdentifiers(attr.node)]
					return free.length > 0 && free.every(n => fx.keyNames.has(n))
				},
			)

/**
 * Record `el`'s key-derived attributes on `scope`. `inBranch`: `el` sits in a
 * server-rendered conditional branch, whose winner the render fixes for every
 * clone but may leave out — its local is a non-throwing query, and the write
 * is guarded.
 */
const collectKeyAttrs = (
	fx: EffectsContext,
	scope: MountScope,
	el: ElementNode,
	inBranch = false,
): void => {
	for (const attr of keyAttrsOf(fx, el)) {
		const local = scope.localFor(el, inBranch)
		scope.keyAttrs.push({
			el: local,
			...(scope.isOptional(local) ? { optional: true } : {}),
			attr: attr.name,
			exprText: attr.exprText,
			sourceStart: attr.node.start,
			sourceEnd: attr.node.end,
		})
	}
}

/**
 * The key-derived attributes in a server-rendered conditional's arms (and
 * the server conditionals nested in them), for `scope`: the same descent the
 * item walk makes. Client constructs there are refused elsewhere
 * (`unmountableInArm`), so only key-derived attributes bind.
 */
const collectBranchKeyAttrs = (
	fx: EffectsContext,
	scope: MountScope,
	node: TemplateNode,
): void => {
	if (isElement(node)) {
		if (loopFor(fx, node)) return
		collectKeyAttrs(fx, scope, node, true)
		for (const child of node.children) collectBranchKeyAttrs(fx, scope, child)
		return
	}
	if (node.kind === 'conditional' && node.mode === 'server')
		for (const arm of node.arms)
			for (const child of arm.children) collectBranchKeyAttrs(fx, scope, child)
}

/**
 * Why a node inside a reactive conditional's arm has no lowering in the
 * arm's mount (ADR 0037 s3), or null when it has one. The mount binds the
 * arm root and its descendants, and plans nested arm sets and loops into
 * their own scopes (ADR 0046 s1, LT-424); client constructs in a nested
 * server-rendered branch and composed references keep their host-level
 * addressing, which an arm cloned after connect would escape.
 */
const unmountableInArm = (node: TemplateNode): string | null => {
	const carriesConstruct = (n: TemplateNode): boolean =>
		n.kind === 'client-stmt' ||
		(n.kind === 'expr' && n.reactivity === 'reactive') ||
		(n.kind === 'element' && n.attrs.some(isClientConstructAttr))
	if (
		(node.kind === 'conditional' || node.kind === 'try') &&
		someNode(node, carriesConstruct)
	)
		return 'A client construct in a nested control-flow branch'
	if (
		node.kind === 'compose' &&
		node.attrs.some(a => a.kind === 'pass' || a.kind === 'ref')
	)
		return 'A composed element read through `first()` or `truc:pass`'
	return null
}

/** Is `holder` a reactive list's container (LTC063's question)? */
const isReconcileContainer = (
	fx: EffectsContext,
	holder: ElementNode,
): boolean =>
	[...fx.component.fors.values()].some(
		loop => loop.kind === 'reconcile' && holderOf(fx, loop.output) === holder,
	)

/**
 * The container a node's arms switch in (ADR 0037): the element that holds
 * it — a host query, or `'host'` at the component root; inside a Mount
 * Scope (LT-424), the scope's local, or the scope root's own. Null, after
 * the diagnostic, when that element is a reactive list's container, which
 * removes every child it did not place (LTC063), or has no unique selector.
 * Placement elsewhere is `validateArmSetPlacement`'s; `noun` names the
 * construct mid-sentence.
 */
const armContainer = (
	fx: EffectsContext,
	node: TemplateNode & { node: AstNode },
	noun: string,
	scope: MountScope | null,
): string | null => {
	const { component, source, diagnostics, addQuery } = fx
	const wording = wordingOf(component)
	let container: TemplateNode | null = null
	walkTemplate(component.root, (current, parent) => {
		if (current === node) container = parent
	})
	const holder = container as TemplateNode | null
	if (holder === null || holder.kind !== 'element') return null
	if (isReconcileContainer(fx, holder)) {
		diagnostics.push(
			diagnostic.reactiveConditionInReconcileContainer(
				source,
				node.node,
				node.kind === 'try' ? 'try' : 'conditional',
				wording,
			),
		)
		return null
	}
	if (scope !== null) return scope.localFor(holder)
	if (holder === component.root) {
		fx.ambient.add('host')
		return 'host'
	}
	const resolved = resolveSelector(fx, holder)
	if (!resolved.unique) {
		diagnostics.push(
			diagnostic.unaddressableElement(
				source,
				holder.node,
				`No unique selector for <${holder.tag}>, which holds ${noun} — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
			),
		)
		return null
	}
	return addQuery(
		refOf(holder)?.name ?? sanitizeVarName(holder.tag),
		resolved.selector,
		'one',
	)
}

/**
 * Every arm set (ADR 0037: a reactive conditional, an async boundary) and
 * every nested reactive list must sit where a mount reaches it: directly in
 * an element of the host or of a Mount Scope — an arm, a list item (ADR
 * 0046 s1) — never inside a server-rendered branch or composed content of
 * that scope, and never in a server-data loop body, whose `each()` binds
 * each item through its own element. One check over the whole template,
 * because a misplaced construct is exactly one the walk would never visit.
 */
const validateArmSetPlacement = (fx: EffectsContext): void => {
	const { component, source, diagnostics } = fx
	const wording = wordingOf(component)
	const loopOutputs = new Map<TemplateNode, ForIR>(
		[...component.fors.values()].map(loop => [loop.output, loop] as const),
	)
	const visit = (
		node: TemplateNode,
		enclosed: boolean,
		inServerBranch: boolean,
		loop: ForIR | null,
		inArm: boolean,
	): void => {
		const own = loopOutputs.get(node) ?? null
		if (hasArmSet(node)) {
			const subject =
				node.kind === 'try'
					? `A ${wording.boundary}`
					: wording.reactiveConditional
			if (loop?.kind === 'each')
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node,
						`${subject} inside a server-data ${wording.loop} body`,
						'`each()` binds each item through its own element, and an arm cloned after connect escapes it — move it out of the loop, or bind a reactive attribute on the item instead.',
					),
				)
			else if (enclosed)
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node,
						`${subject} inside another control-flow branch or a composed element's content`,
						'Its arms switch inside the element that holds it, which the client must find at connect — move it out of the enclosing branch, or onto an element of its own.',
					),
				)
		} else if (own?.kind === 'reconcile' && loop?.kind === 'each') {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node,
					`A reactive-list ${wording.loop} inside a server-data ${wording.loop} body`,
					'`each()` binds the loop items once at connect and has no mount for a list in each item — move the list out of the loop.',
				),
			)
		}
		// A `truc:pass` onto a composed child in a server-rendered branch of
		// the host is refused here (LT-470): the branch handlers never visit
		// a compose node — probed before this refusal, the shape compiled
		// clean on both surfaces with the pass silently unplanned — so
		// without it the author's entries vanish with no error. The same
		// fold-fixed once-only addressing the item walk refuses one scope
		// down; the guarded alternative is rejected for the same reason (a
		// pass entry has no reactive core to guard). Keyed on
		// `inServerBranch`, not `enclosed`: composed content also encloses,
		// and a pass compose nested there is already the LTC011 nesting
		// refusal — a second LTC005 naming a server branch would name the
		// wrong enclosure (review of LT-470). Skipped inside an arm (the arm
		// walk refuses the shape through `unmountableInArm`, including
		// nested server branches) and inside any list (the item walk refuses
		// it in the item's own branches; an `each()` body keeps today's
		// behavior).
		if (
			node.kind === 'compose' &&
			inServerBranch &&
			!inArm &&
			loop === null &&
			node.attrs.some(a => a.kind === 'pass')
		)
			diagnostics.push(
				diagnostic.unsupported(
					source,
					node.node,
					'A `truc:pass` onto a composed child in a server-rendered branch',
					'The branch folds once per render, so the pass would address markup that never re-renders — make the condition reactive: the composed child then renders as its arm’s root.',
				),
			)
		// An arm and a reactive-list item are Mount Scopes: what sits inside
		// starts over from its own mount. A server-data loop body stays
		// `each()`'s; a server-rendered branch or composed content encloses.
		let innerLoop = loop
		let innerEnclosed = enclosed
		let innerInArm = inArm
		let innerInServerBranch = inServerBranch
		if (hasArmSet(node)) {
			innerLoop = null
			innerEnclosed = false
			innerInArm = true
			innerInServerBranch = false
		} else if (own !== null) {
			innerLoop = own
			if (own.kind === 'reconcile') {
				innerEnclosed = false
				innerInServerBranch = false
			}
		} else if (node.kind === 'conditional' || node.kind === 'try') {
			innerEnclosed = true
		} else if (node.kind === 'compose') {
			// Composed content encloses on its own: a pass compose nested in
			// it is the LTC011 nesting refusal, server branch around the
			// outer compose or not, so the flag does not survive the hop
			// (review 2 of LT-470).
			innerEnclosed = true
			innerInServerBranch = false
		}
		if (node.kind === 'conditional' && node.mode === 'server')
			innerInServerBranch = true
		for (const child of childNodes(node))
			visit(child, innerEnclosed, innerInServerBranch, innerLoop, innerInArm)
	}
	visit(component.root, false, false, null, false)
}

/**
 * A reactive conditional (ADR 0037): its arms lower to `reconcile()`'s arm
 * form — templates the server stamps beside the live winner, a key thunk
 * over the test, and one mount per arm whose effects address the arm root
 * and its descendants inside the arm (collector parity, ADR 0017). The
 * conditional sits directly in an element of its scope — the host or a Mount
 * Scope (ADR 0046 s1) — and that element is the container the arm switches
 * in, found at connect or at the enclosing mount. Each arm is a Mount Scope:
 * arm sets and lists inside it plan into its mount (LT-424).
 */
const handleReactiveConditional = (
	fx: EffectsContext,
	node: ConditionalNode,
	scope: MountScope | null = null,
): void => {
	const { component, source, diagnostics, usedNames } = fx
	const wording = wordingOf(component)
	const badNames = fx.scopeBadNames
	const unsupported = (at: Site, what: string, fix: string) => {
		diagnostics.push(diagnostic.unsupported(source, at, what, fix))
	}

	const containerQuery = armContainer(
		fx,
		node,
		'a condition that reads a signal',
		scope,
	)
	if (containerQuery === null) return

	// Arm shape: one root element per arm that renders anything. A compose
	// site is an arm root too (LT-460) — its rendered root is the child's
	// own element.
	const label = isIf(node) ? wording.ifBranch : `${wording.caseLabel} arm`
	for (const arm of node.arms) {
		if (arm.children.length === 0) continue
		const elements = arm.children.filter(isBoundaryArmRoot)
		const loose = arm.children.find(
			c =>
				c.kind !== 'element' &&
				c.kind !== 'compose' &&
				c.kind !== 'client-stmt',
		)
		if (elements.length !== 1 || loose) {
			unsupported(
				(loose ?? elements[1] ?? arm.children[0])?.node ?? node.node,
				`A ${label} that does not render exactly one root element, in a condition that reads a signal`,
				"The client clones each arm from a template with one root element — wrap the arm's content in a single element.",
			)
			return
		}
		// Nested arm sets and loops are scopes of their own: their content
		// answers to their own rules when they are planned.
		let blocked: { at: TemplateNode; what: string } | null = null
		const check = (inner: TemplateNode): void => {
			if (blocked || hasArmSet(inner)) return
			if (isElement(inner) && loopFor(fx, inner)) return
			const what = unmountableInArm(inner)
			if (what) {
				blocked = { at: inner, what }
				return
			}
			for (const child of childNodes(inner)) check(child)
		}
		for (const child of arm.children)
			for (const inner of childNodes(child)) check(inner)
		const rootLoop = loopFor(fx, elements[0] as ElementNode)
		if (rootLoop) blocked = { at: elements[0] as ElementNode, what: 'A loop' }
		if (blocked) {
			const { at, what } = blocked as { at: TemplateNode; what: string }
			unsupported(
				at.node ?? node.node,
				`${what} inside a ${label} of a condition that reads a signal`,
				"The arm's mount binds its root element and the elements inside it; this construct keeps addressing the host and would miss an arm cloned after connect — move it out of the arm.",
			)
			return
		}
	}

	// The client half: the key thunk reads what the test reads.
	fx.collectAmbient(node.test)
	reportServerOnlyNames(
		fx,
		node.test,
		isIf(node) ? wording.ifCondition : wording.switchDiscriminant,
		badNames(node.test),
	)
	// No server phase can pick the winner: no live arm renders (ADR 0037
	// s5), and the component leaves the Folded tier — the realm, when it
	// can answer, renders the arm the client would. A test over an
	// enclosing item is per-item state (ADR 0046 s1): the live item renders
	// its winner with the item in scope, so it routes nothing.
	const itemScoped = [...dependenciesOf(node.test)].some(name =>
		fx.itemNames.has(name),
	)
	if (!itemScoped && !initialFold(component, node)) {
		fx.routingSignals.push({
			origin: 'LTC034',
			detail: `the initial arm of a ${isIf(node) ? 'conditional' : 'switch'} that reads a signal has no server-renderable value`,
			...rangeFields(source, node.test),
			resolution: resolutionOf(node.test, component.serverKnown),
		})
		// LT-391: a test over the wall clock or the RNG (limb b) has no
		// winner in ANY tier, the realm included — but the replayed client's
		// `reconcile()` clones one at connect when the component is Simulated
		// for another reason. Record the arm set so the driver strips that
		// arm before serializing, as it reverts every other limb-(b) site.
		if (suppresses(fx, node.test))
			fx.suppressedSites.push({
				kind: 'arms',
				selector: selectorOf(fx, containerQuery),
				armSet: armSetOf(component.root, node),
			})
	}

	const elementParam = uniqueName(usedNames, 'armElement')
	const keyParam = uniqueName(usedNames, 'armKey')
	const arms: ArmPlan[] = node.arms.map(arm => {
		const root = arm.children.find(isBoundaryArmRoot) ?? null
		const plan: ArmPlan = {
			key: arm.key,
			caseText: arm.testText,
			renders: root !== null,
			root: null,
			locals: [],
			keyAttrs: [],
			effects: [],
		}
		if (root === null) return plan
		// A compose arm root renders the child's own tag; the arm mount's
		// typed local (when anything reads it) casts to that element.
		const rootTag =
			root.kind === 'compose'
				? fx.composeRefs.mode === 'resolved'
					? (fx.composeRefs.registry.get(root.source)?.tag ?? root.component)
					: root.component
				: root.tag
		const rootName = uniqueName(usedNames, sanitizeVarName(rootTag))
		plan.root = { name: rootName, tag: rootTag }
		let rootUsed = false
		if (root.kind === 'element')
			fx.armSelectors.set(rootName, resolveSelector(fx, root).selector)
		const armScope = mountScope(fx, {
			// Composed content is never queried (its elements carry no
			// constructs — `validateComposedChildren`), so the scope root's
			// element-typed queries never touch the compose node.
			root: root as ElementNode,
			rootRef: () => {
				rootUsed = true
				return rootName
			},
			locals: plan.locals,
			sink: plan.effects,
			keyAttrs: plan.keyAttrs,
			label: `the arm root <${rootTag}>`,
		})
		for (const child of arm.children)
			if (child.kind === 'client-stmt') {
				fx.collectAmbient(child.node)
				plan.effects.push({
					kind: 'raw',
					text: child.text,
					sourceStart: child.node.start,
					sourceEnd: child.node.end,
				})
			}
		if (root.kind === 'element') {
			emitConstructEffects(fx, root, rootName, plan.effects, badNames)
			collectKeyAttrs(fx, armScope, root)
		}
		const visitDescendants = (el: ElementNode): void => {
			for (const child of el.children) {
				if (planNested(fx, armScope, child)) continue
				if (child.kind === 'conditional' && child.mode === 'server') {
					collectBranchKeyAttrs(fx, armScope, child)
					continue
				}
				if (!isElement(child)) continue
				if (hasOwnConstruct(child))
					emitConstructEffects(
						fx,
						child,
						armScope.localFor(child),
						plan.effects,
						badNames,
					)
				collectKeyAttrs(fx, armScope, child)
				visitDescendants(child)
			}
		}
		// Composed content carries no constructs (`validateComposedChildren`),
		// so the descent never plans against the compose node itself.
		visitDescendants(root as ElementNode)
		// The root local is only declared when something reads it.
		if (
			!rootUsed &&
			!plan.effects.some(e => 'query' in e && e.query === rootName) &&
			!plan.keyAttrs.some(k => k.el === rootName)
		)
			plan.root = null
		return plan
	})

	;(scope?.sink ?? fx.effects).push({
		kind: 'arms',
		arms: {
			container: containerQuery,
			armSet: armSetOf(component.root, node),
			construct: node.construct,
			testText: node.testText,
			sourceStart: node.test.start,
			elementParam,
			keyParam,
			arms,
		},
	})
}

/**
 * A reactive-list item is a Mount Scope (ADR 0046 s1): its content plans
 * through the same construct emission an arm's does (`emitConstructEffects`,
 * the compose pass-entry path), addressed through the item's own `first` —
 * the item root by `bindItem`'s element parameter (declared as a typed local
 * only when something binds it), descendants by selectors proved within the
 * item's own subtree and queried once per entering item. Item reads keep
 * the signal meaning (ADR 0046 s3): the bare `{item}` child is the signal
 * shorthand — its watch source IS the item signal — and every other read is
 * the authored arrow over `.get()`. A `server` attribute over the key
 * bindings alone is a key-derived attribute (`keyAttrs`): set once at clone,
 * because a key never changes, so there is nothing to watch. Item-scoped
 * sites are per-item state in every tier — `fx.itemNames` makes the LTC034
 * router and the limb-(b) suppression skip them, and `badListBodyNames`
 * reports the server-only face whose setup-const class no client-need walk
 * reaches (LT-349). A composed child in the item renders into the template;
 * its `truc:pass` entries bind against a scoped local, resolved within the
 * item the way `emitComposeEffects` resolves within the template (the
 * child's own `lang`/`i18n` are LT-355's). Nested arm sets and loops plan
 * into the item's mount as scopes of their own (LT-424); the enclosing
 * items' bindings stay in scope there.
 */
const planReconcileItem = (
	fx: EffectsContext,
	loop: ReconcileForIR,
	plan: ReconcilePlan,
): void => {
	const { component, source, diagnostics, usedNames } = fx
	const output = loop.output
	const wording = wordingOf(component)
	const saved = {
		itemNames: fx.itemNames,
		keyNames: fx.keyNames,
		scopeBadNames: fx.scopeBadNames,
	}
	// The item's setup names are per-item too (ADR 0046 s5), and its consts
	// are clone-time values like the key: an attribute over them is set
	// once at mount.
	const setupNames = loop.setup.flatMap(stmt =>
		stmt.name === null ? [] : [stmt.name],
	)
	const consts = loop.setup.flatMap(stmt =>
		stmt.kind === 'const' ? [stmt.name] : [],
	)
	fx.itemNames = new Set([
		...saved.itemNames,
		loop.itemName,
		...(loop.keyName ? [loop.keyName] : []),
		...setupNames,
	])
	fx.keyNames = new Set([
		...saved.keyNames,
		...(loop.keyName ? [loop.keyName] : []),
		...consts,
	])
	fx.scopeBadNames = fx.badListBodyNames
	const badNames = fx.badListBodyNames
	try {
		// Scope locals: the root by its element parameter, descendants by
		// `first()` within the item. Minted lazily — an element nothing
		// binds (its own constructs or a key-derived attribute) declares
		// nothing, exactly like an arm root no effect reads.
		let rootName: string | null = null
		const item = plan.itemScope
		const scope = mountScope(fx, {
			root: output,
			rootRef: () => {
				if (rootName === null) {
					rootName = uniqueName(usedNames, sanitizeVarName(output.tag))
					item.root = { name: rootName, tag: output.tag }
				}
				return rootName
			},
			locals: item.locals,
			sink: item.effects,
			keyAttrs: item.keyAttrs,
			label: `the ${wording.loop} item <${output.tag}>`,
		})

		// Key-derived attributes first, through server-rendered conditional
		// arms (the winner is fixed per render call, so the mount-time write
		// addresses markup that exists in both adopted items and clones) but
		// never into a nested scope or loop, whose own mount sets its own.
		const keyAttrSites: Array<{ el: ElementNode; inBranch: boolean }> = []
		const collectKeySites = (node: TemplateNode, inBranch: boolean): void => {
			if (isElement(node)) {
				if (node !== output && loopFor(fx, node)) return
				if (keyAttrsOf(fx, node).length > 0)
					keyAttrSites.push({ el: node, inBranch })
				for (const child of node.children) collectKeySites(child, inBranch)
				return
			}
			if (node.kind === 'conditional' && node.mode === 'server')
				for (const arm of node.arms)
					for (const child of arm.children) collectKeySites(child, true)
		}
		collectKeySites(output, false)

		// The item root's own constructs.
		if (hasOwnConstruct(output))
			emitConstructEffects(
				fx,
				output,
				scope.localFor(output),
				item.effects,
				badNames,
			)

		// Descendants with constructs of their own, document order. A
		// construct in a server-rendered conditional branch — the branch
		// roots included — is refused (LT-468): the fold is fixed per render
		// and per clone, so the construct's required query would throw in
		// every item mount whenever the branch folded off — the same trap
		// the host and arm walks refuse. Nested arm sets and loops plan into
		// the item's mount as their own scopes, a loop below a branch knowing
		// its container may be absent (LT-455).
		const visitElements = (node: TemplateNode, inBranch = false): void => {
			if (node !== output && planNested(fx, scope, node, inBranch)) return
			if (isElement(node)) {
				if (node !== output && hasOwnConstruct(node)) {
					if (inBranch)
						diagnostics.push(
							diagnostic.unsupported(
								source,
								node.node,
								`A client construct on an element in a server-rendered branch of the ${wording.loop} item <${output.tag}>`,
								'The branch folds once per render and every clone copies the fold, so the construct would address markup that never re-renders — make the condition reactive: the item then plans an arm set with live switching and existence-guarded binding.',
							),
						)
					else
						emitConstructEffects(
							fx,
							node,
							scope.localFor(node),
							item.effects,
							badNames,
						)
				}
				for (const child of node.children) visitElements(child, inBranch)
				return
			}
			if (node.kind === 'compose') {
				collectCompose(node, inBranch)
				return
			}
			if (node.kind === 'conditional' && node.mode === 'server')
				for (const arm of node.arms)
					for (const child of arm.children) visitElements(child, true)
		}

		// Composed children in the item: `truc:pass` entries bind against a
		// scoped local, resolved within the item the way
		// `emitComposeEffects` resolves within the template. The same
		// registry-discovery tolerance applies: that pass runs with no
		// `composeRegistry` and needs only this component's own entry, so a
		// site it cannot resolve says nothing (the LT-015 tolerance).
		// `inBranch`: a `truc:pass`-carrying compose in a server-rendered
		// branch of the item is refused before any local is minted (LT-470) —
		// the fold is fixed per render and per clone, so the required local
		// would throw in every item mount whenever the branch folded off, the
		// construct trap LT-468 refuses one scope down. A pass-less compose
		// stays legal: it is server-rendered markup the client never
		// addresses.
		function collectCompose(node: ComposeNode, inBranch = false): void {
			const passAttrs = node.attrs.filter(
				(a): a is Extract<(typeof node.attrs)[number], { kind: 'pass' }> =>
					a.kind === 'pass',
			)
			if (passAttrs.length === 0) return
			if (fx.composeRefs.mode === 'skipped') return
			if (inBranch) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node,
						`A \`truc:pass\` onto a composed child in a server-rendered branch of the ${wording.loop} item <${output.tag}>`,
						'The branch folds once per render and every clone copies the fold, so the pass would address markup that never re-renders — make the condition reactive: the item then plans an arm set with live switching, and the composed child renders as its arm’s root.',
					),
				)
				return
			}
			const childTag = fx.composeRefs.registry.get(node.source)?.tag ?? null
			if (!childTag) {
				diagnostics.push(
					diagnostic.composedComponentNotCompiled(
						source,
						node.node,
						node.component,
						node.source,
					),
				)
				return
			}
			const siblings = composeNodesBySourceIn(output, node.source)
			let discriminator = ''
			if (siblings.length !== 1) {
				const clause = composeDiscriminatorClause(node, siblings)
				if (!clause) {
					diagnostics.push(
						diagnostic.unaddressableElement(
							source,
							node.node,
							`Multiple <${node.component}> sites in one ${wording.loop} item compose the same child, and no static class/id/data-* attribute tells this one apart — give each site a distinct class.`,
						),
					)
					return
				}
				discriminator = clause
			}
			const name = uniqueName(usedNames, sanitizeVarName(childTag))
			const selector = `${childTag}${discriminator}`
			item.locals.push({
				name,
				selector,
				message: `${component.tag}: ${selector} missing`,
			})
			// Type-flow import: the composed child's tag-map augmentation must
			// reach the client module even though no factory query names it.
			if (childTag !== component.tag && fx.registry.has(childTag))
				fx.childTags.add(childTag)
			const entries = passAttrs.flatMap(a => a.entries)
			checkPassEntries(fx, entries, childTag, node.node)
			emitPassEntries(fx, entries, name, item.effects, badNames)
		}
		visitElements(output)

		// The key-derived attributes, with the locals their sites claimed.
		for (const { el, inBranch } of keyAttrSites)
			collectKeyAttrs(fx, scope, el, inBranch)
	} finally {
		fx.itemNames = saved.itemNames
		fx.keyNames = saved.keyNames
		fx.scopeBadNames = saved.scopeBadNames
	}
}

const emitTopEffects = (fx: EffectsContext, node: TemplateNode): void => {
	const {
		component,
		source,
		diagnostics,
		effects,
		ambient,
		addQuery,
		collectAmbient,
		forPlans,
		reconcilePlans,
	} = fx
	if (node.kind === 'conditional' && node.mode === 'reactive') {
		handleReactiveConditional(fx, node)
		return
	}
	if (isIf(node)) {
		handleIfEffects(fx, node)
		return
	}
	if (isSwitch(node)) {
		handleSwitchEffects(fx, node)
		return
	}
	if (node.kind === 'try') {
		handleTryEffects(fx, node)
		return
	}
	if (node.kind === 'compose') {
		emitComposeEffects(fx, node)
		return
	}
	if (!isElement(node)) return
	const loop = node !== component.root ? loopFor(fx, node) : null
	if (loop) {
		if (loop.kind === 'reconcile') {
			const plan = reconcilePlans.get(loop)
			if (plan) {
				planReconcileItem(fx, loop, plan)
				effects.push({ kind: 'reconcile', for: plan })
			}
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
					keys: objectKeys(attr.object),
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
					keys: objectKeys(attr.object),
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
						component.root.node,
						'A reactive construct on the component root element',
						'The root takes reactive class and style maps and lazy text only — move the construct onto a child element.',
					),
				)
				break
			}
		}
		// LT-114: the root's lazy text CHILDREN are the text-binding
		// counterpart of the style-map/class-map root exemptions above
		// (LT-028/LT-032) — shared with the nested path through
		// `emitLazyTextChildren` (LT-226).
		emitLazyTextChildren(
			fx,
			component.root,
			'host',
			effects,
			'the component root',
			SUPPRESSED_HOST_SELECTOR,
			true,
		)
	} else {
		const hasClientConstruct =
			node.attrs.some(isClientConstructAttr) ||
			node.children.some(c => c.kind === 'expr' && c.reactivity === 'reactive')
		if (hasClientConstruct) {
			const { selector, unique } = resolveSelector(fx, node)
			if (!unique) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						source,
						node.node,
						`No unique selector for <${node.tag}> in the rendered template — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
					),
				)
			}
			const refAttr = refOf(node)
			const query = addQuery(
				refAttr?.name ?? sanitizeVarName(node.tag),
				selector,
				'one',
			)
			emitConstructEffects(fx, node, query)
		}
	}
	for (const child of node.children) emitTopEffects(fx, child)
}

/**
 * LT-090: a static `id` on a compose site materializes on that
 * instance's host element (`composeHostAttrs`) — duplicated across
 * sites it is two elements sharing an id in the same rendered
 * document, invalid HTML, and id-based addressing resolves to at most
 * one of them. Template-cloned arms keep the same property by
 * structure: only the winning arm is ever in the document (ADR 0037
 * s4), so only compose sites can collide. Shares nothing with effect
 * planning — a standalone validation (LT-226), like the front end's
 * post-lowering tail.
 */
const validateComposeIds = (fx: EffectsContext): void => {
	const { component, source, diagnostics } = fx
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
			diagnostic.duplicateComposeId(source, second.node, id, sites.length),
		)
	}
}

/* === Exported Functions === */

/**
 * Pass 4: the document-ordered client effect walk (LT-022, regrouping move
 * M5). Builds the pass context once, walks the template through
 * `emitTopEffects`, then runs the standalone compose-`id` validation —
 * the band units live at module scope (LT-226).
 */
export const runEffects = (
	shared: PassShared,
	{ forPlans, reconcilePlans }: LoopPlans,
	/**
	 * Unread here: the parameter carries the ORDER (ADR 0040 s5). Harvest
	 * registers its queries first, and query registration order is the
	 * byte-stable contract — so effects cannot be planned without it.
	 */
	_harvests: HarvestPlans,
): EffectPlans => {
	const {
		component,
		source,
		diagnostics,
		routingSignals,
		suppressedSites,
		registry,
		composeRefs,
		ambient,
		addQuery,
		collectAmbient,
		badFreeNames,
		badListBodyNames,
		childTags,
		usedNames,
		queries,
	} = shared
	/**
	 * Registry entries by TAG (LT-158). The compose registry is keyed by
	 * source path because composition resolves through import specifiers; a
	 * `pass={{ }}` on a raw dashed tag has only the tag, so it needs the
	 * other index. Built from the same map rather than threading a second
	 * one through: pass 1 puts every compilable file's entry in there, so
	 * the two indexes are the same set of components.
	 */
	const entryByTag = new Map<string, RegistryEntry>()
	if (composeRefs.mode === 'resolved')
		for (const entry of composeRefs.registry.values())
			entryByTag.set(entry.tag, entry)
	const effects: EffectPlans = []
	const fx: EffectsContext = {
		component,
		source,
		diagnostics,
		routingSignals,
		suppressedSites,
		registry,
		composeRefs,
		queries,
		effects,
		ambient,
		usedNames,
		forPlans,
		reconcilePlans,
		addQuery,
		collectAmbient,
		badFreeNames,
		badListBodyNames,
		childTags,
		entryByTag,
		// Empty outside a reactive-list item; `planReconcileItem` swaps them
		// in for the item's own walk and restores them after.
		itemNames: new Set<string>(),
		keyNames: new Set<string>(),
		scopeBadNames: badFreeNames,
		armSelectors: new Map(),
		derivableHostProps: foldableHostProps(component),
		derivableRefGuards: foldableRefGuards(component),
		foldScope: foldableRenderScope(component),
	}
	validateArmSetPlacement(fx)
	emitTopEffects(fx, component.root)
	validateComposeIds(fx)
	return effects
}
