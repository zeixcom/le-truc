/**
 * What the realm cannot answer — the classifier-facing half of the former
 * `sim/patch-table.ts` (ADR 0035 sub-design 3 limb 2, LT-263).
 *
 * The patch table had two audiences reading one module. The APPLIER needs
 * per-runtime shapes: which stub a missing `ResizeObserver` gets, whether a
 * native `requestAnimationFrame` must be forced over, how a closed `fetch`
 * is spelled. Those stay with the driver (`sim/patch-table.ts`). The
 * CLASSIFIER needs something much smaller and substrate-independent: the
 * NAMES of the globals no realm answers, the member reads a realm answers
 * wrong, and the census copy for each. Those are here, compiler-side, so
 * `tier.ts` classifies and the census prints with no substrate installed
 * (ADR 0034 sub-design 5).
 *
 * ## The delete-a-row property still holds
 *
 * ADR 0029 kept the capability rows in the patch table so that deleting a
 * row re-routes the affected components from the Static tier to the
 * Simulated tier automatically, with no second list to keep in sync. That
 * property is about there being ONE list, not about which file it is in —
 * and it survives the move intact, because the applier never reads these
 * rows. A driver that gains real layout deletes rows here.
 *
 * `sim/patch-table.ts` is held to {@link UNANSWERABLE_GLOBALS} by a driver
 * test rather than by a shared literal: the two lists answer different
 * questions about the same names, and deriving one from the other would
 * make both unreadable.
 */

/* === Types === */

/**
 * A global no realm answers — absent and stubbed inert (`ResizeObserver`,
 * `matchMedia`) or present and deliberately closed (`fetch` and the other
 * network globals, ADR 0027 sub-design 2d).
 *
 * Reading one is what makes an expression unresolvable under limb (a) of
 * ADR 0029 sub-design 1. Only the NAME is classifier business; what the
 * driver puts in its place is not.
 */
export type UnanswerableGlobal = {
	/** Global name as authored. A dotted name (`navigator.sendBeacon`) is
	 * matched on its root identifier, which is all a free-identifier scan
	 * can see. */
	name: string
	/** `stub` — absent from the realm; `network` — present but closed. */
	kind: 'stub' | 'network'
	/** Why this one is unanswerable, in the census's words. */
	note?: string
}

/**
 * A MEMBER read the realm cannot answer, even though the global carrying it
 * is present (ADR 0029 sub-design 1 limb (a); the capability-row shape ADR
 * 0026 §2's amendment requires).
 *
 * {@link UnanswerableGlobal} describes globals that are absent or closed, so
 * a missing NAME is the whole story. These rows describe the opposite case:
 * `HTMLElement` is real and `element.scrollLeft` reads without throwing — it
 * just returns a silent zero, because jsdom has no layout engine. A
 * name-based check cannot see that, so the classifier would call a
 * layout-reading component realm-answerable and route it to the Simulated
 * tier, which is exactly the `module-scrollarea` misrouting ADR 0029 exists
 * to prevent (~2.3 s of build time to compute nothing).
 */
export type CapabilityPatch = {
	/** Member name as authored (`scrollLeft`, `getBoundingClientRect`). */
	member: string
	/** Restrict to reads off this receiver name; omitted means any. */
	receiver?: string
	/** Why the realm cannot answer it. */
	note: string
}

/* === The tables === */

/**
 * Every global the driver stubs inert or closes. `REALM_GLOBALS` has no
 * counterpart here on purpose: those are the globals the realm DOES
 * provide, and reading one is precisely what makes a component
 * realm-answerable.
 */
export const UNANSWERABLE_GLOBALS: readonly UnanswerableGlobal[] = [
	// --- Absent from the realm, stubbed inert ------------------------------
	{
		name: 'ResizeObserver',
		kind: 'stub',
		note: 'no realm observes layout; the stub never fires',
	},
	{ name: 'IntersectionObserver', kind: 'stub' },
	{ name: 'PerformanceObserver', kind: 'stub' },
	{
		name: 'matchMedia',
		kind: 'stub',
		note: 'the realm has no viewport; the list never matches and never changes',
	},
	{
		name: 'requestAnimationFrame',
		kind: 'stub',
		note: 'a frame callback fires after the serialization boundary',
	},
	{ name: 'cancelAnimationFrame', kind: 'stub' },
	{ name: 'requestIdleCallback', kind: 'stub' },
	{ name: 'cancelIdleCallback', kind: 'stub' },
	{ name: 'scrollTo', kind: 'stub' },
	{
		name: 'history',
		kind: 'stub',
		note: 'the build has no session history; navigation calls are inert',
	},

	// --- Present but closed (ADR 0027 sub-design 2d) -----------------------
	{
		name: 'fetch',
		kind: 'network',
		note: 'the build realm is closed to the network',
	},
	{ name: 'XMLHttpRequest', kind: 'network' },
	{ name: 'WebSocket', kind: 'network' },
	{ name: 'EventSource', kind: 'network' },
	{ name: 'Request', kind: 'network' },
	{ name: 'navigator.sendBeacon', kind: 'network' },
]

/**
 * Member reads the realm executes without throwing and answers WRONG — the
 * second half of ADR 0029 sub-design 1 limb (a).
 *
 * Two families, and they are unanswerable for different reasons:
 *
 * 1. **Layout geometry.** jsdom has no layout engine, so every one of these
 *    returns 0. Not fixable at this substrate (ADR 0029's "layout is out of
 *    scope for jsdom by construction"), which is why `module-scrollarea` —
 *    the corpus's single largest cost driver at 2,091 occurrences — is a
 *    Static-tier component rather than a Simulated-tier one.
 * 2. **`ElementInternals` members with no jsdom implementation.** Scoped
 *    per ADR 0026 §2's amendment: `internals` is NOT one unanswerable row
 *    any more. ARIA expressions ARE realm-answerable since LT-177, through
 *    `bindAria()`'s attribute fallback — the served HTML carries the value —
 *    so `ariaExpanded` and friends are deliberately absent from this list.
 *    Custom states and the form members remain unanswerable: jsdom's
 *    skeletal object flows through non-null (which populates
 *    `internalsHosts` and lets `bindAria()` bind the host content
 *    attribute), and the library's own LT-150 shape check treats it as no
 *    internals at all — the honest posture for a form-associated component,
 *    since an incomplete stub is worse than none, and polyfilling a working
 *    reflection surface would fire the stale-attribute removal at simulated
 *    connect and strip `role`/`aria-*` from the served markup. The former
 *    `PROTOTYPE_PATCHES` column (prototype-method rewrites) was deleted
 *    with LT-222 — it had been empty since LT-177.
 */
export const CAPABILITY_PATCHES: readonly CapabilityPatch[] = [
	// --- Layout geometry: jsdom returns silent zeros -----------------------
	...(
		[
			'scrollLeft',
			'scrollTop',
			'scrollWidth',
			'scrollHeight',
			'offsetWidth',
			'offsetHeight',
			'offsetLeft',
			'offsetTop',
			'clientWidth',
			'clientHeight',
			'clientLeft',
			'clientTop',
			'getBoundingClientRect',
			'getClientRects',
		] as const
	).map(
		(member): CapabilityPatch => ({
			member,
			note: 'jsdom has no layout engine — this reads as a silent zero',
		}),
	),
	// --- ElementInternals: only the members jsdom does not implement -------
	{
		member: 'states',
		receiver: 'internals',
		note: "jsdom's skeletal ElementInternals has no custom-state set",
	},
	{
		member: 'setFormValue',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
	{
		member: 'setValidity',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
	{
		member: 'form',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
	{
		member: 'validity',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
]

/* === The reason vocabulary === */

/**
 * The root identifier each unanswerable global is recognised by.
 *
 * A dotted entry contributes its ROOT, because a free-identifier scan sees
 * `navigator`, not `navigator.sendBeacon`. So `navigator` reads as
 * unanswerable as a whole — over-broad, and deliberately so: the
 * classifier is sound rather than complete (ADR 0029 sub-design 2), and
 * over-broad here routes a component DOWNWARD, which costs build time and
 * never ships wrong HTML.
 */
export const UNANSWERABLE_GLOBAL_NAMES: ReadonlySet<string> = new Set(
	UNANSWERABLE_GLOBALS.map(global => global.name.split('.')[0] ?? global.name),
)

/** Capability rows keyed by member name, for the member-read check. */
export const UNANSWERABLE_MEMBERS: ReadonlyMap<string, CapabilityPatch> =
	new Map(CAPABILITY_PATCHES.map(patch => [patch.member, patch]))

/**
 * Census copy for a global the realm does not answer. Kept beside the table
 * so the reason and the row that produced it move together.
 */
export const unanswerableGlobalReason = (name: string): string =>
	`\`${name}\` is stubbed in the simulation realm`

/** Census copy for a member read the realm answers wrong. */
export const unanswerableMemberReason = (patch: CapabilityPatch): string =>
	`\`${patch.member}\`: ${patch.note}`
