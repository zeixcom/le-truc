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

**Not every compile-time finding is a diagnostic.** [ADR 0029](0029-tiered-server-evaluation.md) and [ADR 0030](0030-internationalization-as-build-time-server-data.md) add **census records** — the tier census and the translation census — which report what the build discovered without asserting that anything is wrong. A census entry is not a failure, has no runtime counterpart, and therefore lands in no tier here. The rule above is unchanged and stays one-directional: a runtime check that is statically decidable owes a `TSRX` diagnostic. It does not follow that everything the compiler learns is one.

### 2. Three tiers, named

The **name is the handle**; the number is only an ordering. A bare "tier 2" is ambiguous now that ADR [0029](0029-tiered-server-evaluation.md) has evaluation tiers of its own, so these are referred to by name everywhere outside this list.

- **The Prevented tier — Prevented.** A compile-time diagnostic exists (or is owed). The build fails; the author never ships it. The runtime check remains, behaving as **Contained**.
- **The Contained tier — Contained.** The check fires at runtime, the component degrades, and exactly one attributed diagnostic is reported through `console.error` naming the component and the phase. It never escapes `connectedCallback`. **This is the default for everything the runtime detects.**
- **The Escalated tier — Escalated.** Escapes containment. Reserved for two cases, both of which are *structurally* outside `connectedCallback` rather than marked as exceptions to it:
  - **Definition-time failures**, where no component exists yet to degrade (`InvalidComponentNameError`, `ExtensionCollisionError` — both thrown from `defineComponent()` at module evaluation).
  - **Security-boundary violations**, where the page's own error reporting is the point. Today this is exactly one site: `dangerouslyBindInnerHTML`'s microtask re-throw of a Trusted Types violation ([ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) §4 — the browser's enforcement is the appropriate backstop). ADR 0027's driver treats an escaped the Escalated tier as a build error attributed to the component.

**Consequence: the contract-error brand is deleted.** `TrucError`, `TrucTypeError` and `isContractError()` go away, and containment inside `connectedCallback` becomes unconditional. Both the Escalated tier paths already sit outside that boundary — one before the class is defined, one inside a `queueMicrotask` — so neither needs a marker to escape it. Nothing has to be remembered to keep working.

### 3. Containment granularity follows the phase

- **Factory phase** (`factory(context)` and extension `onConnect`): whole-component. The factory is one indivisible consumer function; execution cannot resume past a throw without restructuring the authoring model. `MissingElementError`, `InvalidPropertyNameError`, `NoActiveCollectorError` land here.
- **Activation phase** (`activateResult`): **per descriptor.** Effect descriptors are already a list of independent thunks ([ADR 0018](0018-implicit-effect-collection-via-ambient-context.md)); a throwing one is dropped and reported, and every other descriptor still activates. A failed `pass()` binding costs that binding, not the component's twelve working effects. This is the substantive change from LT-149's uniform per-component containment.

### 4. Degradation is DOM-is-truth, not a fallback UI

Le Truc never renders initial HTML ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md), [§5 Prohibited](../REQUIREMENTS.md#prohibited)). A component that fails to enhance therefore degrades to markup that is *already correct* — the server-rendered, pre-JS state. There is no fallback to design and no error boundary to author: the degradation path is the thing that was on screen a moment ago. This is what makes containment the right default here where it would be wrong in a framework that must render to have anything at all.

**Amended by [ADR 0029](0029-tiered-server-evaluation.md): "already correct" now varies by evaluation tier, and is weakest exactly where a degraded component is most likely to be noticed.** A Folded-tier component's pre-JS markup carries every reactive initial value, so the claim above holds unchanged; a Simulated-tier component's carries the realm's answers. But a **Static-tier** component's markup deliberately *omits* what no server phase could resolve — as does any unresolvable expression in any tier (ADR 0029 sub-design 1) — so its degraded state is not the intended state, it is the absent one. That is usually right, and it is the accepted trade: a scroll-overflow state genuinely has no server answer. It is not right for a semantically-loaded attribute on a real submittable form control, which is exactly why `TSRX034`'s severe variant survives scoped to the Static tier instead of dissolving into the tier census. The mitigation is authored, not automatic: give such an element a static or server-rendered default so the no-JS state is the one the author chose.

### 5. Inventory

| Error | Throws from | (a) Compiler channel | (b) Client behavior |
|---|---|---|---|
| `InvalidComponentNameError` | `defineComponent()`, module eval | Compiler owns the tag name (`TSRX008`) | **The Escalated tier** — no component exists to degrade |
| `ExtensionCollisionError` | `mergeExtensions()`, module eval | `TSRX009` (extension declarations) | **The Escalated tier**, DEV only; production is first-wins |
| `InvalidPropertyNameError` — managed member | `#initSignals` | **`TSRX028`** ✅ | **Contained** |
| `InvalidPropertyNameError` — reserved word | `#initSignals` | **`TSRX028`** ✅ (LT-157a) — the same code as the managed-member branch; the author's fix is the same rename | **Contained**. The prototype chain is protected by the throw's *ordering* (before `defineProperty`), not by its escaping |
| `MissingElementError` | `first`/`query` required | **`TSRX026`** (no match), **`TSRX040`** (conditional branch), `TSRX025` ✅ | **Contained**. The only content-dependent error in the set — it fires on markup drift, not on bad source |
| `InvalidSelectorError` | `all`/`queryAll` | **`TSRX026`** ✅ (LT-157b) — a *malformed* selector, decided outright; the rule is one-sided, so a selector it passes is not thereby claimed valid | **Contained**. `all()`'s selector is the one emitted verbatim into the client, so this is where the check earns its keep |
| `NoActiveCollectorError` | `pushDescriptor` | **`TSRX013`** ✅ (LT-157d) for a collector helper deferred into a callback — **note: [ADR 0029](0029-tiered-server-evaluation.md) splits `TSRX013` and this rule takes its own code, since it is a client-side bug rather than a server-evaluation guard; re-point this row when LT-165 lands** — plus **`TSRX008`** ✅ for an `async` component function. The compiler cannot emit the shape, so the rule exists entirely for authored setup | **Contained** |
| `InvalidCustomElementError` | `swapSlots` | **`TSRX012`** (`passTargetNotCustom`) ✅ | **Contained** |
| `InvalidReactivesError` | `swapSlots` | TypeScript — `props` is typed | **Contained** |
| `InvalidPassPropertyError` | `swapSlots` | **`TSRX012`** ✅ (LT-158) — registry membership decides a foreign target, and the target's own `expose()` decides per-prop Slot-backedness (see §6) | **Contained**, for hand-authored and foreign targets |
| `InvalidTemplateError` | `reconcile()` | **None needed** (LT-157c) — `emit-server.ts`'s `listTemplateLines` shapes a single element node, so a compiled `<template>` has exactly one root *by construction*. Pinned by a corpus test rather than a rule, since there is nothing to decide | **Contained**, for hand-authored `reconcile()` calls only |
| `DependencyTimeoutError` | *logged, never thrown* | n/a | Already the Contained tier. **The existing precedent this ADR generalizes** ([§4 Reliability](../REQUIREMENTS.md#reliability)) |
| Unsafe attribute name/value | `safeSetAttribute` | Not decidable — fires on runtime *data* | **Contained**. The security guarantee is the `setAttribute` **not happening**, not the throw. Needs a real error class so the report names the component |
| Trusted Types violation | `dangerouslyBindInnerHTML` | n/a | **The Escalated tier** (ADR 0010 §4) |

### 6. Two residuals the registry closes

`InvalidPassPropertyError`'s hard case — ADR 0011's own motivating example — is a target whose prop *exists* but is not Slot-backed: a Lit/vanilla custom element with a matching property, or a Le Truc prop exposed read-only ([ADR 0004](0004-slot-based-signal-swapping-for-inter-component-binding.md)). TypeScript accepts both structurally. Both are knowable at compile time — registry membership decides the first, the target's own `expose()` decides the second — but `RegistryEntry` recorded only `propsType`'s *name*, not its members or their writability.

**Closed by LT-158.** `RegistryEntry.exposedProps` now maps every `expose()` key to how its initializer lands on the host: `slot` (a plain value, a Parser, or a `{ get, set }` descriptor — mutable, hence Slot-backed), `computed` (read-only), or `method` (a `defineMethod()` producer, not reactive at all). `TSRX012` decides a `pass={{ }}` against the target entry's map.

Implementing it turned up a shape worth recording, because it inverts the intuition the rule is built on: **`expose({ x: sig.get })` is read-only however mutable `sig` is.** `sig.get` is a bare function, so it is neither a signal nor a descriptor, and `#setAccessor` wraps it in `deriveCell`. That is the corpus's single most common expose shape, which means the residual this section set out to close was not a corner case at all — it was the default. Verified against the runtime rather than inferred from the types.

## Alternatives Considered

- **Amend ADR 0011 in place, keeping `pass()` loud.** Rejected. The premise that expired is not specific to `pass()` — it is that a throw is cheap. Patching one ADR would leave the same reasoning applied inconsistently across eleven other error classes, which is how the LT-149 brand over-reached in the first place.
- **Keep LT-149's file-scoped brand.** Rejected. "Declared in `src/errors.ts`" is not a semantic. It made `MissingElementError` — the one error that depends on runtime content rather than source code, and so the one most likely to fire under ADR 0027 on markup drift — the loudest thing in the library, by accident of file placement.
- **Contain everything, no the Escalated tier.** Rejected for the security site. A Trusted Types violation should reach the page's error reporting; ADR 0010 §4 already decided the browser's own enforcement is the backstop, and suppressing the JS-side signal narrows that to the CSP report alone.
- **Per-descriptor containment in the factory phase too.** Rejected as not achievable. Catching around each `expose()`/`first()` call cannot resume a consumer function past a throw; it would require moving setup into declarative units, which is a much larger change to the authoring model than this ADR justifies.
- **A consumer-facing `onError` hook.** Rejected, carrying forward ADR 0011's reasoning unchanged: deferred activation means the failure happens after the factory returned, so there is no runtime context the component could recover into. DOM-is-truth (§4) is the recovery.

## Consequences

**Good:**

- One rule with no remembered exceptions: everything reaching `connectedCallback` is contained. The brand, and the risk of a future error class landing on the wrong side of it by accident, are deleted.
- ADR 0027 becomes safe by construction — no single component can fail a build without attribution, and per-component containment stops depending on which wrapper the host runtime happens to provide.
- Better degradation: a failed `pass()` costs one binding, not every effect in the component.
- Failures are diagnosed where they are cheapest to fix. All four owed rules landed in LT-157, and the registry extension in LT-158; every inventory row now names a channel that exists.
- The error surface gets a single documented contract instead of eleven per-class precedents.

**Bad:**

- Behavior change for consumers who relied on `pageerror` to detect `pass()` and reserved-word failures — including three of our own Playwright specs. `examples/form/colorgraph/form-colorgraph.spec.ts:85` asserts `MissingElementError` is *absent* from `pageerror`; once contained it can never appear there and the guard passes vacuously, so it must be re-pointed at the console channel in the same commit.
- A contained failure is quieter than an uncaught one. Mitigated by the compiler carrying the loud half, but a hand-authored no-build component genuinely loses signal strength — this is the cost of [M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported) coexisting with a compiler.
- Per-descriptor activation containment means a component can now be *partially* enhanced, a state that did not previously exist. The diagnostic must name the descriptor's helper and target precisely enough that "half of it works" is debuggable.
- ~~Four compiler rules and a registry extension are owed before the Prevented tier is honest.~~ **Closed by LT-157 and LT-158.** One row resolved differently than this ADR assumed: `InvalidTemplateError` needs no rule, because a compiled `@for` template cannot have the shape the runtime rejects. The residual cost is that three of the new rules are deliberately *one-sided* — the malformed-selector check, the deferred-collector scan, and the per-prop `pass()` check all stay silent where they cannot decide, so the Prevented tier covers less than the table's ✅ marks suggest and the the Contained tier backstop still does real work.

## Related

- Requirements: [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass), [M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported), [M16](../REQUIREMENTS.md#m16-security-validation-in-setattribute), [S2](../REQUIREMENTS.md#s2-required-element-error-messages-are-actionable), [S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics), [S5](../REQUIREMENTS.md#s5-typed-throwing-root-parameterized-element-lookup-queryqueryall), [§4 Reliability](../REQUIREMENTS.md#reliability)
- Architecture: [Lifecycle](../ARCHITECTURE.md#lifecycle), [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), [Security](../ARCHITECTURE.md#security)
- Amended by: [ADR 0029](0029-tiered-server-evaluation.md) (§1 census records are not diagnostics; §4 degradation quality varies by evaluation tier; §5's `TSRX013` row re-points when the code splits)
- Related ADRs: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (DOM-is-truth — the degradation path), [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) (the the Escalated tier security site), [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (descriptor list — why per-descriptor containment is possible), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the compiler channel), [ADR 0027](0027-server-simulation.md) (why a throw is no longer cheap)
- Supersedes: [ADR 0011](0011-throw-on-pass-binding-failure.md)
