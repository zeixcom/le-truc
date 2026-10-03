/**
 * `first(selector, required)` element-reference resolution (LT-055,
 * replacing `ref={}`). A front-end-owned pure leaf, sibling of
 * `reactivity.ts`/`evaluability.ts`: `compiler.ts` calls this once the
 * template IR exists (`lowerChildren` has run) to structurally match an
 * author's selector against the component's own template, before attaching
 * the matched element(s) to the same `{kind: 'ref', name}` IR shape
 * `ref={}` used to populate directly. Depends only on `ir.ts` types, so
 * both the front end and (if ever needed) the analysis layer can import it
 * without crossing the pipeline's documented front-end → analysis
 * direction the other way.
 *
 * The author's selector is used ONLY here, at compile time, to identify
 * WHICH element(s) a `first()`-declared name refers to. It is never emitted
 * as the runtime selector — `analysis/selectors.ts`'s `resolveSelectorIn`/
 * `selectorFor` still synthesize that, exactly as for `ref={}` before it,
 * so every existing dedup/union-addressing guarantee carries over unchanged.
 */

import * as cssWhat from 'css-what'
import type { AstNode } from './ast-node'
import { isNode } from './ast-utils'
import { diagnostic, type LocalDiagnostic, type Site } from './diagnostics'
import type { FirstRefDecl, TemplateNode } from './ir'
import {
	childNodes,
	elseOf,
	type IfNode,
	isIf,
	someNode,
	thenOf,
	walkTemplate,
} from './walk'

/* === Types === */

export type ElementNode = Extract<TemplateNode, { kind: 'element' }>

/** One `.class`/`#id`/`[attr]`/`[attr="value"]` clause, or a bare tag name. */
type SimpleSelector = {
	tag: string | null
	id: string | null
	classes: string[]
	attrs: Array<{ name: string; value: string | null }>
}

/** A `.token`/`#id` spelling safe to verify as a bare identifier. */
const PLAIN_SELECTOR_TOKEN = /^[A-Za-z_-][\w-]*$/

/* === Internal Functions === */

/** Static attributes of an element as a map (mirrors `analysis/selectors.ts`). */
const staticAttrs = (element: ElementNode): Map<string, string | null> => {
	const map = new Map<string, string | null>()
	for (const attr of element.attrs)
		if (attr.kind === 'static') map.set(attr.name, attr.value)
	return map
}

/**
 * Parse ONE simple selector (no combinators, no pseudo-classes) into its
 * structural parts. Supports an optional tag followed by any combination of
 * `.class`, `#id`, and `[attr]`/`[attr="value"]` clauses, in any order.
 * Since LT-380 (ADR 0045 Decision 5) the parse itself runs on css-what;
 * the post-checks keep the VERIFIED SUBSET exactly what it was — the swap
 * changed how the selector parses, not what it verifies (widening is
 * LT-381): pseudo-classes, combinators, selector lists, namespaced or
 * uppercase tags, attribute operators beyond `=`/presence, the `i` flag,
 * single-quoted or unquoted attribute values, and any whitespace outside a
 * quoted value (css-what is lenient there in ways the subset predates)
 * all return `null`. The caller must treat `null` as "cannot verify
 * structurally," never as "matches nothing."
 */
const parseSimpleSelector = (selector: string): SimpleSelector | null => {
	const trimmed = selector.trim()
	if (trimmed === '') return null
	let branches
	try {
		branches = cssWhat.parse(trimmed)
	} catch {
		return null
	}
	// ONE simple selector: a single compound — no selector list, no
	// combinator, no empty parse.
	const compound = branches[0]
	if (branches.length !== 1 || !compound || compound.length === 0) return null
	let tag: string | null = null
	let id: string | null = null
	const classes: string[] = []
	const attrs: Array<{ name: string; value: string | null }> = []
	for (const [index, simple] of compound.entries()) {
		if (simple.type === 'tag') {
			// The tag leads the compound, is lowercase HTML, and is not
			// namespaced — css-what accepts far more (`1a`, `a b` as one
			// escaped name, `a|b`) than the subset verified before it.
			if (index !== 0 || simple.namespace !== null) return null
			if (!/^[a-z][a-z0-9-]*$/.test(simple.name)) return null
			tag = simple.name
		} else if (simple.type === 'attribute') {
			if (simple.namespace !== null || simple.ignoreCase === true) return null
			if (simple.action === 'element') {
				// The `.token` spelling (css-what encodes class membership as
				// a `class`/`element` attribute predicate).
				if (simple.name !== 'class' || !PLAIN_SELECTOR_TOKEN.test(simple.value))
					return null
				classes.push(simple.value)
			} else if (
				simple.action === 'equals' &&
				simple.name === 'id' &&
				// Only the `#id` spelling takes the id path — an explicit
				// `[id="…"]` clause is an attribute like any other, exactly
				// as the clause loop before the swap treated it.
				simple.ignoreCase === 'quirks'
			) {
				if (!PLAIN_SELECTOR_TOKEN.test(simple.value)) return null
				// Last wins, exactly as the old clause loop overwrote `id`.
				id = simple.value
			} else if (simple.action === 'equals' || simple.action === 'exists') {
				if (!/^[a-zA-Z_-][\w-]*$/.test(simple.name)) return null
				if (simple.action === 'equals' && simple.value.includes('"'))
					return null
				attrs.push({
					name: simple.name,
					value: simple.action === 'equals' ? simple.value : null,
				})
			} else {
				// `^=`/`$=`/… — operators the subset never verified.
				return null
			}
		} else {
			// Pseudo-classes, pseudo-elements, the universal selector,
			// traversal entries — richer than the subset.
			return null
		}
	}
	if (leavesSimpleSubset(trimmed)) return null
	return { tag, id, classes, attrs }
}

/**
 * The subset's only whitespace is inside a quoted attribute value, and its
 * only attribute spelling is `[name="value"]`: css-what additionally
 * tolerates `[ a = "b" ]` (browser-valid, but the subset predates it and
 * LT-381 owns widening), single-quoted values, and unquoted values — all
 * refused here so the verified subset stays what it was.
 */
const leavesSimpleSubset = (trimmed: string): boolean => {
	let quote: string | null = null
	for (let i = 0; i < trimmed.length; i++) {
		const char = trimmed[i] as string
		if (quote) {
			if (char === '\\') i++
			else if (char === quote) quote = null
			continue
		}
		if (char === '"') {
			quote = char
			continue
		}
		if (/\s/.test(char) || char === "'") return true
		if (char === '=' && trimmed[i + 1] !== '"') return true
	}
	return false
}

const matchesSimpleSelector = (
	candidate: { tag: string; attrs: ReadonlyMap<string, string | null> },
	parsed: SimpleSelector,
): boolean => {
	if (parsed.tag && candidate.tag !== parsed.tag) return false
	const attrs = candidate.attrs
	if (parsed.id !== null && attrs.get('id') !== parsed.id) return false
	if (parsed.classes.length > 0) {
		const classList = (attrs.get('class') ?? '').split(/\s+/).filter(Boolean)
		if (!parsed.classes.every(c => classList.includes(c))) return false
	}
	for (const attr of parsed.attrs) {
		if (!attrs.has(attr.name)) return false
		if (attr.value !== null && attrs.get(attr.name) !== attr.value) return false
	}
	return true
}

/**
 * Does `candidate` — any `{tag, attrs}` pair, so composed elements can be
 * matched too once the registry has resolved their tag (`analysis/
 * compose-refs.ts`) — structurally match an author-written selector? A
 * comma-separated list is OR semantics (matching `ElementFromSelector<S>`'s own
 * comma-union typing); each branch is a tag with any combination of
 * `.class`, `#id`, and `[attr]`/`[attr="value"]`. Returns `null` — not
 * `false` — when NO branch matches AND at least one branch used unsupported
 * syntax, so the caller can distinguish "verified: no match" from "cannot
 * verify."
 */
export const matchesAuthoredSelectorOn = (
	candidate: { tag: string; attrs: ReadonlyMap<string, string | null> },
	selectorList: string,
): boolean | null => {
	let anyUnsupported = false
	for (const branch of selectorList.split(',')) {
		const parsed = parseSimpleSelector(branch)
		if (!parsed) {
			anyUnsupported = true
			continue
		}
		if (matchesSimpleSelector(candidate, parsed)) return true
	}
	return anyUnsupported ? null : false
}

/* === Exported Functions === */

/**
 * Every element in `root` matching an author-written selector. Composed
 * elements are a boundary — their own template is a different component,
 * so the walk doesn't enter them, mirroring `collectComposeElements`'s
 * `intoCompose: false`.
 */
export const collectMatchingElements = (
	root: ElementNode,
	selectorList: string,
): { elements: ElementNode[]; unsupported: boolean } => {
	const elements: ElementNode[] = []
	let unsupported = false
	walkTemplate(
		root,
		node => {
			if (node.kind !== 'element') return
			const result = matchesAuthoredSelectorOn(
				{ tag: node.tag, attrs: staticAttrs(node) },
				selectorList,
			)
			if (result === null) unsupported = true
			else if (result) elements.push(node)
		},
		{ intoCompose: false },
	)
	return { elements, unsupported }
}

/**
 * Does any branch of an author-written selector list name a CUSTOM-element
 * tag (one containing a `-`)? The deferral test for LT-127: a `first()`
 * selector that matched no raw element in this component's own template,
 * but names a custom-element tag, may still be addressing a COMPOSED
 * (PascalCase) child — whose eventual tag lives in another file's registry
 * entry and is unknown inside single-file `compileSource`. Such a selector
 * is handed to the registry-aware second pass (`analysis/compose-refs.ts`)
 * instead of being rejected here; anything else is a genuine LTC026.
 */
export const namesCustomElementTag = (selectorList: string): boolean =>
	selectorList
		.split(',')
		.some(branch => parseSimpleSelector(branch)?.tag?.includes('-') === true)

/**
 * The nearest enclosing `@if` whose branches (`then`/`alternate`) directly
 * contain `target`, searching from `root`.
 */
const enclosingIfIn = (
	root: ElementNode,
	target: ElementNode,
): IfNode | null => {
	const walk = (node: TemplateNode): IfNode | null => {
		if (isIf(node) && node.mode === 'server') {
			const branches = [...thenOf(node), ...elseOf(node)]
			if (branches.includes(target)) return node
			for (const child of branches) {
				const found = walk(child)
				if (found) return found
			}
			return null
		}
		if (node.kind !== 'element') return null
		for (const child of node.children) {
			const found = walk(child)
			if (found) return found
		}
		return null
	}
	return walk(root)
}

/**
 * Are all of `elements` mutually exclusive at runtime — direct branch roots
 * of the SAME `@if`, at most one per branch? This is the structural shape
 * `first('input, textarea', 'required')` needs when the referenced element
 * differs by tag across an `@if`/`@else` — the same "whichever branch
 * rendered" guarantee `analysis/selectors.ts`'s `selectorFor` union
 * addressing already relies on elsewhere, scoped here to DIRECT branch
 * roots only, matching that existing precedent.
 */
export const shareExclusiveIf = (
	root: ElementNode,
	elements: ElementNode[],
): boolean => {
	if (elements.length < 2) return true
	const [first, ...rest] = elements.map(el => enclosingIfIn(root, el))
	if (!first || rest.some(e => e !== first)) return false
	const inThen = elements.filter(el => thenOf(first).includes(el))
	const inAlternate = elements.filter(el => elseOf(first).includes(el))
	return (
		inThen.length <= 1 &&
		inAlternate.length <= 1 &&
		inThen.length + inAlternate.length === elements.length
	)
}

/**
 * LTC039 (LT-122): report every site that renders a server arg
 * whose name is a PARSER-exposed prop — the value's own seeding
 * channel is the host attribute, so such a site is a second copy.
 *
 * The component ROOT is skipped deliberately: the root IS the host,
 * so `<form-textbox value={value}>` is the Parser's channel being
 * rendered, which is the correct half. Only OWNED descendants
 * duplicate it (`<textarea …>{value}</textarea>` beside that same
 * root attribute — form-textbox ships `value` twice today).
 *
 * A site whose OWN element the Parser's fallback reads is skipped too
 * (LT-129). `asNumber(asNumber(1)(input.step))` rendered onto the very
 * `<input>` that `input` addresses is not one value arriving twice — it
 * is the data account's sanctioned OVERRIDE precedence (bullet 2: the
 * host attribute wins over the harvested value), which LT-112 restored
 * deliberately for form-spinbutton's `value`/`min`/`max`/`step`. The
 * criterion is the one confirmed with the owner: warn only when the two
 * channels are genuinely INDEPENDENT copies. Note this is per-SITE, not
 * per-prop — the same prop rendered onto a DIFFERENT element than the
 * one its fallback reads is still a duplicate and still warns.
 *
 * The exclusion covers text-child sites as well as attributes (LT-139):
 * `expose({ label: asString(labelSpan.textContent ?? '') })` over
 * `<span class="label">{label}</span>` is bullet 4's canonical harvest
 * site with bullet 2's override added. A text child's site element is
 * its PARENT, which `walkTemplate` already hands to the visitor.
 *
 * A `formAssociated()`/`formAssociatedCheckbox()` host's reserved prop
 * (`value`/`checked`) is a THIRD exclusion, distinct from bullet 2's
 * override (LT-141): the root's own content attribute is the RESET
 * BASELINE the extension reads on `formResetCallback` (`defaultValue`/
 * `defaultChecked`, LT-056/LT-057), and the owned site is the CURRENT
 * value — native `<input value>` semantics, where the content attribute
 * and the IDL property deliberately diverge. Neither channel is
 * removable, so the ordinary fix-it ("drop the attribute") would break
 * form reset. Exempt only while the root actually carries that baseline
 * attribute — absent it, there is no baseline and the original
 * duplication hazard is real — and when the exemption doesn't apply,
 * `duplicatedPropChannel`'s message is branched so it never tells a
 * form-associated author to delete their reset baseline.
 */
export type DuplicatedChannelsCheck = {
	root: TemplateNode
	source: string
	diagnostics: LocalDiagnostic[]
	argNames: ReadonlySet<string>
	parserProps: ReadonlySet<string>
	parserFactoryOf: (prop: string) => string
	parserFallbackRefsOf: (prop: string) => ReadonlySet<string>
	/** `value` or `checked` if `config.form` names it (LT-141); else `null`. */
	formResetProp: string | null
}

export const reportDuplicatedChannels = ({
	root,
	source,
	diagnostics,
	argNames,
	parserProps,
	parserFactoryOf,
	parserFallbackRefsOf,
	formResetProp,
}: DuplicatedChannelsCheck): void => {
	if (parserProps.size === 0 || argNames.size === 0) return
	const named = (expr: AstNode): string | null => {
		if (!isNode(expr) || expr.type !== 'Identifier') return null
		const name = String(expr.name)
		return argNames.has(name) && parserProps.has(name) ? name : null
	}
	// The root carries the reserved prop as its own baseline attribute —
	// the condition that makes the second channel a baseline rather than
	// a duplicate (LT-141).
	const rootHasBaselineAttr =
		formResetProp !== null &&
		root.kind === 'element' &&
		root.attrs.some(a => a.kind === 'server' && a.name === formResetProp)
	const report = (prop: string, at: Site): void => {
		diagnostics.push(
			diagnostic.duplicatedPropChannel(
				source,
				at,
				prop,
				parserFactoryOf(prop),
				prop === formResetProp,
			),
		)
	}
	/**
	 * The `first()` name bound to this element, if any — the element's own
	 * `{kind:'ref'}` attribute, which is how a fallback expression addresses
	 * it (`input.step`).
	 */
	const refNameOf = (
		node: TemplateNode & { kind: 'element' },
	): string | null => {
		for (const attr of node.attrs) if (attr.kind === 'ref') return attr.name
		return null
	}
	/** The override shape: this prop's Parser fallback reads THIS element. */
	const isSanctionedOverride = (
		prop: string,
		element: (TemplateNode & { kind: 'element' }) | null,
	): boolean => {
		const refName = element ? refNameOf(element) : null
		return refName !== null && parserFallbackRefsOf(prop).has(refName)
	}
	walkTemplate(root, (node, parent) => {
		if (node.kind === 'expr') {
			const prop = named(node.expr)
			// A text child's site element is its PARENT (LT-139) — `walkTemplate`
			// hands it to the visitor, so the same per-site exclusion the
			// attribute branch below applies works here unchanged. The root is
			// not skipped the way it is for attributes: a text child OF the root
			// is an owned site, not the host's own attribute channel.
			if (
				prop &&
				!isSanctionedOverride(
					prop,
					parent?.kind === 'element' ? parent : null,
				) &&
				!(prop === formResetProp && rootHasBaselineAttr)
			)
				report(prop, node.node)
			return
		}
		if (node.kind !== 'element' || node === root) return
		for (const attr of node.attrs) {
			if (attr.kind !== 'server') continue
			const prop = named(attr.node)
			if (
				prop &&
				!isSanctionedOverride(prop, node) &&
				!(prop === formResetProp && rootHasBaselineAttr)
			)
				report(prop, attr.node)
		}
	})
}

/**
 * LTC042 (LT-131): every element in the template carrying a STATIC `id`.
 * A template is per-INSTANCE; an `id` is per-DOCUMENT. The constant is
 * correct for exactly one instance on a page and silently wrong for the
 * second — including the root element, which is the host itself.
 *
 * Only `kind: 'static'` attrs are reported: an `id={expr}` is already the
 * shape this diagnostic asks for, whatever the expression turns out to be
 * (the compiler cannot and should not judge whether the author's value is
 * unique per instance — that is the instantiator's contract).
 */
export const reportStaticIds = (
	root: TemplateNode,
	source: string,
	diagnostics: LocalDiagnostic[],
): void => {
	walkTemplate(root, node => {
		if (node.kind !== 'element') return
		for (const attr of node.attrs)
			if (attr.kind === 'static' && attr.name === 'id' && attr.value)
				diagnostics.push(
					diagnostic.staticIdInTemplate(
						source,
						node.node,
						node.tag,
						attr.value,
					),
				)
	})
}

/**
 * The server-side condition deciding whether `refName`'s matched element
 * is in this component's OWN rendered output (LT-118) — the expression
 * text to substitute for a `Boolean(ref)` presence read when folding a
 * thunk server-side (`evaluability.ts`).
 *
 * The server renders the element exactly when every `@if` on the path to
 * it is taken, so the answer is the conjunction of those conditions
 * (negated for an `@else` arm): `'true'` when nothing guards it, `'false'`
 * when no element matches the ref at all (only a PAGE could supply it, and
 * the server did not).
 *
 * `null` — meaning "do not fold, omit the attribute instead" — for the two
 * cases the server cannot settle with a plain condition: a ref inside a
 * `@switch`/`@try` arm or a reactive conditional's arm (arm selection is not a single boolean), and a ref
 * matched more than once (the union of several conditions is not what a
 * presence read means). Refusing to fold is always safe; folding wrongly
 * bakes a wrong initial state into the HTML.
 */
export const refBranchGuard = (
	root: TemplateNode,
	refName: string,
): string | null => {
	const found: string[][] = []
	let bailed = false
	const carriesRef = (node: TemplateNode): boolean =>
		(node.kind === 'element' || node.kind === 'compose') &&
		node.attrs.some(a => a.kind === 'ref' && a.name === refName)
	const walk = (node: TemplateNode, guards: readonly string[]): void => {
		if (bailed) return
		if (carriesRef(node)) found.push([...guards])
		if (isIf(node) && node.mode === 'server') {
			for (const child of thenOf(node))
				walk(child, [...guards, `(${node.testText})`])
			for (const child of elseOf(node))
				walk(child, [...guards, `!(${node.testText})`])
			return
		}
		if (node.kind === 'conditional' || node.kind === 'try') {
			// Arm selection is not a plain condition — if the ref lives in
			// one, refuse rather than guess.
			if (someNode(node, carriesRef)) bailed = true
			return
		}
		for (const child of childNodes(node)) walk(child, guards)
	}
	walk(root, [])
	if (bailed || found.length > 1) return null
	if (found.length === 0) return 'false'
	const guards = found[0] as string[]
	return guards.length === 0 ? 'true' : guards.join(' && ')
}

/**
 * Does every path to `target` from `root` pass through an `@if`
 * with no `@else` (LT-123)? Such an element is absent from the
 * rendered DOM whenever that branch didn't take, so a reference
 * to it is optional NO MATTER how `first()` was called — the
 * analysis addresses it with a non-throwing query under a
 * presence guard (`handleOptionalBranch`, analysis/effects.ts).
 */
export const inOptionalBranch = (
	root: TemplateNode,
	target: TemplateNode,
): boolean => {
	let found = false
	const walk = (node: TemplateNode, optional: boolean): void => {
		if (found) return
		if (node === target) {
			found = optional
			return
		}
		if (isIf(node) && node.mode === 'server') {
			const single = elseOf(node).length === 0
			for (const child of thenOf(node)) walk(child, optional || single)
			for (const child of elseOf(node)) walk(child, optional)
			return
		}
		for (const child of childNodes(node)) walk(child, optional)
	}
	walk(root, false)
	return found
}

/**
 * Does `target` sit inside a reactive conditional's arm (ADR 0037)? Such an
 * element is recreated from its arm template whenever the arm switches, so
 * no connect-time reference to it stays valid.
 */
export const inReactiveArm = (
	root: TemplateNode,
	target: TemplateNode,
): boolean => {
	let found = false
	walkTemplate(root, node => {
		if (found || node.kind !== 'conditional' || node.mode !== 'reactive') return
		found = node.arms.some(arm =>
			arm.children.some(child => someNode(child, n => n === target)),
		)
	})
	return found
}

/**
 * Every `first()` name a query may address, in source order — all but a
 * REQUIRED ref whose resolution was rejected. An optional ref stays
 * declared whatever its stage: setup code may read it.
 */
export const declaredRefNames = (
	firstRefs: ReadonlyMap<string, FirstRefDecl>,
): Set<string> =>
	new Set(
		[...firstRefs.values()]
			.filter(ref => ref.stage !== 'rejected' || !ref.required)
			.map(ref => ref.name),
	)
