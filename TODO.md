# TODO

- [ ] LT-001: Inlined TSRX compiler — emitter core (ADR 0023 milestone 1)
  **Skill:** le-truc-dev
  **Context:** Build the in-repo compiler module (`server/tsrx/`) on pinned `@tsrx/core` 0.1.60: parse `.tsrx`, emit server HTML render functions (dependency-provable thunk evaluation), extract verbatim tag-scoped CSS, and maintain the component registry; wire as a build effect in `server/build.ts`. Golden-test against the existing hand-written `.html`/`.css` artifacts. See [ADR 0023](adr/0023-adopt-tsrx-as-unified-component-format.md) sub-designs 2–3 and `spike/tsrx-phase0/REPORT-unified.md` §Recommendation.

- [ ] LT-002: Inlined TSRX compiler — client codegen, sanctioned subset (ADR 0023 milestone 2)
  **Context:** Generate `defineComponent()` factories from the same sources: text/attribute/class bindings, event attributes, refs, server-data `@for` + `each()`, hoisted-const rebinding, harvest rules (first-by-document-order). Imports solely from `@zeix/le-truc`; golden-test generated clients against the existing hand-written trio. Completion of LT-001 + LT-002 is ADR 0023's acceptance criterion (flip Proposed → Accepted) and unblocks migrating docs/examples to `.tsrx`. See ADR 0023 sub-designs 1, 4–5 and `spike/tsrx-phase0/expected/unified-lowerings.md`.
