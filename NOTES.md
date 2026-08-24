# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-033 — card-blogmeta: component shape doesn't fit `.tsrx`'s template-ownership model
**Date:** 2026-08-24 | **Skill:** le-truc-dev
**Issue:** `card-blogmeta.ts` doesn't render a template at all — it takes whatever light DOM the page author writes inside `<card-blogmeta>` (an `.author` span with an optional `<img>`, a `time.published`, an optional `.modified time`) and, once at connect time, reformats/rewrites specific descendants in place (locale-formats `datetime` attributes into text, conditionally removes a `.modified` span if the modified date is invalid, inserts a fallback avatar SVG if `.author` has no `<img>`). There are no reactive props and no signals — the component's exposed-props type is `{}`. Every `.tsrx` component compiles its own JSX into the canonical template (server-rendered once, client-addressed by compile-time selectors); there's no mechanism for "arbitrary, structurally-varying author-supplied children, addressed and mutated once at connect." This is a step beyond the already-precedented "can't express missing-element fallback" deviation (`basic-button.tsrx`'s doc comment) — that case converts optional DOM-harvested props into typed attribute-driven props; blogmeta has no prop to convert to, since its job *is* the light-DOM rewrite. Left unmigrated.
**Options:** (a) out of scope for TSRX by design — components in this shape (light-DOM enhancers with no owned template) stay hand-written permanently, document as an explicit boundary in ARCHITECTURE.md/ADR 0024. (b) some future `{children}`-adjacent mechanism for addressing/transforming individual named descendants of composed-in content — large, speculative, no concrete second use case yet.
**Question:** Should ADR 0024 gain an explicit "out of scope" note for light-DOM-enhancer components, so future migration passes don't re-discover this same wall?

---
