# DONE

Done-and-reviewed tasks since the last release, compacted into this ledger prose (the
`DONE.md` view is built from it by `bun run queue:build`; a task's own record lives in
`queue/LT-NNN.md` until a prune deletes it). Each entry keeps only what is still load-bearing:
rulings recorded nowhere else, live handoffs into open tasks (referenced by LT-ID), and the
changed-artifact facts the `writer` needs for the changelog at release planning. Verification
transcripts, changed-file line inventories and review narratives are dropped — the full record
stays in `git log -p`. Entries still carrying `— done, pending review ⏳` are finished but not
yet reviewed; their review pass happens in a future iteration. At release planning the
`writer` consumes the DONE view alongside `CHANGELOG.md [Unreleased]`; the Architect then
prunes `queue/LT-NNN.md` files whose context no live task needs, carrying homeless rulings
into this prose.

---

Pruned 2026-10-09, eighth pass (Architect, after the "P6 cleanup round and the composition
batch" iteration closed; the `writer` recorded it in `CHANGELOG.md [Unreleased]` the same day).
Consumed: LT-093, LT-136, LT-282, LT-437, LT-460–LT-467, LT-469–LT-472, LT-474, LT-476–LT-479,
LT-481, LT-482, LT-485, LT-486, LT-488, LT-490, LT-491, LT-495, LT-496, LT-498, LT-501–LT-505,
LT-507, LT-512. Where their rulings live: ADR 0048 s1–s5; ADR 0033 as revised (s3–s6); ADR 0024
s10 and ADR 0046 s1, amended in place; COMPILER_SPEC §2, §12 and the decision log (D-32), with
LT-480 ruling 4. `HOST_PROFILE.md`: compose arm roots and their passes (LT-460, LT-481);
§ Handler args (LT-461); the item/Mount-Scope passage (LT-470); § Styles (LT-501, LT-504);
§ Element references (the region re-include, LT-512's boundary, the hand-authored mirror rule,
raw same-tag counting; LT-472, LT-478, LT-496, LT-498); the roles, one-writer and content-model
paragraphs (LT-474, LT-476, LT-477); the `children` JSX mapping (LT-495). `LE_TRUC_COMPILER.md`:
the plan walks, server-only `try` included (LT-482), and the baseline exceptions (LT-502).
`errors.md`: LTC005's compose/`try` faces (LT-470, LT-488), LTC066–LTC089, LTC081, LTC083–LTC085.
`VOCABULARY_LEDGER.md`: LTC081–LTC089 and `data-children`. `SERVER.md`: `docs-src/api/` is build
output (LT-282). Code docs: `analysis/harvest.ts` (LT-093), `analysis/effects.ts` (LT-470,
LT-461), `analysis/selectors.ts`, `children-region.ts`, `host-profile.d.ts` (LT-495),
`for-collection-shadow.test.ts` (LT-136), `layout-graph.test.ts` and `examples/main.ts` (LT-467,
LT-485). Component sources: `section-menu.tsx` (LT-469), `module-todo.tsx` (LT-466),
`form-checkbox.tsx`/`.md` (LT-479). `spike/children-scope/FINDING.md` (LT-465, ADR 0048's
evidence). Open handoffs: LT-480 (its 2026-10-09 handoff addendum), LT-518 (the owed copy pass);
LT-254, LT-489, LT-492–LT-494, LT-497, LT-506, LT-511, LT-513–LT-515, LT-517 and the others that
cite a consumed ID restate what they need.

**Rulings carried from the 2026-10-09 eighth pass** (recorded nowhere else; do not re-litigate):
- **A component whose only async state is a `Task` folds** (LT-093). The server renders the nil
  arm, which is what the client shows until the task settles, so the realm buys nothing.
  module-lazyload is Folded by design; the equivalence audit records its nil→err connect diff.
- **`render<Name>` takes an optional second parameter, the content owner's tag** (LT-472). Only a
  component with a `{children}` insertion or forward has it. A compose site passes its own tag, a
  bare forward passes its owner on, a page render passes nothing (no marker is written). Under
  D-32's policy it is part of the public `render<Name>` signature once LT-480 publishes it.
- **An item-setup `first()` into an item's compose content emits the authored selector verbatim**
  (LT-472): scoped to the item root with no composed-child exclusion, per ADR 0046's item-ref
  policy. The region-resident check still drops a selector the child's own markup could match.
- **Children-contract reading limits are accepted** (LT-474, LT-477). An intersection
  (`Children<…> & string`) reads as no contract; LTC083 carries no `related` range to the
  annotation; a role-addressed required query is not deduplicated; an unknown model literal
  records `'any'` (tsc rejects it); "literal children" stop at a nested compose site. Widen only
  on a real case.
- **LTC084's accepted edges** (LT-476). The parent's write channel is the reference-targeted
  `watch` binding only (compose content admits nothing else today; LT-515 would widen it).
  Properties and attributes count as one write. A role-addressed reference whose selector also
  names a custom tag resolves on the deferred leg and is recorded only when no compose site
  claimed it — analysis-only; a bare `.role` selector never defers.
- **LTC087 errs toward warning** (LT-502, LT-505). It tests the subject compound alone, counts a
  dynamic attribute as a possible match, and merges a compose site's static args even when they
  never render as attributes; ticker, todo and codeblock keep their `basic-button > *` limits for
  that reason. **Rejected:** a single-guard lowered form (the lowered CSS already came in under
  v3's size).
- **A relative rule such as `> my-tag .x` inside `@scope` is not LTC066** (LT-501). Only a rule
  *led* by the own tag is.
- **LT-512's rejected and waived options.** A per-site content-directed clash was rejected (no
  consumer; its nested-composition, `{children}`-forward and unregistered-source corners need a
  design). module-codeblock's `copy`/`overlay` keep `:not(module-scrollarea *)` by design.
- **LT-495's rejected alternative:** retyping each child's `children` as `JSX.Element`. The host
  profile translates instead, and the string stays the server-side truth.
- **The test layout's `<base href="/">` turns a bare `#fragment` link into a navigation away**
  (LT-491). A fixture link carries the page path (`/test/<tag>#id`); fix the fixture, never the
  layout. form-listbox's fixture still has bare `#` links, safe only because its spec never
  clicks them.
- **A spec-less example folder is not a `test:variants` gap** (LT-485). The runner refuses a set
  with no `<tag>.spec.ts`; `main.ts` registration on every `/test/*` page is the accepted smoke
  test.
- **A probe-first task may close `done` with a finding** (ITERATION ruling 9 of 2026-10-06).
  When a task states a premise to check and the premise is false, it closes with a pinning test
  or a one-line finding rather than building the fix (LT-136, LT-282).

---

Pruned 2026-10-09 (Architect, next-iteration preparation, owner-approved). Deleted: LT-134,
LT-135, LT-311, LT-297.
- **LT-134**: nothing to do. LTC035 retired at LT-275, LTC038's fix names no per-arm shape, and
  LTC042's advice stands on its own `errors.md` row.
- **LT-135** was merged into LT-093 at planning (2026-10-06, ITERATION ruling 6); LT-093 is reviewed.
- **LT-311** was absorbed by LT-461's handler args: a compose-site `onClick={…}` maps to the
  child's declared `on[A-Z]` arg (LT-461 rule 8).
- **LT-297** is merged into LT-336: both are `argsFromAttrs`' page-occurrence attribute name.

---

Struck 2026-10-07 (Architect, owner ruling: compiled CSS is platform CSS, ADR 0033 rewritten
and ADR 0048 s5 cut back; ITERATION ruling 14). Deleted without integration: LT-473, LT-475,
LT-499, LT-500, LT-405, LT-407, LT-408, LT-409.
- **LT-473** (approved, not integrated) built the ownership emission. Its measurements are the
  evidence behind ADR 0048's rejected style form. The lowered form cost up to about 13.5 kB raw
  per component, and native owners carried their rules twice. `test:variants` was green under
  it. Its branch and worktree were removed after LT-501's salvage of `css-probe-child`
  (2026-10-08).
- **LT-500's owner rulings that survive:** `{children}` directly in a child's root is allowed,
  with no wrapper, and own elements beside it are allowed and count as the parent's region
  (ADR 0048 s1). Components such as card-callout and section-menu are chosen partly for the
  styles they give their content. The platform model keeps that.
- **LT-409** asked for a ruling on each ADR 0033 s7 departure. The rewrite removes the
  emulation, so only inward reach and the lowered form's missing scope proximity remain.
  LT-405's `:host(X)` zero-specificity ruling (2026-10-02) is void: `:scope:is(X)` carries
  the platform's specificity.

---

Pruned 2026-10-06, seventh pass (Architect, after the "corpus port and pre-publish reshapes"
iteration closed; the `writer` recorded it in `CHANGELOG.md [Unreleased]` the same day).
Consumed: LT-109–LT-111, LT-186, LT-187, LT-277, LT-280, LT-305, LT-334, LT-342, LT-353,
LT-355, LT-356, LT-374, LT-375, LT-387, LT-390–LT-392, LT-411, LT-412, LT-414–LT-436,
LT-438–LT-447, LT-449, LT-451–LT-455, LT-468. Where their rulings live: ADR 0046 (s1–s7, as
amended by LT-429/LT-454), ADR 0047, ADR 0034 s1 (markers), ADR 0039; `HOST_PROFILE.md`
(per-item setup, per-field/scalar/key-alias harvest, list templates at the host's end, the
boundary's driver channels and one-catch-read rule, raw value source, unknown `truc:*`, markers,
LTC078); `errors.md` (LTC005's condition and arm/branch faces, LTC059–LTC080);
`VOCABULARY_LEDGER.md` (code skips, LTC079 released); `LE_TRUC_COMPILER.md` (sensor and
host-seed routing, source-ordered client setup); `src/helpers/reactive.ts` (`reconcile()`:
insert-before-mount, per-Mount-Scope containment) and `src/errors.ts` (`reportScopeFailure`);
`analysis/loops.ts` (LTC074, `data-key` no exemption); `glob.ts` + SERVER.md (explicit-dot
segments, `/api/status`, HMR-free mock fragments); `scripts/lib/baseline.ts` and
`check-baseline.ts` (author code reported, not judged); `simulation/contract.ts` (seam revision
2); the module docs of `module-lazyload.tsx`/`.ts`, `module-cem-list.tsx`, `_common/reorder.ts`
and `examples/main.ts` (sanitizer policy, `on*` excluded); `task-queue.md` (commit/integrate
flow); AGENTS.md; and the notes below. Open handoffs: LT-469 (its "LT-111 ruling 5" now
means the twin bullet below), LT-078 (the boundary's corpus consumer is module-lazyload,
LT-449; arm-adoption audit LT-390), and LT-448, LT-456, LT-457, LT-458, LT-459, LT-470, which
restate what they need. LT-246, LT-437 only `needs:` consumed IDs.

**Rulings carried from the 2026-10-06 prune** (recorded nowhere else; do not re-litigate):
- **A twin follows the compiled page; it is never deleted** (ITERATION ruling 5, LT-110,
  LT-449). Every example folder is served compiled and the `.ts` twin stays as a variant. A
  migration regenerates the authored `.html` from the compiled render; the result need not
  match the old fixture byte for byte (owner, 2026-10-06), but the twin must enhance it. When
  the compiled surface owns the DOM (an arm set), the twin is rewritten to consume the compiled
  page through public `reconcile()`. Rejected: deleting the twin, per-surface page shapes,
  surface guards in the spec (the last two break ADR 0039 s2). ADR 0039's "the twin stays
  byte-for-byte the artifact of record" yields to this. Shared helpers serve the *compiled*
  surfaces; the twin keeps its inline logic (LT-111).
- **Acceptance criteria are goals, not constraints to meet by workaround** (ITERATION ruling
  10, owner). A spec or golden that encodes a twin's latent bug is reported with evidence and
  ruled (fix the twin or change the expectation), never matched silently.
- **List-template placement: comment anchors rejected (minifier robustness), computed positions
  rejected (fragility)** (ITERATION ruling 16, LT-454). Not in ADR 0046's alternatives.
- **LTC074 is an error, not a warning, and LT-185's runtime half stays a DEV_MODE advisory**
  (LT-186). A deliberate deviation from ADR 0028's Prevented pairing: do not convert the
  advisory to `console.error` and do not retire it. The compiler cannot see consumer-authored
  HTML.
- **No cleanup ambient for per-item effects** (LT-280): `watch` handler cleanups already run
  before removal.
- **`expose({ value: harvest(…) })` stays LTC005** (LT-443): a plain-value prop's client seed
  is evaluated once and cannot parse a DOM read. Allowing it is a new feature, not a new
  spelling.
- **A generated module's header cites no internal ADR** (LT-414). It keeps only the milestone
  wording.
- **Mount-Scope addressing limits accepted** (LT-424): a host-level `first()` keeps LTC007
  without child-path synthesis, and the synthesized `:scope >` child path skips the
  composed-children exclusion (a step names an own tag).
- **A key alias behind an arm set, a server-data loop or a composed child is LTC005, not
  LTC080** (LT-453). This narrows ADR 0047 s3's "across all enclosing scopes" to enclosing list
  items, under the ADR's "wider forms wait"; LT-456 holds the widening.
- **A key-alias field with no parser or only a formatted site keeps LTC076/LTC059** (LT-453):
  "with s7's parsers and raw-source rule" reuses s7's codes; LTC080 covers only the four s1
  conditions.

**Open obligations added** (check before closing the named work):
- **Known compiler gaps, deliberately unfiled:** dependents of an `unresolvable` signal stay
  server-known, and a `deriveList` over one iterates the `refStub` value; sensors share this
  gap (LT-451). Synthesized harvest declarations drop type arguments (LT-451). A Simulated host
  signal excluded from the retention pool (LT-165 step 5) leaves an item const with a dangling
  name — loud as TS2304, never a silent runtime error (LT-447). The harness's
  `deriveList(source, itemFn)` does not run async item callbacks (LT-425).
- **`form-inplace-edit.css`'s `&[editing] .text { display: none }` is dead** since the arm
  swap. Drop it in the next CSS pass (LT-390).

---

Pruned 2026-10-03, sixth pass (Architect, after the first `release-notes` run recorded
LT-370, LT-371 and LT-378 in `CHANGELOG.md [Unreleased]` and found LT-335 and LT-410 covered,
LT-373 and LT-393 internal). Consumed: LT-335, LT-370, LT-371, LT-373, LT-378, LT-393, LT-410.
Where their rulings live: `sim/realm.ts` § Attribution (LT-335), ADR 0044 s1 and LT-254's entry
(LT-370, LT-371), `do-task.js`'s commit step (LT-378's bundle-churn note), and the notes below.
Its open handoffs (LT-411, LT-414, LT-416) were consumed by the seventh pass.

---

Pruned 2026-10-02, fifth pass (Architect, after the "consolidate the compiler, then land the
pre-publish reshapes" iteration closed; the `writer` recorded it in `CHANGELOG.md
[Unreleased]` the same day, deliberately omitting the byte-identical internal refactors).
Consumed: LT-227–LT-232, LT-234, LT-243–LT-245, LT-248, LT-268, LT-274–LT-276, LT-287–LT-289,
LT-304, LT-306, LT-358–LT-361, LT-364, LT-366–LT-368, LT-379, LT-380, LT-382–LT-386, LT-388,
LT-389, LT-394–LT-404, LT-406. Where their rulings live: ADR 0033 (s1–s10, the scoped emission
and the parse), ADR 0037 (amended by LT-388), ADR 0040 (s2, s4, s5), ADR 0043, ADR 0045, ADR
0032 s0/s4 and ADR 0038 s2 (LT-243's runtime-neutrality ruling), `walk.ts`'s module doc (LT-230's
`@pending` policy), and the notes below. Open handoffs are restated in their own entries:
LT-247, LT-254, LT-334, LT-335, LT-363, LT-369, LT-370, LT-378, LT-381, LT-387, LT-390–LT-393,
LT-405, LT-407, LT-408 (via LT-409). Earlier prunes: 2026-10-01, 2026-09-25 ×3, 2026-09-21 ×2.
Full entry text: `git log -p -- DONE.md`.

---

**Rulings carried from the 2026-10-02 prune** (recorded nowhere else; do not re-litigate):
- **The scope analysis stays in-house** (LT-231). `@typescript-eslint/scope-manager` cannot scope
  the `.tsrx` AST's non-ESTree nodes (`JSXCodeBlock` and its `render` slot). Do not re-propose it
  without a `.tsrx` story.
- **Three "can this read run" predicates stay apart deliberately** (LT-231): `reactivity.ts`'s
  classifier (reactive vs static), `harvest.ts`'s portable-seed allowlist (can the browser re-run
  the initializer), and the `.tsrx` in-template client-stmt allowlist. LT-373 centralizes the
  first; merging the others is LT-369's question, not a by-product.
- **Pass contracts are structural, not branded** (LT-289): a test may hand-build an empty
  `LoopPlans`. `runEffects`'s unread `_harvests` parameter witnesses pass order (query order is the
  byte-stable contract); if effects ever reads it, drop the underscore, keep the parameter.
- **`commonIndent`'s `skipDocContinuations` option stays** (LT-234): unifying the twins would move
  bytes for no benefit.
- **A duplicated `expose()` key is last-wins**, as at runtime (LT-288).
- **A hand-spliced Parser seed goes through `attrValue`** — the serialized attribute, not the
  expression's value (LT-386). The bare `() => host.<prop>` mirror for lazy text sites still splices
  the raw attribute expression on purpose: string/number parsers agree, only `asJSON` object values
  diverge pre-connect. Widening is demand-gated.
- **LTC065 is one code with two faces** (LT-394): the same tier and decision for the author.
  `@position-try` is deliberately absent from `DESCRIPTOR_ATRULES`, since its block holds properties.
- **Distributing `:is(:host …)` gives each member its own specificity** (LT-398), accepted because
  the members come from one authored list.
- **LTC051 reports one drift at a time** (LT-403): when sheets drift, boundary-only differences are
  named once the sheets match.
- **Corpus CSS fixes taken under LT-397** (input for LT-409): module-codeblock's `pre`/`code` rules
  are a top-level `:global { … }` block, and their leak into nested instances is accepted;
  colorinfo's `dt`/`dd` nest under `dl` (R1).
- **Docs-server routing is ours, not Bun's** (LT-364): first-differing segment kind wins
  (static > `:param` > `*`), params are `decodeURIComponent`-ed (a malformed escape is a 404), and
  traversal tests use an encoded slash (`..%2f`), since WHATWG URL parsing normalizes `%2e%2e`.
- **Narrowing a diagnostic's range later is not a breaking change to the record** (LT-371).
  Removing or widening a field is; a tighter `start`/`end` for the same construct is not.

**Open obligations** (not yet discharged; check before closing the named work):
- **`check:contract` is LT-254's proof against the published package** (LT-370): it now compiles
  through `compileComponentTsx` imported from `contract.ts` only, so run it against the packed
  `@zeix/le-truc-compiler`, not the source tree.
- **Track the lightningcss upstream issues #1081 and #1065.** `css-scope.ts` does string-level
  selector surgery over a read-only parse to avoid them; keep the `lightningcss-wasm` and
  `lightningcss-cli` pins on one version (ADR 0033 s9). Retire the surgery when both are fixed (LT-304).
- **Sandbox-blocked legs the owner reruns outside the sandbox:** `check:sim`'s Deno leg (LT-289),
  `check:portability`'s bun leg (LT-366, LT-230), and the `examples/test/scoping` Playwright run in
  both `cssTargets` modes, Chromium and WebKit, if LT-397's corpus run did not include it (LT-401).
- ~~**Upstream issues for the MF1 → MF2 converter are the owner's call.**~~ Discharged
  2026-10-01: tracker searched (no prior or similar reports), both filed by the owner as
  [messageformat#472](https://github.com/messageformat/messageformat/issues/472) (duplicate
  `.input` → `dedupeInputs`) and [#473](https://github.com/messageformat/messageformat/issues/473)
  (non-string skeleton literals → `stringifyLiterals`); still unfixed at 0.12.0. Compacted
  references live in `MF2_EXIT.md`; the pinned test flags an upstream fix — delete the matching
  normalization then (LT-253).
- **Browser specs the agent sandbox could not run:** `basic-pluralize.spec.ts`,
  `module-todo.spec.ts` and `form-tokenbox.spec.ts`, in en and de (the example components; the
  docs are English only). The owner confirms they are green before the next PR (LT-252, LT-354).
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
- **No compiler-stamped hash class for addressing** (LT-096): page-authored occurrences never pass
  through the compiler's render, so a stamped hook would be absent where the enhancer binds. The
  `:not(<tag> *)` exclusion is accepted; its only miss is an own element inside a same-tag
  ancestor of the host, which no composition produces.
- **Scrollarea's wall time at demo scale is noise** (LT-103).

- [x] LT-483: '`handleAsyncBoundary` checks client positions against `badFreeNames` where every other arm-set handler uses `fx.scopeBadNames` — align it.' — reviewed ✓
  **Area:** compiler
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-07, from LT-481's residue 2):** in
  `server/compiler/analysis/effects.ts`, `handleAsyncBoundary` destructures
  `badFreeNames: badNames` and passes it to the ok arm's construct effects and, since LT-481, to
  the pending and catch compose roots' pass entries. `handleReactiveConditional` and the other
  Mount Scope handlers read `fx.scopeBadNames`, which, inside a reactive-list item, refuses the
  names a list body cannot read on the client (setup consts and imports: LTC005's server-only
  face). The review probed an item-nested boundary whose pending compose root passes
  `() => item.get()`: it plans correctly, so item names are not affected. A setup-const or
  import read in an item-nested boundary's client position was not probed. It may compile clean
  and then fail at runtime in the cloned item.
  **Change:** probe the setup-const read in an item-nested boundary on both surfaces (ok-arm
  construct and pending compose root pass entry). If it compiles clean, switch
  `handleAsyncBoundary` to `fx.scopeBadNames`. If it is already refused upstream, still align
  the reader for consistency and record the probe here.
  **Check:** a both-surface test pins the probed shape's diagnostic (LTC005 server-only face),
  and host-level boundaries are unchanged (`test:server`). CHANGELOG Fixed only if the shape
  compiled clean before.
  **Channel/tier:** compiler check, tier 1 Prevented; no runtime check.

  **Changed:** `handleAsyncBoundary` now reads `fx.scopeBadNames` for the client positions it checks — the ok arm's construct effects and the pending/err compose roots' `truc:pass` entries — where it read `badFreeNames`, the host-level rule. Inside a reactive-list item, a setup-const or authored-import read in those positions is now LTC005's list-body face ("…which a list body cannot read…"), the same refusal a plain item element or a reactive conditional's arm gets. Host-level boundaries and boundaries in host-level arms are unchanged (`scopeBadNames` is `badFreeNames` there).

  **How:** Ran the probes the entry ordered, on both surfaces (ok-arm construct via the `truc:html` channel, pending compose root pass entry, each inside a `reconcile()` item): both compiled clean BEFORE the switch — and the emitted client was coherent, the const declared in the preamble with the watch/`pass()` emitted beside it, because `computeClientNeededNames`' walk (`clientExprNodes`) reaches boundary positions inside list items (item content stays in the template tree; ADR 0046). So the entry's runtime-failure hypothesis ("may compile clean and then fail at runtime in the cloned item") did NOT materialize; the defect was consistency — the same read was LTC005 on any other list-body position but silently admitted inside a boundary arm. Switched per the entry's ruling for the clean-probe case and recorded the probe here in lieu of the entry text. No existing test or corpus shape relied on the lenient reader (full suite green unchanged after the one-line switch, before any test edits).

  **Check:** Both-surface pins added: `server/tests/compiler/mount-scopes.test.ts` ("an item-nested boundary refuses setup-const reads in its arm mounts (LT-483)" — ok-arm construct refusal + a host-level boundary still admitting the same read, with the emitted `watch(() => tone, …)` asserted) and `server/tests/compiler/compose.test.ts` ("a pass entry on a boundary compose root in a list item refuses setup-const reads (LT-483)" — pending compose root pass entry). Gates in the worktree: `test:server` 3665 pass / 0 fail; `lint:server` green (biome, no fixes); `typecheck` exit 0; `check:contract` holds; `check:corpus` 43 components, 0 census gaps; `build:docs` green (run for the serve tests). `check:links` not run — no emission change. CHANGELOG Fixed entry owed for the writer's iteration sweep: a setup-const/import read in an item-nested boundary's arm mounts compiled clean (and worked) before; it is now LTC005.

  **Review:** ✓ (2026-10-09). The switch verified against every `badNames` consumer in the handler — the ok arm's construct effects and both compose roots' pass entries; nothing else rides it, and `planHostComposeHandlers`' explicit `badFreeNames` is unreachable for item positions by construction (reconcile loops are skipped), so no sibling inconsistency was left behind. The How's BEFORE-clean claim re-proven live on the base commit (ddc5f884): diagnostics empty, the const declared client-side with the ok-arm watch emitted beside it — the mechanism note is exact and the CHANGELOG Fixed obligation stands. Gates re-run in the worktree: `test:server` 3665/0, `typecheck` exit 0, biome clean, touched files 128/128. Reviewer nit on the branch (d79816ff): `plan.ts`'s `badListBodyNames` doc still carried LT-349's "walks no list-body position → ReferenceError" rationale, which this task's probe disproves — reworded to the uniform-authoring-rule rationale. Comment only.

- [x] LT-489: BasicButton's modifiers become three orthogonal server args (`variant`, `kind`, `size`); module-todo's remove button composes `<BasicButton>`. — reviewed ✓
  **Area:** examples
  **Needs:** LT-461
  **Gates:** check:corpus, test:server, typecheck, test:variants, build:docs
  **Area:** examples
  **Filed (Architect, 2026-10-07, from LT-461's review). Ruled (owner, 2026-10-09: option 2', orthogonal server args):** module-todo's remove button stays raw (`<basic-button class="remove">` with an inner `<button class="tertiary destructive small">`). BasicButton's single `variant` enum mixes weight and color, so a parent cannot ask for that class triple.
  **Ruling.** Three optional server args, each a closed literal union; the default is in italics:
  - `variant`: `primary` | *`secondary`* | `tertiary`. The weight.
  - `kind`: `constructive` | *`normal`* | `destructive`. The color family.
  - `size`: `small` | *`medium`* | `large`.

  A default value has no special styles and is omitted from the emitted class. The inner button's class is the non-default tokens only, joined by spaces, so all defaults give an empty class. Drop the class attribute or emit `class=""`, whichever keeps the existing specs unchanged. `constructive`/`destructive` leave `variant` and move to `kind`. **Rejected:** a `variant` array and a cross-product enum (`tertiary-destructive`).
  **Change:**
  1. **BasicButton** (`basic-button.tsrx`, and the hand-written `basic-button.css` if it diverges): the three args with JSDoc, typed as above, and the class computed from the non-default tokens.
     - **CSS:** class names stay the same, so the stylesheet needs no new token. Existing usages must render as before: `tertiary destructive small`, `constructive`, `destructive`, `primary medium` and the rest.
     - **New combinations:** `primary` with a non-normal kind renders the kind's colors through the existing cascade order (the kind rules follow `primary`), so no new rule is needed. If a combination renders visibly wrong, write it in `NOTES.md` instead of designing a fix.
     - Keep the CSS byte-identical between the `.tsrx` source and its served artifact (ADR 0039).
  2. **Compose sites.** `variant="constructive"` becomes `kind="constructive"` in module-todo and module-list (both `.tsx` and `.tsrx`). Page-authored `.html` markup keeps its classes. A leftover default token such as `secondary` or `medium` is harmless there.
  3. **module-todo's remove button** composes `<BasicButton class="remove" variant="tertiary" kind="destructive" size="small" label="✕" ariaLabel="Remove" onClick={() => items.remove(k)} />` in both surfaces, and drops the LT-463 "raw, not composed" comment.
     - The compose site sits in a reactive-list item. If LT-461's handler-arg lowering refuses the parent-side `onClick` there, keep the button raw with the new class spelling and write a `NOTES.md` entry. Don't work around it.
  4. **Docs.** HOST_PROFILE § Handler args' note that a parent needing classes on the child's inner button uses the ownership rule gets BasicButton's three args as its worked example. The BasicButton `.md` lists the args.
  **Check:** `test:component basic-button module-todo module-list` unchanged on all surfaces, except mechanical rewrites of the sim-driver snapshot. `check:corpus`, `test:server`, `typecheck`, `test:variants` and `build:docs` green.
  **Channel/tier:** none. Example-corpus API shape; TypeScript already refuses a value outside each union.

  **Changed:** BasicButton's modifiers are three orthogonal server args per the owner ruling (2026-10-09, option 2'): `variant` (`primary`/`secondary`/`tertiary`, the weight), `kind` (`constructive`/`normal`/`destructive`, the color family) and `size` (`small`/`medium`/`large`), each JSDoc'd, each a closed literal union whose default emits no class token — the inner button's class is the non-default tokens joined, and all defaults drop the `class` attribute entirely (`attr()` omits `undefined`). module-todo and module-list compose with `kind="constructive"` (both surfaces); module-todo's remove button now composes `<BasicButton class="remove" variant="tertiary" kind="destructive" size="small" label="✕" ariaLabel="Remove" onClick={() => items.remove(k)} />` in both surfaces, replacing the raw markup — the empty badge span its render adds is hidden by `.badge:empty`. Page-authored `.html` keeps its classes (module-todo.html's steady state regenerated for the badge span; basic-button.html untouched). Docs: HOST_PROFILE § Handler args gains the ownership-rule note with the three args as its worked example; the BasicButton `.md` gains a Server Args table.

  **How:** LT-461's handler-arg lowering accepted the per-item compose without a word — the `onClick` lowers to one `on(first('basic-button.remove button'), 'click', …)` inside the item's bindItem scope on both surfaces; no NOTES.md fallback needed. Changing the class expression shifted four pinned expectations, all verified diff-by-diff before re-baselining: the module-list golden (`class="constructive"` — the default `medium` token is gone), the sim-driver snapshot (8 tags compose BasicButton: basic-button, module-list, module-ticker, module-todo, test-listitem, module-catalog, module-codeblock, css-probe — every diff is default-token omission plus module-todo's badge span), the equivalence-audit snapshot (same shapes + shifted byte-offset annotations), and the .tsx parity client snapshot, whose two-line shift is the composed remove's real consequence: the reorder handle's synthesized selector moves from `button.reorder` to `button[aria-pressed="false"]` because a compose site in the item now engages the composed-child exclusion pass and every class-token candidate "could match" the child's dynamic `class` (`mayMatchShape` treats a dynamic attribute as any value) — the first exclusion-free candidate wins, and it is exact (the placement button carries no `aria-pressed`); the remove handler's local moves from `button.tertiary` to LT-461's synthesized `basic-button button`.

  **Check:** typecheck, check:corpus, test:server (3662 pass, 0 fail), build:docs, check:links (775 links), test:variants (537 passed, unsandboxed) all green; test:component basic-button (12) and module-todo (60) pass unchanged — module-todo's remove-flow tests click the composed button in a real browser, proving the per-item handler end to end. module-list has no spec file (its coverage is the golden, the sim driver and the variant parity suite). `test:component module-list` is therefore not runnable as named in the entry. CSS untouched: the inline sheet and basic-button.css are byte-identical to before, so the ADR 0039 assertion holds trivially; `primary` with a non-normal kind renders the kind's colors through the existing cascade order (the kind rules follow `primary`), nothing visibly wrong, no NOTES.md entry.

  **Review:** ✓ (2026-10-09). The ruling verified clause by clause: three closed literal unions with JSDoc and default-omitting class emission (`undefined` drops the attribute entirely); `.secondary`/`.medium`/`.normal` carry no CSS rules, so the omitted defaults render identically, and the kind rules follow `.primary` in the sheet as the ruling's cascade note assumes. All four re-baselines checked diff-by-diff: the golden, sim-driver and equivalence-audit shifts are default-token omissions plus the badge span (`&:empty` under `.badge` hides it), and the parity snapshot's selector synthesis is sound — `aria-pressed="false"` is a template literal, so every clone mounts matching, and `basic-button button` is LT-461's placement selector. No stale old spelling anywhere in authored sources; page-authored `.html` keeps its classes per the ruling. Gates re-run in the worktree: typecheck exit 0 (43 components, 0 census gaps), build:docs green, test:server 3662/0, test:variants 537 passed, test:component basic-button 12 / module-todo 60 — the real-browser remove flow clicks the composed button end to end. module-list's missing spec file confirmed; the deviation note is accurate. No nits.

- [x] LT-492: Lift LTC011 for `truc:html` in a composed element's content — the parent's own sanitized binding (ADR 0048 s1). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-472, LT-483
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Needs:** LT-472, LT-483 (planning, 2026-10-09: track X runs one at a time)
  **Filed (Architect, 2026-10-07, from LT-463's review; owner ruling 2026-10-07):** `<div
  truc:html={start}/>` inside composed `<ModuleScrollarea>` children fails LTC011 through
  `composedElementUnsupported` ("`html` attribute in a composed element's content is not supported
  yet", ADR 0024 s10). That blocks module-splitview's conversion (LT-493).
  **Ruling:** content the parent passes as `children` belongs to the parent (ADR 0048 s1), so a
  `truc:html` on an element in that region is the parent's own binding, exactly like a
  `truc:html` in the parent's own template. It goes through the same sanitized channel (LT-025):
  the server render sanitizes and splices it into the children string, and a reactive thunk binds
  from the parent's client against the parent-owned element. **Rejected:** a markup-valued
  ModuleScrollarea prop. It would open a second HTML channel just for this one child and route
  markup through an arg that no sanitizer sees.
  **Change:** drop the `html`-attribute case from the composed-content refusal. Lower it through
  the existing `truc:html` emission, in the Children Region scope that LT-472's query re-include covers. The other
  constructs `composedElementUnsupported` names stay refused. Amend ADR 0024 s10's "not supported
  yet" list in place (it is unpublished) and cross-reference ADR 0048 s1.
  **Check:** `test:server` pins three things: a static `truc:html` arg in composed children
  renders sanitized server-side, a reactive thunk binds client-side, and a script in the markup
  is stripped. `check:corpus` green.
  **Channel/tier:** compiler — LTC011 narrows; no new check. The sanitizer's existing tier-2
  containment applies unchanged.

  **Changed:** `truc:html` on an element in composed content is the parent's own sanitized binding (ADR 0048 s1): the data-reference arg splices server-side through `sanitizeHtml` into the children string, and a reactive thunk plans as a host watch against the Children Region — LTC011 no longer refuses the `html` case; every other construct it names stays refused. A reactive thunk at a site the host walk cannot reach — inside an arm, a loop body or a server-rendered branch — is now refused (LTC005, per-enclosure fix), so nothing compiles as a silently inert watch; the data-reference form needs no client half and is legal in every scope. ADR 0024 s10 amended in place cross-referencing ADR 0048 s1; HOST_PROFILE (bullet 3's region passage), LE_TRUC_COMPILER (the one-writer passage) and `skills/le-truc/references/errors.md` (LTC005's arm/branch faces) updated.

  **How:** `validateComposedChildren` admits `kind: 'html'`; `planContentRefs` became `planContentConstructs`, planning a reactive thunk through the shared `emitConstructEffects` (query under the reference's name when the author addressed the element, else the tag's — the `emitTopEffects` pattern); `validateArmSetPlacement` gained the scoped-site refusal at its whole-template checkpoint.

  **Check:** gates green in the worktree: `test:server` 3675/0 (after `build:docs`; the 16 serve-test failures on a fresh worktree were the missing `docs/` build), `typecheck`, `lint:server`, `check:corpus`, `check:contract`, `check:links`. New legs in `server/tests/compiler/children-region.test.ts` pin: a static arg renders sanitized (fail-closed escaped default) on both surfaces; a configured sanitizer strips a `<script>` from the content markup; a reactive thunk emits `watch(() => body.get(), dangerouslyBindInnerHTML(article, { sanitize: sanitizeHtml }))` and the harness renders its seed server-side, on both surfaces; the static form stays legal inside a server branch; and the four scoped refusals (arm, reactive-list body, server-data loop body, server-rendered branch) each fire LTC005 naming the enclosure. Two doubts for the review pass: (1) pre-existing, not from this change — a `first()` into a compose site inside a server-rendered branch compiles with a dangling query name (the branch walk never calls the content planner; probes confirmed the emitted client references an undeclared local). My refusal covers `truc:html` only; the ref shape may want its own task. (2) `roleWrites` (LTC084) scans authored statements only, so a reactive `truc:html` on a role element is a parent write it cannot see — the accepted-edge ruling scopes it so (widening is LT-515's question); noted in the `findRoleWriterConflicts` docstring.

  **Review:** ✓ (2026-10-09). The lift verified against the ruling: `validateComposedChildren` admits `kind: 'html'` and nothing else; the data-reference form splices server-side through `sanitizeHtml` (pinned: fail-closed escaped default on both surfaces, a configured sanitizer stripping `<script>`/`onclick`, restore in `finally`); the reactive thunk plans through the shared `emitConstructEffects` under the ref's or the tag's query name (pinned: `watch(() => body.get(), dangerouslyBindInnerHTML(article, { sanitize: sanitizeHtml }))` with the seed rendered server-side, both surfaces). The scoped refusal — the one step beyond the filed Change — is the right call and correctly built: the alternative to refusing was a silently inert watch, the enclosure picker and per-enclosure fixes are precise, all four enclosures are pinned as LTC005, and `errors.md`'s arm/branch face documents the new wording; tier 1 Prevented. Docs verified: ADR 0024 s10 amended in place with the ADR 0048 s1 cross-reference, HOST_PROFILE bullet 3's region passage, the one-writer passage's template-authored-write note. **Doubt 1 confirmed live and filed as LT-519**: on this branch, a `first()` into a compose site inside `@if (open) { … }` compiles with empty diagnostics while the emitted client carries `watch(() => true, () => { mark.title = 'marked' })` over an undeclared `mark` — ReferenceError at connect; pre-existing (the content planner has always been host-walk-only), outside this task's ordered scope. **Doubt 2 accepted as scoped**: `roleWrites` reads authored statements only per the LT-476 review's accepted-edge ruling, the docstring and the one-writer passage say so, and LT-515 (P7 design) owns the widening question. Gates re-run in the worktree: build:docs, `test:server` 3675/0, `typecheck`, `lint:server`, `check:corpus`, `check:contract`, `check:links` 776/776. No nits.

- [x] LT-493: module-splitview composes `<ModuleScrollarea>` for its panes. — reviewed ✓
  **Area:** examples
  **Needs:** LT-492
  **Gates:** check:corpus, test:variants, test:server, typecheck
  **Area:** examples
  **Needs:** LT-492
  **Filed (Architect, 2026-10-07, from LT-463's review):** module-splitview's panes are LT-463's
  last named scrollarea site. The conversion was reverted there because `truc:html` inside
  composed children was LTC011-refused, and LT-492 lifts that refusal.
  **Change:** in `module-splitview.tsx`, each pane's `<module-scrollarea>` becomes
  `<ModuleScrollarea …>` with its `<div truc:html={…}/>` as children. Leave the `.ts` twin as it is,
  and keep the CSS byte-identical. Update the source header to name the composition (LT-463,
  LT-492).
  **Check:** `check:corpus` green; `bun run test:component module-splitview` green on all
  surfaces.
  **Channel/tier:** none — corpus conversion.

  **Changed:** module-splitview's two panes are composed `<ModuleScrollarea>` elements (LT-463's last named scrollarea site, unblocked by LT-492's LTC011 lift): each pane's `<module-scrollarea>` becomes `<ModuleScrollarea>` with its `<div truc:html={start|end}/>` child, which lowers to the parent's own sanitized binding (ADR 0048 s1) — server spliced through `sanitizeHtml`, no client half, exactly the channel the raw form used. The `.ts` twin is untouched and the CSS is byte-identical (the variant assert passes; per ADR 0048 s5 the `@scope` rule `module-scrollarea { min-width: 0 }` reaches the composed roots as descendants, unchanged). Source header names the composition (LT-463, LT-492).

  **How:** three edits in `examples/module/splitview/module-splitview.tsx` — header paragraph, one import of `../scrollarea/module-scrollarea.tsx`, and the two pane swaps. Served markup moves by design: each pane gains scrollarea's own wrapper `<div data-children="module-splitview">` around the pane content (undefined `orientation` omits the attribute). One snapshot re-pinned: `sim-driver.test.ts.snap`'s module-splitview line (bun `test -u`; the other 42 snapshots in the file are byte-identical). The equivalence audit passed unchanged — splitview's connect diff stays empty with the composed panes hydrating in the realm.

  **Check:** gates green in the worktree: `typecheck` exit 0, `check:corpus` exit 0, `build:docs`, `test:server` 3675/0 (after the re-pin; the first run failed exactly the one snapshot), `test:variants` 537 passed / 7 skipped on all surfaces, `bun run test:component module-splitview` 24 passed, `bunx biome check` on the changed path clean. No LTC087 fired on the bare `module-scrollarea` `@scope` rule — it targets the composed child's host itself, which the warning's inside-the-child scope does not cover; the styling intent is sizing the pane root from the parent grid. Review glance if wanted: scrollarea's header comment ("compiled parents … author their own first child") already described composed parents (codeblock, dialog) in this arrangement, so I left it; splitview joins that set.

  **Review:** ✓ (2026-10-09). The diff is exactly the three ordered edits — header paragraph (naming LT-463/LT-492 and ADR 0048 s1), the import, the two pane swaps — with the `.ts` twin and the CSS untouched. The `truc:html={start|end}` sites are the data-reference form, which needs no client half, so no scope questions arise. The re-pin verified at char level: the snapshot string differs only by the two Children Region wrappers (`data-children="module-splitview"` opening/closing divs, one per pane) — nothing else moved — and reverting the snapshot to the base commit reproduces the first-run failure live: 52 pass / exactly 1 fail, the module-splitview line. ADR 0048 s5's descendant-reach claim checked verbatim ("the parent's scoped rules reach it as descendants"), and the no-LTC087 reasoning holds — the bare `module-scrollarea` rule targets the composed child's host element, not its internals; check:corpus keeps the 1-standing-warning baseline. The review glance resolves clean: scrollarea's header already named splitview among the compiled parents at the base commit — leaving it was right. Gates re-run in the worktree: typecheck 0, check:corpus 0, build:docs, test:server 3675/0 (equivalence audit unchanged, as claimed), test:variants 537, test:component module-splitview 24, biome clean. No nits.

- [x] LT-494: FormRadiogroup's `.split-button` variant hides its own legend and radios; module-todo composes `<FormRadiogroup>`. — reviewed ✓
  **Area:** examples
  **Needs:** LT-463, LT-489
  **Gates:** check:corpus, test:variants, test:server, typecheck
  **Area:** examples
  **Needs:** LT-463, LT-489 (planning, 2026-10-09: both edit module-todo; track B)
  **Filed (Architect, 2026-10-07, from LT-463's review; owner ruling 2026-10-07):** module-todo's
  filter radiogroup stayed raw. The composed render cannot carry the page-level `visually-hidden`
  class on the legend and the radio inputs. (Under ADR 0033 as revised 2026-10-07, the parent
  could style the child's internals without a limit, but LTC087 would flag it as a leak. The
  ruling stands: the presentation is the child's.)
  **Ruling:** that presentation belongs to the child's own `.split-button` variant. Every
  split-button usage hides the legend and the native radios (see `form-radiogroup.html`), so the
  variant's own stylesheet owns it. No new prop. **Rejected:** a presentation arg (`hideLegend`
  and similar), which would expose one variant's internals as API, and accepting a visible
  difference.
  **Change:**
  1. In FormRadiogroup's sheet, `&.split-button` visually hides `legend` and
     `input[type="radio"]` with the same declarations as the shared `.visually-hidden` utility,
     so the legend keeps its accessible name and the inputs stay focusable. The page-authored
     demo drops its now-redundant `visually-hidden` classes, or keeps them (harmless). Pick
     whichever leaves `form-radiogroup.spec.ts` unchanged. The hand-written `form-radiogroup.css`
     gets the same rule, so its CSS matches the compiled sheet.
  2. module-todo (`.tsx` and `.tsrx`) composes `<FormRadiogroup class="split-button" name="filter"
     legend={t.filter} options={…} value="all" />`, with the option labels from `t.all`,
     `t.active` and `t.completed`. Remove the raw markup's LT-463 comment.
  **Check:** `check:corpus` green; `bun run test:component form-radiogroup` and `module-todo`
  green on all surfaces, with no expectation changed. If a spec expectation must change beyond
  the composed root's attributes, stop and write it in `NOTES.md` (LT-463's rule for surprises).
  **Channel/tier:** none — corpus CSS and composition.

  **Changed:** FormRadiogroup's `.split-button` variant now visually hides its own legend and radios — the exact `.visually-hidden` declarations, in the compiled sheet and the hand-written `form-radiogroup.css` twin — and module-todo's filter composes `<FormRadiogroup class="split-button" name="filter" legend={t.filter} options={…} value="all" />` on both compiled surfaces (`.tsx`/`.tsrx`), labels from `t.all`/`t.active`/`t.completed`; the LT-463 raw-markup comments are gone and the demo html keeps its page-level classes (the spec pins `input.visually-hidden`).
  **How:** Composing required `form-radiogroup > *` added to module-todo's `@scope to (…)` limits on both surfaces — LTC087's prescribed fix (the child's labels carry a dynamic class, so every class selector "could" match inside it; module-coloreditor's multi-limit form). Two review records re-pinned: sim-driver's module-todo fixed-point markup and the equivalence-audit hydration boundary. The boundary moved for the designed reason: the composed root gains `name="filter"`, the legend/radios drop the page-level classes (the variant's sheet hides them now), and the child's connect-time writes (label `selected`, per-radio `tabindex`, the `checked` property write) are module-todo's boundary — the same write class form-radiogroup's own audit entry records.
  **Check:** `check:corpus` (0 new warnings — the 6 fresh LTC087s the compose raised are gone with the limit), `typecheck`, `test:server` (3665 pass after the two deliberate snapshot re-pins), `test:component form-radiogroup` (40) and `module-todo` (60), `test:variants` (537, every surface), `lint:examples` — all green, no spec expectation changed. Doubt for the review pass: the composed render gives up the raw markup's hand-baked pre-upgrade steady state — a served module-todo page shows no checked/selected filter until client activation (the child's server render never bakes it; its own demo hand-bakes for the docs page). Inherent to composing this child; flagging it because the old raw markup was better pre-upgrade.

  **Review:** ✓ (2026-10-09). The ruling verified: the `.split-button` rule carries the exact six `.visually-hidden` declarations (`examples/_global.css:558`), in the compiled sheet and the hand-written twin; legend and radios only, so the accessible name and focusability survive. The composition matches the ruled spelling on both surfaces, labels from `t.all`/`t.active`/`t.completed`, LT-463 comments gone; the demo html keeps its utility classes per the "whichever leaves the spec unchanged" clause. The `@scope to (basic-button > *, form-radiogroup > *)` limit is exactly module-coloreditor's multi-limit form — LTC087's prescribed fix. Both snapshot re-pins read as the designed consequence: the composed root gains `name="filter"`, the page-level classes drop, and the child's connect-time writes (`selected`, `tabindex`, the `checked` property) become module-todo's hydration boundary. **The flagged doubt is ruled inherent-and-accepted:** the child renders selection through `host.value` thunks (form-radiogroup.tsrx:119-125) — client positions that do not fold server-side, which is why its own demo hand-bakes — and no page can reach inside another component's template to bake it. The pre-upgrade unselected flash is the cost of the ruled composition; recorded here. (Whether the child should bake its initial selection from a static `value` arg is a separate design question, left to the owner.) Gates re-run in the worktree: check:corpus exit 0 (43 components, census 36/7/0, 1 standing warning — 0 new), typecheck 0, build:docs, test:server 3665/0, test:variants 537, component form-radiogroup 40 / module-todo 60, lint:examples clean. No spec expectation changed. No nits.

- [x] LT-514: Form components and BasicButton take their visible label as non-interactive children. — done, pending review ⏳
  **Area:** examples
  **Needs:** LT-477, LT-479, LT-489, LT-494
  **Gates:** check:corpus, test:variants, typecheck, test:server, build:docs
  **Area:** examples
  **Filed (Architect, 2026-10-09; owner ruling on BasicButton, this session):** LT-479 lets FormCheckbox take its label as children. This task does the same for the other corpus components whose visible label is a `string` arg rendered as a text node, where the raw HTML element would accept phrasing content. The pattern is ADR 0048 s4: `children?: Children<{}, 'non-interactive'>`. LT-479 keeps a reactive `label` beside the children for FormCheckbox; here only BasicButton keeps one (item 2), because no form component in item 1 exposes its label. Change every member of each variant set (ADR 0039) and keep the CSS byte-identical.
  1. **Form components: `label` (`legend`) becomes `children`.** Remove the string arg and insert `{children}` where the arg was rendered:
     - `form-textbox`, `form-combobox` (both the `.tsrx` and the `.tsx` member) and `form-tokenbox`: `<label for={inputId}>{label}</label>`.
     - `form-spinbutton`: the label is optional, so `@if (label)` becomes a test on `children`.
     - `form-radiogroup`: `<legend>{legend}</legend>`. The options' `option.label` is list-item data and stays a string.
     None of these components exposes its label, so the change touches no client code.
  2. **BasicButton gets both.** `label` stays as the reactive text prop: it is exposed, and module-ticker's `.ts` twin `pass()`es it at runtime. Add `children?: Children<{}, 'non-interactive'>` for rich static content such as an icon plus text. `span.label` renders the passed children when present, otherwise `{label}`. Writing `label` at runtime replaces the rich content with text; document this on the arg's JSDoc. Existing `label=` compose sites stay valid.
  3. **Compose sites.** Move every compiled compose site of a form component in item 1 from `label=`/`legend=` to passed children: the `examples/` sources and `server/tests/compiler/imported-setup-helper.test.ts`. Page-authored `.html` markup is unaffected.
  4. **Out of scope:** `aria-label`-style args (`form-listbox`'s `ariaLabel`), `description` args (a description may legitimately hold a link, and a component has only one `children` region), and the card components' `label`.

  **Channel/tier:** no new check. LTC085 (LT-477) already refuses interactive content at these compose sites. Any remaining interactive site is a `NOTES.md` entry, not a workaround.
  **Check:** `test:component` for each changed component and its composers is unchanged. `check:corpus` and `test:variants` stay green.
  **Sequence (Architect, 2026-10-09):** LT-514 runs after LT-494, which first composes module-todo's `<FormRadiogroup legend={t.filter} …>`; item 3 then moves that site's `legend` to children. It also runs after LT-489, which reshapes BasicButton's props (`variant`/`kind`/`size`), so BasicButton's API changes in one order.

  **Changed:** Form components and BasicButton take their visible label as non-interactive children (ADR 0048 s4). `form-textbox`, `form-combobox` (both variant members), `form-tokenbox` and `form-radiogroup` replace the required `label`/`legend` string arg with a required `children: Children<{}, 'non-interactive'>`; `form-spinbutton`'s optional `label` becomes optional children tested by `@if (children)`. BasicButton keeps the reactive `label` prop (module-ticker passes it at runtime) and gains `children?: Children<{}, 'non-interactive'>`: `span.label` renders the children when present, otherwise the `label` text. Because that choice folds server-side, no auto watch-text plans for the span anymore — BasicButton now authors checkbox's equality-guarded `watch('label', …)` as the label's one runtime writer, and the arg's JSDoc documents that a runtime write replaces rich children with text. Every compiled compose site moved to children: inplace-edit's edit field, colorgraph's three axes, module-todo's add-todo field and filter legend (both members), coloreditor's name field, module-list's new-item field (both members), and the `imported-setup-helper.test.ts` compose fixture. Existing `label=` BasicButton compose sites stay valid. Out-of-scope items untouched (form-listbox `ariaLabel`, `description` args, card labels). Docs: the five form `.md` pages gain the checkbox-style children paragraph; basic-button's Server Args table gains `children` and its `label` row documents the runtime-write contract. Regression pin: `server/tests/compiler/label-children.test.ts` (rich children render trusted; they survive connect; a runtime `label` write flattens them; a plain label still updates).

  **How:** Standard compile/fixture round. Children render trusted (`String(children)`, ADR 0048 s1) where the old `label` arg escaped through the text sink — the golden's special-characters test now pins that split (attribute escapes, children trusted). Compose sites therefore gain the `data-children="<parent>"` region marker on the `label`/`legend` element (module-list golden, sim-driver and equivalence-audit snapshots re-pinned — the audit's deltas are offset shifts only, the hydration writes unchanged). BasicButton's open children shape propagates through the compose registry: parents' synthesized queries gain `:not(<child> *)` exclusion clauses (`module-list.client.ts.snap`, `parity.test.ts.snap` re-pinned).

  **Check:** All gates green in the worktree: `typecheck` ✓, `test:server` 3717/3717 ✓, `check:corpus` ✓ (exit 0; compile-warning baseline 1 unique standing warning, the pre-existing module-dialog LTC088 — the five LTC047 warnings my first cut raised were fixed, not baselined), `test:variants` 537 passed ✓, `build:docs` ✓, `check:links` 775 ✓, and Playwright `test:component` for all eleven touched components/composers unchanged-green (basic-button 12, textbox 30, combobox 60, tokenbox 6, spinbutton 42, radiogroup 40, inplace-edit 26, colorgraph 20, module-list 14, module-todo 60, coloreditor 24).

  **Deviations and residues for review:**
  - **LTC047 rode in, fixed per its own prescription.** Moving `label="Lightness"`-style args into template children exposed the literals to LTC047's prose walk (compose content is the parent's markup, ADR 0048). The literals now route through catalogs: `form-colorgraph` gains `lightness`/`chroma`/`hue`, `module-todo` gains `addTodoLabel` (both members). `de.json` got real German ("Helligkeit", "Chroma", "Farbton", "Was muss erledigt werden?") written by me — translator review welcome; the other five locales carry `""` placeholders via `i18n:sync` (manifest confirmed; census reports 0 gaps since placeholders count as present).
  - **module-todo's synthesized `p` query coarsened:** `p.remaining` → `p:not(form-textbox *, basic-button *, form-inplace-edit *, form-radiogroup *)`. The open children shapes make every candidate clash, and `resolveSelectorIn` accepts the first unique candidate, so the bare tag beats the class discriminator among excluded candidates. Still structurally unique and correct today (module-todo has exactly one `p`), but the discriminator loss is a compiler-synthesis precision gap worth a look — among excluded candidates, precision is not preferred.
  - Variant-member spelling note: biome formats `.tsx` compose children multiline; the tsx front end trims JSX whitespace, so both members render byte-identical (parity's value-harness test pins it).

- [x] LT-517: The probe differential's composed leg is vacuous — key its synthetic registry by source path so `composedShapesFor` lookups hit. — reviewed ✓
  **Area:** compiler
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-09; LT-512 review).** In `server/tests/compiler/probe-differential.test.ts`, `runDifferential` builds its synthetic registry keyed by `ComponentIR.source`. That holds the source **text**, while a compose node's `source` is the resolved file path. Every `composedShapesFor` lookup misses on both the reference and production sides, so each child resolves as unknown markup. The corpus leg's composed comparison therefore agrees trivially, and has done so since LT-379. It cannot catch a divergence in `composedEmitter`, including LT-512's region-content `children` skip.
  **Do:**
  1. Key the registry by the path the compose nodes carry: the corpus file path the harness compiled, resolved the same way `scripts/build-corpus.ts` resolves compose sources.
  2. Add a non-vacuity guard: the corpus leg asserts that at least one compose lookup hits a registered entry with a known tag, and fails otherwise.
  3. Bring the reference re-encoding of `composedEmitter` up to date with production: the `children` skip for region-content targets (LT-512), the region-form exclusion and `regionSafe`. Fix any mismatch the now-live comparison surfaces in the reference unless it shows a production bug. A production bug goes to `NOTES.md` instead of being fixed here.

  **Check:** `test:server` green. Temporarily removing the LT-512 skip from the reference's re-encoding makes the differential fail on module-codeblock (a temporary edit, not committed).
  **Channel/tier:** none. Test harness only.

  **Changed:** The probe differential's composed leg is live — `runDifferential`'s synthetic registry is keyed by the compiled path (the repo-relative filename each component was compiled by, the key `compileCorpus` registers entries under) instead of the source text, so `composedShapesFor` lookups hit (they all missed since LT-379, making the composed comparison agree trivially on unknown markup). The corpus leg now compiles with `file.filename` (repo-relative, as production does) instead of the absolute `file.path`, and gained a non-vacuity guard: at least one compose lookup must hit a registered entry with a known tag.

  **How:** Test-only (`server/tests/compiler/probe-differential.test.ts`); no production code touched. The reference implementation was brought up to date with production's `composedEmitter`: the LT-512 `children`-shape skip for region-content targets, `regionSafe`, and the region-form exclusion (`refExcludeUnlessOwned` mirrors `excludeUnlessOwned`'s string form byte-for-byte) — plus the mirrors the live comparison needs: `refEnclosingComposeOf` and `refCountWithRegions` (the hand analog of `probeCountWithRegions`, which region-content targets count over). Synthetic registry entries now carry `childrenRegion` via `childrenRegionOfComponent`, as production's pipeline does.

  **Check:** `test:server` green — 3662 pass / 0 fail (first run had 27 fails from the fresh worktree's unbuilt docs; `build:docs` before the gate, as the skill requires). `typecheck` OK; `biome check` clean on the changed file. The entry's Check is proven: with the LT-512 skip removed from the reference's re-encoding (temporary edit, reverted), the corpus leg fails with 18 mismatches, on module-codeblock's region-content targets `pre`@4216 and `code`@4227 (reference falls back to the region-form exclusion, production emits clean). The now-live comparison surfaced ZERO mismatches across 53 corpus components and 57 compose sites — production and the re-encoded reference agree everywhere, so no production bug to report and no NOTES.md entry.

  **Review:** ✓ (2026-10-09). The registry keying verified empirically — the live leg resolves all 57 compose sites (53 components, 608 selector queries, 0 mismatches) and the non-vacuity guard holds. The mirrors checked against production: `regionSafe` is structurally identical to selectors.ts's and the region-form exclusion reproduces the documented `:not(:is(C *):not(:is(R *):not(:is(R C *))))` shape with `R` = `[data-children=owner]`. The entry's acceptance proof re-proven live: with the LT-512 skip removed from the reference (temporary edit, reverted), the corpus leg fails on module-codeblock's region-content targets `pre`@4216/`code`@4227 — the reference falls back to the region-form exclusion while production emits clean; my edit surfaced 16 mismatch entries where the entry counted 18, a counting artifact of the temporary edit, same failure substance. Gates re-run in the worktree: build:docs, `test:server` 3662/0, `typecheck` exit 0, biome clean on the changed file. Test-only as claimed; no production code touched. No nits.

- [x] LT-518: Writer copy pass — LTC081 and the reworded LTC007 refusals, plus three stale compiler-doc facts. — done ✓
  **Area:** docs
  **Gates:** test:server, check:links
  **Area:** docs (`writer`)
  **Filed (Architect, 2026-10-09, eighth prune):** two reviews deferred copy to a later batch, and no open task held it. The prune audit also found three stale facts.
  **Do:**
  1. **Error copy** (`writer` → error-messages), in `server/compiler/diagnostics.ts` with the matching `skills/le-truc/references/errors.md` rows:
     - LTC081's message (LT-461's review deferred it).
     - The arm and list-item faces of LTC007 that LT-498 reworded.
     - The LTC005 row gains LT-461's parent-side face: a handler arg on a child where no mount binds it (today only `analysis/effects.ts`'s doc states it).
     Keep each message's channel and tier wording (ADR 0028). Update the server tests that pin message text in the same commit.
  2. **`LE_TRUC_COMPILER.md`** (around the tier-census passage): refresh the tier counts against `check:corpus` and list module-lazyload as Folded (LT-093; `queue/LEDGER.md`, eighth pass).
  3. **`VOCABULARY_LEDGER.md`**: LTC082 is released unused (LT-136), not held by another task. Fix both mentions.

  **Not in scope:** LT-496's "Multiple sites" copy for a mixed clash (accepted as is), and the CSS codes (LT-503 reviewed them).
  **Check:** `test:server` and `check:links` green. The diff changes message text and docs only, with no diagnostic code or condition.
  **Channel/tier:** none (copy).

  **Changed:** copy pass landed — LTC081's `read` face says "raw element" (a placement publishes on an owned custom tag too, so "native element" was wrong; HOST_PROFILE's LTC081 bullet follows), and its `in-loop` face states the consequence (only the first item's element would get the one listener); `errors.md`'s LTC007 row now carries the LT-496/LT-498 compose-site faces (scope words, the forward's tag-unknown clause, the per-shape class fixes) and the LTC005 row gains the LT-461 parent-side face (a handler arg on a composed child where no mount binds it); `LE_TRUC_COMPILER.md`'s census re-pinned to 36 of 43 Folded against `check:corpus` (7 Simulated, enumerated from the fresh census; `module-lazyload` listed Folded with the nil-arm reason) and the Static-tier census line to 36/7/0; `VOCABULARY_LEDGER.md` records LTC082 as released unused (LT-136) in both mentions. Message pins held, so no test changed. Gates: test:server 3662/0, check:links 775/775.
