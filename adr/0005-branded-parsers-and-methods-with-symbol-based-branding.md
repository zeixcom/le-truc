# ADR 0005: Branded Parsers and Methods with Symbol-Based Branding

## Status

✅ Accepted

## Context

Need to distinguish branded parsers (`Parser<T>`) and method producers (`MethodProducer`) from regular functions. Using `fn.length` is unreliable with default params, rest parameters, or destructuring. Structural typing doesn't provide the necessary distinction for runtime checks.

## Decision

Use symbol-based branding (`PARSER_BRAND`, `METHOD_BRAND`) to reliably identify parsers and method producers. Symbols are unforgeable, providing a reliable way to brand functions at runtime.

- `asParser()` attaches the `PARSER_BRAND` symbol to parser functions
- `defineMethod()` attaches the `METHOD_BRAND` symbol to method producer functions
- `isParser()` checks for `PARSER_BRAND` symbol presence
- `isMethodProducer()` checks for `METHOD_BRAND` symbol presence

## Alternatives Considered

- **Structural typing** — Cannot distinguish at runtime; type-only, no runtime check possible
- **Class instances** — Would require parsers to be class instances, adding overhead
- **Function length property** — Unreliable with default params (`(x=1) => {}` has length 0), rest params (`(...args) => {}` has length 0), destructuring (`({a}) => {}` has length 0)

## Consequences

**Good:**
- Symbols are unforgeable — reliable branding mechanism
- Zero runtime overhead for branded functions
- Clear distinction between branded and regular functions

**Bad:**
- Requires explicit branding via `asParser()` and `defineMethod()`
- Slightly more verbose than implicit detection

## Related

- Requirements: [M13](REQUIREMENTS.md#m13-typescript-types-exported-and-accurate), [S1](REQUIREMENTS.md#s1-parserreader-distinction-replaced-by-explicit-api), [S2](REQUIREMENTS.md#s2-methodproducer-made-explicit-in-the-type-system)
- Architecture: [The Parser System](ARCHITECTURE.md#the-parser-system)
- Supersedes: None
