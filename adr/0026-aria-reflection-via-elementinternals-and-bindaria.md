# ADR 0026: ARIA Reflection via ElementInternals and `bindAria()`

## Status

🔄 Proposed

## Context

[ADR 0016](0016-element-internals-for-form-association-and-states.md) adopted `ElementInternals` for form association and custom `:state()` pseudo-classes but deliberately withheld ARIA reflection (`internals.role`, `internals.aria*`): no helpers, no examples, and an active advisory to keep explicit `aria-*` attributes. The advisory named three blockers, each concrete at the time:

1. **axe-core false positives** — axe could not see `internals`-set semantics at all ([#4259](https://github.com/dequelabs/axe-core/issues/4259), [#4659](https://github.com/dequelabs/axe-core/issues/4659)), so a `<basic-button>` that set `internals.role = 'button'` and dropped its inner native `<button>` would ship broken nesting that no static tool flagged.
2. **Chromium accessibility-tree gap** — `internals.aria*` did not reliably reach the computed accessibility tree ([chromium 40810268](https://issues.chromium.org/issues/40810268)).
3. **Unresolved spec gap** — [w3c/aria #2663](https://github.com/w3c/aria/issues/2663).

[Issue #121](https://github.com/zeixcom/le-truc/issues/121) (milestone 3.0) claims these are now lifted and asks to revisit. Verification against primary sources (August 2026) confirms the claim, with qualifications the ADR must carry forward:

- **Cross-browser support is real.** `internals.role` and the string `aria*` properties are supported in Chrome 103, Firefox 119 (Oct 2023), Safari 16.4. The **element-reference properties** (`ariaActiveDescendantElement`, `ariaControlsElements`, `ariaDescribedByElements`, `ariaDetailsElements`, `ariaErrorMessageElements`, `ariaFlowToElements`, `ariaLabelledByElements`) — which hold `Element`/`Element[]` instead of IDREF strings — are Baseline 2025: Chrome 135 (Apr 2025), Firefox 136 (Mar 2025), Safari 16.4 (which shipped them first, in 2023). **One exception: `ariaOwnsElements` is still unimplemented in Chrome/Edge** (deferred deliberately, [crbug 41469336](https://issues.chromium.org/issues/41469336), due to cross-shadow-root `aria-owns` problems in [w3c/aria #2266](https://github.com/w3c/aria/issues/2266)).
- **The Chromium tree gap is closed.** The engine-level mapping was fixed ([40834284](https://issues.chromium.org/issues/40834284) in 2022; the element-reference mapping in [41491667](https://issues.chromium.org/issues/41491667), Jan 2025); 40810268 was closed as its duplicate.
- **axe-core support is real but partial.** [axe-core 4.13.0](https://github.com/dequelabs/axe-core/releases/tag/v4.13.0) (Aug 2026) enables ElementInternals support by default and closed the historic role-based false positives (both issues above are closed as completed). But per [axe's own documentation](https://github.com/dequelabs/axe-core/blob/develop/doc/element-internals.md), it currently honors **only `internals.role`** — not `ariaLabel` and the other `aria*` properties — only in a subset of rules (`aria-allowed-attr`, `aria-prohibited-attr`, `aria-required-parent`/`children`, list/listitem), and **only when the page exposes internals via the [element-internals-declaration community protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/element-internals-declaration.md)** — without that opt-in, axe silently audits the element as if internals were absent.
- **The spec gap persists as an introspection problem.** w3c/aria #2663 is still open, reframed as a proposal for a read-only `implicitAria` API. It no longer blocks *using* reflection — how internals values feed the tree is defined — but no standard way exists for tools to *inspect* internals-set semantics.

Two platform facts shape the design:

- **Internals values are *default* semantics.** A host `aria-*`/`role` content attribute **overrides** the corresponding `internals` value in the accessibility computation. Component-set reflection therefore cannot lock a consumer out: the consumer retains the attribute channel as the override.
- **Visibility differs by target.** Writing an ARIA reflection property on a native `Element` mirrors into the content attribute (CSS- and `getAttribute()`-visible); writing it on `ElementInternals` stays invisible — no attribute is created, no CSS selector matches, no `:state()` applies.

Meanwhile the ergonomic gap the advisory left behind is visible across the examples: boolean→string coercion hand-rolled at every call site (`textbox.ariaExpanded = String(expanded)` in `form-combobox`), manual ID plumbing for internal relationships (`form-combobox` generates and wires `aria-describedby` by hand), and no null-guarded reactive path for `internals` targets at all — `bindProperty(internals, …)` would throw on a null internals, and `bindAttribute`'s boolean branch (`toggleAttribute`) produces invalid empty-string ARIA values (already flagged in AGENTS.md as a don't).

Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function) (component definition), [M3](../REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers) (attributes as the server-authored initial-state channel), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects) (fine-grained effects), §4 Accessibility ("must not make it harder to achieve"; example components as the ARIA reference implementation), §4 Browser support (all evergreen browsers).

## Decision

Lift ADR 0016's advisory and amend its "ARIA reflection: available but not promoted" section. ARIA reflection via `ElementInternals` is now a **recommended, first-class channel** alongside content attributes, governed by a two-channel policy, served by one new binding helper (`bindAria()`), and made tooling-visible by implementing the element-internals-declaration protocol for every Le Truc component. Targets the v3.0 line per [issue #121](https://github.com/zeixcom/le-truc/issues/121). Additive and non-breaking; `bindAttribute`/`bindProperty` keep their roles.

### 1. Two-channel policy

Content attributes and internals reflection are **complementary channels, not competitors** — attributes are the consumer-facing override, reflection is the component-owned default. Per concern:

| Concern | Channel | Why |
|---|---|---|
| Initial state in server-rendered HTML | `aria-*` content attribute (read by parsers, [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md)) | Reflection is runtime-only; attributes are the only server-authorable form (M3). |
| Consumer overrides component semantics | content attribute | Host attributes override internals values — the platform's default-semantics model guarantees the consumer always wins. |
| Component-owned default semantics on the host (`role`, `aria-expanded`, `aria-valuenow`, …) | `internals.aria*` via `bindAria()` | Invisible in markup, unclobberable by framework attribute rewriting, consumer can still override via the attribute. |
| Component-internal relationships (label, description, controls, active-descendant, error-message) | Element references (`aria*Elements`) via `bindAria()` | No ID generation or plumbing; references are live element identity and survive re-targeting. |
| Relationships the *consumer* authors (into or across components) | content attribute (IDREF) | The consumer owns that markup; the component only reads it (`module-tabgroup` reading `aria-controls`). |
| State that CSS must select on | attributes on elements (native reflection mirrors IDL writes to the attribute) | Internals-reflected values are invisible to CSS selectors; `:state()` remains the component-owned styling hook ([ADR 0016](0016-element-internals-for-form-association-and-states.md) §8). |

**No-mixing rule**: component code must never write both channels for the *same* ARIA property on the *same* element — pick the channel per the table. ARIA state on inner native elements (`option.ariaSelected = 'true'`, as the form examples do today) is unchanged practice: native IDL reflection mirrors it to the attribute, so it stays CSS- and axe-visible without any protocol.

### 2. `bindAria()` binding helper

One helper in `src/bindings.ts`, exported from the barrel:

```ts
watch('expanded', bindAria(internals, 'ariaExpanded'))
watch('activeOption', bindAria(listbox, 'ariaActiveDescendantElement'))
watch(all(descriptions), bindAria(internals, 'ariaDescribedByElements'))
```

- **Target**: `ARIAMixin | null | undefined` — `Element` and `ElementInternals` both implement `ARIAMixin` (with `role` and all `aria*Elements` typed on it), so one signature covers host reflection and inner-element binding. A nullish target (the `attachInternals()` failed path) makes the returned handlers a no-op — the same graceful degradation `bindState()` established.
- **Name**: `keyof ARIAMixin & string` — the platform property names, with full editor autocomplete. The helper hides nothing; it is named for and dispatches to the platform API.
- **Return**: `SingleMatchHandlers` (like `bindAttribute`, not a bare function) so `watch`'s `nil` path is available:
  - `ok(boolean)` → `'true'` / `'false'` — ARIA enumerated semantics, never `toggleAttribute`'s empty-string form
  - `ok(number)` → decimal string (`ariaValuenow` from a numeric prop)
  - `ok(null | undefined)` → assigns `null`, clearing the reflection (restoring attribute authority)
  - `ok(string | Element | readonly Element[])` → pass-through (`'mixed'`, `'polite'`, element references)
  - `nil` → assigns `null` (clear)
- **Debug attribution**: register the target when it is an `Element` (as `bindProperty` does); skip `ElementInternals` targets, which carry no host reference — same rationale as `bindState` ([ADR 0022](0022-debug-extension-for-visual-and-console-instrumentation.md)).

Static ARIA (`internals.role = 'slider'`, one-time `aria*Elements` wiring from a `first()` query) stays **imperative in the factory body** — no helper for statements that are already shorter than their helper call. This preserves ADR 0016's rejection grounds for wrapping single imperative statements; what changed is that *reactive* bindings now have a real mapping to hide (boolean coercion, null guards, nil routing), the same bar `bindState()` cleared.

### 3. Element-internals-declaration protocol, implemented once by the library

The `Truc` class constructor — the one place `attachInternals()` is already called ([ADR 0016](0016-element-internals-for-form-association-and-states.md) §1) — additionally registers the internals in the protocol's registry: `globalThis._elementInternals ??= new WeakMap()`, then `.set(this, internals)` when attach succeeded. This makes **every Le Truc component axe-core ≥ 4.13-testable with zero author opt-in**, including in production builds (audits run against production; the registration is unconditional and costs one WeakMap set per instance). The library does **not** expose internals as a public host property — the protocol explicitly rejects public accessors (`.internals`/`._internals` collision risk), and the registry is declared to be tooling-only ("application-logic use explicitly unsupported"). It is a stopgap by design: removable without API impact once a native introspection API ships (whatwg/html#11040, w3c/aria #2663).

### 4. `ariaOwnsElements`: withheld

Do not use or promote `ariaOwnsElements` — it does not exist in Chrome/Edge, and `aria-owns` is the one reference property whose semantics (reparenting for AT without visual reparenting) are problematic in their own right. Le Truc components own their internal structure and never need it. Revisit when Chromium ships it.

### 5. Documentation and examples migrate where reflection is strictly better

- `form-combobox`: replace the hand-rolled `aria-describedby` ID plumbing with `internals.ariaDescribedByElements = [descriptionEl]` (or the reactive binding once description content can change); `aria-expanded` moves to a `watch(isExpanded, bindAria(textbox, 'ariaExpanded'))` — the textbox is a native element, so the attribute mirror keeps it CSS-visible.
- The docs advisory in `docs-src/pages/components.md` ("keep explicit `aria-*` attributes") is replaced by the policy table above; the July 2026 blog post stands as a historical record.
- Examples keep attribute-based ARIA where CSS or attribute selectors consume it (`form-listbox`'s `[aria-selected="true"]`).

## Alternatives Considered

- **Advisory lift only (no helper).** Authors would hand-roll `v => { internals?.ariaExpanded = String(v) }` per site — the exact boilerplate every binding helper in `src/bindings.ts` exists to remove, plus a null guard `bindProperty` lacks. Rejected: inconsistent with the library's own granularity (there is no "just write `el.classList.toggle`" purism either).
- **Reuse `bindProperty(internals, 'ariaExpanded')`.** Typechecks today (`bindProperty` is generic over any object) but has no null guard (throws on null internals), no boolean→`'true'`/`'false'` coercion (TS lib types are `string | null`, so every boolean prop needs a mapping thunk), and no `nil` path. Extending `bindProperty` with type-dependent coercion instead would hide ARIA semantics inside a general-purpose helper. Rejected; `bindAria` composes with it cleanly.
- **Declarative reflection map (e.g. `aria(internals, { expanded: 'expanded' })`) or `expose()`-integrated reflection.** Confuses the host's public prop surface with internal semantics — `expose()` declares what *consumers* see and set ([ADR 0002](0002-factory-form-over-builder-pattern.md)); reflected ARIA is component-owned default state that consumers override via attributes, a different axis. Also fails the "what complexity does this hide?" test: the map saves one `watch()` line per property but hides the effect. Rejected.
- **An `ariaReflection()` extension** auto-reflecting ARIA-named props. Over-magic: implicit writes for any prop whose name matches `aria*`, surprises on read, and ADR 0019 extensions are for class-level configuration, not per-property effect wiring. Rejected.
- **Reflection-first (deprecate attribute ARIA).** Breaks the server-authored initial-state channel (M3 — reflection cannot be expressed in HTML), CSS selection, `getAttribute()`-based consumer/test code, and the consumer-override story. The two-channel policy keeps each channel where it is strongest. Rejected.
- **Public `host.internals` property** (simpler than the protocol WeakMap). The element-internals-declaration protocol deliberately rejects public accessors — `.internals` is exactly the kind of name a dozen libraries and user subclasses collide on. Rejected.

## Consequences

**Good:**

- Host semantics without markup noise: a component can make its host a `slider`/`listbox` with live `aria-valuenow`/`aria-selected` that no consumer framework rewriting the host's attributes can clobber — and the consumer can still override via the attribute channel, which the platform guarantees wins.
- Internal relationships lose their ID plumbing: element references kill the generate-an-id-then-`setAttribute` pattern and its failure modes (duplicate/missing IDs).
- Every Le Truc component becomes axe-core-auditable out of the box (role-based rules, ≥ 4.13), with no per-component opt-in — the library bears the protocol cost once, in the constructor.
- One helper, one mental model: `bindAria(target, name)` spans host reflection, inner-element binding, string state, and element references, typed off the platform's own `ARIAMixin`.
- The nested-element safety net the advisory worried about (`internals.role = 'button'` hiding broken nesting) is restored for role semantics: axe ≥ 4.13 sees internals roles again.

**Bad / trade-offs:**

- **axe-core coverage is partial and will stay partial for a while**: only `internals.role` (not `ariaLabel` & co.), a rule subset, and only via the registry WeakMap — which is itself a Draft protocol and a declared stopgap. Non-role internals semantics still need real-browser/AT verification, not just axe.
- **Reflected internals state is invisible to CSS, `getAttribute()`, and jsdom/happy-dom-tier tests.** Consumers style via attributes or `:state()`; tests that assert state via attribute selectors keep working only where the attribute channel is used. Unit tests (Bun) stub internals (`FakeElementInternals`) — they verify wiring, not browser behavior; observable-behavior coverage lives in the Playwright tier, consistent with the existing form-extension tests.
- **The registry is a global**: `globalThis._elementInternals` is created if absent. That is what the protocol prescribes (idempotent, `??=`), but it is a page-visible global — documented, tooling-only, and removable when native introspection lands.
- **`ariaOwnsElements` is a known hole** in Chromium; guidance withholds it rather than papering over it.
- **Bundle cost**: `bindAria` (~30 lines) joins `src/bindings.ts`, which is inside the minimal entry measured by the ≤ 9 kB regression ceiling; the WeakMap registration adds one branch per instance. Implementation must confirm both against `test/regression-bundle.test.ts` tiers.
- DevTools' accessibility-computed-tree panel rendering of internals-set semantics is engine-fixed but not formally verified; Chromium's `ariaOwnsElements`-style deferrals are a reminder that "Baseline" still carries per-property asterisks.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [M3](../REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects), §4 (Accessibility, Browser support, Performance)
- Amends: [ADR 0016](0016-element-internals-for-form-association-and-states.md) — replaces its "ARIA reflection: available but not promoted" section and the related advisory in the docs; §1–8 (form association, managed convention, `bindState`) unchanged
- Related: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) — attributes remain the server-authored initial-state channel; this ADR adds the runtime channel, it does not replace M3
- Related: [ADR 0022](0022-debug-extension-for-visual-and-console-instrumentation.md) — debug-attribution treatment of internals-targeting bindings
- Motivating issue: [zeixcom/le-truc#121](https://github.com/zeixcom/le-truc/issues/121)
- External: [Deque: axe-core ElementInternals support](https://www.deque.com/blog/test-your-custom-elements-and-trust-the-results-with-axe-cores-support-for-elementinternals/) · [axe-core element-internals docs](https://github.com/dequelabs/axe-core/blob/develop/doc/element-internals.md) · [element-internals-declaration protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/element-internals-declaration.md) · [MDN ARIAMixin](https://developer.mozilla.org/en-US/docs/Web/API/ARIAMixin)
- Supersedes: None
