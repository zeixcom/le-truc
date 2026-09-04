/**
 * The server-evaluation tier classifier (ADR 0029, LT-165).
 *
 * `evaluability.ts` decides what the server can render; this module decides
 * WHICH MECHANISM should try. The two are the same analysis with opposite
 * polarity — every site that used to be a refusal (`TSRX004`, non-severe
 * `TSRX034`, `TSRX043`, and `TSRX013`'s two server-evaluation factories) is
 * now a *routing signal*, because "phase 1 cannot fold this" was never a
 * statement about the author's code. It was a statement about the harness.
 *
 * ## Two facts, deliberately separate
 *
 * Conflating them produces wrong answers in both directions, so ADR 0029
 * sub-design 1 defines them apart and so does this module:
 *
 * 1. **Unresolvability is a property of an EXPRESSION** — no server phase
 *    can produce its value. Two limbs: `stubbed-api` (every read routes
 *    through something `sim/patch-table.ts` declares unanswerable) and
 *    `not-a-server-fact` (the value is a function of the viewing moment or
 *    the build machine's ambient state — the wall clock, the RNG, a
 *    runtime-default locale). An unresolvable expression is omitted in
 *    EVERY tier, the Simulated tier included: executing `Date.now()` in the
 *    build's jsdom does not approximate the browser's answer, it bakes the
 *    build machine's clock into the served HTML for the life of the page.
 * 2. **Tier is a routing decision about a COMPONENT** — and the predicate
 *    is not "can phase 1 resolve everything" but "is phase 2 worth running".
 *
 * `module-ticker` is why they cannot be merged: it calls `Math.random()` and
 * is heavily `first()`-based. Classified Static-tier as a whole it would
 * discard everything the realm could resolve; classified Simulated-tier with
 * the random read folded it would bake a seed into the page. It is
 * Simulated-tier *with one suppressed expression*, an outcome that only
 * exists because unresolvability is per-expression.
 *
 * ## The soundness posture is asymmetric on purpose
 *
 * A component is Folded-tier only when phase 1 is provably total; any doubt
 * routes downward. A false Simulated classification costs ~1.1 ms. A false
 * Folded classification ships wrong HTML with no diagnostic. So the
 * classifier is sound, not complete, and the completeness gap is a build-time
 * cost rather than a correctness one (ADR 0029 sub-design 2).
 *
 * ## Why limb (a) reads the patch table
 *
 * The stub posture and the tier assignment are the same data. When the driver
 * gains a real capability, deleting that patch-table row re-routes the
 * affected expressions from unresolvable to realm-answerable, and their
 * components from the Static tier to the Simulated tier — automatically,
 * with no second list to keep in sync. Limb (b) has no such escape hatch by
 * construction: no driver capability can tell the build machine what time it
 * will be when the page is read.
 */

import type { TsrxNode } from '@tsrx/core'
import { isNode } from './ast-utils'
import { lineOf } from './diagnostics'
import { type ImpureAmbientCause, impureAmbientCauses } from './evaluability'
import {
	CAPABILITY_PATCHES,
	NETWORK_GLOBALS,
	STUB_GLOBALS,
} from './sim/patch-table'

/* === Types === */

/**
 * The three tiers of ADR 0029. Numbered in the ADR as 1/2/0 — the Static
 * tier sits BELOW the Folded tier because it resolves less, not more.
 */
export type EvaluationTier =
	/** Tier 1: template lowering + `runtime.ts`'s value harness. No jsdom. */
	| 'folded'
	/** Tier 2: phase-1 skeleton, then pre-play in the jsdom realm. */
	| 'simulated'
	/** Tier 0: phase-1 skeleton only; the client corrects at connect. */
	| 'static'

/** Which limb of sub-design 1 makes an expression unresolvable. */
export type UnresolvableLimb =
	/** (a) Every read routes through something the patch table stubs. */
	| 'stubbed-api'
	/** (b) The input is the viewing moment or the build machine's state. */
	| 'not-a-server-fact'

/** Whether some server phase can answer an unresolved expression. */
export type Resolution =
	/** The realm executes it for real against a simulated document. */
	| { by: 'realm' }
	/** No phase can answer it; omitted in every tier. */
	| { by: 'none'; limb: UnresolvableLimb; reason: string }

/**
 * One reason a component left the Folded tier.
 *
 * `origin` records which phase-1 refusal produced it, keeping the census
 * traceable to the analysis that decided it — and keeping the retired
 * diagnostic codes meaningful as provenance after they stop being
 * diagnostics (ADR 0029 sub-design 5).
 */
export type RoutingSignal = {
	origin: 'TSRX004' | 'TSRX013' | 'TSRX034' | 'TSRX043' | 'compose-read'
	/** The name or expression the signal is about, for the census line. */
	detail: string
	/** 1-based line in the `.tsrx` source, when known. */
	line?: number
	resolution: Resolution
}

/** A component's tier and the reasons behind it — one census record. */
export type TierClassification = {
	tag: string
	tier: EvaluationTier
	signals: readonly RoutingSignal[]
}

/* === Internal Functions === */

/**
 * Every global the patch table declares absent-and-stubbed or closed.
 * `REALM_GLOBALS` is deliberately excluded: those are the globals the realm
 * DOES provide, and reading one is precisely what makes a component
 * realm-answerable.
 */
const STUBBED_GLOBALS: ReadonlySet<string> = new Set([
	...STUB_GLOBALS.map(patch => patch.name),
	...NETWORK_GLOBALS.map(patch => patch.name.split('.')[0] ?? patch.name),
])

/** Capability rows keyed by member name, for the member-read check. */
const UNANSWERABLE_MEMBERS = new Map(
	CAPABILITY_PATCHES.map(patch => [patch.member, patch]),
)

/** Census copy for each unresolvable impurity, in the table's own terms. */
const IMPURITY_REASONS: Record<ImpureAmbientCause, string> = {
	date: 'reads the wall clock, which is a fact about the viewing moment',
	rng: 'reads the RNG, which has no server answer to bake in',
	'locale-method':
		'formats through a locale/timezone-reading method, so the value is the build machine’s',
	'intl-default-locale':
		'resolves its locale to the runtime default, which is the build machine’s own setting',
	'intl-dom-locale':
		'reads its locale from the DOM — realm-answerable, never unresolvable',
}

/* === Exported Functions === */

/**
 * The optional `line` field, spread-ready. `exactOptionalPropertyTypes` is
 * on, so an explicit `line: undefined` is a type error rather than an
 * absent field — this keeps every signal-construction site from repeating
 * the same ternary.
 */
export const lineFields = (
	source: string,
	offset: number | undefined,
): { line?: number } => {
	const line = lineOf(source, offset)
	return line === undefined ? {} : { line }
}

/**
 * Whether `node` reads something the realm cannot answer — limb (a).
 *
 * Two shapes, both sourced from `sim/patch-table.ts`:
 * - a free identifier naming a stubbed or closed global (`ResizeObserver`,
 *   `matchMedia`, `fetch`);
 * - a member read the realm answers WRONG rather than not at all
 *   (`el.scrollWidth` → a silent zero, `internals.states` → absent).
 *
 * Returns the patch-table `note` as the reason so the census explains
 * itself in the table's own words rather than a paraphrase that can drift.
 */
export const stubbedApiRead = (node: TsrxNode): string | null => {
	let reason: string | null = null
	const visit = (current: unknown): void => {
		if (reason !== null) return
		if (Array.isArray(current)) {
			for (const child of current) visit(child)
			return
		}
		if (!isNode(current)) return
		if (
			current.type === 'Identifier' &&
			STUBBED_GLOBALS.has(String(current.name))
		) {
			reason = `\`${String(current.name)}\` is stubbed in the simulation realm`
			return
		}
		if (current.type === 'MemberExpression' && !current.computed) {
			const property = current.property
			if (isNode(property) && property.type === 'Identifier') {
				const patch = UNANSWERABLE_MEMBERS.get(String(property.name))
				// A capability row scoped to a receiver only fires on that
				// receiver: `internals.states` is unanswerable, a component's own
				// `states` const is not.
				const object = current.object
				const receiverMatches =
					patch?.receiver === undefined ||
					(isNode(object) &&
						object.type === 'Identifier' &&
						String(object.name) === patch.receiver)
				if (patch && receiverMatches) {
					reason = `\`${String(property.name)}\`: ${patch.note}`
					return
				}
			}
		}
		for (const [key, value] of Object.entries(current)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			if (value && typeof value === 'object') visit(value)
		}
	}
	visit(node)
	return reason
}

/**
 * Decide whether an unresolved expression has a server answer anywhere.
 *
 * Limb (a) is checked before limb (b) only because its reason is more
 * specific; an expression matching both is unresolvable either way.
 */
export const resolutionOf = (
	node: TsrxNode,
	scope: ReadonlySet<string>,
): Resolution => {
	const stubbed = stubbedApiRead(node)
	if (stubbed !== null)
		return { by: 'none', limb: 'stubbed-api', reason: stubbed }
	const causes = impureAmbientCauses(node, scope)
	// LT-142's three-way split (ADR 0029 sub-design 5): only SOME impurity is
	// unresolvable. An `Intl` call whose locale is read from the DOM is impure
	// for folding — the value harness has no document — but the realm executes
	// that read against a real simulated element, so it is a Simulated-tier
	// routing signal rather than an omitted expression.
	const unresolvable = causes.filter(cause => cause !== 'intl-dom-locale')
	if (unresolvable.length > 0)
		return {
			by: 'none',
			limb: 'not-a-server-fact',
			reason: IMPURITY_REASONS[unresolvable[0] as ImpureAmbientCause],
		}
	// Everything else the harness could not fold, the realm executes for real
	// against a simulated document — which is the whole point of tier 2.
	return { by: 'realm' }
}

/**
 * Route a component from its routing signals — the conjunction of ADR 0029
 * sub-design 1's table, not a single predicate.
 *
 * | | phase 1 resolves everything | realm can answer the rest | all unresolvable |
 * | --- | --- | --- | --- |
 * | tier | folded | simulated | static |
 *
 * The Static tier is the degenerate case: every unresolved expression is
 * unresolvable, so no mechanism needs to run at all.
 */
export const classifyTier = (
	signals: readonly RoutingSignal[],
): EvaluationTier => {
	if (signals.length === 0) return 'folded'
	return signals.some(signal => signal.resolution.by === 'realm')
		? 'simulated'
		: 'static'
}

/**
 * Propagate composition contamination to a fixpoint — ADR 0029 sub-design 3.
 *
 * Contamination happens on READS, never on containment. A Folded-tier or
 * Static-tier parent that merely embeds a Simulated-tier child stays in its
 * own tier and splices the child's already-rendered markup: the compose
 * graph renders children before parents (ADR 0027 sub-design 2), so the
 * child's string exists by the time the parent needs it. Only a `first()`
 * addressing a compose site, or a `truc:pass={{ }}` into it, leaves phase 1
 * without an answer the child's markup alone supplies.
 *
 * Containment-based contamination was measured and rejected: with page
 * chrome in the compose graph (`module-scrollarea` at 2,091 occurrences,
 * `module-codeblock` at 299) it drags nearly the whole corpus into the realm
 * and reproduces the unconditional cost tiering exists to avoid.
 *
 * A parent reading a Static-tier child becomes Simulated-tier, not
 * Static-tier: the child's own expressions are unresolvable, but the
 * parent's read of the rendered site is an ordinary DOM question the realm
 * answers. Only a parent with no realm-answerable signal of its own stays
 * Static.
 *
 * @param classifications - per-tag classification from the first pass
 * @param composeReads - tags this tag READS at a compose site (not merely
 *   contains), from the registry-aware pass where `analysis/compose-refs.ts`
 *   already resolves compose-site references
 */
export const contaminateComposeReads = (
	classifications: ReadonlyMap<string, TierClassification>,
	composeReads: (tag: string) => readonly string[],
): Map<string, TierClassification> => {
	const result = new Map(classifications)
	let changed = true
	// Fixpoint rather than one pass: a read chain A → B → C only settles when
	// C's tier has finished moving, and the compose graph is not ordered.
	while (changed) {
		changed = false
		for (const [tag, classification] of result) {
			if (classification.tier === 'simulated') continue
			for (const child of composeReads(tag)) {
				const childTier = result.get(child)?.tier
				if (childTier === undefined || childTier === 'folded') continue
				const signal: RoutingSignal = {
					origin: 'compose-read',
					detail: `reads composed <${child}> (${childTier}-tier) at a compose site`,
					resolution: { by: 'realm' },
				}
				const signals = [...classification.signals, signal]
				result.set(tag, {
					...classification,
					tier: classifyTier(signals),
					signals,
				})
				changed = true
				break
			}
		}
	}
	return result
}
