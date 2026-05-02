# ADR 0003: Attributes Drive State at Connect Time Only

## Status

✅ Accepted

## Context

v2.0 breaking change. Live attribute sync via `observedAttributes` was the primary obstacle to simplifying the `defineComponent` signature (required the `U extends UI` generic on parsers) and confused authors who mixed "attribute as initial config" with "attribute as reactive state". Le Truc provides real, type-safe reactivity through properties — attribute observation is an escape hatch for interop, not a first-class pattern.

## Decision

Attributes drive state only at connect time via parsers; `static observedAttributes = []`; attributes don't drive reactive updates after connect. Parsers are called once at connect time with `this.getAttribute(key)`.

## Alternatives Considered

- **Always-reactive attributes** — Would require `observedAttributes` and `attributeChangedCallback`, complicating the API
- **Observed attributes with attributeChangedCallback** — Confuses initial config with reactive state; was the primary obstacle to simplifying the signature

## Consequences

**Good:**
- Simpler `defineComponent` API (no `U extends UI` generic on parsers)
- Clearer mental model (attributes = initial config, properties = reactive state)
- Type-safe reactivity through properties instead of stringly-typed attributes

**Bad:**
- Cannot react to attribute changes from external sources (e.g., CMS tooling) without opt-in
- If live attribute sync is needed for specific use cases, it can be added as an optional third parameter to `defineComponent` in a future release

## Related

- Requirements: [M3](REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers), [X1](REQUIREMENTS.md#x1-observedattributes--attributechangedcallback-for-reactive-state)
- Architecture: [The Component Lifecycle](ARCHITECTURE.md#the-component-lifecycle)
- Supersedes: None
