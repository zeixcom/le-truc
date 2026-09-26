# ADR 0042: The Component Stylesheet as a Compiler Artifact — Checks over the Parsed Sheet

## Status

🔄 Proposed — builds on ADR 0033 s9. Each sub-design is a recorded direction, taken up when a real use appears. None is scheduled.

## Context

[ADR 0033](0033-scope-component-styles-by-custom-element-name.md) s9 replaces the compiler's CSS dedent with a `lightningcss` parse, so the component's own sheet becomes reachable from the compiler alongside the template IR. Three wants that previously had nothing to stand on become small once the sheet is parsed. This ADR records them. Spec-grammar validation is not one of them: it comes free with the parse (ADR 0033 s9).

## Decision

1. **Dead-rule detection.** A rule in the component's sheet that matches zero elements of the rendered template warns. It catches a typo, a renamed class, or a rule left stale by a markup refactor. `matchesSelector` / `countForSelector` (`server/compiler/analysis/selectors.ts`) already decide structurally how many template elements a selector matches. The check stays conservative, because light-DOM markup is not closed: it exempts any subtree holding a compose node or `dangerouslyBindInnerHTML`, it exempts `::slotted` and reaches into composed children, and it respects the deliberately wide class matching kept for page-authored enhancement. **Channel compiler, Contained**: an unmatched rule is evidence, not proof. Tech Writer owns the copy. If the proposed `css-select` + `parse5` replacement of `selectors.ts` lands first, this check gets cheaper, so no bespoke matcher is written ahead of it.

2. **The typed custom-property seam.** Where a signal drives a custom property through `bindStyle`, the compiler checks that the signal's type and the property's CSS consumption agree, and emits a registration (`@property --lightness { syntax: '<number>'; inherits: false; initial-value: … }`). The browser then enforces it too, and interpolation comes along. The syntax is inferred from the CSS side (`width: var(--w)` implies `<length>`), because `inferType` cannot tell `<length>` from `<number>`. **Channel compiler, Contained** for the disagreement, with the registration carrying the runtime half. **There are no consumers today** (`bindStyle` appears nowhere in the corpus), so this follows a real use rather than preceding one.

3. **The typed class handle (stage 1 of style composition).** An assigned block (`const theme = <style>{css`…`}</style>`) becomes a compile-time map over its own sheet's class names, and `class={theme.dark}` lowers to the literal `"dark"`. A class the sheet does not define is a compile error rather than a silently dead class. This is ordinary TSX, so it does not wait on TSRX 1.0. It needs one surface change: accepting a `<style>` in setup position, which `.tsrx` must accept too, or the surfaces drift. Composition proper (`apply={theme}`, merged sheets, regenerated selectors) stays on the [ROADMAP](../ROADMAP.md).

## Alternatives Considered

- **Synthesizing collision-free selectors from the template's uniqueness inference**: rejected. It cannot reach inward capture, and minting served selectors from inference would make the sheet break on markup edits the author never touched. ADR 0033 scopes by boundary tags instead; the inference is reused for verification only.
- **`vanilla-extract` for typed styles**: rejected. It reintroduces hash classes and a bundler plugin to deliver the type safety. `csstype` types property names and keywords but leaves values `string | number`, so it does not know units.

## Consequences

**Good:**

- One parse, which ADR 0033 already pays for, carries all three checks.
- Dead-rule detection catches a defect class no spelling rule can see.
- The typed class handle delivers composition's anti-drift benefit without generating CSS.

**Bad / accepted tradeoffs:**

- The dead-rule check has an irreducible false-positive surface, because light-DOM markup is not closed; an over-eager version would be worse than none.
- The custom-property seam has no audience yet.
- The typed class handle adds a second legal `<style>` position, which both front ends must accept.

## Related

- Requirements: [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking)
- [ADR 0033](0033-scope-component-styles-by-custom-element-name.md) (the parse and the scoping these build on), [ADR 0028](0028-tiered-error-surfacing.md) s1 (channel and tier accounting)
- `COMPILER_REFLECTION.md` (the library table proposing `lightningcss` and `css-select`)
