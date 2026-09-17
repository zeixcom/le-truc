/**
 * The realm patch table (ADR 0027 sub-design 2, LT-151).
 *
 * Executing a generated client module against jsdom means the module's free
 * globals — `HTMLElement`, `customElements`, `document`, observer and event
 * constructors — must resolve to the *simulated* realm's classes, not to
 * whatever the host runtime happens to expose. The three server runtimes fail
 * that differently:
 *
 * - **Bun** supplies no DOM classes but DOES supply `fetch` (and friends), which
 *   survive into the realm untouched — a component's connect-time `fetch()`
 *   would reach the network from a build (sub-design 2d).
 * - **Node** supplies no DOM classes at all; every entry here is a fill.
 * - **Deno** ships many web APIs natively, so the hazard inverts: a native
 *   `Event`/`CustomEvent`/`MutationObserver` would SHADOW the realm's, and
 *   `instanceof` across the boundary silently goes false. Filling only what is
 *   missing is therefore wrong; the realm's value must be FORCED over the
 *   native one.
 *
 * Hence the table is data, not conditionals: one declarative list per concern,
 * applied uniformly by `realm.ts`. Verified 2026-09-03 on Bun 1.3.11, Node
 * 26.7.0 and Deno 2.9.6: `bun run check:sim` serializes `form-colorgraph`
 * byte-identically under all three. `runtimes` scopes an entry when a runtime
 * genuinely differs; no entry needs it today, because forcing a value that is
 * already absent is a fill and forcing one that is present is the de-shadow —
 * the same operation covers both cases.
 */

/* === Types === */

/** The server runtimes the driver must run under. */
export type SimRuntime = 'bun' | 'node' | 'deno' | 'unknown'

/**
 * A global whose value must come from the jsdom realm. Forced, not filled:
 * an existing host-runtime native is overwritten (Deno de-shadowing).
 */
export type RealmGlobalPatch = {
	kind: 'realm'
	/** Global name, also the property read off the jsdom `window`. */
	name: string
	/** Read from a different `window` property than `name`. */
	from?: string
	/** Scope to specific runtimes; omitted means all. */
	runtimes?: readonly SimRuntime[]
	/** Why this one is in the table. */
	note?: string
}

/** The shape an absent constructor/function is stubbed with. */
export type StubShape =
	| 'observer'
	| 'match-media'
	| 'animation-frame'
	| 'cancel'
	| 'noop'

/**
 * A global the realm does not implement, stubbed inert so a runs-once-at-connect
 * effect is harmless rather than a `ReferenceError` (which the spike observed
 * surfacing process-fatal rather than per-element).
 */
export type StubGlobalPatch = {
	kind: 'stub'
	name: string
	shape: StubShape
	/** Force even when the realm/runtime already provides one. */
	force?: boolean
	runtimes?: readonly SimRuntime[]
	note?: string
}

/**
 * An ambient network global, replaced with a no-op that reports at call
 * time and then NEVER SETTLES (amended sub-design 2d, LT-154, 2026-09-03).
 * A rejecting stub is wrong under the hermetic-quiescence boundary
 * (`boundary.ts`): draining a rejection to settlement routes every fetching
 * component to its `@catch` arm, but the build cannot know the request
 * failed — it never ran. A promise that never settles keeps the component's
 * task at `nil`, which is what CHECKLIST §8/§9 require of SSG and is what
 * `match()` renders as `@pending`. The build must never depend on the
 * network either way (sub-design 2d); only the arm the client ends up
 * shipping changes.
 */
export type NetworkGlobalPatch = {
	kind: 'network'
	name: string
	/** `function` → callable stub; `constructor` → `new`-able stub. */
	form: 'function' | 'constructor'
	runtimes?: readonly SimRuntime[]
	note?: string
}

/** A patch that rewrites a prototype method inside the realm. */
export type PrototypePatch = {
	kind: 'prototype'
	/** `window` property holding the constructor. */
	owner: string
	method: string
	/** `throw` is the only behaviour needed so far. */
	behavior: 'throw'
	message: string
	note?: string
}

/**
 * A MEMBER read the realm cannot answer, even though the global carrying it
 * is present (ADR 0029 sub-design 1 limb (a); the capability-row shape ADR
 * 0026 §2's amendment requires).
 *
 * The other four patch kinds describe globals that are absent, stubbed or
 * closed, so a missing NAME is the whole story. These rows describe the
 * opposite case: `HTMLElement` is real and `element.scrollLeft` reads
 * without throwing — it just returns a silent zero, because jsdom has no
 * layout engine. A name-based check cannot see that, so the classifier
 * would call a layout-reading component realm-answerable and route it to
 * the Simulated tier, which is exactly the `module-scrollarea` misrouting
 * ADR 0029 exists to prevent (~2.3 s of build time to compute nothing).
 *
 * Kept in THIS table rather than in the classifier so the ADR's
 * delete-a-row-to-re-route property holds for capabilities too: when a
 * driver gains real layout or a fuller `ElementInternals`, deleting the row
 * re-routes the affected components from the Static tier to the Simulated
 * tier automatically, with no second list to remember.
 */
export type CapabilityPatch = {
	kind: 'capability'
	/** Member name as authored (`scrollLeft`, `getBoundingClientRect`). */
	member: string
	/** Restrict to reads off this receiver name; omitted means any. */
	receiver?: string
	/** Why the realm cannot answer it. */
	note: string
}

export type SimPatch =
	| RealmGlobalPatch
	| StubGlobalPatch
	| NetworkGlobalPatch
	| PrototypePatch
	| CapabilityPatch

/* === Patch Table === */

/**
 * Realm classes and objects forced onto `globalThis` for the duration of a
 * simulated connect. Ordering is irrelevant; the list is a set.
 */
export const REALM_GLOBALS: readonly RealmGlobalPatch[] = [
	// The document and the registry the upgrade pass runs through.
	{ kind: 'realm', name: 'window' },
	{ kind: 'realm', name: 'self', from: 'window' },
	{ kind: 'realm', name: 'document' },
	{ kind: 'realm', name: 'customElements' },
	{ kind: 'realm', name: 'navigator' },
	{ kind: 'realm', name: 'location' },
	{ kind: 'realm', name: 'getComputedStyle' },

	// Base classes. `instanceof` must be clean within the realm, and an
	// authored `class X extends HTMLElement` must extend the realm's.
	{ kind: 'realm', name: 'EventTarget' },
	{ kind: 'realm', name: 'Node' },
	{ kind: 'realm', name: 'Element' },
	{ kind: 'realm', name: 'HTMLElement' },
	{ kind: 'realm', name: 'DocumentFragment' },
	{ kind: 'realm', name: 'ShadowRoot' },
	{ kind: 'realm', name: 'HTMLTemplateElement' },
	{ kind: 'realm', name: 'HTMLSlotElement' },
	{ kind: 'realm', name: 'HTMLInputElement' },
	{ kind: 'realm', name: 'HTMLButtonElement' },
	{ kind: 'realm', name: 'HTMLSelectElement' },
	{ kind: 'realm', name: 'HTMLTextAreaElement' },
	{ kind: 'realm', name: 'HTMLFormElement' },
	{ kind: 'realm', name: 'HTMLCanvasElement' },
	{ kind: 'realm', name: 'HTMLDialogElement' },
	{ kind: 'realm', name: 'HTMLStyleElement' },
	{ kind: 'realm', name: 'ElementInternals' },
	{ kind: 'realm', name: 'CSSStyleDeclaration' },
	{ kind: 'realm', name: 'DOMTokenList' },
	{ kind: 'realm', name: 'NodeList' },
	{ kind: 'realm', name: 'HTMLCollection' },

	// Event constructors. Deno ships native `Event`/`CustomEvent`; an event
	// constructed from the native class and dispatched at a realm target is
	// the de-shadowing case this table exists for.
	{
		kind: 'realm',
		name: 'Event',
		note: 'Deno/Bun ship a native Event that would shadow the realm',
	},
	{ kind: 'realm', name: 'CustomEvent' },
	{ kind: 'realm', name: 'ErrorEvent' },
	{ kind: 'realm', name: 'InputEvent' },
	{ kind: 'realm', name: 'KeyboardEvent' },
	{ kind: 'realm', name: 'MouseEvent' },
	{ kind: 'realm', name: 'PointerEvent' },
	{ kind: 'realm', name: 'FocusEvent' },
	{ kind: 'realm', name: 'SubmitEvent' },

	// Observers jsdom implements. Deno ships no DOM observers, Bun ships none
	// either — but forcing keeps one rule for the whole column.
	{ kind: 'realm', name: 'MutationObserver' },

	// Form/data types the form extension touches.
	{ kind: 'realm', name: 'FormData' },
	{ kind: 'realm', name: 'DOMException' },
]

/**
 * Constructors and functions absent from jsdom, stubbed inert. `force: true`
 * where a host-runtime native must not be allowed through either: a real
 * `requestAnimationFrame` (Deno, Bun) would schedule work AFTER the synchronous
 * serialization boundary, so its callback could never land in the HTML and its
 * timer would keep the build process alive.
 */
export const STUB_GLOBALS: readonly StubGlobalPatch[] = [
	{
		kind: 'stub',
		name: 'ResizeObserver',
		shape: 'observer',
		note: 'jsdom has none; form-colorgraph observes at connect',
	},
	{ kind: 'stub', name: 'IntersectionObserver', shape: 'observer' },
	{ kind: 'stub', name: 'PerformanceObserver', shape: 'observer' },
	{
		kind: 'stub',
		name: 'matchMedia',
		shape: 'match-media',
		note: 'jsdom has none; returns a never-matching, never-changing list',
	},
	{
		kind: 'stub',
		name: 'requestAnimationFrame',
		shape: 'animation-frame',
		force: true,
		note: 'forced: a real rAF fires after serialization and holds the process open',
	},
	{
		kind: 'stub',
		name: 'cancelAnimationFrame',
		shape: 'cancel',
		force: true,
	},
	{ kind: 'stub', name: 'requestIdleCallback', shape: 'animation-frame' },
	{ kind: 'stub', name: 'cancelIdleCallback', shape: 'cancel' },
	{ kind: 'stub', name: 'scrollTo', shape: 'noop', force: true },
]

/**
 * Every ambient network global, replaced with a reporting, never-settling
 * stub (amended sub-design 2d, LT-154). Reporting happens at CALL time, so a
 * network attempt is always a build warning regardless of what the component
 * does with the returned promise. The promise itself never settles, which is
 * what keeps a fetching component's task at `nil` and its markup on the
 * `@pending` arm under the quiescence drain — a rejection would route it to
 * `@catch` and ship an arm the build cannot know is right (CHECKLIST §8/§9).
 */
export const NETWORK_GLOBALS: readonly NetworkGlobalPatch[] = [
	{
		kind: 'network',
		name: 'fetch',
		form: 'function',
		note: "Bun's fetch survives into the jsdom realm untouched",
	},
	{ kind: 'network', name: 'XMLHttpRequest', form: 'constructor' },
	{ kind: 'network', name: 'WebSocket', form: 'constructor' },
	{ kind: 'network', name: 'EventSource', form: 'constructor' },
	{ kind: 'network', name: 'Request', form: 'constructor' },
	{ kind: 'network', name: 'navigator.sendBeacon', form: 'function' },
]

/**
 * Prototype normalizations inside the realm.
 *
 * Empty since LT-177. The forced `attachInternals()` throw that used to live
 * here is gone: jsdom's skeletal `ElementInternals` now flows through
 * non-null, which is what populates `internalsHosts` and lets `bindAria()`
 * bind the host's content attribute so the served HTML carries the value
 * (ADR 0026 §2, *Capability fallback*). Polyfilling internals here was
 * rejected for the same reason — a working reflection surface would fire the
 * stale-attribute removal at simulated connect and strip `role`/`aria-*` from
 * the served markup. Form association keeps its own global degradation: the
 * library's LT-150 shape check still sees the skeletal object and treats it
 * as no internals, which is the honest posture for a form-associated
 * component (an incomplete stub is worse than none).
 */
export const PROTOTYPE_PATCHES: readonly PrototypePatch[] = []

/**
 * Member reads the realm executes without throwing and answers WRONG — the
 * second half of ADR 0029 sub-design 1 limb (a). See {@link CapabilityPatch}
 * for why these cannot be expressed as absent globals.
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
 *    skeletal object has no `states` set, and the library's own LT-150
 *    shape check treats it as no internals at all.
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
			kind: 'capability',
			member,
			note: 'jsdom has no layout engine — this reads as a silent zero',
		}),
	),
	// --- ElementInternals: only the members jsdom does not implement -------
	{
		kind: 'capability',
		member: 'states',
		receiver: 'internals',
		note: "jsdom's skeletal ElementInternals has no custom-state set",
	},
	{
		kind: 'capability',
		member: 'setFormValue',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
	{
		kind: 'capability',
		member: 'setValidity',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
	{
		kind: 'capability',
		member: 'form',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
	{
		kind: 'capability',
		member: 'validity',
		receiver: 'internals',
		note: 'form association degrades to no internals (LT-150 shape check)',
	},
]

/** The whole table, in application order. */
export const SIM_PATCH_TABLE: readonly SimPatch[] = [
	...REALM_GLOBALS,
	...STUB_GLOBALS,
	...NETWORK_GLOBALS,
	...PROTOTYPE_PATCHES,
	...CAPABILITY_PATCHES,
]

/* === Runtime Detection === */

/** Which server runtime this process is. */
export function detectRuntime(): SimRuntime {
	const global = globalThis as Record<string, unknown>
	if (global.Deno) return 'deno'
	if (global.Bun) return 'bun'
	if (
		typeof global.process === 'object' &&
		global.process !== null &&
		typeof (global.process as { versions?: { node?: string } }).versions
			?.node === 'string'
	)
		return 'node'
	return 'unknown'
}

/** Filter the table to the entries that apply to `runtime`. */
export function patchesFor<T extends SimPatch>(
	patches: readonly T[],
	runtime: SimRuntime,
): T[] {
	return patches.filter(
		patch =>
			!('runtimes' in patch) ||
			patch.runtimes === undefined ||
			patch.runtimes.includes(runtime),
	)
}
