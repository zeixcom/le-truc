# ADR 0028: Tiered Error Surfacing — Compiler First, Contained Runtime

## Status

✅ Accepted

## Context

[ADR 0011](0011-throw-on-pass-binding-failure.md) decided that a `pass()` binding failure surfaces as an uncaught `connectedCallback` exception — "a development-time signal, not a recoverable condition." Two premises made that safe, and both expired. Le Truc was client-only on an already-rendered page — a loud throw cost at most one component's enhancement; under [ADR 0027](0027-server-simulation.md) the same throw runs inside a build, where nothing contains it: one authoring bug becomes a failed build with a stack trace into jsdom. And the runtime was the only channel. The compiler now owns roughly half the error surface, so a runtime throw for a condition it already rejected repeats something the author was told in their editor. Containing consumer throws while preserving ADR 0011 meant branding every class in `src/errors.ts` loud — a brand around a *file*, not a semantic, sweeping in errors no ADR ever discussed. This ADR replaces both.

## Decision

**Route every failure to the cheapest channel that can carry it, and never let the expensive channel repeat work the cheap one already did.** A compile-time diagnostic reaches the author before any user; a runtime throw costs a build under ADR 0027 and, on a live page, whatever the host's reaction wrapper decides.

1. **The compiler is the primary channel; the runtime is the backstop.** Every runtime check decidable from source and template **must** have a diagnostic. Codes are `LTC###` (surface-neutral), except six `.tsrx`-grammar codes that keep `TSRX`; the ledger is [VOCABULARY_LEDGER.md](../server/compiler/VOCABULARY_LEDGER.md). The runtime check remains a backstop for hand-authored no-build components ([M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported)), foreign markup, and DOM changed after render. It fails safely rather than notifying. Not every compile-time finding is a diagnostic: the tier and translation censuses ([ADR 0029](0029-tiered-server-evaluation.md), [ADR 0030](0030-internationalization-as-build-time-server-data.md)) report without asserting wrongness — no runtime counterpart, no tier. The rule stays one-directional.

2. **Three surfacing tiers, named — the name is the handle, the list order only an ordering** (ADR 0029 has evaluation tiers of its own; refer to these by name outside this list).
   1. **Prevented**: a compile-time diagnostic exists (or is owed), and the build fails. The runtime check remains, behaving Contained.
   2. **Contained**: the check fires at runtime, the component degrades, and exactly one attributed `console.error` names the component and the phase. It never escapes `connectedCallback`. This is the default for everything the runtime detects.
   3. **Escalated**: the failure escapes containment. It is reserved for two cases *structurally* outside `connectedCallback`: definition-time failures (no component exists yet to degrade) and the security site, the innerHTML Trusted Types re-throw ([ADR 0010](0010-trusted-types-support-via-sanitize-hook.md)), where the page's own error reporting is the point. The simulation driver treats an Escalated escape as a build error.

   **The contract-error brand is deleted.** Containment inside `connectedCallback` becomes unconditional, and both Escalated paths already sit outside it, so nothing has to be remembered.

3. **Containment granularity follows the phase.** Factory phase: whole-component. The factory is one indivisible consumer function, and execution cannot resume past a throw. Activation phase: **per effect descriptor**. Descriptors are independent thunks ([ADR 0018](0018-implicit-effect-collection-via-ambient-context.md)); a throwing one is dropped and reported, and the rest activate. A failed `pass()` costs the binding, not the component's other effects.

4. **Degradation is DOM-is-truth, not a fallback UI.** Le Truc never renders initial HTML. A failing component degrades to markup that is *already correct* — the server-rendered, pre-JS state. There is no fallback to design and no error boundary to author. The result varies by evaluation tier ([ADR 0029](0029-tiered-server-evaluation.md)). Folded markup carries every initial value. Static markup, and any unresolvable expression in any tier, omits what no server phase could resolve. That is usually right and accepted. It is wrong for a semantically-loaded attribute on a submittable control, which is why that severe diagnostic survives, per expression. Mitigation is authored: give such elements a static default.

5. **Inventory.** Every error class has a channel that exists. Definition-time failures (invalid component name; extension collision, DEV only — production is first-wins) are **Escalated**. The rest are **Contained**, with compiler rules where decidable:
   - invalid or reserved exposed property names;
   - missing elements — the one content-dependent error, firing on markup drift, not bad source;
   - malformed selectors (one-sided);
   - foreign `pass()` targets (registry membership plus per-prop Slot-backedness).

   Invalid templates need no rule: a compiled template has one root by construction, corpus-pinned. `DependencyTimeoutError` is logged, never thrown — the Contained precedent. Unsafe attribute data is not decidable. The guarantee is that the `setAttribute` **does not happen**; the report still names the component. Compiler rules live in `server/compiler/diagnostics.ts`; runtime classes in `src/errors.ts`.

6. **The registry residual.** `RegistryEntry.exposedProps` maps every `expose()` key to how its initializer lands: `slot` (value, Parser, `{ get, set }` — mutable, Slot-backed), `computed` (read-only), or `method` (a `defineMethod()` producer, not reactive). This makes a `pass()` against a non-Slot-backed prop decidable. `expose({ x: sig.get })` is read-only however mutable `sig` is — a bare function is neither signal nor descriptor. It is the corpus's most common expose shape, so the residual closed here is the default, not a corner case.

## Alternatives Considered

- **Amend ADR 0011 in place**: the expired premise is not `pass()`-specific — it is that a throw is cheap; patching one ADR leaves the reasoning inconsistent across the other classes.
- **Keep the file-scoped brand**: file placement is not a semantic; it made the content-dependent markup-drift error the loudest thing in the library by accident.
- **Contain everything**: a Trusted Types violation should reach the page's error reporting; suppressing the JS signal narrows reporting to the CSP report alone.
- **Per-descriptor containment in the factory phase**: not achievable. A consumer function cannot resume past a throw; achieving it means restructuring the authoring model.
- **A consumer-facing `onError` hook**: deferred activation means the failure happens after the factory returned, so there is no runtime context to recover into. DOM-is-truth is the recovery.

## Consequences

**Good:**

- One rule with no remembered exceptions: everything reaching `connectedCallback` is contained; the brand — and the risk of a future class landing on the wrong side of it — is deleted.
- ADR 0027 becomes safe by construction: no single component fails a build without attribution.
- A failed `pass()` costs one binding, not every effect.
- Failures are diagnosed where they are cheapest to fix.
- One documented contract replaces per-class precedents.

**Bad / accepted tradeoffs:**

- Consumers who relied on `pageerror` to detect `pass()` or reserved-word failures now get only a `console.error` — including specs asserting an error's *absence*, which pass vacuously and must re-point at the console channel.
- A contained failure is quieter; a hand-authored no-build component genuinely loses signal strength — the cost of [M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported) coexisting with a compiler.
- Per-descriptor containment means a component can be *partially* enhanced — the diagnostic must name the descriptor's helper and target precisely enough that "half of it works" is debuggable.
- Several rules are deliberately one-sided, staying silent where they cannot decide. Prevented covers less than its inventory suggests, and the Contained backstop does real work.

## Related

- Requirements: [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass), [M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported), [M16](../REQUIREMENTS.md#m16-security-validation-in-setattribute), [S2](../REQUIREMENTS.md#s2-required-element-error-messages-are-actionable), [S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics), [S5](../REQUIREMENTS.md#s5-typed-throwing-root-parameterized-element-lookup-queryqueryall), [§4 Reliability](../REQUIREMENTS.md#reliability)
- Architecture: [Lifecycle](../ARCHITECTURE.md#lifecycle), [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), [Security](../ARCHITECTURE.md#security)
- Supersedes: [ADR 0011](0011-throw-on-pass-binding-failure.md)
- Related: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (DOM-is-truth — the degradation path), [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) (the Escalated security site), [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (descriptor list), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the compiler channel), [ADR 0027](0027-server-simulation.md) (why a throw is no longer cheap), [ADR 0029](0029-tiered-server-evaluation.md) (censuses are not diagnostics; degradation varies by tier)
