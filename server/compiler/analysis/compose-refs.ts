/**
 * Registry-aware resolution of `first()` references that address COMPOSED
 * (PascalCase) children (LT-127, retiring composed-element `ref={}`).
 *
 * `first-refs.ts` resolves an author's selector against the component's own
 * RAW template elements inside `compileSource`, which is single-file: a
 * composed child's eventual DOM tag lives in another file's registry entry,
 * so a selector like `first('form-spinbutton.lightness')` cannot be decided
 * there. `compileSource` defers those (`firstRefs` stage `deferred`) and
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

import { diagnostic, type LocalDiagnostic } from '../diagnostics'
import { matchesAuthoredSelectorOn } from '../first-refs'
import type { ComponentIR, TemplateNode } from '../ir'
import type { RegistryEntry } from '../registry'
import { wordingOf } from '../surface'
import { allComposeNodes, composeStaticAttrs, refOf } from './selectors'

/* === Types === */

/**
 * The compose-reference resolution (ADR 0040 s5): `skipped` when no
 * `composeRegistry` was threaded (the registry-discovery pass), `resolved`
 * otherwise. `ambiguous` stays the already-reported channel — compose nodes
 * an ambiguous selector matched, reported here as LTC027, so
 * `emitComposeEffects` must not address them by tag or report them again.
 */
export type ComposeRefs =
	| { mode: 'skipped' }
	| {
			mode: 'resolved'
			registry: ReadonlyMap<string, RegistryEntry>
			unmatchedOptional: ReadonlyArray<{ name: string; selector: string }>
			ambiguous: ReadonlySet<TemplateNode>
	  }

/* === Exported Functions === */

/**
 * Resolve every deferred `first()` reference against the template's composed
 * elements, mutating the matched node's `attrs` exactly as `compiler.ts`
 * does for raw elements.
 *
 * Typed resolved-or-skipped (ADR 0040 s5, LT-289): with no
 * `composeRegistry` (the discovery pass) nothing is resolved and the result
 * says so, so a caller cannot read an empty `ambiguous` set as "checked, none
 * found" — it has to acknowledge the skip. The resolved result carries the
 * registry it resolved against.
 *
 * `unmatchedOptional` are the OPTIONAL refs that matched nothing:
 * legitimate, and queried from the authored selector verbatim, the same
 * treatment a `firstRefs` `unmatched` stage gets (LT-123). `ambiguous` are
 * the compose nodes an ambiguous selector matched — already reported here,
 * so `emitComposeEffects` must not ALSO address them by tag or report them
 * again: one authoring mistake, one diagnostic, and LTC027 is the one that
 * names the fix.
 */
export const resolveComposeRefs = (
	component: ComponentIR,
	diagnostics: LocalDiagnostic[],
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): ComposeRefs => {
	// No registry: this is the discovery pass. Resolving is impossible and
	// not needed — say nothing rather than reporting a false LTC026.
	if (!composeRegistry) return { mode: 'skipped' }
	const unmatchedOptional: Array<{ name: string; selector: string }> = []
	const ambiguous = new Set<TemplateNode>()
	const result: ComposeRefs = {
		mode: 'resolved',
		registry: composeRegistry,
		unmatchedOptional,
		ambiguous,
	}
	const deferred = [...component.firstRefs.values()].filter(
		ref => ref.stage === 'deferred',
	)
	if (deferred.length === 0) return result
	const nodes = allComposeNodes(component.root)
	for (const ref of deferred) {
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
			if (!ref.required) {
				unmatchedOptional.push({ name: ref.name, selector: ref.selector })
				continue
			}
			diagnostics.push(
				diagnostic.firstSelectorNotFound(
					component.source,
					ref.at,
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
					ref.at,
					ref.name,
					ref.selector,
					matches.length,
					wordingOf(component),
				),
			)
			continue
		}
		const target = matches[0] as (typeof nodes)[number]
		// The compose-site half of LT-132: same IR limitation, same
		// silence. `ref={}` made this shape unwritable; `first()` does
		// not, so it needs the same check the raw path got.
		const claimed = refOf(target)
		if (claimed && claimed.name !== ref.name) {
			diagnostics.push(
				diagnostic.firstSelectorDuplicate(
					component.source,
					ref.at,
					ref.name,
					ref.selector,
					claimed.name,
					component.firstRefs.get(claimed.name)?.at,
				),
			)
			continue
		}
		// A claimed ref bound to the SAME name is this pass's own earlier
		// attachment (LT-221 §1.4): the attachment rides the shared IR, so
		// a second `analyzeClient` over it — a test harness, a future
		// caller — re-finds it here. Re-attaching would be a duplicate
		// attr; reporting LTC041 would be a spurious error on the pass's
		// own work. Attach once, report once: idempotent re-analysis
		// attaches nothing and reports nothing. (Two distinct names on one
		// element remains the LTC041 above; a repeated const name is
		// invalid JS the generated module's own type-check catches.)
		if (!claimed) target.attrs.push({ kind: 'ref', name: ref.name })
	}
	return result
}
