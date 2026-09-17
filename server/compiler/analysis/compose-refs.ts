/**
 * Registry-aware resolution of `first()` references that address COMPOSED
 * (PascalCase) children (LT-127, retiring composed-element `ref={}`).
 *
 * `first-refs.ts` resolves an author's selector against the component's own
 * RAW template elements inside `compileSource`, which is single-file: a
 * composed child's eventual DOM tag lives in another file's registry entry,
 * so a selector like `first('form-spinbutton.lightness')` cannot be decided
 * there. `compileSource` defers those (`component.deferredComposeRefs`) and
 * this pass — the first point where `composeRegistry` is threaded — finishes
 * the job, attaching the same synthetic `{kind: 'ref', name}` the raw path
 * attaches. Everything downstream (`emitComposeEffects`'s `addQuery`, the
 * `refNames` walk in `plan.ts`) is unchanged; only the population moved.
 *
 * The registry-DISCOVERY pass runs with `composeRegistry === undefined` and
 * must keep tolerating that (the LT-015 tolerance `emitComposeEffects`
 * already applies): that pass only needs each component's own registry
 * entry, and erroring there would make discovery depend on its own output.
 */

import { type CompileDiagnostic, diagnostic } from '../diagnostics'
import { matchesAuthoredSelectorOn } from '../first-refs'
import type { ComponentIR, TemplateNode } from '../ir'
import type { RegistryEntry } from '../registry'
import { allComposeNodes, composeStaticAttrs } from './selectors'

/* === Exported Functions === */

/**
 * Resolve every deferred `first()` reference against the template's composed
 * elements, mutating the matched node's `attrs` exactly as `compiler.ts`
 * does for raw elements.
 *
 * `unmatchedOptional` are the OPTIONAL refs that matched nothing:
 * legitimate, and queried from the authored selector verbatim, the same
 * treatment `component.unmatchedOptionalRefs` gets (LT-123). `ambiguous` are
 * the compose nodes an ambiguous selector matched — already reported here,
 * so `emitComposeEffects` must not ALSO report them as unaddressed `pass`
 * sites (TSRX012): one authoring mistake, one diagnostic, and TSRX027 is
 * the one that names the fix.
 */
export const resolveComposeRefs = (
	component: ComponentIR,
	diagnostics: CompileDiagnostic[],
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): {
	unmatchedOptional: Array<{ name: string; selector: string }>
	ambiguous: Set<TemplateNode>
} => {
	const unmatchedOptional: Array<{ name: string; selector: string }> = []
	const ambiguous = new Set<TemplateNode>()
	const result = { unmatchedOptional, ambiguous }
	if (component.deferredComposeRefs.length === 0) return result
	// No registry: this is the discovery pass. Resolving is impossible and
	// not needed — say nothing rather than reporting a false TSRX026.
	if (!composeRegistry) return result
	const nodes = allComposeNodes(component.root)
	for (const ref of component.deferredComposeRefs) {
		const matches = nodes.filter(node => {
			const tag = composeRegistry.get(node.source)?.tag
			if (!tag) return false
			return (
				matchesAuthoredSelectorOn(
					{ tag, attrs: composeStaticAttrs(node) },
					ref.selector,
				) === true
			)
		})
		if (matches.length === 0) {
			if (ref.maybe) {
				unmatchedOptional.push({ name: ref.name, selector: ref.selector })
				continue
			}
			diagnostics.push(
				diagnostic.firstSelectorNotFound(
					component.source,
					ref.offset,
					ref.name,
					ref.selector,
				),
			)
			continue
		}
		if (matches.length > 1) {
			for (const node of matches) ambiguous.add(node)
			// The compose-site analog of `first-refs.ts`'s ambiguity check,
			// and the same requirement `composeDiscriminatorClause` states
			// for same-source siblings: a distinguishing static `class`/
			// `id`/`data-*` on the compose site.
			diagnostics.push(
				diagnostic.firstSelectorAmbiguous(
					component.source,
					ref.offset,
					ref.name,
					ref.selector,
					matches.length,
				),
			)
			continue
		}
		const target = matches[0] as (typeof nodes)[number]
		// The compose-site half of LT-132: same IR limitation, same
		// silence. `ref={}` made this shape unwritable; `first()` does
		// not, so it needs the same check the raw path got.
		const claimed = target.attrs.find(a => a.kind === 'ref')
		if (claimed) {
			diagnostics.push(
				diagnostic.firstSelectorDuplicate(
					component.source,
					ref.offset,
					ref.name,
					ref.selector,
					claimed.name,
				),
			)
			continue
		}
		target.attrs.push({ kind: 'ref', name: ref.name })
	}
	return result
}
