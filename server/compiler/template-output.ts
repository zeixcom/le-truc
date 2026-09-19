/**
 * Template-output resolution, shared by both front ends (LT-202, ADR 0032
 * sub-design 6: the anti-drift half of the dual front-end contract): the
 * root element, the `<style>` block, the CSS, and the `first()`/`all()`
 * element-reference resolution against the lowered template. Front-end-
 * neutral like the other front-end stage modules: no parser values, only
 * the loose `AstNode` type.
 */

import type { AstNode } from './ast-node'
import { dedentCss } from './css'
import { diagnostic } from './diagnostics'
import {
	collectMatchingElements,
	inOptionalBranch,
	namesCustomElementTag,
	reportStaticIds,
	shareExclusiveIf,
} from './first-refs'
import type { ExtractContext, TemplateNode } from './ir'
import type { SetupExtraction } from './setup-extraction'

/** Template-output resolution: the root, the style block, and the CSS. */
export type ResolvedTemplate = {
	root: TemplateNode & { kind: 'element' }
	styleChild: (TemplateNode & { kind: 'element' }) | null
	css: string
	refReasons: Map<string, string>
	unmatchedOptionalRefs: Array<{ name: string; selector: string }>
	deferredComposeRefs: Array<{
		name: string
		selector: string
		maybe: boolean
		offset: number | undefined
	}>
	optionalRefs: Set<string>
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
 * instance) and extracts the CSS verbatim via `stylesheetOf`.
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
	stylesheetOf: (node: AstNode) => string,
	outputShapeLabel: string,
): ResolvedTemplate | null => {
	const source = ctx.source
	const templateRoot = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && n.tag !== 'style',
	)
	const styleChild =
		lowered.find(
			(n): n is TemplateNode & { kind: 'element' } =>
				n.kind === 'element' && n.tag === 'style',
		) ?? null
	const root = templateRoot ?? null
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
				root.node.start,
				`${filename}: the root element must be the component's custom element tag (got \`${root.tag}\`).`,
			),
		)
		return null
	}

	// Resolve `first(selector, required)` element references (LT-055) now
	// that `root` exists.
	const refReasons = new Map<string, string>()
	const unmatchedOptionalRefs: Array<{ name: string; selector: string }> = []
	const deferredComposeRefs: Array<{
		name: string
		selector: string
		maybe: boolean
		offset: number | undefined
	}> = []
	for (const [
		refName,
		{ selectorText, reasonText, maybe, node },
	] of extraction.elementRefs) {
		const { elements } = collectMatchingElements(root, selectorText)
		if (elements.length === 0 && namesCustomElementTag(selectorText)) {
			// A selector naming a custom-element tag that matched no raw
			// element may still address a COMPOSED child, whose tag this
			// single-file pass cannot know (LT-127). Defer the whole
			// decision — match, no match, ambiguity — to the pass that
			// has the compose registry; deciding here would mean
			// rejecting a selector that is about to resolve.
			deferredComposeRefs.push({
				name: refName,
				selector: selectorText,
				maybe,
				offset: node.start,
			})
			refReasons.set(refName, reasonText as string)
			continue
		}
		if (elements.length === 0) {
			// An OPTIONAL ref is allowed to match nothing here
			// (LT-123): "may be absent" includes "the page, not
			// this template, authors it". The structural proof
			// LTC026 rests on — the compiler wrote this HTML,
			// so counting matches in the IR is counting matches
			// in the DOM — simply has nothing to say about
			// markup the component didn't render, so the client
			// queries the authored selector as-is.
			if (maybe) {
				unmatchedOptionalRefs.push({
					name: refName,
					selector: selectorText,
				})
				continue
			}
			ctx.diagnostics.push(
				diagnostic.firstSelectorNotFound(
					source,
					node.start,
					refName,
					selectorText,
				),
			)
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
		if (!maybe && elements.every(el => inOptionalBranch(root, el)))
			ctx.diagnostics.push(
				diagnostic.deadRequiredReason(
					source,
					node.start,
					refName,
					selectorText,
				),
			)
		if (elements.length > 1 && !shareExclusiveIf(root, elements)) {
			ctx.diagnostics.push(
				diagnostic.firstSelectorAmbiguous(
					source,
					node.start,
					refName,
					selectorText,
					elements.length,
				),
			)
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
					node.start,
					refName,
					selectorText,
					claimed.name,
				),
			)
			continue
		}
		for (const element of elements)
			element.attrs.push({ kind: 'ref', name: refName })
		refReasons.set(refName, reasonText as string)
	}

	// LTC042 (LT-131): a constant `id` in a template duplicates as
	// soon as a page places the component twice. Runs here, beside
	// LTC039, for the same reason — the walk needs `root`.
	reportStaticIds(root, source, ctx.diagnostics)

	// CSS: verbatim, dedented (see css.ts).
	const css = styleChild ? dedentCss(stylesheetOf(styleChild.node)) : ''

	return {
		root,
		styleChild,
		css,
		refReasons,
		unmatchedOptionalRefs,
		deferredComposeRefs,
		optionalRefs: new Set(
			[...extraction.elementRefs]
				.filter(([, entry]) => entry.maybe)
				.map(([name]) => name),
		),
	}
}
