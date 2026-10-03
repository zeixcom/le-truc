# Non-Obvious Behaviors

Every fact this file once carried now lives in a writable home — this is a pointer, not a reference. Where to look, by topic:

- **Author-facing traps** (observedAttributes opt-in, parser/method branding, hand-authored descriptors, `pass()` scope, lazy `all()` observer, `setAttribute` validation, nil routing, dependency timeout, `on()` return values, context retries, `expose()` descriptors, form reset, DEV_MODE guards and testing them): **`AGENTS.md` → *Surprising Behaviors***.
- **Mental models** (factory form, lifecycle and connect-time error containment, effect descriptors, list reconciliation and its arm form, the query system, tiering): **`ARCHITECTURE.md`** and the ADR it cites.
- **Per-function contracts**: the JSDoc of the function itself —
  - `src/types.ts` (`isParser`, `asParser`, `defineMethod`, `EffectDescriptor`),
  - `src/internal.ts` (`pushDescriptor`, `describeDescriptor`, `isUsableInternals`),
  - `src/component.ts` (`defineComponent`, `#initSignals`, `#setAccessor`),
  - `src/helpers/reactive.ts` (`makeWatch`, `makePass`, `each`, `reconcile`, `activateDescriptors`),
  - `src/helpers/dom.ts` (`query`, `queryAll`, `makeElementQueries`),
  - `src/helpers/events.ts` (`OnEventHandler`, `makeOn`),
  - `src/helpers/context.ts` (`ContextRequestEvent`, `makeProvideContexts`, `makeRequestContext`),
  - `src/bindings.ts` (module doc: map-form convention; `safeSetAttribute`, `bindStyle`, `bindAria`, `dangerouslyBindInnerHTML`),
  - `src/extensions/attributes.ts` (`observedAttributes`),
  - `src/extensions/debug.ts` (module doc: pulse keys, PURE annotations, the metaKey toggle),
  - `src/extensions/form.ts` (`formAssociated`, `formAssociatedCheckbox`, `makeResetCallback`, `makeDefaultPropDescriptor`).

If you are about to add a runtime gotcha here: put it in the JSDoc of the function it describes, or in `AGENTS.md` when it surprises an author. This file stays a pointer only when every entry it would name has a writable home.
