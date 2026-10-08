/**
 * Template-output resolution, shared by both front ends (LT-202, ADR 0032
 * sub-design 6: the anti-drift half of the dual front-end contract): the
 * root element, the `<style>` block, the CSS, and the `first()`/`all()`
 * element-reference resolution against the lowered template. Front-end-
 * neutral like the other front-end stage modules: no parser values, only
 * the loose `AstNode` type.
 */

import type { AstNode } from './ast-node'
import { forEachFreeIdentifier } from './ast-utils'
import { childrenInsertionsOf } from './children-region'
import { dedentCss, parseComponentSheet } from './css'
import { type ContractFinding, checkSheetContract } from './css-scope'
import type { LocalDiagnostic, Site, StyleBlockRefusal } from './diagnostics'
import { diagnostic } from './diagnostics'
import type { ExtractContext } from './extract-context'
import {
	collectMatchingElements,
	inOptionalBranch,
	inReactiveArm,
	inReconcileItem,
	namesCustomElementTag,
	namesDeclaredRole,
	reportStaticIds,
	shareExclusiveIf,
} from './first-refs'
import { claimMarker } from './imports'
import type {
	ComponentSheet,
	FirstRefDecl,
	FirstRefStage,
	ForIR,
	TemplateNode,
} from './ir'
import type { SetupExtraction } from './setup-extraction'
import { wordingOf } from './surface'
import { walkTemplate } from './walk'

/**
 * A surface's read of its `<style>` block: the raw CSS text (empty for an
 * empty block), or why the content is not a stylesheet (LTC078, LT-444).
 */
export type StylesheetRead = string | StyleBlockRefusal

/** Template-output resolution: the root, the style block, the CSS and the parsed sheet. */
export type ResolvedTemplate = {
	root: TemplateNode & { kind: 'element' }
	styleChild: (TemplateNode & { kind: 'element' }) | null
	css: string
	/**
	 * The stylesheet's raw text (undedented), when a non-empty style block
	 * exists — the text `sheet`'s locs resolve against, and the slice the
	 * scoped emission partitions (LT-304).
	 */
	sheetText: string | null
	/** The parsed stylesheet (ADR 0033 s9), null when absent or unparseable. */
	sheet: ComponentSheet | null
	firstRefs: Map<string, FirstRefDecl>
}

/**
 * Resolve the lowered template output: the root element (which must be the
 * component's custom element tag), the optional `<style>` block, and the
 * `first()`/`all()` element-reference resolution (LT-055) against that
 * template — structurally matching each author selector and attaching a
 * synthetic `{kind: 'ref', name}` to every matched element, the exact IR
 * shape `ref={}` used to populate directly. Every downstream consumer
 * (addQuery's naming in `analysis/effects.ts` and `analysis/harvest.ts`,
 * refNames collection in `analysis/plan.ts`) is unchanged: only how that IR
 * gets populated moved. Also runs LTC042 (LT-131, static ids duplicate per
 * instance) and resolves the stylesheet: the dedented verbatim text for
 * emission, and its `lightningcss` parse (`ComponentIR.sheet`, ADR 0033
 * s9) with LTC064 (no parse) and LTC065 (declaration grammar) reported
 * against the authored source.
 *
 * Since LT-375 (ADR 0032 s1) the output is a single root element, and the
 * `<style>` block — the stylesheet — is a direct child of that root. This
 * pass HOISTS the first such child out of the root's children before
 * anything else reads the template, so the sheet resolution is unchanged
 * from the days when the block rode beside the root in a fragment. Every
 * other `<style>` element — a second direct child, or one nested in a
 * descendant — is refused (LTC073, LT-417) rather than left in place: it
 * would reach the emitters as an empty `<style></style>` with its CSS
 * dropped.
 *
 * `outputShapeLabel` names the surface's output shape in the no-root
 * message: `the @{ } output` (.tsrx) / `the template return` (.tsx).
 * Returns null (with the diagnostic pushed) when no root element exists.
 */
export const resolveTemplateOutput = (
	ctx: ExtractContext,
	filename: string,
	extraction: SetupExtraction,
	lowered: TemplateNode[],
	stylesheetOf: (ctx: ExtractContext, node: AstNode) => StylesheetRead,
	outputShapeLabel: string,
	/** The lowered loops, for the host-level `first()`-into-an-item check. */
	fors: ReadonlyMap<AstNode, ForIR> = new Map(),
): ResolvedTemplate | null => {
	const source = ctx.source
	const root = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } => n.kind === 'element',
	)
	if (!root) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				undefined,
				`${filename}: no root element found in ${outputShapeLabel}.`,
			),
		)
		return null
	}
	if (!root.tag.includes('-')) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				root.node,
				`${filename}: the root element must be the component's custom element tag (got \`${root.tag}\`).`,
			),
		)
		return null
	}

	// Hoist the `<style>` block out of the root's children (LT-375, ADR 0032
	// s1): it is the component's stylesheet, never rendered markup. First
	// direct `style` child wins, as the fragment days' top-level find did.
	const styleIndex = root.children.findIndex(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && n.tag === 'style',
	)
	const styleChild =
		styleIndex >= 0
			? (root.children.splice(styleIndex, 1)[0] as TemplateNode & {
					kind: 'element'
				})
			: null
	// LTC073 (LT-417): the hoisted child is the only accepted `<style>`.
	// Any left in the tree — a second direct child, or one nested in a
	// descendant (composed content included) — would render empty, its CSS
	// silently dropped.
	walkTemplate(root, (node, parent) => {
		if (node.kind === 'element' && node.tag === 'style') {
			ctx.diagnostics.push(
				diagnostic.misplacedStyleBlock(source, node.node, parent !== root),
			)
			// Its `css` tag is this refusal's, not a stray marker (LT-429).
			forEachFreeIdentifier(node.node, identifier =>
				claimMarker(ctx, identifier),
			)
		}
	})

	// LTC078 (LT-444): the hoisted child's content must be a stylesheet
	// spelling — anything else would read as an empty sheet, the component
	// shipping no CSS without a word.
	const sheetRead = styleChild ? stylesheetOf(ctx, styleChild.node) : ''
	let sheetText = ''
	if (typeof sheetRead === 'string') sheetText = sheetRead
	else
		ctx.diagnostics.push(
			diagnostic.unreadableStyleBlock(source, sheetRead, wordingOf(ctx)),
		)

	// Resolve `first(selector, required)` element references (LT-055) now
	// that `root` exists. The reach-in check (LTC083) needs the `{children}`
	// insertions once per template.
	const insertions = childrenInsertionsOf(root)
	const insertsChildren =
		insertions.holders.size > 0 ||
		insertions.forwards.size > 0 ||
		insertions.unmarked
	const firstRefs = new Map<string, FirstRefDecl>()
	for (const [
		refName,
		{ selectorText, reasonText, maybe, node },
	] of extraction.elementRefs) {
		const resolve = (stage: FirstRefStage): void => {
			firstRefs.set(refName, {
				name: refName,
				selector: selectorText,
				required: !maybe,
				reason: reasonText,
				stage,
				at: { start: node.start, end: node.end },
			})
		}
		const { elements } = collectMatchingElements(root, selectorText)
		if (elements.length === 0 && namesCustomElementTag(selectorText)) {
			// A selector naming a custom-element tag that matched no raw
			// element may still address a COMPOSED child, whose tag this
			// single-file pass cannot know (LT-127). Defer the whole
			// decision — match, no match, ambiguity — to the pass that
			// has the compose registry; deciding here would mean
			// rejecting a selector that is about to resolve.
			resolve('deferred')
			continue
		}
		if (elements.length === 0) {
			// The reach-in check (ADR 0048 s2, LTC083): a selector that
			// matches nothing here, in a template that inserts `{children}`,
			// can only resolve inside the content a parent passes — unless
			// its subject names a declared role, the one surface the child
			// may address that content through. Fires for required and
			// optional references alike, before LT-123's optional silence.
			// An unreadable roles declaration changes the fix, not the
			// verdict (LT-474 review): the compiler cannot claim a role the
			// author may have declared in it is missing.
			const roles = ctx.childrenContract?.roles
			const declared = namesDeclaredRole(
				selectorText,
				new Set(roles?.keys() ?? []),
			)
			if (insertsChildren && declared === false) {
				ctx.diagnostics.push(
					diagnostic.childrenReachIn(
						source,
						node,
						'first',
						refName,
						selectorText,
						ctx.childrenContract?.unreadable === true,
					),
				)
				resolve('rejected')
				continue
			}
			// A role-addressed reference resolves inside the content a
			// parent passes (ADR 0048 s2), so a no-match here is expected
			// for it, required or optional (LT-474 review): the client
			// queries the authored selector from the host — the region
			// re-include finds the element inside the content (ADR 0048
			// s1) — and a required one throws the existing
			// `MissingElementError` with the authored reason when the
			// parent passes no such element.
			if (declared === true) {
				resolve('unmatched')
				continue
			}
			// An OPTIONAL ref is allowed to match nothing here
			// (LT-123): "may be absent" includes "the page, not
			// this template, authors it". The structural proof
			// LTC026 rests on — the compiler wrote this HTML,
			// so counting matches in the IR is counting matches
			// in the DOM — simply has nothing to say about
			// markup the component didn't render, so the client
			// queries the authored selector as-is.
			if (maybe) {
				resolve('unmatched')
				continue
			}
			ctx.diagnostics.push(
				diagnostic.firstSelectorNotFound(source, node, refName, selectorText),
			)
			resolve('rejected')
			continue
		}
		// A REQUIRED ref (two literals) whose only match sits in
		// a branch that may not render is required in name only
		// — the analysis addresses it with a non-throwing query
		// under a presence guard either way (LT-008/LT-025), so
		// the authored reason can never be thrown. Say so
		// rather than dropping the string silently: for a
		// template-OWNING component the compiler controls the
		// markup, so a required-reason only ever earns its keep
		// on a selector that may match markup this component
		// did not itself render.
		// An element in a reactive conditional's arm is recreated on every
		// arm switch (ADR 0037 s3): a reference taken at connect goes stale.
		const inArm = elements.find(el => inReactiveArm(root, el))
		if (inArm) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					source,
					node,
					`A \`first()\` reference to <${inArm.tag}> inside a reactive conditional's arm`,
					"The arm's elements are cloned anew each time the arm renders, so a reference taken at connect goes stale — bind the element from inside the arm instead (an event handler or a reactive attribute on it).",
				),
			)
			resolve('rejected')
			continue
		}
		// The same staleness inside a reactive-list item (ADR 0046 s1): an
		// item's elements exist once per item and are recreated on every
		// reconcile — the host-level reference would bind the first item's.
		const itemOutputs = [...fors.values()]
			.filter(l => l.kind === 'reconcile')
			.map(l => l.output)
		const inItem = elements.find(el => inReconcileItem(itemOutputs, el))
		if (inItem) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					source,
					node,
					`A \`first()\` reference to <${inItem.tag}> inside a reactive-list loop body`,
					"The item's elements exist once per item and are recreated on every reconcile, so a reference taken at connect goes stale — bind the element from inside the item instead (an event handler or a reactive attribute on it).",
				),
			)
			resolve('rejected')
			continue
		}
		if (!maybe && elements.every(el => inOptionalBranch(root, el)))
			ctx.diagnostics.push(
				diagnostic.deadRequiredReason(source, node, refName, selectorText),
			)
		if (elements.length > 1 && !shareExclusiveIf(root, elements)) {
			ctx.diagnostics.push(
				diagnostic.firstSelectorAmbiguous(
					source,
					node,
					refName,
					selectorText,
					elements.length,
					wordingOf(ctx),
				),
			)
			resolve('rejected')
			continue
		}
		// Two `first()` names resolving to the same element is a
		// mistake the IR cannot represent (LT-132): `attrs` is a
		// list, but every consumer reads the ref with `.find()`,
		// so the second name would silently never become a query.
		const claimed = elements.flatMap(el => el.attrs).find(a => a.kind === 'ref')
		if (claimed) {
			ctx.diagnostics.push(
				diagnostic.firstSelectorDuplicate(
					source,
					node,
					refName,
					selectorText,
					claimed.name,
					extraction.elementRefs.get(claimed.name)?.node,
				),
			)
			resolve('rejected')
			continue
		}
		for (const element of elements)
			element.attrs.push({
				kind: 'ref',
				name: refName,
				selector: selectorText,
			})
		resolve('matched')
	}

	// LTC042 (LT-131): a constant `id` in a template duplicates as
	// soon as a page places the component twice. Runs here, beside
	// LTC039, for the same reason — the walk needs `root`.
	reportStaticIds(root, source, ctx.diagnostics)

	// CSS: verbatim, dedented for emission (LT-268 changes no output), and
	// parsed into the sheet the IR carries (ADR 0033 s9) — with the
	// spec-grammar faces of LTC064/LTC065 reported against the authored source.
	let sheet: ComponentSheet | null = null
	if (styleChild) {
		if (sheetText.trim()) {
			const parsed = parseComponentSheet(sheetText)
			// The sheet text is a verbatim slice of the source (the template
			// literal's raw slice on `.tsx`, the tag's inner text on
			// `.tsrx`), so the sheet offset maps onto the authored offset —
			// undefined only if the slice cannot be relocated.
			const sheetStart = source.indexOf(sheetText, styleChild.node.start)
			for (const sheetError of parsed.errors) {
				const authoredOffset = authoredRange(sheetStart, sheetError)
				switch (sheetError.face) {
					case 'syntax':
						ctx.diagnostics.push(
							diagnostic.malformedStyleSheet(
								source,
								authoredOffset,
								sheetError.detail,
							),
						)
						break
					case 'unknown-property':
						ctx.diagnostics.push(
							diagnostic.unknownCssProperty(
								source,
								authoredOffset,
								sheetError.property ?? '',
							),
						)
						break
					case 'invalid-value':
						ctx.diagnostics.push(
							diagnostic.invalidCssValue(
								source,
								authoredOffset,
								sheetError.property ?? '',
								sheetError.value ?? '',
							),
						)
						break
				}
			}
			sheet = parsed.sheet
			// The platform-CSS authored form (ADR 0033 s6, LT-501): the checks
			// run over the parsed sheet only — a sheet lightningcss refused
			// is already LTC064's — and report against the authored source.
			if (sheet) {
				const findings = checkSheetContract(sheet, sheetText, root.tag)
				for (const finding of findings)
					ctx.diagnostics.push(
						contractDiagnostic(source, sheetStart, finding, root.tag),
					)
			}
		}
	}
	const css = styleChild ? dedentCss(sheetText) : ''
	const hasSheet = sheetText.trim() !== '' && sheet !== null

	return {
		root,
		styleChild,
		css,
		sheetText: hasSheet ? sheetText : null,
		sheet,
		firstRefs,
	}
}

/**
 * Lift a sheet finding's range into the authored source (ADR 0044 s2):
 * the sheet text is a verbatim slice, so offsets shift by where it starts.
 * Undefined — the whole file — only when the slice cannot be relocated or
 * the parser gave no position.
 */
export const authoredRange = (
	sheetStart: number,
	finding: { offset?: number | undefined; end?: number | undefined },
): Site =>
	sheetStart >= 0 && finding.offset !== undefined
		? {
				start: sheetStart + finding.offset,
				end: sheetStart + (finding.end ?? finding.offset),
			}
		: undefined

/**
 * Map one stylesheet contract finding (ADR 0033 s6, LT-501) onto its
 * diagnostic: the sheet offset lifts into the authored source when the
 * slice relocated, and each face names its own builder.
 */
const contractDiagnostic = (
	source: string,
	sheetStart: number,
	finding: ContractFinding,
	tag: string,
): LocalDiagnostic => {
	const authoredOffset = authoredRange(sheetStart, finding)
	switch (finding.face) {
		case 'own-tag-led':
			return diagnostic.ownTagLedRule(source, authoredOffset, tag)
		case 'slotted':
			return diagnostic.slottedInLightDom(source, authoredOffset)
		case 'host-context':
			return diagnostic.hostContextSelector(source, authoredOffset)
		case 'host':
			return diagnostic.hostSelector(source, authoredOffset)
		case 'global':
			return diagnostic.globalSelector(source, authoredOffset)
		case 'dead-by-limit':
			return diagnostic.deadByLimit(
				source,
				authoredOffset,
				finding.selector,
				finding.limit ?? '',
			)
		case 'unscoped':
			return diagnostic.unscopedRule(
				source,
				authoredOffset,
				finding.selector,
				tag,
			)
	}
}
