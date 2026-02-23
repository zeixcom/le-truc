# Copilot Instructions — Le Truc

Focused guidance for AI agents reviewing or writing code in `@zeix/le-truc`.

## Review priorities
- Preserve the public API surface: exports in `index.ts`, types in `types/index.d.ts`.
- Prefer minimal changes; new behaviour should be demonstrated in `examples/`.
- Do not break the `customElements.define()` registration in `src/component.ts` — `getHelpers` in `src/ui.ts` relies on it for dependency detection.

## Conventions to enforce
- Component names must include a hyphen and match `/^[a-z][a-z0-9-]*$/`.
- Props initializers: plain values, `Signal`s, parsers from `src/parsers/*`, or callbacks — parsers are auto-added to `observedAttributes`.
- New parsers must be exported from root `index.ts`; follow the `(ui, value, old?) => T` signature.
- Side-effects belong inside `runEffects`; cleanup must be returned.

## PR descriptions
- State intent: feature, bugfix, or refactor. Note if public API changed.
- If API changed: list updates needed in `types/`, `index.ts`, and `examples/`.
- Verify by building (`bun run build:dev`) and testing the relevant example.
