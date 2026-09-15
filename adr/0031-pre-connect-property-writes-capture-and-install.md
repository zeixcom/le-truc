# ADR 0031: Pre-Connect Property Writes Are Captured and Installed

## Status

✅ Accepted (2026-09-15).

## Context

Custom element `connectedCallback`s fire parent-first for any subtree inserted in one operation (spec-mandated tree order), so a parent factory can synchronously write a child's `expose()`d property before the child upgrades — dynamic composition (`innerHTML`, `replaceChildren`, template cloning) hits this on every mount. `#initSignals` skipped any prop already present on the host ("explicit DOM value wins"), which honored the written value but left it a plain own data property forever: no signal, no accessor, so `watch()` effects never re-fired and `pass()` could not observe the prop — reads looked healthy while reactivity was dead, violating [M2](../REQUIREMENTS.md#must-have). The skip also dropped the retained initializer, disabling `formResetCallback` and `observedAttributes()` re-runs for that prop. Static page loads mask the hazard because elements parse before definitions register, so nothing can write their properties early.

## Decision

`#initSignals` never skips installation for a reactive prop. A plain own data property present at connect is a captured pre-connect write whose value seeds the initial signal (Lit deferred-properties pattern — `Object.defineProperty` replaces the configurable own property, no delete needed):

1. Static value: `earlyValue ?? initializer`.
2. Parser: `earlyValue ?? parser(getAttribute(key))` — the write is the latest, most specific author intent; the attribute remains the HTML-first source when no early write exists.
3. Declared `Signal`/thunk/`SlotDescriptor`: the initializer stays the source of truth — substituting a static value would downgrade the prop to a plain cell and drop the signal's reactive edges.
4. Method producers assign as before, replacing any early write.

Discrimination is `Object.hasOwn`, not `in`: inherited prototype-managed members (real-DOM `localName`, `lang`, other IDL props) keep being skipped, preserving "expose() silently no-ops on built-in IDL properties". The initializer is retained before installation, so `formResetCallback`/`observedAttributes()` re-runs work for early-written props too — form reset restores the declared default, matching native `<input>` semantics.

## Alternatives Considered

- **Keep skipping (status quo)**: rejected — permanently deactivates reactivity for a legitimately written prop; unfixable from user code except by deferring every parent write past the connect batch (the `module-listnav` workaround, LT-200).
- **Attribute beats early write for Parser-backed props**: rejected — an imperative write after markup authoring is more recent and more specific intent; the attribute still decides when no write exists.
- **Seed declared mutable signals via `.set()`**: rejected — mutating a possibly shared signal at connect time is a side effect on state the component does not own.

## Consequences

- **Good**: dynamic composition, SPA mounts, and test installs get the same reactivity as static loads; the "don't write to a timed-out child's properties" guidance becomes obsolete — the write is now meaningful; early writes no longer trip `formAssociated()`'s missing-signal `DEV_MODE` warning (`src/extensions/form.ts` `hasSignal` is true in both paths).
- **Bad**: behavior change for a declared `Signal`/thunk/`SlotDescriptor` initializer plus an early write — the declared signal now wins where the write used to suppress the initializer entirely (an untested corner; the old outcome was the same permanent non-reactivity). A user-installed own accessor property is replaced by the Slot accessor. Runtime cost is one `Object.hasOwn` check per exposed prop.

## Related

- Requirements: [M2](../REQUIREMENTS.md#m2-reactive-properties-backed-by-signals) (properties behave like normal JS object properties), [M3](../REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers) (attribute → property initialisation at connect time)
- Architecture: [Data Flow → Parsers](../ARCHITECTURE.md#parsers)
- Refines, does not supersede: ADR 0003 (attributes drive state at connect time only) — settles precedence between an attribute and an early imperative write
- Tasks: LT-199 (library fix), LT-200 (`module-listnav` deferred hash sync as defense-in-depth)
