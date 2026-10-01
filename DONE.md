# DONE

Done-and-reviewed tasks since the last release, compacted per the 3-file mini-kanban (owner,
2026-09-18). Each entry keeps only what is still load-bearing: rulings recorded nowhere else,
live handoffs into open tasks (referenced by LT-ID), and the changed-artifact facts Changelog
Keeper needs at release planning. Verification transcripts, changed-file line inventories and
review narratives are dropped — the full record stays in `git log -p`. Entries still carrying
`— done, pending review ⏳` are finished but not yet reviewed; their review pass happens in a
future iteration. At release planning Changelog Keeper consumes this file alongside
`CHANGELOG.md [Unreleased]`; the Architect then prunes entries whose context no live task needs.

---

Pruned 2026-10-01, fourth pass (Architect, after the "ICU MessageFormat switch" iteration
closed; Changelog Keeper merged it into `CHANGELOG.md [Unreleased]` the same day). **No task
entries remained** at that prune; LT-228/LT-229 were added since. Consumed: LT-138, LT-189, LT-218–LT-220, LT-233, LT-242, LT-249–LT-253,
LT-308, LT-343, LT-344, LT-346–LT-351, LT-354. Where their rulings live: ADR 0030 (s4 ICU, s6/s9
locale and the client channel, the corpus-only MF2 authoring constraint), ADR 0032 s6 (diagnostic
parity), ADR 0010 s6 (hand-written `dangerouslyBindInnerHTML` stays raw), AGENTS.md, and the
notes below. Open handoffs are restated in their own entries: LT-342, LT-345, LT-352, LT-353,
LT-355–LT-359, LT-361 (the LT-138 docs handoff, now a task), LT-362. Earlier prunes: 2026-09-25
×3, 2026-09-21 ×2. Full entry text: `git log -p -- DONE.md`.

---

- [x] LT-287: SignalIR → three members by constructor family (ADR 0040 s2). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `ir.ts`: `SignalIR` = `DeclaredSignalIR | DerivedSignalIR | ContextSignalIR`, tagged `family`, with `constructor` narrowed per member. `ContextSignalIR` carries `fallback` + `fallbackText` and has no `init`; the null-elsewhere `fallbackText` field is gone. `InitSignalIR` (ir.ts only) names the two initializer members. The three members are new `contract.ts` type exports (published surface). The requestContext special cases narrow on `family`. Exact-constructor checks stay constructor-narrowed (the `deriveCell`/`deriveStore`/`createMemo` grouping excludes `deriveList` by design). Type-only, so goldens and parity are byte-identical. LE_TRUC_COMPILER.md §4 is in present tense.
  **Review:** Approved. Matches ADR 0040 s2. `family` is the tag the ADR asks for, and `fallback` typed non-null holds because the member is only built from a two-argument call.

- [x] LT-243: Adopt `@typescript-eslint/typescript-estree` for `to-estree.ts`. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** devDependency `@typescript-eslint/typescript-estree` pinned `8.71.0` (peer `typescript >=4.8.4 <6.1.0`, recorded in the module doc). `frontend/tsx/to-estree.ts` goes from 964 to 151 lines: typescript-estree's conversion plus a normalization pass onto the shared `AstNode` shape. **Behavior change:** a `.tsx` TypeScript parse error is LTC008 "Failed to parse …", the same as `.tsrx`. The old converter silently compiled TS's error-recovery tree, and eight test sources with invalid `<style>{…}</style>` JSX had compiled with empty CSS. The `params.ts` `tsNode` path is gone; LTC050 reads `typeAnnotation` on both surfaces. ADR 0032 s0/s4 and its drift consequence are amended. Corpus output is byte-identical, and `check:portability` passes on bun/node/deno.
  **Ruling (owner, 2026-10-01, from this task's halt):** browser purity is not a compiler requirement. The compiler's rule is source-level runtime neutrality (ADR 0038 s2), and browser loadability is ADR 0025 s6's own work. REQUIREMENTS M25/N3 and ADRs 0025/0036/0038 are amended. The bundle smoke retires in LT-366.
  **Review:** Approved; LTC008 reuse is consistent with `.tsrx`. Handoffs: LT-367 (public `parse()` instead of `use-at-your-own-risk`), LT-366 (run the neutrality check on this tree), LT-254 (dependency weight, M28).

- [x] LT-364: Serve the docs server through one pure request handler; test it without a socket. — reviewed ✓
  **Skill:** docs-server-dev
  **Changed:** new `server/routes.ts` — `createRequestHandler({ development })`, the whole routes
  table and its handlers, `development` passed in rather than read from env at module load.
  `server/serve.ts` keeps HMR state, the `TEST_SURFACE` exit and an exported `listen(port)`
  (`Bun.serve({ fetch, websocket })`, `/ws` upgraded in `fetch` in development only).
  `serve.test.ts` drives the real handler; `startTestServer` and its mirrored helpers are gone;
  one `Bun.serve wiring` smoke test skips without port binding, except in CI.
  **Rulings:** routing is now ours, not Bun's: patterns match by first-differing segment kind
  (static > `:param` > `*`), and params are `decodeURIComponent`-ed (a malformed escape → 404).
  The traversal legs use an encoded slash (`..%2f`), not `%2e%2e`: WHATWG URL parsing normalizes
  `%2e%2e` like `..`, so only an encoded slash reaches `guardPath`. Those legs fail with the guard
  stubbed out. `/examples/` and `/sources/` are now tested with their guards; the old mirror
  served them unguarded.
  **Review:** Approved. Owner's manual pass (`bun run serve`, `test:variants`) green, 2026-10-01.

- [x] LT-228: Split `ast-utils.ts` into `vocabulary.ts` + `ast-utils.ts`. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new import-free leaf `server/compiler/vocabulary.ts` holds every recognized-name
  table; `ast-utils.ts` keeps AST helpers only. The tag → lib.dom interface map moved into
  `emit-client.ts` (`DIRTY_FLAG_CONTROL_INTERFACES`); `vocabulary.ts` keeps the tag list as a
  literal tuple (`DIRTY_FLAG_CONTROL_TAG_NAMES`) because analysis still calls
  `isDirtyFlagControlAttr`. The emitter table is `satisfies Record<DirtyFlagControlTag, string>`,
  so the two can't drift. Internal only; no changelog entry.
  **Review:** Approved. Handoff → LT-232: `vocabulary.ts`'s header says the parity tests pin
  the duplicated tables, but today only `FACTORY_CONTEXT_MEMBER_NAMES` (globals.test.ts) and
  `RESERVED_PROP_NAMES` (diagnostics.test.ts) are pinned. LT-232 makes the claim true or
  rewords it.

- [x] LT-229: One shared estree walk on `eslint-visitor-keys` — retire the hand-rolled skip-lists. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `eslint-visitor-keys@5.0.1` pinned as a devDependency, pinned the same way as
  `@tsrx/core` (pure ESM data; the browser bundle builds). `ast-utils.ts` gains `forEachChild` /
  `walkNodes` (membership from KEYS, the node's own key order, unknown types fall back to
  non-bookkeeping keys) and `forEachFreeIdentifier`, the one scope walk under both
  `freeIdentifiers` and the authored-import check. All 15 estree walks migrated, plus
  `scripts/codemod-react-jsx.ts`.
  **Ruling (type positions):** `TypePositions` defaults to `'skip'`. Only
  `reportLeTrucImportMismatch` keeps `'descend'`, because an unimported `typeof createState`
  needs the import. `classifyChild`, `impureAmbientCauses` and `stubbedApiRead` converged to
  skip, with tests: an annotation such as `(d: Date) => …` or `ro: ResizeObserver` is no longer
  a read. The remaining sites converged as stated no-ops.
  **Changelog fact (user-visible):** LTC036 now fires in `.tsrx` for a real export read only in
  the template (e.g. `isPending` in a class thunk). The old private walk never visited
  `JSXCodeBlock.render`, while `.tsx` always fired. Loop, catch and self-referencing const
  bindings named like an export no longer fire it falsely.
  **Review:** Approved. The corpus key audit was a one-off script, so its guarantee isn't
  pinned. `'skip'` still leaks names out of TS type-only declarations, and class and method
  names, as free reads, with the two surfaces disagreeing. Both → LT-363.

**Open obligations** (not yet discharged; check before closing the named work):
- **Upstream issues for the MF1 → MF2 converter are the owner's call.** Drafts are in the
  untracked `ICU_MESSAGEFORMAT_ISSUES.md`, and none are filed. The pinned test in
  `mf2-exit.test.ts` flags an upstream fix; delete the matching normalization then (LT-253).
- **Browser specs the agent sandbox could not run:** `basic-pluralize.spec.ts`,
  `module-todo.spec.ts` and `form-tokenbox.spec.ts`, in en and de. The owner confirms they are
  green before the next PR (LT-252, LT-354).
- **The first `@empty` over a reactive List owes a browser spec leg** for the empty → filled →
  empty cycle. No corpus component uses it yet (LT-212).
- **CI has not yet proved the variant spec matrix.** CI triggers only on `main`/`next` pushes and
  PRs, not `v3`, so the next PR's run is the first proof. It must list every variant set, and a
  throwaway broken `.ts` twin must fail the job on surface "ts" (LT-295).
- **The simulation realm's timer ownership is process-wide.** Any host timer scheduled while a
  realm is open is cancelled at `dispose()`. That is safe only because `simulateCorpus()` runs in
  one-shot builds. A task that opens a realm in a long-lived process (dev server, watch
  rebuilds) must revisit it (LT-207).
- **The trap in `src/tests/reactive.test.ts`:** one assertion passes under both the pre- and
  post-LT-178 spelling. Tighten it once LT-189 item 11 settles the wording (LT-179).

**Standing notes for compiler-adjacent tasks:**
- **Shared compiler code never spells a surface's construct** (LT-233). It reads
  `wordingOf(ctx | component)` from `surface.ts`. `ComponentIR.surface` is optional, and absent
  means `.tsx` wording, because a required field would tighten contract IR. Diagnostic parity has
  two standing checks: equal code, severity and message after the allowlist, and a leak scan for
  `.tsrx` vocabulary in `.tsx` messages (LT-242).
- **"Server-only" is positive** (LT-348, LT-349). A name is server-only iff the server render
  binds it and no author-declared client binding rebinds it. Compiler-generated query locals never
  rebind. A tier never licenses an unbound client name. An undeclared name belongs to tsc, not
  LTC005. Setup consts and imports stay rejected in list bodies, because
  `computeClientNeededNames` walks no list-body position. Widening that walk is the fix if a
  component needs it.
- **The host profile's `JSX.LibraryManagedAttributes` distributes over unions** (LT-343). A
  plain `Omit` flattens a discriminated args type and drops its requirements. A union parameter
  type opts out of inline-literal type reading (`infer-type.ts`), so check the generated modules
  before spreading the pattern.
- **`| undefined` on an intrinsic attribute only where it literally means "absent when
  omitted"** (LT-308): component-tag config attributes that mirror an optional arg. Never ARIA or
  global attributes.
- **LTC055's refusals are what `Intl` cannot run** (LT-250): custom formatters, ICU number/date
  patterns, `precision-increment`, one argument as both number and date. `date`/`time` apply
  the record's `timeZone`, which diverges from `@messageformat/core` on purpose. The call-site
  check does not track shadowing.
- **`truc:html` fails closed on both halves; configure once per realm** (LT-138). The build and
  the browser are separate module instances. Pruning plural arms for a connect-time prop is
  declined, because the prop stays writable (LT-252).
- A compiler crash during a corpus build makes `typecheck`'s `&&`-chained `tsc` silently skip.
  Check the exit code, never grep for "error TS" (LT-226). A handoff's `check:corpus` claim is its
  **exit code**, not the warning baseline (LT-283).
- **A folded reactive thunk that reads page context is an error, not an omission** (LT-258).
  `Date.now()` is unresolvable in every tier; a page-context read is realm-answerable, so omitting
  it would silently re-route Folded → Simulated and out of template emission. The page-context
  side is the deny-list `PAGE_CONTEXT_GLOBALS` (`fold-inputs.ts`); the positive side is
  `assertFoldScopeClosed`. Keep that split. RNG stays on the impure-ambient side, and computed or
  aliased receivers (`crypto['randomUUID']()`, a destructured `randomUUID`) still fold as accepted
  residue, to revisit only on a real case (LT-314; LT-340 is the related indirection gap).
- **Client-only signal credit** means "at least one client-only read, none a render read" (not
  "every consumer client-only"), and the render read is transitive through setup consts
  (LT-323, LT-327). LT-333 extends it.
- **Harness-name aliasing covers only emitter-synthesized sites** (LT-302). Authored text keeps its
  spelling, and `host`/`internals` are never aliased.
- **`truc:pass` addressing** (LT-338, LT-319, LT-339). An auto-addressed site is a **required**
  query (`'one'`), the same as a raw custom element. A shared-class group lowers to one
  `pass(all(…))` only on **textual** identity of the `truc:pass` objects, never semantic
  equivalence, and only when every member would reach the fallback itself. The imperative
  `pass(all(…))` stays sanctioned as a client-only setup statement (tier 2).
- **A loop is diagnosed only when its output IS a branch root** (LT-301). A loop wrapped in an
  element inside a branch stays legal. Branch-scoped `each()` is a design task when a migration
  first needs it.
- **`<truc:try>`** (LT-303): `tsc` owns the arm types, the repeated arm and the missing `catch`.
  The compiler keeps one LTC005 shape error and also guards the missing `catch`, because it never
  runs `tsc`. As a `.map()` output root it is LTC053, matching `.tsrx`. LT-276 reshapes the `try`
  node under both front ends.
- **Generated typings** (LT-312, LT-325). Import keys are the shortest path suffix no other
  source shares, so a collision fails loudly. The file is always written, even empty. A
  `.tsx`-served tag gets no generated tag-map entry, because its authored source carries one and
  a second would be TS 2717. The examples typecheck leg needs a corpus build first.
- **The canonical output directory is not pruned** (LT-296). The route serves a canonical client
  only when `registry.json` selects that surface; `compileCorpus` owns and prunes only
  `variants/`.
- **The simulation realm** (LT-188, LT-332). A Folded/Static child in the composed closure runs
  its connect in the realm, and its diagnostics attribute to the rendering parent, which is
  intended. A connect-time page-context API the realm lacks (`history`, `requestAnimationFrame`)
  gets an **inert stub** in `patch-table.ts`/`capabilities.ts`, not a standing classification.
- **Dynamic tags** (LT-213, for the future `<truc:element tag={…}>`, ADR 0041). Address such an
  element by class/id/`data-*`, never by tag. No React-style `const Tag = …; <Tag>`, which
  collides with PascalCase compose dispatch. IR shape:
  `tag: { kind: 'static', name } | { kind: 'server', exprText }`.
- **`argsFromAttrs`** (LT-290, LT-095). Declaring a ref stub inside the page-occurrence helper
  was rejected, because a `refStub` value would reach the markup. A server arg's page-occurrence
  attribute is its **kebab-case** name; a `number` arg has a numeric channel (blank = absent,
  non-numeric = unrenderable). LT-297 and LT-336 continue this.
- **The size bet holds on the runtime, not the payload** (LT-266): 8.72 vs 64.38 kB gzip runtime;
  the payload line (3.07 vs 8.54) favours React. Any connector claim quotes **both** lines. Run of
  record: `spike/size-bet/FINDING.md`.

**Standing notes for wave-4 migrations:**
- **Don't contort a component to dodge a classifier gap; file the gap** (LT-103). Record tier and
  reason as they land. Tier predictions are often wrong: refs used only in `watch`/`on` never route
  (LT-096).
- **`bun run build:docs` is part of every migration's check** (LT-095): it caught a demo
  regression nothing else ran.
- **A Parser-exposed prop's text site is a `{() => host.<prop>}` thunk**, not the arg (LT-099).
- **A client that writes a style or ARIA value at connect gets a server render in the exact form
  the watcher writes**, so the connect diff is empty (LT-102).
- **A compose site cannot put attributes on the child's inner element**, so an opener needing
  `aria-haspopup` renders as a raw `<button>` (LT-101). The dialog's `body.scroll-lock` waits for
  LT-306's `:global()`.
- **A raw dashed tag seeds a child import only when a query addresses it** (LT-291).
- **A provider's context keys live in a module with no side effects**, never in the component
  module, because importing a component module defines the element (LT-106; docs in LT-189
  item 14).
- **Lazyload keeps its hand-written `watch(content, { ok, nil, stale, err })`**. The compiled
  boundary cannot express that contract until LT-334 (LT-104).
- **No compiler-stamped hash class for addressing** (LT-096): page-authored occurrences never pass
  through the compiler's render, so a stamped hook would be absent where the enhancer binds. The
  `:not(<tag> *)` exclusion is accepted; its only miss is an own element inside a same-tag
  ancestor of the host, which no composition produces.
- **Scrollarea's wall time at demo scale is noise** (LT-103).
