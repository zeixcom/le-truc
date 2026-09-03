# ADR 0028: Tiered Error Surfacing — Compiler First, Contained Runtime

## Status

✅ Accepted

## Context

[ADR 0011](0011-throw-on-pass-binding-failure.md) decided that a `pass()` binding failure surfaces as an **uncaught `connectedCallback` exception**, visible via `pageerror` — "a development-time signal, not a recoverable condition." Two premises made that safe, and both have expired:

1. **Le Truc was client-only, on an already-rendered page.** A loud throw could cost at most one component's enhancement; the server-rendered markup stayed on screen and the rest of the page kept working. Under [ADR 0027](0027-server-simulation.md) the same throw runs inside a build, where nothing contains it and no wrapper attributes it — one component's authoring bug becomes a failed build with a stack trace pointing into `jsdom`.
2. **The runtime was the only channel.** [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) gave us a compiler that owns the markup and sees the source. Roughly half the runtime error surface is now decidable at compile time — `MissingElementError` is `TSRX026`/`TSRX040`, `InvalidPropertyNameError`'s managed-member branch is `TSRX028`, `InvalidCustomElementError` is `TSRX012`. A runtime throw for a condition the compiler already rejected is a second notification of something the author was told about in their editor.

A first attempt contained consumer-code throws in `connectedCallback` but preserved ADR 0011 by branding every class in `src/errors.ts` as loud. That brand is drawn around a *file*, not a semantic: it swept in `MissingElementError`, `InvalidSelectorError` and `InvalidTemplateError`, which no ADR ever discussed. This ADR replaces both the brand and ADR 0011's premise.

## Decision

**Route every failure to the cheapest channel that can carry it, and never let the expensive channel repeat work the cheap one already did.** A compile-time diagnostic reaches the author in their editor before any user; a runtime throw costs a build under ADR 0027 and, on a live page, whatever the host's reaction wrapper decides.

### 1. The compiler is the primary channel; the runtime is the backstop

Every runtime check that is decidable from the source and the template **must** have a TSRX diagnostic. The runtime check is not deleted — it still guards hand-authored components ([M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported), no-build CDN usage), foreign markup a component only enhances, and DOM that changed after the server rendered it. But it is a *backstop*, not the notification: its job is to fail safely, not to be how the author finds out.

### 2. Three tiers

- **Tier 1 — Prevented.** A compile-time diagnostic exists (or is owed). The build fails; the author never ships it. The runtime check remains, behaving as Tier 2.
- **Tier 2 — Contained.** The check fires at runtime, the component degrades, and exactly one attributed diagnostic is reported through `console.error` naming the component and the phase. It never escapes `connectedCallback`. **This is the default for everything the runtime detects.**
- **Tier 3 — Escalated.** Escapes containment. Reserved for two cases, both of which are *structurally* outside `connectedCallback` rather than marked as exceptions to it:
  - **Definition-time failures**, where no component exists yet to degrade (`InvalidComponentNameError`, `ExtensionCollisionError` — both thrown from `defineComponent()` at module evaluation).
  - **Security-boundary violations**, where the page's own error reporting is the point. Today this is exactly one site: `dangerouslyBindInnerHTML`'s microtask re-throw of a Trusted Types violation ([ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) §4 — the browser's enforcement is the appropriate backstop). ADR 0027's driver treats an escaped Tier 3 as a build error attributed to the component.

**Consequence: the contract-error brand is deleted.** `TrucError`, `TrucTypeError` and `isContractError()` go away, and containment inside `connectedCallback` becomes unconditional. Both Tier 3 paths already sit outside that boundary — one before the class is defined, one inside a `queueMicrotask` — so neither needs a marker to escape it. Nothing has to be remembered to keep working.

### 3. Containment granularity follows the phase

- **Factory phase** (`factory(context)` and extension `onConnect`): whole-component. The factory is one indivisible consumer function; execution cannot resume past a throw without restructuring the authoring model. `MissingElementError`, `InvalidPropertyNameError`, `NoActiveCollectorError` land here.
- **Activation phase** (`activateResult`): **per descriptor.** Effect descriptors are already a list of independent thunks ([ADR 0018](0018-implicit-effect-collection-via-ambient-context.md)); a throwing one is dropped and reported, and every other descriptor still activates. A failed `pass()` binding costs that binding, not the component's twelve working effects. This is the substantive change from LT-149's uniform per-component containment.

### 4. Degradation is DOM-is-truth, not a fallback UI

Le Truc never renders initial HTML ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md), [§5 Prohibited](../REQUIREMENTS.md#prohibited)). A component that fails to enhance therefore degrades to markup that is *already correct* — the server-rendered, pre-JS state. There is no fallback to design and no error boundary to author: the degradation path is the thing that was on screen a moment ago. This is what makes containment the right default here where it would be wrong in a framework that must render to have anything at all.

### 5. Inventory

| Error | Throws from | (a) Compiler channel | (b) Client behavior |
|---|---|---|---|
| `InvalidComponentNameError` | `defineComponent()`, module eval | Compiler owns the tag name (`TSRX008`) | **Tier 3** — no component exists to degrade |
| `ExtensionCollisionError` | `mergeExtensions()`, module eval | `TSRX009` (extension declarations) | **Tier 3**, DEV only; production is first-wins |
| `InvalidPropertyNameError` — managed member | `#initSignals` | **`TSRX028`** ✅ | Tier 2 |
| `InvalidPropertyNameError` — reserved word | `#initSignals` | **Owed** — `expose()` keys vs. `ReservedWords` is statically decidable | Tier 2. The prototype chain is protected by the throw's *ordering* (before `defineProperty`), not by its escaping |
| `MissingElementError` | `first`/`query` required | **`TSRX026`** (no match), **`TSRX040`** (conditional branch), `TSRX025` ✅ | Tier 2. The only content-dependent error in the set — it fires on markup drift, not on bad source |
| `InvalidSelectorError` | `all`/`queryAll` | **Owed** — a malformed selector is decidable; `TSRX026` covers the unverifiable-syntax half | Tier 2 |
| `NoActiveCollectorError` | `pushDescriptor` | Compiler cannot emit this shape; **owed** for hand-authored (async factory, deferred callback) | Tier 2 |
| `InvalidCustomElementError` | `swapSlots` | **`TSRX012`** (`passTargetNotCustom`) ✅ | Tier 2 |
| `InvalidReactivesError` | `swapSlots` | TypeScript — `props` is typed | Tier 2 |
| `InvalidPassPropertyError` | `swapSlots` | **Partial.** `TSRX012` + `PassedProps<P>` typing cover the common cases. Two residuals need registry work — see §6 | Tier 2 |
| `InvalidTemplateError` | `reconcile()` | **Owed** — `@for` templates are compiler-generated (`TSRX001`) | Tier 2 |
| `DependencyTimeoutError` | *logged, never thrown* | n/a | Already Tier 2. **The existing precedent this ADR generalizes** ([§4 Reliability](../REQUIREMENTS.md#reliability)) |
| Unsafe attribute name/value | `safeSetAttribute` | Not decidable — fires on runtime *data* | Tier 2. The security guarantee is the `setAttribute` **not happening**, not the throw. Needs a real error class so the report names the component |
| Trusted Types violation | `dangerouslyBindInnerHTML` | n/a | **Tier 3** (ADR 0010 §4) |

### 6. Two residuals the registry should close

`InvalidPassPropertyError`'s hard case — ADR 0011's own motivating example — is a target whose prop *exists* but is not Slot-backed: a Lit/vanilla custom element with a matching property, or a Le Truc prop exposed as a `deriveCell` (read-only, [ADR 0004](0004-slot-based-signal-swapping-for-inter-component-binding.md)). TypeScript accepts both structurally. Both are knowable at compile time — registry membership decides the first, the target's own `expose()` decides the second — but `RegistryEntry` records only `propsType`'s *name* today, not its members or their writability. Extending it moves this from Tier 2 to Tier 1 and retires the last of ADR 0011's rationale.

## Alternatives Considered

- **Amend ADR 0011 in place, keeping `pass()` loud.** Rejected. The premise that expired is not specific to `pass()` — it is that a throw is cheap. Patching one ADR would leave the same reasoning applied inconsistently across eleven other error classes, which is how the LT-149 brand over-reached in the first place.
- **Keep LT-149's file-scoped brand.** Rejected. "Declared in `src/errors.ts`" is not a semantic. It made `MissingElementError` — the one error that depends on runtime content rather than source code, and so the one most likely to fire under ADR 0027 on markup drift — the loudest thing in the library, by accident of file placement.
- **Contain everything, no Tier 3.** Rejected for the security site. A Trusted Types violation should reach the page's error reporting; ADR 0010 §4 already decided the browser's own enforcement is the backstop, and suppressing the JS-side signal narrows that to the CSP report alone.
- **Per-descriptor containment in the factory phase too.** Rejected as not achievable. Catching around each `expose()`/`first()` call cannot resume a consumer function past a throw; it would require moving setup into declarative units, which is a much larger change to the authoring model than this ADR justifies.
- **A consumer-facing `onError` hook.** Rejected, carrying forward ADR 0011's reasoning unchanged: deferred activation means the failure happens after the factory returned, so there is no runtime context the component could recover into. DOM-is-truth (§4) is the recovery.

## Consequences

**Good:**

- One rule with no remembered exceptions: everything reaching `connectedCallback` is contained. The brand, and the risk of a future error class landing on the wrong side of it by accident, are deleted.
- ADR 0027 becomes safe by construction — no single component can fail a build without attribution, and per-component containment stops depending on which wrapper the host runtime happens to provide.
- Better degradation: a failed `pass()` costs one binding, not every effect in the component.
- Failures are diagnosed where they are cheapest to fix. Four rules are owed (`InvalidSelectorError`, `InvalidTemplateError`, the reserved-word branch, hand-authored `NoActiveCollectorError`); the rest of Tier 1 already exists.
- The error surface gets a single documented contract instead of eleven per-class precedents.

**Bad:**

- Behavior change for consumers who relied on `pageerror` to detect `pass()` and reserved-word failures — including three of our own Playwright specs. `examples/form/colorgraph/form-colorgraph.spec.ts:85` asserts `MissingElementError` is *absent* from `pageerror`; once contained it can never appear there and the guard passes vacuously, so it must be re-pointed at the console channel in the same commit.
- A contained failure is quieter than an uncaught one. Mitigated by the compiler carrying the loud half, but a hand-authored no-build component genuinely loses signal strength — this is the cost of [M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported) coexisting with a compiler.
- Per-descriptor activation containment means a component can now be *partially* enhanced, a state that did not previously exist. The diagnostic must name the descriptor's helper and target precisely enough that "half of it works" is debuggable.
- Four compiler rules and a registry extension are owed before Tier 1 is honest; until then the table's "owed" rows are aspiration, not description.

## Related

- Requirements: [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass), [M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported), [M16](../REQUIREMENTS.md#m16-security-validation-in-setattribute), [S2](../REQUIREMENTS.md#s2-required-element-error-messages-are-actionable), [S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics), [S5](../REQUIREMENTS.md#s5-typed-throwing-root-parameterized-element-lookup-queryqueryall), [§4 Reliability](../REQUIREMENTS.md#reliability)
- Architecture: [Lifecycle](../ARCHITECTURE.md#lifecycle), [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), [Security](../ARCHITECTURE.md#security)
- Related ADRs: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (DOM-is-truth — the degradation path), [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) (the Tier 3 security site), [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (descriptor list — why per-descriptor containment is possible), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the compiler channel), [ADR 0027](0027-server-simulation.md) (why a throw is no longer cheap)
- Supersedes: [ADR 0011](0011-throw-on-pass-binding-failure.md)
