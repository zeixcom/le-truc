# ADR 0026: ARIA Reflection via ElementInternals and `bindAria()`

## Status

✅ Accepted (2026-08-31, after the LT-001–LT-005 proof-of-concept; see [PoC validation](#poc-validation))

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

**Stale-attribute rule (added after the PoC), handled by the library.** Nothing on the platform enforces the no-mixing rule, and the override direction cuts against the component: a *pre-existing* host attribute for a property the component reflects via internals **permanently shadows** the reflection — a server-rendered `aria-expanded="false"` makes every later `internals.ariaExpanded` write a no-op in the accessibility tree, silently and forever (LT-002 finding 4, reproduced in `poc-stale-expanded.ts`).

`bindAria()` therefore **removes the shadowing content attribute itself**, as part of its contract, rather than leaving it to the author. The contract in one line: *the server-rendered attribute is the initial value; from then on the component owns that property reactively via internals.* Precisely:

- **Once, at binding activation** — not continuously. This is what preserves the consumer-override row above: internals values remain *defaults*, so a parent that sets `aria-expanded` **after** connect still wins, exactly as before. Only the server-rendered echo is cleared.
- **Only for `ElementInternals` targets.** For an `Element` target the IDL write *is* the attribute channel (native reflection mirrors it), so there is nothing shadowing and nothing to remove.
- **After parsers have run.** Attributes drive initial state at connect time ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md), M3) and effects activate later ([ADR 0007](0007-effect-descriptors-with-deferred-activation.md)), so a prop parser reading that attribute has already consumed it by the time the binding activates. The implementation must honor and test this ordering — removing before parsing would discard the SSR value instead of adopting it.

This is not a carve-out from the "no helper for single imperative statements" principle: the removal is not a statement the author would otherwise write *by choice* — it is pure boilerplate whose omission is silent and total (the component's ARIA simply never updates, with no error). That is precisely the failure mode a binding helper exists to make impossible.

Two implementation prerequisites, both cheap and both currently missing:

1. **`ElementInternals` → host reverse lookup.** `internalsMap` (`src/internal.ts`) is keyed host → internals and `ElementInternals` carries no host reference, so `bindAria(internals, name)` cannot reach the element whose attribute it must remove. Add a module-private `WeakMap<ElementInternals, HTMLElement>` populated on the same constructor line as §3's registry registration. Library-private; not exposed.
2. **IDL property name → content attribute name.** Note the mapping is *not* kebab-case: ARIA attribute names carry no inner hyphens. Strip a trailing `Element`/`Elements`, strip the `aria` prefix, lowercase the remainder, prefix `aria-` (`ariaValueNow` → `aria-valuenow`, `ariaDescribedByElements` → `aria-describedby`, `ariaActiveDescendantElement` → `aria-activedescendant`); `role` maps to itself. A naive kebab-case transform yields `aria-labelled-by` and silently removes nothing.

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
  - `ok(number)` → decimal string (`ariaValueNow` from a numeric prop — note the IDL casing, which is *not* the hyphenated attribute name; a mis-cased write is a silent no-op, see PoC validation)
  - `ok(null | undefined)` → assigns `null`, clearing the reflection (restoring attribute authority)
  - `ok(string | Element | readonly Element[])` → pass-through (`'mixed'`, `'polite'`, element references)
  - `nil` → assigns `null` (clear)
- **Debug attribution**: register the target when it is an `Element` (as `bindProperty` does); skip `ElementInternals` targets, which carry no host reference — same rationale as `bindState` ([ADR 0022](0022-debug-extension-for-visual-and-console-instrumentation.md)).

Two amendments from the PoC (LT-004):

**(a) The `null`/`undefined` row is a runtime contract, not a typed one.** `SingleMatchHandlers<T>` constrains `T extends {}`, which excludes `null`/`undefined` from the generic parameter under `strictNullChecks`. The value type is therefore `AriaValue = boolean | number | string | Element | readonly Element[]` — typed optimistically — while `ok()` still guards `value == null` at runtime, because a signal whose *resolved* value is legitimately `null` reaches `ok(null)` (cause-effect's `match()` routes to `nil` only on `UnsetSignalValueError`, i.e. pending/unset, never on a resolved null). This is the identical split `bindAttribute`'s and `bindStyle`'s map-form `ok(map)` already carry for absent keys, not a new inconsistency.

**(b) A map form ships alongside the single form**, matching every other binding helper after [ADR 0023](0023-map-form-overloads-for-bind-helpers.md) (v2.6):

```ts
watch('hue', bindAria(internals, ['ariaValueNow', 'ariaValueText']))
```

`names` is declared statically at the call site, so it is always the complete set of properties the binding owns: `ok(map)` assigns each declared name per the coercion table above, with an absent or nullish entry clearing that property; `nil` clears every declared property. This was **not** prototyped in the PoC and is the one part of §2 landing on ADR 0023's precedent rather than on measured evidence — but the PoC produced the motivating case directly: the LT-002 hue slider derives *two* ARIA properties (`ariaValueNow`, `ariaValueText`) from one hue value and needed two separate `bindAria()` calls driven from one throttled callback. Multi-property-from-one-source is if anything more common for ARIA than for style or attributes, and shipping the only `bind*` helper without a map form would be a gratuitous asymmetry in a v3.0 API. Implementation must prototype it before landing (see the follow-up task).

`bindAria()`'s return value is a plain object with `ok`/`nil`, so it also composes with imperative call sites that have no signal graph at all (verified against the raw-custom-element hue slider). That is a property of the shape, not a promoted usage pattern.

Static ARIA (`internals.role = 'slider'`, one-time `aria*Elements` wiring from a `first()` query) stays **imperative in the factory body** — no helper for statements that are already shorter than their helper call. This preserves ADR 0016's rejection grounds for wrapping single imperative statements; what changed is that *reactive* bindings now have a real mapping to hide (boolean coercion, null guards, nil routing), the same bar `bindState()` cleared.

### 3. Element-internals-declaration protocol, implemented once by the library

The `Truc` class constructor — the one place `attachInternals()` is already called ([ADR 0016](0016-element-internals-for-form-association-and-states.md) §1) — additionally registers the internals in the protocol's registry: `globalThis._elementInternals ??= new WeakMap()`, then `.set(this, internals)` when attach succeeded. This makes **every Le Truc component's internals visible to axe-core ≥ 4.13 with zero author opt-in** (how far axe can act on that visibility is qualified below), including in production builds (audits run against production; the registration is unconditional and costs one WeakMap set per instance). The library does **not** expose internals as a public host property — the protocol explicitly rejects public accessors (`.internals`/`._internals` collision risk), and the registry is declared to be tooling-only ("application-logic use explicitly unsupported"). It is a stopgap by design: removable without API impact once a native introspection API ships (whatwg/html#11040, w3c/aria #2663).

**Verified, with a narrower reach than axe's docs imply (LT-005).** The registration works exactly as designed: an unregistered element with `internals.role = 'button'` plus an invalid `aria-checked` attribute passes axe silently; the byte-for-byte identical registered element is flagged (`aria-allowed-attr`) in the same `axe.run()` pass, and a registered element with no violation stays clean. One WeakMap entry per instance, with no disconnect-time cleanup to write — `attachInternals()` lives in the constructor, which the upgrade algorithm runs exactly once per instance.

But of the four rules axe documents as ElementInternals-aware, only **`aria-allowed-attr` and `aria-prohibited-attr`** can act on an internals-only role in practice. `aria-required-attr`, `aria-required-parent`, and `aria-required-children` each declare `selector: '[role]'` in their compiled rule metadata — an attribute-presence CSS selector that excludes internals-only elements from the rule's element-selection pass *before* role computation (and its `elementInternals` fallback) ever runs. This is not documented; it was found by reading `axe-core`'s compiled rule definitions after a `list`/`listitem` probe stayed silent regardless of registration. Cite the supported subset with this qualification wherever it appears in documentation, and see the corrected consequence below.

### 4. `ariaOwnsElements`: withheld

Do not use or promote `ariaOwnsElements` — it does not exist in Chrome/Edge, and `aria-owns` is the one reference property whose semantics (reparenting for AT without visual reparenting) are problematic in their own right. Le Truc components own their internal structure and never need it. Revisit when Chromium ships it.

### 5. Documentation and examples migrate where reflection is strictly better

- `form-combobox`: replace the hand-rolled `aria-describedby` ID plumbing with `internals.ariaDescribedByElements = [descriptionEl]` (or the reactive binding once description content can change); `aria-expanded` moves to a `watch(isExpanded, bindAria(textbox, 'ariaExpanded'))` — the textbox is a native element, so the attribute mirror keeps it CSS-visible.
- The docs advisory in `docs-src/pages/components.md` ("keep explicit `aria-*` attributes") is replaced by the policy table above; the July 2026 blog post stands as a historical record.
- Examples keep attribute-based ARIA where CSS or attribute selectors consume it (`form-listbox`'s `[aria-selected="true"]`).
- **Migration is bounded by testability, not just by fit** (from the PoC): moving a host property to the internals channel forfeits its Playwright-visible assertion on every engine and its static nesting validation in axe. Migrate a property only when the reflection is strictly better *and* the resulting semantics can still be asserted — through the Chromium CDP tier, or through manual AT verification for anything cross-engine. Structural/composite roles stay on the attribute channel per the Consequences below.

## PoC validation

A five-task proof of concept (LT-001–LT-005, `test/poc/`, 2026-08-31) probed each channel against its hardest real case before this ADR was accepted. Full findings and their pinned tests live in [`test/poc/README.md`](../test/poc/README.md); the verdicts:

| Channel / claim | Hardest case probed | Verdict |
|---|---|---|
| Host default semantics (§1 row 3) | `form-colorgraph`-style hue slider: `internals.role = 'slider'` + four range properties, reactive at pointermove frequency | ✅ **Viable.** Role, static bounds and live `valuenow`/`valuetext` all reach the Chromium AX tree; 50 synchronous updates collapse to exactly one throttled flush. |
| Consumer override / reassert (§1 row 2) | Host attribute vs. internals default, for name *and* numeric value | ✅ **Viable** — and the *reason* the stale-attribute rule had to be added: the same mechanism that guarantees consumer override lets a stale SSR attribute shadow the component permanently. |
| Element references (§1 row 4) | Combobox: `ariaControls`/`DescribedBy`/`LabelledBy`/`ErrorMessage` static + `ariaActiveDescendantElement` retargeted per keystroke over an `all()` list | ✅ **Viable with caveats** — all five relationships reach the AX tree, `:not(:defined)` targets need no dependency wait; caveats are the `aria-invalid` gate and the empty-not-removed attribute mirror (see Consequences). |
| `bindAria()` contract (§2) | Every mapping-table row, plus re-wiring both probes through it | ✅ **Viable, signature refined** — see §2 (a)–(b) and §1's stale-attribute rule. The prototype is close enough to `src/bindings.ts`'s shape that landing it is a move, not a redesign. |
| Registry + axe gate (§3) | Registered vs. never-registered identical trap elements in one `axe.run()` | ⚠️ **Viable, reach narrower than documented** — the flip is real; the rule subset that can act on it is effectively two rules, and nesting validation is not among them. |
| Firefox / WebKit engine trees | — | ❌ **Unverifiable in CI.** Standing limitation; needs manual AT verification. |
| `ariaOwnsElements` (§4) | — | Not probed; withheld regardless. |

Two PoC-process findings worth carrying forward, both about false negatives in the *observation* rather than the platform: a mis-cased `internals.ariaValuenow` write silently created an inert data property (TypeScript catches this only when the target is typed `ElementInternals`/`ARIAMixin`, never when it is `any`), and CDP reports element-reference properties in a separate `relatedNodes` array rather than as a flat string. Both initially read as platform gaps. Any future ARIA verification should confirm a "not visible" result against the raw CDP shape before believing it.

## Alternatives Considered

- **Advisory lift only (no helper).** Authors would hand-roll `v => { internals?.ariaExpanded = String(v) }` per site — the exact boilerplate every binding helper in `src/bindings.ts` exists to remove, plus a null guard `bindProperty` lacks. Rejected: inconsistent with the library's own granularity (there is no "just write `el.classList.toggle`" purism either).
- **Reuse `bindProperty(internals, 'ariaExpanded')`.** Typechecks today (`bindProperty` is generic over any object) but has no null guard (throws on null internals), no boolean→`'true'`/`'false'` coercion (TS lib types are `string | null`, so every boolean prop needs a mapping thunk), and no `nil` path. Extending `bindProperty` with type-dependent coercion instead would hide ARIA semantics inside a general-purpose helper. Rejected; `bindAria` composes with it cleanly.
- **Declarative reflection map (e.g. `aria(internals, { expanded: 'expanded' })`) or `expose()`-integrated reflection.** Confuses the host's public prop surface with internal semantics — `expose()` declares what *consumers* see and set ([ADR 0002](0002-factory-form-over-builder-pattern.md)); reflected ARIA is component-owned default state that consumers override via attributes, a different axis. Also fails the "what complexity does this hide?" test: the map saves one `watch()` line per property but hides the effect. Rejected.
- **An `ariaReflection()` extension** auto-reflecting ARIA-named props. Over-magic: implicit writes for any prop whose name matches `aria*`, surprises on read, and ADR 0019 extensions are for class-level configuration, not per-property effect wiring. Rejected.
- **Reflection-first (deprecate attribute ARIA).** Breaks the server-authored initial-state channel (M3 — reflection cannot be expressed in HTML), CSS selection, `getAttribute()`-based consumer/test code, and the consumer-override story. The two-channel policy keeps each channel where it is strongest. Rejected.
- **Stale-attribute removal as a documented author responsibility** rather than part of `bindAria()`'s contract — i.e. authors write `this.removeAttribute('aria-expanded')` themselves before wiring the binding. Considered on the grounds that the platform cannot distinguish a stale SSR echo from a consumer override. Rejected: under this project's own model that distinction is *temporal*, not ambiguous — attributes are the connect-time initial-state channel ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md), M3), so a one-time removal at binding activation clears only the server-rendered echo and leaves post-connect overrides fully intact. Leaving it to authors would make a mandatory line optional, with a silent and total failure mode when forgotten (reflection writes land, nothing updates, no error). See §1's stale-attribute rule.
- **Public `host.internals` property** (simpler than the protocol WeakMap). The element-internals-declaration protocol deliberately rejects public accessors — `.internals` is exactly the kind of name a dozen libraries and user subclasses collide on. Rejected.

## Consequences

**Good:**

- Host semantics without markup noise: a component can make its host a `slider`/`listbox` with live `aria-valuenow`/`aria-selected` that no consumer framework rewriting the host's attributes can clobber — and the consumer can still override via the attribute channel, which the platform guarantees wins.
- Internal relationships lose their ID plumbing: element references kill the generate-an-id-then-`setAttribute` pattern and its failure modes (duplicate/missing IDs).
- Every Le Truc component becomes axe-core-visible out of the box (≥ 4.13), with no per-component opt-in — the library bears the protocol cost once, in the constructor. Verified end-to-end in LT-005, including that registration does not blanket-flag correct internals-role elements.
- One helper, one mental model: `bindAria(target, name)` spans host reflection, inner-element binding, string state, and element references, typed off the platform's own `ARIAMixin`.
- Attribute-validity rules regain the safety net for internals-set roles: an `aria-*` attribute that is invalid for a component's reflected role is flagged again (`aria-allowed-attr`/`aria-prohibited-attr`), where before it passed silently.

**Bad / trade-offs:**

- **The specific trap ADR 0016's advisory named is *not* recovered.** That advisory's concrete example was broken *nesting* — `internals.role = 'button'` with the native `<button>` dropped, or a `listitem` with no `list` parent — and nesting is checked by exactly the rules (`aria-required-parent`/`aria-required-children`) whose `[role]` selector never admits an internals-only element (§3). Reflecting a *structural* role via internals therefore still forfeits static nesting validation, registry or not. Guidance: reflect structural/composite roles (`list`, `listbox`, `menu`, `table` and their required children) via attributes, or keep the native element; reserve internals reflection for host-level widget and state semantics, where the recovered `aria-allowed-attr`/`aria-prohibited-attr` coverage actually applies. Revisit when axe drops those selector gates.
- **axe-core coverage is partial and will stay partial for a while**: only `internals.role` (not `ariaLabel` & co.), an effectively two-rule subset (above), and only via the registry WeakMap — which is itself a Draft protocol and a declared stopgap. Non-role internals semantics still need real-browser/AT verification, not just axe.
- **Ground truth is Chromium-only in CI.** Playwright exposes a computed-accessibility-tree API for Chromium (CDP) and nothing equivalent for Firefox or WebKit, so every engine-level claim in the PoC is a Chromium claim; Firefox/WebKit support is asserted from platform documentation and IDL behavior, not observed. Cross-engine confidence requires manual VoiceOver/NVDA verification, which must happen before the examples migrate (§5), not after.
- **Playwright's tooling tier is blind to internals on every engine** — `getByRole()` and `ariaSnapshot()` count attribute-carrying elements only. Any example or test whose ARIA moves from the attribute channel to the internals channel loses its Playwright-visible assertion and must be re-asserted through the Chromium-only CDP tier. The examples suite currently makes ~160 attribute-based ARIA assertions; most sit on inner native elements, which §1 keeps on the attribute channel, but every host-level migration pays this cost. This bounds how far §5 should go.
- **Two spec-level gotchas for the element-reference channel**: `ariaErrorMessageElements` is inert until `aria-invalid` is also set, and assigning any `aria*Elements` property *empties* the mirrored content attribute (`getAttribute() === ''`) rather than removing it — code testing "was this set via attributes" needs empty-string semantics, not `hasAttribute()`.
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
- Related: [ADR 0023](0023-map-form-overloads-for-bind-helpers.md) — the map-form precedent `bindAria()` follows (§2b)
- Evidence: [`test/poc/README.md`](../test/poc/README.md) — LT-001–LT-005 findings and pinned observations behind the PoC validation table
- Motivating issue: [zeixcom/le-truc#121](https://github.com/zeixcom/le-truc/issues/121)
- External: [Deque: axe-core ElementInternals support](https://www.deque.com/blog/test-your-custom-elements-and-trust-the-results-with-axe-cores-support-for-elementinternals/) · [axe-core element-internals docs](https://github.com/dequelabs/axe-core/blob/develop/doc/element-internals.md) · [element-internals-declaration protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/element-internals-declaration.md) · [MDN ARIAMixin](https://developer.mozilla.org/en-US/docs/Web/API/ARIAMixin)
- Supersedes: None
