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

- [x] LT-489: BasicButton's modifiers become three orthogonal server args (`variant`, `kind`, `size`); module-todo's remove button composes `<BasicButton>`. — done, pending review ⏳
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

- [x] LT-517: The probe differential's composed leg is vacuous — key its synthetic registry by source path so `composedShapesFor` lookups hit. — done, pending review ⏳
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
