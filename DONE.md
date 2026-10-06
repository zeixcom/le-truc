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

- [x] LT-460: A compose site in an async-boundary arm — lower it as arm root, keep the arm binding in its children. — reviewed ✓
  **Area:** compiler
  **Gates:** check:corpus, test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from a composition probe for LT-463; owner: both are bugs):**
  (1) a compose site as an arm root (`pending={…}`, `catch={e => …}`, `.tsrx` `@pending`/`@catch`/`@if`
  bodies) was refused with a stale LTC011 message naming "`.map()` output"; (2) a catch-parameter read
  in a compose site's children compiled with no diagnostic into a server module that read `e` outside
  the catch callback (TS2552 under `check:corpus`, ReferenceError at execution).

  **Changed:** Compose sites are legal in arm positions on both surfaces. An arm root that is a compose
  site lowers as one, and its `data-key` splices onto the child's rendered root through
  `composeHostAttrs`, for reactive conditionals and async boundaries, in both the live arm and the inert
  templates. A catch-parameter read inside composed content (one compose hop) is in scope in the live
  arm, baked empty in the err template, and rewritten by the client's err watch through an arm-scoped
  `first()`. LTC011's composed-position wording now names a loop's output root. New LTC005 refusals
  (compiler, tier 1): a compose **arg** reading the catch parameter; a bare-tag message element inside
  composed content (it needs a `role`, `class`, `id` or `data-*`, since the child's own markup could
  match a bare tag); a reactive read placed directly in composed content (fix-it: wrap it in an element
  of your own). The pending arm keeps its deep-construct refusal. Documented in
  `server/compiler/HOST_PROFILE.md` (compose-arm paragraph) and `LE_TRUC_COMPILER.md`.

  **Review:** Approved after two rework rounds. Round 1 fixed: a bare-tag selector miswrite, dead
  `armValue` code, wrong fix-it advice for composed content, and a missing reactive-`@if` compose-arm
  test. Round 2 fixed: a pending-arm deep-construct regression introduced by round 1, and the
  message's missing `data-*` mention. Rulings: an ok-arm compose root stays refused (composed content
  cannot carry the task read); item/key reads in composed content stay LTC075; the LT-221 probe pin
  ("compose site in a `@pending` arm is rejected") is overruled.

- [x] LT-462: Children contract — parent-owned children, child-declared roles and content model (design; ADR 0048). — done ✓
  **Area:** design
  **Needs:** LT-465
  **Area:** design
  **Filed (Architect, 2026-10-06; owner rulings 2026-10-06):** composing `<ModuleScrollarea>` around
  `module-codeblock`'s `<pre><code>` fails LTC026 — the structural verifier excludes everything
  under a composed child (`:not(<child-tag> *)`, LT-316) — and ADR 0033 s7 leaves content a parent
  places inside a composed child outside the parent's style scope.
  **Owner rulings:** (a) content a parent passes as `children` is owned by the parent. (b) A child
  may act on its children through its contract (first raised for `BasicPluralize`, since retired
  in LT-467; `<select>`/`<option>` is the standing analogue).
  (c) `FormCheckbox` takes its label as `children` and refuses interactive content in it. (d) The
  CSS boundary consequence is decided by a spike first (LT-465).
  **Model to record in ADR 0048:**
  1. **Parent owns the content** — structure, text, its own bindings and `first()` references reach
     the children region; the verifier excludes only the child's own template.
  2. **The child acts only through declared roles** — its `children` type names the roles it
     addresses (sketch: `children: Children<{ tab: 'button', panel: 'section' }>`, roles matched by
     class), as `<select>` acts on `<option>`. A child `first()`/`all()` into children that targets
     no declared role is a reach-in (new LTC, tier 1).
  3. **One writer per property** — a parent binding a property the child's contract writes on a role
     element is a conflict (new LTC, tier 1, decidable from the compose registry).
  4. **Content model** — a child may declare its children non-interactive; the compiler checks the
     compose site's literal children (`a[href]`, `button`, `input`, `select`, `textarea`, `label`,
     `details`, `iframe`, `[tabindex]`, media with `controls`) and composed children whose template
     contains one, transitively through the registry (new LTC, tier 1). TypeScript cannot carry it
     (JSX element types are opaque); page-authored HTML is unchecked.
  5. **Styles** — per LT-465's recommendation.
  **ADR edits riding with 0048** (none of these is published on `main`, so all are in-place
  amendments): ADR 0024 s10 (children ownership; cross-reference), ADR 0033 s7 (the
  "template-authored content in a composed child" difference, per LT-465), ADR 0046 (point 1's
  verifier change inside list items), HOST_PROFILE § data account bullet 3 and § element references.
  **Output:** ADR 0048, then compiler tasks per numbered point with channel, tier and LTC codes,
  plus the two composition sites split out of LT-463 (owner, planning 2026-10-06):
  `module-codeblock`'s `<module-scrollarea>` → `<ModuleScrollarea>`, and `module-todo`'s
  `<form-checkbox>` → `<FormCheckbox>` with its label as children (point 4's content model; after
  LT-464 gives form-checkbox its `.tsx` spelling).
  **Changed:** ruled 2026-10-06 (owner design session) into ADR 0048. ADR 0024 s10, ADR 0033 s7
  and ADR 0046 s1 were amended in place, and CONTEXT.md gained **Children Region** and **Role**.
  The implementation is track C: LT-472 to LT-479 (ITERATION ruling 10).

- [x] LT-465: Spike — style scope for parent-owned children inside a composed child. — reviewed ✓
  **Area:** compiler
  **Area:** compiler (spike — no production change; output is a report)
  **Filed (Architect, 2026-10-06, owner ruling (d) in LT-462):** under parent-owned children the
  parent's rules should reach the content it passes into a composed child, and the child's rules
  should not (beyond declared role elements' own boxes). ADR 0033 s3 emits
  `@scope (parent) to (<boundary> > *)`, which cuts off everything below the child host —
  children included, wherever the child's template inserts them (`<pre><code>{children}</code></pre>`
  puts them two levels deep). A `to` limit cannot re-include a subtree it excluded.
  **Probe these shapes, both emissions (native `@scope` and lowered `:where()`), self-nesting
  included (ADR 0033 s7's `A > B > A′`):**
  (a) **A second scope root at the insertion point:** the server marks the element enclosing a
  `{children}` insertion (sketch `data-children`), and the parent's sheet emits once more as
  `@scope ([data-children]) to (<boundary> > *)`, guarded to the parent's own instances — cost:
  doubled rules, the marker attribute in served HTML, the instance guard.
  (b) **A `display: contents` wrapper element** around inserted children, as the scope root of (a)
  without marking a template element — cost: a non-semantic element in the DOM, child selectors
  (`:host > p`) that now miss.
  (c) **Status quo plus `:global`** — children stay outside the scope; record what ownership then
  means for styles only.
  For each: which rules match, specificity parity between emissions, served-byte cost on the
  corpus's composing components, and the child-side half (the child's own `to` limit must now stop
  at the insertion point). Also confirm the structural verifier change (LT-462 point 1) composes
  with the chosen marker.
  **Output:** a recommendation with fixtures under `server/tests/` (kept, skipped if the chosen
  shape is not adopted) and a short report in `NOTES.md` for the Architect, who writes ADR 0048
  and the ADR 0033 s7 amendment from it.

  **Changed:** Spike report recommending shape (a). The server marks the element enclosing `{children}` with `data-children="<owner-tag>"`. The owner adds a region re-include: a second `@scope` block in native emission, a guard clause in lowered. The child adds the pseudo-boundary `[data-children]:not([data-children="T"])`. Shapes (b) and (c) were measured and rejected. Report: `spike/children-scope/FINDING.md`, summarized in NOTES.md.
  **How:** `server/tests/compiler/children-scope.ts` is a prototype that post-processes `emitScopedSheet` output; its fixtures are in `children-scope.test.ts`. The browser matrix covers both emissions and all three shapes, including self-nesting, in Chromium and WebKit (`spike/children-scope/*.probe.ts`). `measure.ts` measures byte cost over the corpus. No production code changed.
  **Check:** `bun spike/children-scope/generate.ts && node node_modules/.bin/playwright test --config spike/children-scope/playwright.config.ts` reproduces `results-*.json`. Gates: typecheck green. test:server green: 3389 pass after `build:docs`; the serve tests need a built `docs/`. Doubts for the Architect:
  - The native self-nesting difference (region rules resolve against any enclosing T).
  - Forwarded `{children}` and declared-role styling were reasoned through but not probed.
  - The marker name is unratified.
  **Review:** Approved: a spike with no production change, ruled into ADR 0048. The finding's lowered self-nesting "unstyled" row is the spike-time state; ADR 0048 s6 replaces it with the re-include (LT-473). The prototype and its test are deleted when LT-473 ports them.

- [x] LT-466: module-todo — move the in-place editor out of the checkbox label. — reviewed ✓
  **Area:** examples
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06; owner-confirmed bug):** each todo item places a `FormInplaceEdit`
  inside the `<label>` of its `form-checkbox`. Interactive content inside a label is invalid
  (HTML content model) and leaks activation: the edit button stops its click, but the
  double-click that starts editing bubbles to the label and toggles the checkbox. Move the
  `FormInplaceEdit` to beside the `form-checkbox` within the item, in both `module-todo.tsx` and
  `.tsrx` (CSS byte-identical, ADR 0039). The checkbox keeps an accessible name: a
  `.visually-hidden` label text bound to the item label (`{() => item.label.get()}`), so the
  visible text is the editor's and the name follows edits. Adjust the item grid in the sheet.
  **Verification:** a Playwright leg — double-clicking the label text enters edit mode without
  toggling the checkbox; the checkbox's accessible name tracks a committed edit; check:corpus,
  test:variants, `module-todo.spec.ts`.

  **Changed:** module-todo no longer nests the composed `FormInplaceEdit` inside the `form-checkbox`'s `<label>` (invalid HTML content model; the dblclick that starts editing bubbled to the label and toggled the checkbox). The editor now sits beside the checkbox within the item, in `module-todo.tsx` and `.tsrx` (CSS byte-identical, asserted by the corpus compile); the served `module-todo.html` template, the hand-written `.ts` twin, and the folder sheet were moved with it. The checkbox keeps its accessible name: the label keeps a `.visually-hidden` text bound to the item label (`{() => item.label.get()}` in the compiled members, `watch(item.label, bindText(...))` in the `.ts` twin's `bindItem`), so the name follows a committed edit. The item flex was adjusted in the sheet: the checkbox's own `flex-grow` is zeroed, the editor takes the free space, and a completed item keeps the text dim/line-through its label used to carry. Spec: the 19 toggling clicks on `form-checkbox .text` (the editor's span inside the label) became `form-checkbox label` clicks, and a new "Editor placement (LT-466)" describe adds the verification leg.

  **How:** One judgment call against the entry's wording: the label itself stays visible and only its text span carries `.visually-hidden`, because the visible checkbox box is drawn by that label's `::before` (form-checkbox.css) — hiding the whole label would hide the box. The completed-state dim/line-through rule was added to module-todo's sheet because the editor left the scope of form-checkbox's own `&.todo:has(input:checked) label` rule (the box still dims via that rule); it targets the `form-inplace-edit` host (in scope) so no `:global` is needed — drop that one rule if the owner prefers the entry's literal scope. `module-todo.html` was hand-mirrored to the compiled render (attribute-order differences vs. raw render predate this change; the `<template data-list>` region was verified equal after whitespace-stripping). Compiler snapshots for module-todo (sim-driver, parity) were regenerated; no other snapshot changed.

  **Check:** `bun run check:corpus` ✅ · `bun run typecheck` ✅ · `bun test server/tests` ✅ (3389 pass, 0 fail, after `build:docs` for the fresh worktree) · `bun run test:variants module-todo` ✅ (all 56 legs × ts/tsrx/tsx, including the two new LT-466 legs: dblclick enters edit without toggling; `toHaveAccessibleName` tracks a committed edit). Biome check on the changed paths clean. Review may want to confirm visually that the completed-item strikethrough renders (text-decoration on the `form-inplace-edit` flex host propagating to its `.text` item) — the spec does not assert it.

  **Review:** Approved. Both judgment calls stand as rulings: the label stays visible with only its text span `.visually-hidden` (the label's `::before` draws the box), and the completed-item dim/line-through moves to module-todo's own sheet on the `form-inplace-edit` host.

- [x] LT-471: Design session — D-32, the compiler's public contract (entry points, result types, the generated-module API under semver). — done ✓
  **Area:** design
  **Area:** design (Architect with the owner)
  **Filed (Architect, planning 2026-10-06; owner scheduled it this iteration):** D-32 is deferred
  to a design session (`COMPILER_SPEC.md` §12, decision log). It gates LT-254, the first task of
  the P1 release track, and LT-376. Running it during the P6 round keeps the publish off the
  owner's calendar when P1 opens.
  **Questions to rule:**
  1. **Entry points** — one public entry point (dialect + one entry + consumer half, PROPOSAL D4)
     versus also publishing the corpus pass and the incremental API (§2).
  2. **Result types** — which types the entry points return are public. `RegistryEntry` names
     `RenderedShape` and `SuppressedSite`, and neither is exported: export them, or narrow
     `RegistryEntry`.
  3. **The generated-module API under semver** — ADR 0034 s8 counts it as public (a change is a
     major), while `contract.ts` and `LE_TRUC_COMPILER.md` §2 say semver applies to the designated
     set "and to nothing else", which does not list it. Rule which way it goes: add it to the
     policy, or amend the ADR (LT-254's rider).
  4. **Weigh `@typescript-eslint/typescript-estree` as a runtime dependency** under M28 if its
     answer turns on the entry-point shape (LT-254's rider). Otherwise it stays with LT-254.
  **Output:** the ruling recorded in `COMPILER_SPEC.md` §12 and its decision log (D-32 → Ratified),
  an in-place ADR 0034 s8 amendment if question 3 goes that way, and Appendix B refreshed (stale
  since 2026-09-29). Then re-scope LT-254 and LT-376 against the ruling.
  **Channel/tier:** none — design.
  **Ruled (owner, 2026-10-06) — done ✅.** (1) **Corpus entry point**, B. The one published
  entry point is the corpus pass. It writes to `outDir` and returns the diagnostics and a
  summary. `compileComponentTsx` stays internal, and the incremental API is a later minor.
  (2) **`RegistryEntry` narrowed** to a public projection. `RenderedShape` and `SuppressedSite`
  stay internal, and the projection is the `registry.json` schema. (3) **Generated-module API
  under semver**, added to the policy, so ADR 0034 s8 stands with no amendment. It covers
  `render<Name>`, the client default export, the `i18n` module's shape and the `registry.json`
  schema. `argsFromAttrs` is internal. (4) **`typescript-estree` stays with LT-254**, because
  its answer does not depend on the entry-point shape. Recorded in `COMPILER_SPEC.md` §2, §12,
  O-1, the decision log (D-32 → Ratified) and Appendix B (refreshed). The reshape is filed as
  LT-480 (P1, gates LT-254). LT-254 and LT-376 are re-scoped.
