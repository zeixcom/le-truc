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

- [x] LT-093: Make LTC004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall). — reviewed ✓
  **Area:** compiler
  **Area:** compiler
  **Context:** LTC004 fired "no harvestable initial-DOM site" for a signal that IS rendered
  through a thunk when its initializer read a plain setup const or an import, so the component
  tiered Simulated with no warning (ADR 0029). The task absorbed LT-135 (a predicate hoisted
  into a setup const un-credited its signal).

  **Changed:** a thunk-rendered signal now reuses an initializer that reads plain setup consts
  (transitively) or authored imports. The client already placed those names: a signal
  declaration is a client position in `computeClientNeededNames`, so only the harvest gate
  (`substituteArgExpr`) refused them. That gate is now `unportableNames` in
  `analysis/harvest.ts`. A server arg counts as portable only at the initializer's top level.
  When the initializer still cannot be reused, the LTC004 census detail names its free names
  instead of claiming no site. The harvested client declaration keeps its authored type
  arguments (`createTask<string>(…)`; `typeArguments` in `emit-client.ts`). form-combobox
  (`.tsrx` and `.tsx`) hoists its popup predicate into `const isOpen`; the workaround comment is
  gone. Corpus effect: **module-lazyload moves from Simulated to Folded.** Its only routing
  signal was this false firing. Its served HTML is unchanged (both tiers serve the pending arm),
  and the equivalence audit records its nil→err connect diff. Tests:
  `server/tests/compiler/initializer-portability.test.ts` (const, const chain, import, type
  arguments, `.tsx`, the LT-091 `plainLocalNames` reactive-thunk leg, the routing-reason
  wording). `tier-corpus.test.ts` and `host-seeded-signal.test.ts` are updated.
  **Already landed before this task (verified, not redone):** the LT-135 half, through LT-323's
  `carriedBy`, with the negative case already flipped in `client-setup-credit.test.ts`; and the
  `returnsNumber` number-signal coercion (LT-126, `dirty-flag-dispatch.test.ts`).

  **Review:** Approved. Ruling: folding a component whose only async state is a `Task` is the
  intended tier. The server renders the nil arm, which is what the client shows until the task
  settles, so the realm bought nothing. The reviewer ran the unrunnable gates outside the
  sandbox: `test:variants form-combobox` (tsrx 60, tsx 60) and `test:variants module-lazyload`
  (ts 40, tsx 40), all green.

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

- [x] LT-464: form-checkbox gains a .tsx spelling. — reviewed ✓
  **Area:** examples
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06, owner request):** add `form-checkbox.tsx` beside the `.tsrx`
  as a variant-set member (ADR 0039). It becomes the served surface, keeps the `label: string`
  arg (the children switch lands in LT-463), and the `.tsrx` twin stays.

  **Changed:** `examples/form/checkbox/form-checkbox.tsx` is added: canonical tag, its own
  `HTMLElementTagNameMap` entry, byte-identical CSS, and a `FormFactoryContext<FormCheckboxProps>`
  second parameter. It is now the served surface. The host profile
  (`server/compiler/frontend/tsx/host-profile.d.ts`) gains `name`/`checked` on
  `FormCheckboxAttrs` and `disabled` on the `input` intrinsic. Both members declare
  `'truc:pass'?: { checked?: … }` on their args type, as form-listbox's members do, so the
  parity render signatures stay identical. `examples/test/listitem/test-listitem-tsx.tsx` now
  composes the `.tsx` member, which pins a typed `.tsx`→`.tsx` pass. The parity snapshot gains
  the form-checkbox `.tsx` client.

  **Review:** Approved after one rework. The rework was owed because the examples tsc program
  (`tsx/typecheck.test.ts`) failed on the profile attrs and the missing pass key, and
  test-listitem-tsx still imported the `.tsrx` (owner flag). The twin's matching `'truc:pass'`
  key is accepted. The reviewer ran the browser gates outside the sandbox: `test:variants
  form-checkbox` (tsrx 40, tsx 40) and `test:component test-listitem` (18), all green. The tsx
  typecheck suite passes 4/0.

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

- [x] LT-467: Retire basic-pluralize — module-todo words its own count through an ICU message. — reviewed ✓
  **Area:** examples
  **Needs:** LT-466
  **Gates:** check:corpus, test:variants, test:server
  **Area:** examples
  **Filed (Architect, 2026-10-06; owner ruling 2026-10-06):** a parent words a count with its own
  ICU `plural` message, folded when server-known and re-evaluated by the inlined client evaluator
  when reactive (ADR 0030 s9). That left `basic-pluralize` no job, so it is retired.

  **Changed:** `basic-pluralize` is removed: its folder, its `main.ts`/`main.css` entries, the
  examples nav, the CEM comment, the `host-profile.d.ts` attrs, and the size-bet rows, including
  the React spike's twin. module-todo (`.tsx`/`.tsrx`) declares `remaining: '{count, plural, =0
  {…} one {# task remaining} other {# tasks remaining}}'` and renders `<p class="remaining">{() =>
  t.remaining({ count: activeCount.get() })}</p>`. The `.ts` twin binds the same source-locale text
  with `Intl.PluralRules('en')` in a `watch`. In every locale, `basic-pluralize.*` became
  `module-todo.remaining` (census 0 gaps). Compiler coverage moved to the `c-plural` fixture
  (`server/tests/compiler/fixtures/plural/`): gate-wave LT-143/LT-144/LT-173, the mf2-exit
  nested-pattern legs, the diagnostics, i18n-client and root-harvest legs, and the LT-191
  lang-materialization legs. i18n.test, smoke/corpus-args, parity and the page-render LT-191 leg
  pin module-todo. Snapshots regenerated: equivalence-audit, sim-driver, parity.
  `module-todo.spec.ts` adds an `en` leg (0, 1, 5) and a `pl` leg (0, 1, 2–4, 5) over a real
  `pl` server render. **Rework:** `examples/main.ts` imported module-todo's hand-written twin, not
  its generated client (LT-111 never switched it). The twin held the tag on every page and in
  every `test:variants` surface bundle, so the compiled spellings had never run in a browser.
  `main.ts` now imports `server/generated/components/module-todo.client.ts`.
  `server/tests/layout-graph.test.ts` pins the switch and lists the three remaining twin
  imports in `KNOWN_TWIN_IMPORTS` → LT-485.

  **Rulings (review):** declaring `i18n` makes every template literal an LTC047 warning, so
  module-todo's six labels became keys. The ar/cy/lv labels stay empty as source-fallback
  placeholders. LT-191's materialization is pinned by the `c-plural` simulation legs and the
  per-locale page leg; `basic-number` walks the locale but does not materialize it, so it
  cannot carry the leg.

  **Handoffs:** LT-485 (the three remaining twin imports), LT-486 (`writer`: the prose
  references), LT-487 (translator pass for the ar/cy/lv strings). LT-352's table lost its
  basic-pluralize rows (edited in place). CHANGELOG records the removal at iteration close.

  **Review:** Approved after one rework. The reviewer ran `test:variants module-todo` outside
  the sandbox: ts 58 pass (`pl` skipped by design), tsrx 60, tsx 60.

- [x] LT-469: Migrate `section-menu` to `.tsx` with same-commit cutover — the site's sidebar chrome: external toggle by document id, imperative backdrop, layout-wide registration. — done, pending review ⏳
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-427, LT-428, LT-429
  **Area:** examples
  **Scopes (LT-446 design session, 2026-10-06):** the last folder the "every example folder
  served compiled" exit criterion cannot close without, and the four shapes no compiled corpus
  member has carried together — an external toggle wired by `document.getElementById`, an
  imperative backdrop created at connect, a writable State-backed expose, and layout-wide
  registration. Every authored shape below is probe-verified against both front ends
  (both surfaces compile clean, byte-identical client/server modules) — do not re-derive them.
  **The set:** `section-menu.tsx` (served) beside a `section-menu.tsrx` twin; the hand-written
  `section-menu.ts` stays as the set's `.ts` twin (LT-111 ruling 5). Both compiled members emit
  byte-identical server renders and CSS (LTC051). Every member declares the identical
  `declare global { 'section-menu': HTMLElement & SectionMenuProps }` entry, each with its own
  identical `SectionMenuProps` alias (`{ open: boolean }`) — divergence is TS 2717.
  **Template:** root = host, `{children}` passthrough, one `<style>{css`…`}</style>` child —
  nothing else. The component is behavior-only chrome: the nav content arrives as page-authored
  children (`server/templates/menu.ts` and the example page author it), and the compiled server
  render must stay byte-compatible with `menu()`'s hand-written output plus the compose-site
  attributes (`id="sidebar"`) menu.ts writes itself. `module-scrollarea` inside the children is
  NOT a compile-time boundary (the template composes no child — ADR 0033 s7), so the sheet's
  `& module-scrollarea` selectors stay legal.
  **Setup rulings (LT-446):**
  1. **`expose({ open })` stays the live-State identifier form, verbatim:** `const open =
     createState(false)` + `expose({ open })`. The classifier's kind is `slot` (the
     no-diagnostic answer); the generated client carries both statements verbatim and the
     server module carries the signal declaration with the expose shim, so the fold sees the
     seed. `el.open = …` writes through the installed Slot — the unchanged spec's Programmatic
     Control probe proves it per surface. The toggle handler's `() => ({ open: !open.get() })`
     return-updates idiom is an authored `on()` call — library contract, carried as written.
  2. **`.js`/`.ready` sequencing is two bare client-only setup statements, verbatim:**
     `host.classList.add(JS_CLASS)` and `requestAnimationFrame(() => host.classList.add(READY_CLASS))`
     — `host` is context, `requestAnimationFrame` a JS global, the callback an inline arrow in a
     client-only statement. The five name constants (`JS_CLASS`, `READY_CLASS`, `OPEN_CLASS`,
     `BACKDROP_CLASS`, `TOGGLE_ID`) MOVE from module scope into setup — module-scope names are
     not client-known (LTC005; the module-scrollarea deviation note is the precedent). The
     served HTML carries no `.js` class — the progressive-enhancement contract holds by
     construction (probe: the server render emits `<section-menu>{children}</section-menu>`
     only).
  3. **The backdrop stays imperative:** `ensureBackdrop()` — a function const that finds or
     creates `:scope > .backdrop`, prepends it, and RETURNS the element (the existence check
     keeps the twin's tolerance of authored markup); wired by
     `on(ensureBackdrop(), 'click', () => ({ open: false }))` — the call is the `on()`
     argument, so no setup const ever holds a page-context value. Do NOT author the backdrop
     `hidden` in the template: the no-JS DOM shape stays byte-identical to the twin's (no
     backdrop element at all), which is the contract the sheet's header comment documents.
  4. **The external toggle stays component-owned; the guard lives in the helpers, the lookups
     inline as call arguments:** `on(document.getElementById(TOGGLE_ID), 'click', () => ({ open:
     !open.get() }))` — `on()`'s target accepts `Falsy` and the descriptor no-ops on it; and
     `watch(open, bindAria(document.getElementById(TOGGLE_ID), 'ariaExpanded'))` — `bindAria`
     accepts nullish targets and makes every handler a no-op. The twin's `if (toggle)` guard is
     therefore built into the runtime; do NOT hold the element in a setup const (a const whose
     value reads `document` is a build error, LTC054 — page context), and do NOT call
     `watch`/`on` inside a function const (LTC045 — the ambient collector is gone by the time a
     deferred callback runs). NOT the layout's job: the drawer state has one owner (the
     component's exposed Slot), the id is the documented chrome contract (TOGGLE_ID's docblock,
     LT-001, SERVER.md), and the wiring must exist exactly when the drawer behavior does.
     The outside-click handler re-queries the toggle inside the descriptor body — no held
     reference.
  5. **Document-level listeners ride the twin's `watch(() => true, descriptor)` idiom
     verbatim** (module-listnav's compiled form is the corpus precedent): raw
     `addEventListener`/`removeEventListener` on `document`, `open.get()`/`open.set()` inside,
     cleanup returned. Keep the twin's `el instanceof HTMLAnchorElement` check — which needs
     the rider below.
  **Compiler rider — JS_GLOBALS:** `server/compiler/vocabulary.ts`'s `JS_GLOBALS` set lists
  `HTMLButtonElement`…`HTMLTextAreaElement` but NOT `HTMLAnchorElement`, so the twin's
  `instanceof HTMLAnchorElement` outside-click check is a false unknown name and refuses with
  LTC005 (probe-verified; a `nodeName === 'A'` re-spelling compiles but deviates from the twin
  for no reason once the set is fixed). Add the entry — the set's own docblock scope ("DOM
  globals (generated handlers reference element types)") — and pin it in
  `server/tests/compiler/globals.test.ts`. No diagnostic changes, no ADR 0028 inventory change.
  **Styles:** re-author the sheet to ADR 0033 form — `:host`-led (a rule led by the component's
  own tag is LTC066, fix-it `:host`); the page-shell rules (`.docs-body`, `.docs-main`,
  `#sidebar-toggle`, `.quicklinks`, `.docs-header-bar`, `header`) ride the two whole-rule
  `:global` forms, the at-rule-conditioned ones inside a bare `:global { @media … }` block
  (LTC069); `module-dialog`'s `:global(body.scroll-lock)` is the corpus precedent and the
  sheet's header comment documenting the `.docs-body`/`.docs-main` exception stays. Members'
  CSS byte-identical (LTC051). `examples/main.css` flips its import to the generated sheet.
  **Cutover:** `examples/main.ts` imports
  `../server/generated/components/section-menu.client.ts` — the canonical client, so the
  LAYOUT pages serve the canonical `.tsx` surface (main.js bundles it on every docs page) and
  `/test/section-menu`'s default page is the registry's selected surface; `?surface=` and the
  runner's `TEST_SURFACE` reach the `.ts` twin and the `.tsrx` variant
  (`routes.ts` `resolveSurfaceModule`). `server/templates/menu.ts` stays hand-written and
  byte-compatible with the compiled server render — the markup contract SERVER.md documents;
  `templates/menu.test.ts` keeps pinning it, unchanged. The authored `section-menu.html` is
  regenerated from the compiled server render (the module-todo header-comment pattern),
  keeping `#sidebar-toggle` before the host and `#outside-target` after `<main>`.
  `examples/tsconfig.json` lists the new members; the strict `IntrinsicElements` table in
  `server/compiler/frontend/tsx/host-profile.d.ts` gains `type SectionMenuAttrs =
  CommonLightDom` and the `'section-menu'` entry (a migration extends the table in the same
  commit). The component has no `.md`/gallery entry before or after (structural chrome).
  **Tier:** the component stays Folded — no setup const holds a page-context value (probe: no
  LTC013 routing signal, no LTC054). The tier-corpus census pins +`section-menu: folded`; that
  shift is this entry's by-design change.
  **The spec is unchanged.** `test:variants section-menu` is the acceptance gate: the unchanged
  suite (drawer, toggle, aria reflection, programmatic control, Escape/outside-click/link-nav
  close) passes against all three surfaces.
  **Check:** gates inside the worktree: `typecheck`; `test:server` (extend the
  parity/equivalence-audit snapshots for the new generated modules; `templates/menu.test.ts`
  stays green unchanged); `check:corpus` (census re-pin); `check:contract`; `test:variants
  section-menu` (browser gate — LT-111 proved it can run green in the sandbox; else an
  owner-run leg); `test:component section-menu` on the default page. `build:docs` +
  `check:links` when the JSDoc/host-profile changes are doc-visible.
  **Channel/tier:** no new runtime check and no diagnostic change; the rider is a vocabulary
  omission fix (compiler) that removes a false LTC005 — it adds no check, so nothing owes the
  catalog or the ADR 0028 inventory an entry.

  ---

  **Changed:** `section-menu` migrated to the served `.tsx` surface with same-commit cutover (LT-469): the folder is now the three-member variant set — `section-menu.tsx` (served), `section-menu.tsrx` twin, hand-written `section-menu.ts` retained (LT-111 ruling 5) — with identical `SectionMenuProps` aliases and tag-map entries in every member (the TS 2717 drift gate runs in the examples program). Template is the host passthrough plus one `<style>` child; the compiled server render of page-authored children is byte-identical to `menu()`'s output modulo the compose-site `id="sidebar"` attribute (verified live; `templates/menu.test.ts` untouched and green). The sheet re-authors to ADR 0033 form: `:host`-led internals, the page-shell rules (`.docs-body`, `.docs-main`, `#sidebar-toggle`, `.quicklinks`, `.docs-header-bar`, `header`, `:root`) in the two whole-rule `:global` forms, drawer class combos spelled as `:host(.js)`/`:host(.js.ready)`/`:host(.js.open)` arguments (no `&.ready` nesting under `:host`, which would lower to a refused `:host`+qualifier). Setup follows the LT-446 rulings verbatim — `createState(false)`/`expose({ open })` identifier form, the five name constants moved into setup, `ensureBackdrop()` as the `on()` call argument, toggle lookups inline as `on()`/`bindAria()` arguments, `watch(() => true, descriptor)` document-level listeners with the `instanceof HTMLAnchorElement` check and the outside-click re-query. Rider: `HTMLAnchorElement` joins `JS_GLOBALS` (vocabulary omission fix, no diagnostic/ADR 0028 change), pinned in `globals.test.ts`. Cutover: `examples/main.ts` imports the canonical generated client, `examples/main.css` the emitted sheet (the hand-written `section-menu.css` stays unimported, like `module-todo.css`); authored `section-menu.html` carries the regeneration header over unchanged body markup (the compiled render of its children is byte-identical to what the page authors); `examples/tsconfig.json` lists the twin pair; `host-profile.d.ts` gains `SectionMenuAttrs` + the `'section-menu'` entry; tier census pins `+section-menu: folded` (registry-verified: folded, zero routing signals); SERVER.md's sidebar bullet now points at the emitted stylesheet. No diagnostic, error-copy or ADR 0028 inventory change; spec, `.md`/gallery absence and `server/templates/menu.ts` unchanged.

  **How:** Authored both members first, compiled the corpus to verify (Folded tier, LTC051 byte-identical CSS, `<section-menu>{children}</section-menu>`-only server render), then flipped the imports and re-pinned. Three authored-source corrections fell out of the gates: (1) backticks inside sheet comments terminate the `css` template literal — stripped from both members' sheet comments (LTC008 parse failure otherwise); (2) `host.querySelector<HTMLElement>(…)` is TS2347 in the generated server module (`host` is the `any` refStub there — untyped calls reject type arguments), so the query is spelled `as HTMLElement | null`, matching the corpus's cast idiom; (3) the emitted props alias is carried verbatim into the server module (`assemble-ir.ts` decl ride-along), so `emit-tier.test.ts`'s dropped-statement scan read the type member `open: boolean` as a use of the dropped slot-kind const — the scan now strips `export type X = {…}` blocks, the same non-value carve-out its comment strip already had (its own JSDoc-word precedent). New snapshots: equivalence-audit connect diff (records the designed `.js` class + backdrop insertion, nothing overwrites server state), sim-driver fixture pin (`<section-menu class="js"><div class="backdrop"></div></section-menu>`), parity client-module snapshots for the set.

  **Check:** All gates run inside the worktree, all green: `typecheck` (exit 0); `test:server` 3492 pass / 0 fail, 85 snapshots (after `-u` on `parity.test.ts.snap` — its stored section-menu snapshot predated the `as`-cast fix); `check:corpus` exit 0 (tier census 42 entries: 34 folded, 8 simulated, 0 static; translation census 0 gaps); `check:contract` exit 0; `build:docs` + `check:links` exit 0 (771 links; built `docs/assets/main.{js,css}` verified to carry the compiled client and the `:where(section-menu)` sheet); `test:variants section-menu` — the unchanged 10-test spec green on all three surfaces, Chromium + WebKit, 20/20; `test:component section-menu` green on the default page, 20/20. `bunx biome check --write` over exactly the changed paths: no fixes. Review-attention items: (a) the `emit-tier.test.ts` strip is a standing-invariant amendment — value-position coverage unchanged, but a reviewer should confirm the regex (`^export type \w+ = \{[\s\S]*?^\}`) against future emitted type shapes; (b) the emitted sheet's `:global`-hoisted rules keep authored nesting (`& a` inside `.quicklinks`) verbatim — browser-native nesting, same posture as the old hand-written sheet; (c) below-48em drawer cascade now rides source order (all `:host` emits are zero-specificity) instead of the old tag-rule specificity — verified order-equivalent for every competing pair in this sheet; (d) full `bun run test` (all example specs) not run — not in the entry's gate list; the touched component's specs ran via the variants and component gates.

- [x] LT-470: A composed child carrying `truc:pass` in a server-rendered branch of a list item mints a required local and throws in every item mount when the branch is not taken — refuse it after LT-468's manner. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-468
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-468's review):** in `planReconcileItem`'s item walk, a
  compose node in a server conditional's arm reached `collectCompose` with no branch awareness:
  it minted a required scope local, so with the branch folded off every adopted and cloned item
  threw `MissingElementError` at mount and the child's `truc:pass` entries never bound.
  **Ruling (Architect):** refuse, after LT-468's manner: the LTC005 family, the remedy "make
  the condition reactive". The LT-455 guard shape (optional local, guarded binding) was
  rejected, because a compose's pass entries have no reactive core of their own, so guarding
  them would mint per-entry existence guards for one-shot addressing. A pass-less compose in a
  branch stays legal.

  **Changed:** A `truc:pass`-carrying composed child in a server-rendered branch is refused
  (`LTC005`) in both scopes. In a reactive-list item, the item walk threads `inBranch` into
  `collectCompose` and refuses before minting. At the host, the probe found that the shape
  compiled clean on both surfaces with the entries silently unplanned: the branch handlers never
  visit a compose node. `validateArmSetPlacement` now refuses it there. It keys on an
  `inServerBranch` flag that a server `conditional` sets and that an arm set, a reactive list or
  composed content clears, and it skips arms (`unmountableInArm` refuses there) and lists (the
  item walk refuses there). A pass compose nested in composed content reports LTC011 alone,
  with no second LTC005. A pass-less composed child in a branch still compiles and renders into
  the template. A compose with `truc:pass` directly in the item still binds. The catalog face is
  in the LTC005 row of `skills/le-truc/references/errors.md`. The compose case sits beside
  LT-468's in HOST_PROFILE.md's item/Mount-Scope passage, AGENTS.md's conditional-placement
  paragraph and LE_TRUC_COMPILER.md's plan-walk passage. CHANGELOG has a Fixed entry. Tests:
  "a `truc:pass` compose in a server branch is refused (LT-470)" in
  `server/tests/compiler/mount-scopes.test.ts`.

  **Handoffs:** LT-481 plans pass entries on a compose arm root of a reactive conditional or an
  async boundary. Until it lands, that shape (this refusal's remedy) compiles clean and never
  binds. LT-482 treats a server-only `@try`'s body and catch arm as server-rendered branches in
  both walks.

  **Review:** Approved after two reworks: the host refusal now keys on the nearest enclosure,
  so composed content reports only LTC011.

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

- [x] LT-481: A `truc:pass` on a compose site that is a reactive arm root compiles clean and never binds — plan the entries in the arm's mount. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-470
  **Gates:** check:corpus, test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-470's probe finding 3):** LT-460 made a compose site
  legal as an arm root, but its `truc:pass` entries were never planned. The arm walk checked
  only the root's descendants against `unmountableInArm`, so the shape compiled to an empty
  `bindArm` on both surfaces. That is the silent drop LT-470's remedy steered authors into.

  **Changed:** A compose site as an arm root now plans its `truc:pass` entries as `pass()`
  effects in the arm's mount, against the arm element parameter. The arm root is the child's
  rendered element, so no query or local is minted. The entries rebind on every adopt and clone.
  This covers reactive `@if`/`@switch` arms (host and nested Mount Scopes) and the async
  boundary's pending and catch arms, on both surfaces. The lowering is `planArmRootComposePass`
  in `server/compiler/analysis/effects.ts`. It shares `checkPassEntries` + `emitPassEntries` with
  every other compose path, and `composeArmRootTag` dedupes LT-460's tag expression.
  `emit-client.ts`'s `emitBoundary` gained the `nil` mount branch and the err arm's root local
  and effects. A `first()` on a compose arm root is now refused (LTC005); it was never refused
  before, and the fix names `truc:pass` as the channel. An ambiguous `first()` keeps LTC027 as
  its one diagnostic. `reconcile()`'s arm path already inserted a clone before mounting it, so
  no runtime change was needed. Docs: HOST_PROFILE.md's arm-root paragraph, LE_TRUC_COMPILER.md's
  ClientPlan passage, and a CHANGELOG Fixed entry. LT-470's remedy sentences now hold as written.
  Tests: "compose arm roots plan their `truc:pass` entries (LT-481)" in
  `server/tests/compiler/compose.test.ts`.

  **Handoffs:** the compose root of a server-only `@try` arm → LT-482 shape (e). The boundary's
  name check (`badFreeNames` vs `fx.scopeBadNames`) → LT-483. Element pending/catch roots refusing
  constructs that reactive-conditional arm roots plan → LT-484 (design).

  **Review:** Approved. The review probed list-item nesting: a reactive arm root and a pending
  root passing `() => item.get()` both bind.

- [x] LT-482: A server-only `@try` is a server-rendered branch the plan walks don't treat as one — a `truc:pass` compose in its body compiles clean and never binds. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-470
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-470's rework residue; widened by LT-481's residue 1):**
  a `try` with no `pending` arm is not an arm set. It folds once per render into its body or its
  catch arm, but the walks treated only server `conditional`s as server-rendered branches.
  **Ruling (Architect):** a server-only `try`'s body and catch arm are server-rendered branches,
  so LT-468's and LT-470's refusals apply unchanged.

  **Probe (both surfaces agree on every shape):** (a) a pass compose in a server-only `try` at
  the host compiled clean and never bound: fixed. (b) and (c), a pass compose or a client
  construct in a server-only `try` inside a reactive-list item: already refused, because
  `validateListBody` (`lower-shared.ts`) refuses any boundary in a reactive-list body, so no
  `try` reaches the item walk and the entry's item-walk descent would be dead code (not added).
  (d) a client construct in a server-only `try` at the host: already plans the guarded binding
  through `handleOptionalBranch`. (e) a compose as the body or catch-arm root carrying
  `truc:pass`: compiled clean and never bound, fixed by the same change. Also already refused:
  a pass compose in a server-only `try` nested in a reactive arm (`unmountableInArm`), and a
  reactive list in a server-only `try` body.

  **Changed:** `validateArmSetPlacement` sets `inServerBranch` for a `try` that is not an arm
  set, so (a) and (e) fail the compile with LT-470's message (LTC005). A pass-less compose in a
  `try` stays legal and renders. The refusal fires once per offending compose site.
  LE_TRUC_COMPILER.md's LT-470 sentence names the server-only `try`'s arms. CHANGELOG Fixed
  entry. Tests in `server/tests/compiler/mount-scopes.test.ts`.

  **Handoffs:** LT-488 rewords the remedy for a `try` site. "Make the condition reactive" names
  a condition a `try` does not have.

  **Review:** Approved. The ruling's "same wording and remedy" was the Architect's error for a
  `try` and is not held against the task; LT-488 corrects it.

- [x] LT-488: The LT-470 refusal tells a server-only `@try` site to "make the condition reactive" — a `try` has no condition; give it its own remedy. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-482
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-07, from LT-482's review):** LT-470's refusal told a server-only
  `@try` site to "make the condition reactive", but a `try` has no condition.

  **Changed:** `validateArmSetPlacement`'s `inServerBranch` became a `ServerBranch` union
  (`false | 'conditional' | 'try-body' | 'try-catch'`), keyed per child by the arm that holds it.
  The nearest enclosure wins on nesting. `serverBranchFix` words the LTC005 fix per enclosure,
  under the same subject head:
  - server conditional: unchanged;
  - `try` body: move the composed child out of the `try`;
  - `try` catch arm: add a pending arm, which makes the `try` an async boundary whose catch arm
    binds the pass (LT-481).
  The LTC005 face in `skills/le-truc/references/errors.md` and LT-482's CHANGELOG line follow.
  LT-482's tests assert the per-arm fix on both surfaces.

  **Review:** Approved. The catch-arm mechanism clause the contributor added ("The catch arm
  folds once per render…") stays: it gives the message its three-part form.
