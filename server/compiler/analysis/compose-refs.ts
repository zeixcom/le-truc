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

import { childrenInsertionsOf } from '../children-region'
import { diagnostic, type LocalDiagnostic } from '../diagnostics'
import {
	inReconcileItem,
	matchesAuthoredSelectorOn,
	namesDeclaredRole,
} from '../first-refs'
import type { ComponentIR, TemplateNode } from '../ir'
import type { InternalRegistryEntry } from '../registry'
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
			registry: ReadonlyMap<string, InternalRegistryEntry>
			/**
			 * Refs that matched nothing — optional ones (LT-123) and
			 * role-addressed ones, required included (ADR 0048 s2, LT-474
			 * review). `required` picks the query cardinality: a required
			 * one throws the existing `MissingElementError` at connect when
			 * the queried markup is absent, an optional one stays silent.
			 */
			unmatched: ReadonlyArray<{
				name: string
				selector: string
				required: boolean
			}>
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
 * `unmatched` are the refs that matched nothing — legitimate, and queried
 * from the authored selector verbatim, the same treatment a `firstRefs`
 * `unmatched` stage gets (LT-123); `required` on each decides the query's
 * cardinality (ADR 0048 s2, LT-474 review). `ambiguous` are
 * the compose nodes an ambiguous selector matched — already reported here,
 * so `emitComposeEffects` must not ALSO address them by tag or report them
 * again: one authoring mistake, one diagnostic, and LTC027 is the one that
 * names the fix.
 */
export const resolveComposeRefs = (
	component: ComponentIR,
	diagnostics: LocalDiagnostic[],
	composeRegistry?: ReadonlyMap<string, InternalRegistryEntry>,
): ComposeRefs => {
	// No registry: this is the discovery pass. Resolving is impossible and
	// not needed — say nothing rather than reporting a false LTC026.
	if (!composeRegistry) return { mode: 'skipped' }
	const unmatched: Array<{
		name: string
		selector: string
		required: boolean
	}> = []
	const ambiguous = new Set<TemplateNode>()
	const result: ComposeRefs = {
		mode: 'resolved',
		registry: composeRegistry,
		unmatched,
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
			// The reach-in check (ADR 0048 s2, LTC083) on the deferred leg: the
			// selector matched no raw element (why it was deferred, LT-127) and
			// no composed child either, so in a template that inserts
			// `{children}` it can only resolve inside the content a parent
			// passes — a reach-in unless its subject names a declared role. An
			// unreadable roles declaration changes the fix, not the verdict
			// (LT-474 review).
			const insertions = childrenInsertionsOf(component.root)
			const inserts =
				insertions.holders.size > 0 ||
				insertions.forwards.size > 0 ||
				insertions.unmarked
			const declared = namesDeclaredRole(
				ref.selector,
				new Set(component.childrenContract?.roles.keys() ?? []),
			)
			if (inserts && declared === false) {
				diagnostics.push(
					diagnostic.childrenReachIn(
						component.source,
						ref.at,
						'first',
						ref.name,
						ref.selector,
						component.childrenContract?.unreadable === true,
					),
				)
				continue
			}
			// A role-addressed reference resolves inside the content a parent
			// passes (ADR 0048 s2), so — in a template that inserts
			// `{children}` — a no-match here is expected for it, required
			// or optional (LT-474 review): the client queries the authored
			// selector from the host — the region re-include finds the
			// element inside the content (ADR 0048 s1) — and a required
			// one throws the existing `MissingElementError` with the
			// authored reason when the parent passes no such element.
			// Without an insertion the content can never arrive, so the
			// bypass does not apply (review 2): a required reference
			// falls through to LTC026, an optional one to LT-123's
			// silence.
			if (inserts && declared === true) {
				unmatched.push({
					name: ref.name,
					selector: ref.selector,
					required: ref.required,
				})
				continue
			}
			if (!ref.required) {
				unmatched.push({
					name: ref.name,
					selector: ref.selector,
					required: false,
				})
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
		// A host-level `first()` into a reactive-list item is ADR 0046 s1's
		// remaining refusal: the item's elements are recreated on every
		// reconcile, so the connect-time reference goes stale (LT-423).
		const itemOutputs = [...component.fors.values()]
			.filter(l => l.kind === 'reconcile')
			.map(l => l.output)
		const inItem = matches.find(node => inReconcileItem(itemOutputs, node))
		if (inItem) {
			diagnostics.push(
				diagnostic.unsupported(
					component.source,
					ref.at,
					`A \`first()\` reference to <${composeRegistry.get(inItem.source)?.tag ?? inItem.component}> inside a reactive-list loop body`,
					"The item's elements exist once per item and are recreated on every reconcile, so a reference taken at connect goes stale — bind the element from inside the item instead (an event handler or a reactive attribute on it).",
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
