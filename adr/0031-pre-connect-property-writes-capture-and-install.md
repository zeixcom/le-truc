# ADR 0031: Pre-Connect Property Writes Are Captured and Installed

## Status

✅ Accepted

## Context

Custom element `connectedCallback`s fire parent-first for any subtree inserted in one operation (spec-mandated tree order). A parent factory can therefore synchronously write a child's `expose()`d property before the child upgrades. Dynamic composition (`innerHTML`, `replaceChildren`, template cloning) hits this on every mount. `#initSignals` skipped any prop already present on the host ("explicit DOM value wins"). That honored the written value but left it a plain own data property forever: no signal, no accessor. `watch()` effects never re-fired and `pass()` could not observe the prop. Reads looked healthy while reactivity was dead, violating [M2](../REQUIREMENTS.md#must-have--library-contract). The skip also dropped the retained initializer, disabling `formResetCallback` and `observedAttributes()` re-runs for that prop. Static page loads mask the hazard: elements parse before definitions register, so nothing can write their properties before connect.

## Decision

`#initSignals` never skips installation for a reactive prop. A plain own data property present at connect is a captured Pre-Connect Write, and its value seeds the initial signal (the Lit deferred-properties pattern; `Object.defineProperty` replaces the configurable own property, no delete needed):

1. Static value: `earlyValue ?? initializer`.
2. Parser: `earlyValue ?? parser(getAttribute(key))` — the write is the latest, most specific author intent. The attribute remains the HTML-first source when no pre-connect write exists.
3. Declared `Signal`/thunk/`SlotDescriptor`: the initializer stays the source of truth. Substituting a static value would downgrade the prop to a plain cell and drop the signal's reactive edges.
4. Method producers assign as before, replacing any pre-connect write.

Discrimination is `Object.hasOwn`, not `in`. Inherited prototype-managed members (real-DOM `localName`, `lang`, other IDL props) keep being skipped, preserving "expose() silently no-ops on built-in IDL properties". The initializer is retained before installation, so `formResetCallback`/`observedAttributes()` re-runs work for pre-connect-written props too. Form reset restores the declared default, matching native `<input>` semantics.

## Alternatives Considered

- **Keep skipping**: permanently deactivates reactivity for a legitimately written prop. It is unfixable from user code except by deferring every parent write past the connect batch (the `module-listnav` workaround).
- **Attribute beats pre-connect write for Parser-backed props**: an imperative write after markup authoring is more recent and more specific intent. The attribute still decides when no write exists.
- **Seed declared mutable signals via `.set()`**: mutating a possibly shared signal at connect time is a side effect on state the component does not own.

## Consequences

**Good:**

- Dynamic composition, SPA mounts, and test installs get the same reactivity as static loads.
- The "don't write to a timed-out child's properties" guidance becomes obsolete: the write is now meaningful.
- Pre-connect writes no longer trip `formAssociated()`'s missing-signal `DEV_MODE` warning (`hasSignal` in `src/extensions/form.ts` is true in both paths).

**Bad / accepted tradeoffs:**

- Behavior changes for a declared `Signal`/thunk/`SlotDescriptor` initializer plus a pre-connect write: the declared signal now wins where the write used to suppress the initializer entirely (an untested corner; the old outcome was the same permanent non-reactivity).
- A user-installed own accessor property is replaced by the Slot accessor.
- Runtime cost is one `Object.hasOwn` check per exposed prop.

## Related

- Requirements: [M2](../REQUIREMENTS.md#m2-reactive-properties-backed-by-signals) (properties behave like normal JS object properties), [M3](../REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers) (attribute → property initialisation at connect time)
- Architecture: [Data Flow → Parsers](../ARCHITECTURE.md#parsers)
- Refines, does not supersede: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (attributes drive state at connect time only) — settles precedence between an attribute and a pre-connect imperative write
