# TODO

Prioritized task queue, highest band first. Within a band, work top to bottom unless a task
names its own dependency.

**Where the history went.** Everything landed and reviewed has been removed from this file
(architect, 2026-09-06; i18n band pruned 2026-09-17). The rationale for what shipped lives in
`adr/` (0024, 0026–0032), `ARCHITECTURE.md`, `server/compiler/LE_TRUC_COMPILER.md` and
`server/compiler/HOST_PROFILE.md`; the user-facing summary lives in `CHANGELOG.md` `[Unreleased]`; the
task-by-task record lives in `git log -p -- TODO.md`. Do not re-derive a decision from a task
entry — read the ADR. LT-199/LT-200 (pre-connect property writes, ADR 0031) landed via the
`next` merge (PR #130); the i18n lineage (LT-165, LT-169/180, LT-173–175, LT-185, LT-190–192)
via `feature/internationalization` — both merged into v3 on 2026-09-17.

**Standing framing** (ADR 0029, accepted 2026-09-04). Server evaluation is three tiers:
**Folded** (phase 1 resolves it; string folding, no jsdom), **Simulated** (phase 1 cannot
complete AND the realm can answer; pre-played in jsdom), **Static** (neither; static skeleton,
the client corrects at connect). Tier is per **component**; unresolvability is per
**expression** — an impure ambient read (`Date.now()`, `Math.random()`) is omitted in every
tier and is not a routing signal. The compile-warning baseline's target is **zero**: routing
signals ride the tier census on `sim/report.ts`, not the diagnostic channel. Judge a migration
on zero warnings *plus* its recorded tier and reason.

**Next free task ID: LT-236.**

---

## P0 — TSX surface adoption (ADR 0032) — CLOSED 2026-09-18

Everything landed and reviewed: **LT-183** (spike verdict GO; record
`spike/tsx/FINDINGS.md`), **LT-202** (production merge: the shared front-end modules
`front-end.ts`/`lower-shared.ts`/`pipeline.ts`, the dual `.tsrx`+`.tsx` corpus with
TSRX048, the `css` template tag), **LT-203** (the strict per-element host profile,
`server/compiler/frontend/tsx/host-profile.d.ts`), **LT-206** (the `server/compiler/`
tree with `frontend/{tsrx,tsx}/` inside), **LT-204** (docs round; the profile doc is
`server/compiler/HOST_PROFILE.md`), **LT-205** (the stale-arm asymmetry ruling —
superseded as history by LT-211's withdrawal), **LT-208/LT-209** (the branded
three-arm `boundary` types; the annotated `FactoryContext`/`FormFactoryContext`
second parameter), **LT-210** (`@tsrx/core` pin 0.2.3, byte-identical corpus, TSRX020
retired; [ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) drafted),
**LT-211** (the stale arm removed end-to-end; the `isPending` idiom). Rationale:
ADR 0032 (Accepted, with the owner's dual-front-end amendment) and ADR 0033; the
machinery and authoring rules live in `server/compiler/LE_TRUC_COMPILER.md` and
`server/compiler/HOST_PROFILE.md`; step record: `git log -p -- TODO.md`.

**What pending work inherits (wave 4 and later):** migrations author `.tsx` by default
(`.tsrx` stays supported where statement-context control flow reads better); a migration
extends the strict `IntrinsicElements` table in the same commit; components annotate a
typed second context parameter; boundaries are three-arm with the `isPending` idiom
(`class={() => (isPending(data) ? 'pending' : null)}` — the arrow is required). ADR 0033
stays Proposed with **LT-214 parked alongside it**; upstream-pattern style composition is
a ROADMAP.md backlog item (likely 3.1 at TSRX 1.0).

**Decisions that live nowhere else:**
- **Packaging-time deferrals (LT-206) — deliberately NOT renamed with the tree:** the
  `check:tsrx`/`build:tsrx` script names, the `server/effects/tsrx.ts` filename, the
  `server/generated/tsrx/` output directory, `@tsrx/core` package names, and TSRX
  diagnostic codes. Revisit at packaging only.
- **Changelog verdict (2026-09-18): P0 owes CHANGELOG.md nothing.** The whole band
  touched `server/` (unpublished) and docs; the library diff vs `main` comes from the
  merges (LT-199, LT-185, LT-177, the error-message round), not P0. `@tsrx/core` is a
  devDependency, so the pin bump is not integrator-visible.

---

## P1 — Tiered server evaluation — CLOSED 2026-09-06

Everything landed and reviewed: **LT-165** (the eight ADR 0029 steps), **LT-185**
(form-tokenbox's hydration regression), **LT-184** (the severe `TSRX034` scoped
per-expression), **LT-180** (library-contained connect failures reach the build report) and
**LT-169** (the simulation driver runs inside `build:docs`). Post-LT-190 census: **20 Folded /
2 Simulated / 0 Static** (`form-combobox`, `form-listbox`), compile-warning baseline **0**,
simulation build-report baseline **0 unclassified**. Rationale: ADR 0027, ADR 0029,
`LE_TRUC_COMPILER.md` §5.4; step record: `git log -p -- TODO.md`.

**Review decisions that live nowhere else (2026-09-06).** The simulation pass renders each
component's authored demo HTML (`examples/**/<tag>.html`), not the server render function
over fixture args — the fixture args are a test artifact, the demo markup is what the docs
serve. The pass runs for one-shot builds only — one module cache per process makes a second
load of the same generated client unsound (ADR 0027 sub-design 10), so a watch session never
sees the gate. It captures every host `console.error`/`warn` during a load/render window,
not only the library's containment messages — the console carries no separating marker, and
`CLASSIFIED_DIAGNOSTICS` is the designed escape hatch.

---

## P2 — Internationalization follow-ups (ADR 0030)

**Pruned 2026-09-17** — LT-173 (reserved `i18n` parameter + catalog pipeline), LT-175
(render-cache measurement; its containment landed in LT-174, its removal ruling became
LT-193), LT-174 (per-locale page rendering), LT-190 (per-category message keys), LT-191
(locale inheritance, `lang` config-only), LT-192 (review residue) all landed and reviewed;
ADR 0030's corpus-multiplication consequences bullet was retracted in place 2026-09-07.
History: `git log -p -- TODO.md`, ADR 0030, `CHANGELOG.md` `[Unreleased]`. Two review
handoffs became tasks: **LT-201** (the ADR amendment) and **LT-189** (the Tech Writer copy
round, scope widened).

- [x] LT-201: Amend ADR 0030 — s1 output shape, s3 precedence chain, s4 per-category keys (the adr-keeper pass queued on LT-191, never run). — done ✓ (docs-only; ADR unpublished on v3, amended in place)
  **Skill:** adr-keeper
  **Done (2026-09-17):** s1 gained the pages/fragments split (pages multiply per locale under
  `docs/<locale>/`, fragment trees single-copy at the docs root); s3 retitled "Locale
  precedence; `lang` is config-only" and rewritten — full precedence chain (explicit site/server
  arg > compose-graph inheritance > authored default > page locale), the IDL guard making
  `lang` structurally un-exposable, materialization at connect, fixed-for-the-connection; s4
  gained the per-category key paragraph (quoted dotted keys, TSRX008 shape error, no implicit
  fallback chain, stage-2 whole-phrase endgame) and a real de.json example entry; s5 gained the
  census reachability rule (pruned category = nothing-to-do, `caseType` scoping, union
  over-report = conservative). Verified: section order and code fences intact, `check:links`
  374 green, no code moved.

- [x] LT-193: Remove LT-166's render cache and LT-175's locale containment with it. — reviewed ✓ (2026-09-17)
  **Skill:** docs-server-dev
  **Review (architect, 2026-09-17):** Approved with one defect found and fixed in the review
  commit: `server/tsrx/sim/index.ts` still re-exported the deleted `RenderStats` type —
  `bun test` does not type-check, so the handoff's green test runs masked it and CI's
  Typecheck step would have failed. Removed; `bun run typecheck` exits 0 (verified with
  explicit exit-code capture — a piped tail masks it). Also applied in the same commit: two
  tense fixes the landing makes stale — ADR 0030's retraction bullet ("is being removed" →
  "was removed"), and ADR 0029's per-request-path consequence, which cited LT-166's
  memoization as an existing per-process cache and now records it as removed with the
  cache itself left undesigned for that hypothetical path. The rest of the handoff verified
  against the diff: every removed symbol accounted for, the reframed tests assert what
  their names claim, the registry's `declaresI18n` flag correctly survives for
  emit-server's compose-graph inheritance, and the build's occurrence count, gate, and
  census baselines are unchanged.
  **Changed:** `server/tsrx/sim/realm.ts` (deleted `renderCache`/`renderStats`, the
  `RenderStats` type, the `declaresI18n` realm option, and the module header's "Render
  memoization" + "conditional locale" sections); `server/effects/simulate.ts` (dropped
  `renders`/`cacheHits` from `SimulationPassResult`, the log line, and the `declaresI18n`
  wiring; header cost paragraph removed); tests (`sim-realm.test.ts` memoization block
  reframed post-cache — byte-stability and `connects === 2` pinned, per-occurrence
  diagnostics kept; `simulate.test.ts` fake realm de-modelled, containment test deleted,
  occurrence test now pins a fresh render per occurrence per locale; `sim-driver.test.ts`
  cache-correctness clause dropped from the hermeticity comment); `server/TESTS.md`
  (memoization bullet removed — its "render distinct markup for a fresh connect" constraint
  evaporates when every render connects); `server/SERVER.md` (stale cache-key clause →
  "once per locale").
  **How:** The registry's `declaresI18n` flag survives — `emit-server.ts`'s compose-graph
  inheritance still consumes it; only the realm's cache-key consumer is gone.
  **Verification:** `bun test server/tests` 1523 pass / 0 fail (−1 = the deleted containment
  test); unit 491 pass; `build:docs` occurrence count and diagnostics UNCHANGED (8
  occurrences, 2 components, 20 skipped, zero unclassified, no ⚠️ lines) — the report's shape
  did not visibly change, so no dedup-noise note is owed; compile-warning baseline 0, tier
  census 20/2/0, translation census 0 gaps all hold; simulated-stage wall time **60 ms →
  61 ms** (no-regression measured, not asserted); biome clean.
  **Check:** the reframed `sim-realm.test.ts` block (byte-stability + `connects === 2` as
  the pinned post-cache behavior) and the SERVER.md/TESTS.md touch-ups.

- [x] LT-195: Internationalize the corpus's hard-coded accessibility strings (demand check, 2026-09-07). **Depends on LT-173; sequence after LT-193.** — reviewed ✓ (Architect, 2026-09-18)
  **Skill:** le-truc-dev
  **Review (Architect, 2026-09-18):** Approved. Both falsified premises ruled on the
  record: the `t`-in-reactive-thunk boundary is correct by design (the carrier-span idiom
  is the sanctioned interim expression of LT-197 option (a), taught in HOST_PROFILE.md),
  and the reactive-list body gate was over-broad relative to its own invariant — filed as
  LT-215 and ruled the same day. The `i18n:sync` `""`-placeholder fix is endorsed (the old
  `?? source` resolution contradicted the sync script's doc and ADR 0030 s5). Tokenbox's
  seventh string lands with LT-215; the remaining six are final.
  **Context:** Surveyed the 22-component `.tsrx` corpus for user-visible English literals.
  **Demand is real but small and sharply bounded** — 7 strings across 6 components, all of
  them static template attributes or visually-hidden text, all server-rendered, all
  translatable by ADR 0030's existing mechanism with no new surface:

  | Component | Tier | String | Site |
  |---|---|---|---|
  | `form-combobox` | simulated | `Clear input` | `aria-label` |
  | `form-listbox` | simulated | `Filter` / `Clear filter` | `placeholder` / `aria-label` |
  | `form-textbox` | folded | `Clear input` | `aria-label` |
  | `form-spinbutton` | folded | `Decrement` / `Increment` | `aria-label` (the second inside a thunk, with the literal as fallback) |
  | `form-tokenbox` | folded | `Remove` | `aria-label` |
  | `form-colorgraph` | folded | `Drag` | `.visually-hidden` span |

  **Two things NOT in scope, deliberately:**
  - **Developer-facing messages stay English.** `first('button', 'Add a native button as
    descendant.')` and friends address the page author in their console, not the end user.
    Translating them would be a category error — say so in a comment where it is tempting.
  - **Author-supplied content stays untouched.** `basic-gauge`'s qualification labels come
    from its `thresholds` attribute — page-author data, not component-owned strings. The
    component catalog is not the right home for them.
  **Watch for:** `form-spinbutton`'s increment label is a THUNK with `'Increment'` as its
  fallback (`zeroSpan.textContent ?? 'Increment'`). `t` is a build-time record, so
  `t['increment']` inside the thunk is fine — but confirm the fold survives it and the tier
  does not move.
  **Expected tier consequence, and the reason this is sequenced after LT-193:** two of the six
  are the corpus's only Simulated-tier components. Once they declare `i18n`, LT-175's
  containment stops applying to them — which is exactly why LT-193 removes it first rather
  than leaving a cache that silently stops engaging.
  **Verification:** tier census unchanged (20 folded / 2 simulated); compile-warning baseline
  stays 0; `bun run i18n:sync` records the new keys' manifest hashes; the de catalog gains real
  translations (not source echoes) for at least one component, pinned as a fixture.
  **Done (2026-09-18):** five components declare `export const i18n` and route six strings
  through `{t.key}` server-folded sites (combobox, listbox ×2, textbox, spinbutton ×2,
  colorgraph); tokenbox's `Remove` is NOT landed — falsified premise, filed as **LT-215**.
  The spinbutton increment label falsified the watch item: `t` in a reactive thunk is
  **TSRX005** (server-only name — the thunk is a client-only watch, and no catalog ships),
  so the translated fallback renders into a hidden `.increment-label` span the thunk reads
  back: the component's own CTA-span idiom, ADR 0030 s6 rendered alternatives; demo HTML
  updated in kind. Developer-facing `first()` guidance and tokenbox's client-built status
  strings are commented as deliberately out of scope (the latter is LT-197's). **Defect
  found and fixed en route:** the `i18n:sync` `""` placeholder resolved as EMPTY text
  (`?? source` let the empty override win), contradicting sync's own doc and ADR 0030 s5 —
  `i18nRecord` now falls back on empty overrides, pinned in i18n.test.ts; noted in
  HOST_PROFILE.md + CHANGELOG. Fixture renders needing the record were updated
  (corpus-args `inlineI18n`, consumed by smoke/golden/gate-wave/parity/audit — a
  render-fn call without `i18n` now throws at the destructure).
  **Verification (run):** `check:tsrx` exit 0, warning baseline 0, tier census 20/2/0
  (reasons unchanged), translation census 0 gaps; `typecheck` exit 0; `bun test
  server/tests` 1559 pass / 0 fail (1 pre-existing unhandled inter-test error, the
  tier-corpus face of LT-207, NOTES.md); parity 31/31; `build:docs` green, simulation
  pass 2/8/20 unchanged; form-spinbutton Playwright spec 21/21 Chromium (the aria-label
  update cycle exercises the re-sourced fallback); biome clean. De fixture pins:
  `i18nRecord('form-textbox', 'de').t.clearInput === 'Eingabe leeren'` et al. plus a
  render-level `aria-label="Eingabe leeren"` pin; de translations are real (Eingabe
  leeren / Filtern / Filter leeren / Verringern / Erhöhen / Ziehen), not source echoes.

- [x] LT-215: Admit server-static expressions inside reactive-list `@for` bodies (LT-195 residue: form-tokenbox's `Remove`). — done ✓ (2026-09-18; ruled by the Architect and landed in the same day's implementation)
  **Skill:** le-truc-dev
  **Ruling (Architect, 2026-09-18, owner concur — "clearly seems to be a bug"):** the
  invariant `validateListBody` protects is ADR 0017's slot-fill contract — the extracted
  `<template>` must be renderable with NO per-item client binding. "Statics only" is
  sufficient for that invariant but not necessary: an expression whose free identifiers
  are ALL server-known (args ∪ the reserved record's `t`/`lang` bindings, minus anything
  bound in loop scope — item, index, key, hoisted consts) folds identically into every
  item at every render call and needs no client binding at all. The client clones the
  SERVED template (`first('template', …)` → `reconcile()`), so folded bytes baked into
  the template at render time ride along to every cloned item; the in-place items already
  fold via the ordinary server-attr emission (`attr('aria-label', t.clearInput)` in
  form-textbox is the same classification). Rejected alternative: relaxing only the
  in-place render while the template stays statics-only — that would make cloned items
  diverge from initial items, the silent-wrong-answer class this project polices.
  **Scope of the admitted class — by classification, not by "t":** any expression
  `isServerEvaluable(node, serverScope)` admits (evaluability.ts; `containsImpureAmbient`
  stays a hard error inside it — an impure read must not sneak through the relaxation).
  `hidden={() => …}` thunks, item/index-derived expressions (`aria-label={token}`,
  `{token.toUpperCase()}` — the slot-fill contract has no channel for a per-item
  VALUE), refs, and control flow stay rejected; the item-derived diagnostic needs
  rewording to say WHY it rejects (per-item value, no slot channel) — Tech Writer
  reviews that copy (batch with LT-189's diagnostic family). No new TSRX code: this is
  a false-positive removal from an existing tier-1 Prevented check, channel compiler.
  **Implementation:**
  1. `validateListBody` in BOTH front ends (`frontend/tsrx/lower-template.ts` and the
     ported `frontend/tsx/lower-tsx.ts:627` — they must stay in lockstep, the ADR 0032
     anti-drift contract): admit expr ATTRS and expr TEXT children that classify
     server-static; the `holes !== 1` count keeps counting ITEM holes only. Fix the
     citation drift while there — the comments say "ADR 0023 sub-design 5"; the
     dual-`@for` content lives in adr/0024 s5.
  2. `listTemplateLines` (emit-server.ts): emit admitted attr exprs as `{ expr }` Parts
     (`esc()` covers attribute-value quoting) and admitted expr text children as
     `esc(String(…))` pushes; the `<template>` is emitted per render call, so each
     locale bakes its own strings. Verify the in-place path needs nothing (it already
     folds server attrs).
  3. Parity: the §4.4 synthetic reactive-list shape gains an admitted server-static attr,
     pinned byte-identical across both front ends; a negative pin keeps item-derived
     expressions rejected at the reworded diagnostic.
  4. form-tokenbox (the demand that exposed the gate): declare `export const i18n`,
     `aria-label={t.remove}` in the @for body; add the tokenbox record to
     corpus-args' `inlineI18n` consumers; run `i18n:sync`; de gains `Entfernen`; extend
     the i18n.test.ts de fixture pin. The loop-body remove button is the corpus's first
     in-body case — note it in the tokenbox header where the old static-attr
     rationale sits.
  5. ADR 0024 s5 amendment via adr-keeper (server-static expressions admitted in
     reactive-list bodies; baked into the extracted template at render time; item-derived
     still out). HOST_PROFILE.md's list/reconciliation guidance gains one sentence.
  **Acceptance:** `aria-label={t.remove}` compiles clean in tokenbox's reactive-list
  body; the de render emits `aria-label="Entfernen"` on the initial pills AND inside the
  served `<template>` (pinned); an item-derived attr still rejects, at the reworded
  message; tier census 20/2/0 and warning baseline 0 unchanged; parity green; gates
  green (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links).
  **Done (2026-09-18):** all five items landed. `validateListBody` in both front ends
  admits `kind: 'server'` attrs and non-lazy expr children passing
  `isServerEvaluable(node, ctx.serverKnown)` (which also keeps the impure-ambient hard
  error in force); the rejections now name the offending reads, and the stale `&{item}`
  sigil spellings in the touched messages modernized — copy handed to LT-189 item 7.
  `listTemplateLines` bakes admitted attrs as `{ expr }` Parts
  (`aria-label="${esc(String(t.remove))}"`) and text children as `esc(String(…))`
  pushes, with `used.add('esc')` wiring the runtime import; the in-place path needed no
  change, as ruled. Citation drift fixed in the touched comments (ADR 0024 s5, was
  cited as 0023). Tokenbox declares `remove: 'Remove'`, sync wrote the placeholders
  (6 keys → manifest confirmed), de carries `Entfernen`; the i18n fixture pins cover
  the record AND both render sites, and the sim-driver tokenbox snapshot is
  byte-unchanged at en — the baked `'Remove'` equals the old static literal, exactly
  the no-drift property the ruling predicted. New pins: diagnostics.test.ts admission +
  item-derived rejection (naming the offender), parity's extended §4.4 synthetic +
  the cross-surface baked-line pin.
  **Verification (run):** `check:tsrx` exit 0, warning baseline 0, tier census 20/2/0,
  translation census 0 gaps; `typecheck` exit 0; `bun test server/tests` 1564 pass /
  0 fail (1 pre-existing inter-test error, LT-207 family); parity green incl. the new
  cross-surface pin; `build:docs` green, simulation pass 2/8/20 unchanged; biome clean;
  `check:links` 410 green.

- [x] LT-196: Report orphaned catalog keys in the translation census (ADR 0030 s5 gap). — done, pending review ⏳ (2026-09-18)
  **Skill:** docs-server-dev
  **Context:** **Demonstrated by falsification, not inspection** (architect, 2026-09-07):
  adding `"basic-deleted-component.gone"` and `"basic-pluralize.typo-key"` to `i18n/de.json`
  and running the build reports **`🌐 Translation census: 0 gap(s) across 6 locale(s)`**. The
  census walks DECLARED keys and checks catalogs; nothing ever walks catalog keys and checks
  declarations. `TranslationGap.status` is `'missing' | 'stale'` with no third case.
  **Why it matters more than it looks:** this is the exact failure mode a translator produces.
  Mistype `task.other` as `task.oher` and the census says all clear while the source string
  renders forever — the silent-wrong-answer shape, in the one place the project built a census
  specifically to make loud. It is also how a renamed key or a deleted component leaves
  residue in six catalogs with nothing to catch it.
  **How:** add `'orphaned'` to `TranslationGap['status']` — a catalog key with no declaring
  component, or whose component declares no such key. Include the per-category reachability
  logic LT-190 added, inverted with care: a suffixed key OUTSIDE the locale's platform
  category set is unreachable-but-legitimate, **not** orphaned. Getting that backwards would
  report every `task.one` in a locale without a `one` category.
  **Channel and tier (ADR 0028 s1):** the **build report / translation census**, tier **not
  applicable — a report, not an error**, and it does **not** fail the build. Same channel and
  posture as `missing`/`stale`, and for the same reason: a catalog is DATA, not component
  source, so the compiler has no jurisdiction over it, and a hard failure would break the
  legitimate rename-then-sync workflow. Tech Writer owns the census wording.
  **Also:** `scripts/i18n-sync.ts` should prune orphans (or list them for removal) in the same
  pass it writes missing keys — the census names the problem, `i18n:sync` is where a person
  fixes it.
  **Changed:** `server/compiler/sim/report.ts` (`TranslationGap['status']` gains
  `'orphaned'`; `translationCensus` emits the third reason line); `server/effects/i18n.ts`
  (`collectI18n` grows the inverse walk — every catalog key must be declared, with the
  LT-190 reachability rule inverted into a carve-out that runs BEFORE the declaration
  check; `Catalogs` is now exported and injectable as a second `collectI18n` parameter
  for tests; `writeI18nReport` gains the `orphaned` bucket and count); `scripts/i18n-sync.ts`
  (orphaned keys pruned from the catalog AND the staleness manifest, listed in the
  summary; header doc gains step 3); `server/tests/compiler/i18n.test.ts`.
  **How:** the carve-out is unconditional but per locale — a suffixed key outside the
  locale's platform set is never orphaned, whatever its declaration state, which is the
  wholesale-translation protection the task text warned about (`task.one` in an
  `{other}`-only locale). A key whose TAG is unknown (deleted component) takes the union
  fallback — the compiler's own conservative answer — so a deleted component's keys still
  report everywhere their categories could render; only genuinely pruned-category keys
  slip the report, and only in the locales that could never render them. No new TSRX
  code, no error class — census/report channel only, the build never fails on a catalog.
  The census wording is FIRST DRAFT for Tech Writer (batch with LT-189 items 2–7):
  census reason `orphaned — nothing in the corpus declares this key; the entry can
  never render`, sync log `N orphaned key(s) PRUNED — nothing in the corpus declares
  them, so they could never render`.
  **Test note:** the LT-190 probe test now injects empty catalogs — with the inverse
  walk live, a synthetic one-entry corpus against the REAL catalogs reports every
  committed key orphaned (the parallel LT-198 run transiently observed exactly this);
  locale facts are platform-derived, so nothing real was lost.
  **Check:** (1) the unknown-tag union fallback — deleted-component residue in a
  pruned category stays unreported in locales that cannot render that category, by
  design; a global prune would need cross-locale knowledge `i18n:sync` deliberately
  lacks. (2) ADR 0030 s5 amended in place (both-directions walk, inverted carve-out,
  sync prunes) — unpublished on v3, same precedent as LT-201; adr-keeper pass can
  ratify. (3) LE_TRUC_COMPILER.md's census paragraph + HOST_PROFILE.md's census
  sentence + a CHANGELOG Added bullet carry the same fact.
  **Verification (run):** `i18n.test.ts` 31/31 (incl. the falsification pair pinned
  over the REAL catalogs + committed-catalogs-report-nothing-else); full
  `bun test server/tests` 1601 pass / 0 fail (1 pre-existing LT-207 inter-test
  error); `typecheck` exit 0; `check:tsrx` warning baseline 0, tier census 20/2/0,
  translation census 0 gap(s) across 6 locale(s) WITH the inverse walk live;
  `build:docs` exit 0, simulation pass 2/8/20 unchanged; `check:links` 410 green;
  biome clean on touched files. `i18n:sync` live-verified: a scratch catalog with two
  planted orphans had them pruned (census listed both during the same run); on the
  committed state sync is a clean no-op (`0 missing / 0 pruned`, `git status i18n/`
  empty).
  **Review (Architect, 2026-09-18):** Approved. Verified against the diff at
  8b429d8f, not the handoff: the status union, the inverse walk, the report
  buckets, and the sync prune (catalog AND manifest) are as described; the
  falsification pair is pinned over the REAL catalogs, which also pins the
  committed catalogs orphan-free; `git status i18n/` is clean, so sync is a
  verified no-op on the committed state. Channel posture ratified — a census
  record, never a build failure; no new TSRX code, no error class, so ADR 0028
  owes nothing. The LT-190-probe injection fix is the right call: with the
  inverse walk live, a synthetic corpus against the real catalogs reports
  every committed key, so the old test was asserting isolation it no longer
  had. One narrowing ruled, filed as **LT-217**: the reachability carve-out
  as landed is UNCONDITIONAL, but its motivating case (the wholesale-translated
  `task.one`) is a DECLARED key — the protection only needs declared keys, and
  as landed, undeclared residue (a renamed `few`-suffixed key, a deleted
  component) goes unreported and unpruned in de/lv/zh, whose union sets lack
  `few`. That is the renamed-key/deleted-component residue this task's own
  "Why" paragraph names, surviving in three of six catalogs. Census + sync
  wording handed to Tech Writer as LT-189 item 8 (batch with or after LT-217,
  which rewords the sync header and the ADR sentence again).

- [x] LT-198: LT-174 review residue — four deferred minors. **Depends on nothing; any time.** — reviewed ✓ (Architect, 2026-09-18)
  **Skill:** docs-server-dev
  **Review (Architect, 2026-09-18):** Approved. Verified against the diff, not the
  handoff: all four items landed as described, the mirrored test server in
  serve.test.ts is in lockstep with the route, the architecture-diagram box
  alignment survives, and the full suite in the current tree (LT-196 landed
  since the handoff) is 1601 pass / 0 fail with only the pre-existing
  LT-207-family inter-test error. The item-2 ruling is **ratified**: a
  serve.ts redirect map cannot reach the static host that actually serves the
  site, the locale layout is unreleased so nothing external rots, and the
  pins — a REAL post's root-level URL 404s, not just an unknown slug — keep a
  later reversal honest about its cost. The `Accept: text/markdown` narrowing
  in SERVER.md was checked against pre-LT-174 serve.ts (`ba81fa65^`): the old
  `/blog/:slug` route never handled the header either, so the "all HTML
  routes" claim was already stale before LT-174 — documented a pre-existing
  inaccuracy, no capability regressed. One residue filed: TESTS.md's
  test-file tree omits `pages-locale.test.ts` and ~50 pre-existing files
  (**LT-216**). Noted, no action: the `noUnusedVariables` biome error at
  `host-profile.d.ts:127` predates this task (arrived with LT-208) and CI has
  no biome step — local noise only.
  **Context:** The LT-174 code review (2026-09-15) returned ready-after-fixes; the two
  regressions it caught — llms.txt linking root-level mirrors that had moved into the locale
  trees, and blog author avatars resolving into the non-existent `<locale>/assets/` — plus
  the missing sitemap `x-default` are fixed in the same commit as the review. Four minors
  were judged real but not worth holding the commit for:
  1. Blog-post markdown mirrors 404 on the dev server: `/:locale/blog/:slug` (serve.ts)
     strips only `.html` and force-appends `.html`, so `/en/blog/<slug>.md` looks for
     `<slug>.md.html`. The mirrors exist at `docs/<locale>/blog/<slug>.md`; static hosts
     serve them fine. Handle `.md` in the blog route.
  2. Legacy root URLs (`/guide.html`, `/blog/<slug>`, …) now 404 with no redirect map —
     only `/` got the stub treatment. Decide: a 301 map in serve.ts, or accept it for a
     young site and record the ruling.
  3. `server/SERVER.md` still documents the old routes and output layout (`GET /` → the
     index page, `GET /blog/:slug` → root-level blog, `<page>.html` at the docs root).
     Tech Writer owns it.
  4. The new pure helpers (`rewriteFragmentRefs`, `localeAssetPath`, `pageDepth`,
     `hreflangAlternates`, `rootRedirectPage`) have no direct unit tests — the most
     corner-case-prone surface of LT-174. Route-level tests partially compensate; the
     avatar fix added tests for the path math it touched.
  **Done (2026-09-18):** all four landed.
  1. `/:locale/blog/:slug` serves the mirror at `/<locale>/blog/<slug>.md`
     (Bun.file supplies `text/markdown`; no MIME map change); extensionless
     and `.html` forms unchanged.
  2. **Ruled: accept the 404s.** A serve.ts 301 map cannot reach the surface
     that actually serves the site — the static host gets the built `docs/`
     verbatim — so the map would be an imprecise stand-in, and the locale
     layout is unreleased, so no population of broken external links exists
     yet. Only `/` keeps its stub, because it is the URL people actually
     type. Pinned by the new `legacy root URLs` describe: a REAL post's
     root-level URL 404s, not just an unknown one; the ruling is also
     recorded in SERVER.md's route section. Reversing it means adding the
     map AND reconsidering static-host stubs, and touching the pins.
  3. SERVER.md route table, architecture diagram, and blog-section routing
     sentence rewritten to the locale-prefix layout; "All HTML routes support
     `Accept: text/markdown`" narrowed to the two routes that do (`/`,
     `/:locale/:page`); the dead `BLOG_OUTPUT_DIR` removed from config.ts,
     serve.ts's import, and the constants table (the blog route builds its
     path from `OUTPUT_DIR` directly).
  4. Direct unit tests: `localeAssetPath` + `rewriteFragmentRefs` (all four
     dirs, src/value attrs, depth, page-link + absolute-URL negatives) in
     config.test.ts; `pageDepth` / `hreflangAlternates` / `rootRedirectPage`
     in new `effects/pages-locale.test.ts`; route-level `.md` tests (en + de
     mirrors, unknown slug, un-built locale, traversal) in serve.test.ts,
     whose mirrored test server was updated in lockstep with the route.
  **Changed:** `server/serve.ts` (blog route `.md` branch; dropped the unused
  BLOG_OUTPUT_DIR import); `server/config.ts` (removed BLOG_OUTPUT_DIR);
  `server/SERVER.md` (diagram, route table, legacy-URL ruling paragraph,
  constants table, blog routing sentence); `server/tests/serve.test.ts`;
  `server/tests/config.test.ts`; `server/tests/effects/pages-locale.test.ts`
  (new).
  **Check:** the item-2 ruling (accept legacy-root 404s) is the judgment call
  to ratify — it is pinned by tests, so a reversal is not free. Second look
  at pages-locale.test.ts for over-fitting to `LOCALES = ['en', 'de']`.
  **Verification (run):** touched files 110 pass / 0 fail; full
  `bun test server/tests` 1600 pass / 1 fail / 1 error — the fail
  (`i18n.test.ts` "a category outside the locale's platform set is not a
  gap") involves none of my files: a PARALLEL LT-196 implementation sits
  uncommitted in this tree (its census change makes the old LT-190 probe
  report the real corpus as orphaned; its own LT-196 tests pass), and the
  error is the pre-existing LT-207-family tier-corpus inter-test error.
  `typecheck` exit 0; biome clean on the touched files (one pre-existing
  noUnusedVariables error in committed host-profile.d.ts:127, not this
  task's); `check:links` 410 green.

- [x] LT-217: Narrow the orphan walk's reachability carve-out to DECLARED keys (LT-196 review). — done, pending review ⏳ (2026-09-18)
  **Skill:** le-truc-dev
  **Context:** LT-196 (8b429d8f, reviewed same day) runs LT-190's reachability rule
  inverted as an UNCONDITIONAL carve-out in `collectI18n`'s orphan walk: a
  category-suffixed catalog key outside the locale's platform set is never
  orphaned, whatever its declaration state. But the carve-out's motivating case —
  a wholesale translation carrying `task.one` into an `{other}`-only locale — is a
  DECLARED key, so the protection only needs to cover declared keys. For
  UNDECLARED keys the unconditional carve-out is a blind spot: rename
  `task.few` away (or delete the declaring component) and the old key reports
  and prunes in ar/cy/pl but survives forever in **de/lv/zh, whose cardinal AND
  union sets both lack `few`** — the renamed-key/deleted-component residue
  LT-196's own "Why" paragraph names, uncaught in three of six catalogs. The
  shape is pinned today by `i18n.test.ts`'s "the reachability carve-out is
  unconditional — but only per locale" test, which asserts the unconditional
  regime and flips under this ruling (its de half reports; its cy half is
  unchanged).
  **How:** in the orphan walk, check declaration BEFORE reachability: a key the
  component declares (tag known, key in `i18nMessages`) and whose category is
  unreachable skips — the wholesale protection, unchanged; an UNDECLARED key
  under a known tag, or any key under an unknown tag, reports `orphaned` in
  every locale with no `pluralCategories` call at all (reachability is then
  computed only for declared keys, hoistable per locale — removes the per-key
  recomputation nit en route). The compile gate already guards the
  dropped-component-then-sync hazard: a corpus with error-severity diagnostics
  throws before `i18n:sync` reaches any catalog.
  **Docs that flip with the behavior (code commit carries them):** the pinned
  test above; `scripts/i18n-sync.ts` header step 3 ("Unreachable category keys
  are not orphans" → unreachable DECLARED keys); ADR 0030 s5's orphan-direction
  sentence (unpublished on v3, amend in place); LE_TRUC_COMPILER.md's census
  paragraph. The census reason line and the sync summary line are LT-189
  item 8's copy jurisdiction — land the behavior wording as first draft there,
  final copy in that batch.
  **Acceptance:** an undeclared `few`-suffixed key in de.json reports
  `orphaned` and `i18n:sync` prunes it (the rename-residue case, currently
  silent); a wholesale-translated declared `task.one` in zh stays unreported
  and unpruned (unchanged); the committed catalogs stay gap-free; full gates
  green (`bun test server/tests`, typecheck, `check:tsrx`, `build:docs`).
  **Changed:** `server/effects/i18n.ts` (the orphan walk checks DECLARATION
  first — an undeclared key under a known tag, or any key under an unknown
  tag, pushes `orphaned` and continues with no `pluralCategories` call; the
  carve-out runs only for declared keys and only after the
  `PLURAL_CATEGORIES` suffix check, so plain declared keys fall out with
  zero `Intl` work — the per-key recomputation nit resolved as a side
  effect); `server/tests/compiler/i18n.test.ts` (the pinned test flipped to
  "the carve-out protects only DECLARED keys — undeclared residue reports
  everywhere": de now reports `stray.few`, the wholesale `label.two`
  negative stays, and a cy injection pins the every-locale claim).
  **How:** pure reorder, no new state — `if (undeclared) { push; continue }`
  before the reachability branch. The census reason line and sync summary
  line are UNCHANGED first drafts (LT-189 item 8's jurisdiction); the docs
  that restate the OLD unconditional rule were amended with the behavior:
  sync header step 3, ADR 0030 s5's orphan-direction sentence (unpublished
  on v3, in place), LE_TRUC_COMPILER.md's census paragraph, and the
  CHANGELOG bullet tightened to "protecting declared keys only".
  HOST_PROFILE.md needed nothing — its sentence says residue "never outlives
  the declaration", which this landing makes true in every locale.
  **Verification (run):** `i18n.test.ts` 31/31; full `bun test server/tests`
  1601 pass / 0 fail (1 pre-existing LT-207 inter-test error); `typecheck`
  exit 0; `check:tsrx` warning baseline 0, tier census 20/2/0, translation
  census 0 gap(s) across 6 locale(s); `build:docs` exit 0, simulation pass
  2/8/20 unchanged; `check:links` 410 green; biome clean on touched files.
  **Acceptance live-proven:** `basic-pluralize.stray.few` planted in the
  committed `i18n/de.json` reported as orphaned in the compile's census (de
  — the locale whose category set hid it before this task) and was pruned by
  `i18n:sync`, leaving `git status i18n/` byte-clean.

- [x] LT-194: The document-level page renderer and the page-position ambient `lang` walk. **Depends on LT-174 (landed 2026-09-15).** — reviewed ✓ (Architect, 2026-09-18)
  **Skill:** docs-server-dev
  **Re-verified 2026-09-18 (architect):** the premise still holds — the examples effect
  embeds authored markup verbatim (`server/effects/examples.ts`: the component HTML is
  fence-highlighted and demo-previewed, never rendered), ADR 0030 s3 names this task as
  the page-position walk's vehicle, and LT-191's acceptance fixture still has no home.
  Demand is still zero: no docs page, layout, or example uses a mid-page `lang`
  attribute (the only corpus hit, `basic-pluralize.html`, is component-owned demo
  markup). Stays open but demand-gated: pick it up when a page actually carries a
  positional `lang` (e.g. author-supplied HTML in blog markdown) or the walk rung of
  ADR 0030 s3 blocks something concrete; dropping it would strand that precedence rung,
  which cites this task by name.
  **Context:** Resolves the second NOTES.md entry from LT-174. LT-191's scope ruling parked
  the page-position walk in LT-174; LT-174's own entry scoped it to path-prefix routing, and
  the developer built the stated scope and flagged the gap. **The developer was right to
  split it** — the walk needs a renderer that does not exist, so it was never a detail of
  LT-174. It is this ticket.
  **The gap:** the docs build does not server-render compose sites INTO pages. Pages embed
  authored markup; `examples/**/<tag>.html` is copied verbatim. So `emit-server.ts`'s compose
  inheritance (LT-191 stage 2) resolves a child's locale down the COMPOSITION tree, but a
  component's ambient `lang` from its POSITION on the page (`<section lang="cy">` wrapping
  arbitrary occurrences) has nothing to ride on. **LT-191's acceptance fixture has no home
  until this lands** — that is the completion signal.
  **Shape ruling (owner, 2026-09-18, via the task's three scoping questions):**
  (1) the renderer SERVER-RENDERS a qualifying occurrence (generated render fn, args
  parsed from the authored attributes, `i18nRecord` at the resolved locale) — not an
  attribute-only augment; (2) qualification is BOUNDED to locale-consuming occurrences;
  (3) it runs over BOTH trees under one rule: own `lang` attr > nearest positional
  `[lang]` ancestor > page locale, and where no page locale exists (single-copy
  `examples/`) a baseless occurrence stays authored. The unit is the page (positional
  resolution needs the document); locale stays a build-time constant per occurrence; no
  render cache (LT-193 posture).
  **Bounded to `declaresI18n` Folded-tier — one refinement to the ruling's wording,**
  owner attention drawn: the second question's option said "declares i18n OR takes a
  `lang` server arg — 5 components today". The `lang`-arg arm is dropped on evidence:
  `basic-number` takes a `lang` arg but computes its locale-dependent value CLIENT-side
  (`getLocale(host)` in a lazy child), so its server render is empty-inside — page-
  rendering it would EMPTIFY authored text, the silent-wrong-answer class this project
  polices. Qualifies = Folded + `declaresI18n`: basic-pluralize, form-textbox,
  form-spinbutton, form-colorgraph, form-tokenbox (5). Simulated combobox/listbox stay
  authored regardless — the realm cannot run per watch rebuild (ADR 0027 sub-design 10).
  **Changed:** `server/effects/page-render.ts` (NEW — `renderPageOccurrences`: parse5 in
  source-offset mode, right-to-left splicing of the ORIGINAL string, so bytes outside a
  replaced occurrence survive verbatim; resolution precedence per the ruling; occurrence
  `class`/`id` splice onto the rendered root via `composeHostAttrs` (the LT-090
  discriminator channel); generated modules imported with mtime cache-busting so watch
  rebuilds serve fresh renders); `server/compiler/emit-server.ts` (folded `i18n`-declaring
  modules now emit `argsFromAttrs(attrs)` — Parser-backed props re-emit their factory
  call verbatim `asString('')(attr)`, plain-`string` args take the raw attribute,
  non-Parser non-string args are IGNORED not re-typed (no attribute channel client-side
  either), absent attr omits the key only when optional/defaulted, else null = leave
  authored; the export's PRESENCE is the renderer's static qualification — a `children`
  arg or a required compose-only arg emits no helper); `server/compiler/ir.ts` +
  `front-end.ts` (new `paramProps` on the IR: per top-level pattern property name /
  typeText / optional / hasDefault / isString, computed once in the SHARED assembly, both
  surfaces); `server/compiler/imports.ts` (RUNTIME_HARNESS_EXPORTS exported);
  `server/effects/pages.ts` (renderer inside `applyTemplate`, per locale) and
  `server/effects/examples.ts` (renderer after demo-preview injection, `pageLocale:
  null`); `parse5` devDependency pinned **^7** — NOT v8: jsdom requires parse5
  CommonJS-side and v8 is ESM-only; a hoisted v8 broke `build:docs` via the simulation
  driver until jsdom fell back to its nested copy (pin both consumers stable: hoisted v7
  for us, nested v8 for jsdom); `server/tests/effects/page-render.test.ts` (NEW — 16
  tests: resolution precedence incl. empty-lang-attr and single-copy baseless,
  qualification negatives, byte discipline incl. escaped fence content, class/id merge,
  renderer-supplied lang/i18n; integration over the REAL corpus compiled into an isolated
  generated dir); `server/tests/compiler/emit-tier.test.ts` (`markupOf` now slices to the
  render fn's end — the folded-only helper rode its to-EOF slice and the tier
  byte-identity comparison correctly failed on it); `server/compiler/LE_TRUC_COMPILER.md`
  (§5.3 gains the `argsFromAttrs` contract); `server/SERVER.md` (new Page-Occurrence
  Renderer section); `adr/0030` s3 (the LT-194 sentence amended in place — unpublished on
  v3, same precedent as LT-201/LT-217).
  **How:** the page renderer replaces the occurrence wholesale with the render fn's
  output — the component's template IS the canonical content, so per-instance authored
  words converge to the component's catalog words (the six demo-locale catalogs already
  carry real translations — ar/cy/de/lv/pl/zh, which is the census's "6 locale(s)" — so
  the Welsh/Arabic/etc. instances keep their languages; the pluralize demo's per-instance
  DOG words become the component's tasg/tasgiau — Tech Writer may want a demo-copy pass).
  Docs content consequence, flagged not blocking: the fence shows authored source while
  the preview shows rendered bytes for the 7 pluralize instances (post-upgrade DOM
  already diverged from served bytes before this change; no-JS output is now CORRECT
  instead of all-categories-visible).
  **Check:** (1) the `declaresI18n`-only refinement above is the ruling call to ratify.
  (2) The mtimes-busted module cache is per-process: a watch session that changes only a
  CATALOG (not a component) may serve stale `i18nRecord` results until dev-server restart
  (one-shot builds and CI are always fresh) — accepted, documented in page-render.ts.
  (3) `parse5@^7` pin rationale (jsdom requires CJS) deserves a glance at the next
  jsdom bump.
  **Verification (run):** `bun test server/tests` 1617 pass / 0 fail (16 new; 1
  pre-existing LT-207 inter-test error); `typecheck` exit 0; `check:tsrx` exit 0,
  warning baseline 0, tier census 20/2/0 unchanged, translation census 0 gap(s) across
  6 locale(s); `build:docs` exit 0, simulation pass 2/8/20 unchanged (59 ms), the
  build log now reports `Server-rendered 7 component occurrence(s) in
  examples/basic-pluralize`, served page carries `<basic-pluralize count="2"
  lang="cy" id="welsh-ancestor-test">` with the cy `two` form `dasg` visible and all
  other categories hidden — **LT-191's acceptance fixture is served at its home**;
  the German instance converges byte-wise with the de catalog (Aufgabe/Aufgaben/
  verbleibend); `check:links` 410 green; biome clean on touched files (the
  pre-existing host-profile.d.ts:127 noise excepted).
  **Review (Architect, 2026-09-18):** Approved, with one defect found and fixed in the
  review commit 27652642. Verified against the diff at c05d6c29, not the handoff, and
  the handoff's verification claims were independently re-run, not trusted: tier census
  **20/2/0**, warning baseline **0**, translation census **0 gaps / 6 locales** all hold
  with the renderer live. The served bytes confirm the deep semantics, not just the
  counts: the de instance prunes to exactly `{one, other}` spans (four categories
  ABSENT, not hidden — the `truc:case` pruning is real), zh to `{other}`, `id` splices
  after the rendered attrs. **The `declaresI18n`-only refinement is ratified** — the
  evidence (basic-number's server render is empty-inside; page-rendering it would
  EMPTIFY authored text) makes the lang-arg arm of the original shape ruling untenable,
  and the five-component set is what the question option named anyway. **The defect
  (fixed in review):** the renderer passed the occurrence's `class`/`id` to
  `argsFromAttrs` while ALSO splicing them onto the rendered root — a compose site
  filters them from the child's forwarded args (LT-090: they address the HOST), so a
  page occurrence of form-textbox would have let `id` shape internal wiring
  (`id = name`-derived inputId/aria wiring) where a compose render derives it from
  `name`. Renderer now strips both before the helper call; new test pins the arg view
  to exactly the non-host attrs. A stale comment fixed alongside: the helper gate's
  JSDoc still advertised the withdrawn lang-arg arm. **Accepted with rationale, no
  action:** (a) a self-closing authored occurrence (`<form-textbox … />`) parses with
  following content as its children — but that is the BROWSER's parse of the same
  bytes (DOM-is-truth), the replacement range matches it exactly, and the corpus has
  zero such occurrences (scan run); (b) catalog-only watch staleness (documented in
  page-render.ts); (c) the `!location` silent return is unreachable — a custom element
  always originates in authored source bytes, which always carry parse5 locations.
  **Noted, not blocking:** the pagesEffect wiring seam (`applyTemplate` passing the
  loop locale) has no direct pin — it is 6 auditable lines; and LT-193's perf posture
  is respected (no cache; 7 occurrences corpus-wide). **LT-224 is unblocked** by this
  review; its `front-end.ts` line citations should be re-grepped against the landed
  state (paramPropsOf sits at ~1610, the IR assembly moved ~46 lines down).
  Demand-gate provenance, kept for the record: the architect re-verified this task as
  demand-gated with zero demand the same morning; the owner lifted the gate by
  requesting it that afternoon, and the task's before-implementing protocol was
  honored via the three scoping questions put to the owner first.

- [x] LT-197: Decide how client-side runtime strings get translated (exploration). **Depends on LT-195.** — done ✓ (ruled 2026-09-18, owner concurred; ADR 0030 sub-design 9, amended in place)
  **Skill:** architect (with le-truc-dev for feasibility)
  **Ruling (Architect, 2026-09-18):** option (b′) — the task's (b) with the delivery channel
  changed. A per-component map **compiled into the generated client** is rejected: the client
  bundle is shared across locales while pages multiply per locale (ADR 0030 s1), so baked-in
  translations would force per-locale client bundles. Instead the compiler classifies
  `t.<key>` reads in client positions and serializes only those keys onto the root as a
  config-only `i18n` attribute, resolved per render call through the existing
  `i18nRecord(tag, lang)` — locale stays build-time server data and one client bundle stays
  universal. Option (a) keeps jurisdiction over strings a no-JS reader must see (folded or
  rendered alternatives); the attribute serves event-time-only strings, which by definition
  need JavaScript to exist, so the progressive-enhancement story costs nothing. A page-level
  JSON payload was weighed and rejected (lookup plumbing, per-instance locale lost). Owner
  rulings: **client-referenced keys only** (server-folded keys are already bytes in the
  markup); the name is **`i18n`** — `truc:`-namespaced attributes are server-resolved
  directives, a different purpose; **the carrier-span idiom retires in this landing**
  (superseded by s9, not sanctioned alongside); ADR 0030 amended in place (s4 exception
  line, s6 jurisdiction pointer, sub-design 9, three new alternatives, consequences).
  Boundary consequences: TSRX005's `t` face retires; `lang` stays server-only (client reads
  `host.lang`); computed `t[dynamicKey]` stays rejected; `{placeholder}` message patterns
  with `t.key({ param })` call syntax (the s4 stage-2 shape pulled forward for this channel),
  compiler-validated placeholders (new TSRX code, tier Prevented), census
  placeholder-preservation check (report channel). Payload measured ~150–250 B/instance on
  tokenbox (3 patterns), ~60 B on colorgraph (1 key) — pinned by LT-219. The parse is
  compiler-inlined into the generated client; ADR 0030 s8 (no library surface) holds.
  Implementation: **LT-218** (analysis + emission + client preamble), **LT-219** (corpus
  adoption + census check), **LT-220** (docs/Tech Writer round).

- [ ] LT-218: The client-string `i18n` attribute — compiler analysis, server emission, client preamble (ADR 0030 sub-design 9).
  **Skill:** le-truc-dev
  **Sequencing (2026-09-18):** land the P2b SurfaceAdapter consolidation (**LT-233**) before
  this task — it collapses the two copied front ends this task must currently edit in
  lockstep, and LT-218 is the next surface-capability task that would pay the double-edit cost.
  **Context:** Implements the LT-197 ruling. Three pieces; both authored surfaces stay in
  lockstep (ADR 0032 anti-drift) — the classification lives in the shared analysis, the
  per-front-end diagnostics as today.
  1. **Analysis:** admit `t.<key>` reads in client positions — event handlers, reactive
     thunks, `truc:html` thunks, expose get/set, `defineMethod` bodies, pass get/set — the
     positions the server-only name diagnostic rejects today. Literal/static keys only; a
     computed `t[dynamicKey]` stays rejected (tier Prevented). `lang` stays server-only, its
     message pointing at `host.lang`. The `t` face of the server-only rejection retires for
     these reads — a false-negative removal from an existing check, no new error class
     (retirement sweep is LT-220's).
  2. **Emission:** when the component's client-referenced key set is non-empty,
     `emit-server.ts` appends `attr('i18n', JSON.stringify({ …picked… }))` to `rootParts` —
     the materialized-`lang` precedent — evaluated per render call, so each locale bakes its
     own strings and compose-graph inheritance applies unchanged. Only client-referenced
     keys (owner ruling): a server-folded key never rides the attribute. The
     root-attribute exclusion covers TSRX039; authored `i18n` attributes are already
     rejected in classify-attributes.
  3. **Client preamble:** the generated client factory gains an inlined, guarded
     `JSON.parse(host.getAttribute('i18n'))` merged over the declared source-locale record —
     NO new `@zeix/le-truc` export (ADR 0030 s8). Pattern keys (`{placeholder}` values,
     statically known from the authored record) materialize as interpolating functions,
     plain keys as strings; client-position `t.key` reads rewrite to the local; a pattern
     call site compiles to a call the compiler validates against the declared placeholders —
     **new TSRX code, tier 1 Prevented, error** (author-fixable; Tech Writer owns the copy,
     batch with LT-189). Parsed once at connect, fixed for the connection; malformed JSON
     warns in DEV_MODE and falls back to the source record in production.
  **Pins:** the attribute carries only client-referenced keys (a folded-only key stays off
  it); absent when the set is empty (a component without event-time strings renders
  byte-identical — pin one); a de render bakes translated patterns into the attribute;
  parity green with identical attribute bytes across both surfaces; a client-created
  instance (attribute stripped) falls back to the source record (jsdom pin); the DEV_MODE
  malformed-attribute warning pins.
  **Acceptance:** tier census 20/2/0 and compile-warning baseline 0 unchanged (client keys
  are not a routing signal); gates green (typecheck, `bun test server/tests`, check:tsrx,
  build:docs, check:links). Corpus snapshots should not move yet — no corpus component has
  client-position `t` reads until LT-219; pin via fixtures.

- [ ] LT-219: Corpus adoption — tokenbox + colorgraph event-time strings; retire the carrier-span idiom; census placeholder check. **Depends on LT-218.**
  **Skill:** le-truc-dev
  **Context:** The corpus's event-time strings (LT-195's survey; ADR 0030 s9):
  - **form-tokenbox**: declare `added`/`removed`/`duplicate` message patterns
    (`'Added token: {token}'`, `'Removed token: {token}'`, `'{token} is already in the
    list'` — the duplicate-validity message is user-visible via `setCustomValidity`; the
    platform's own `validationMessage` reads stay as-is, browser-localized); route the two
    status-region writes and the duplicate `setCustomValidity` through `t.<key>({ … })`.
    The header's "deliberately NOT here" comment shrinks to the validationMessage note.
  - **form-colorgraph**: `outOfGamut` key; the three `setCustomValidity('Color out of
    gamut')` sites route through `t.outOfGamut`.
  - **form-spinbutton**: retire the hidden `.increment-label` carrier span — the thunk reads
    `t.increment`/`t.decrement` directly (the LT-195 interim idiom, superseded by ADR 0030
    s9; owner ruling: retire in this landing). The keys become client-referenced; the span
    and its read-back die.
  - `i18n:sync` records the new keys; de gains real translations with placeholders
    preserved („Token hinzugefügt: {token}" shape); extend the i18n.test.ts de fixture pins
    to the attribute + patterns.
  - **Census placeholder-preservation direction:** a translation whose placeholder set
    differs from the declared pattern's is a census entry (new `TranslationGap['status']`
    case, report channel — not a warning, translator-paced, same reasoning as
    missing/stale/orphaned; Tech Writer owns wording, batch with LT-189 item 8).
    `i18n:sync` flags it in its summary; it cannot auto-fix (a placeholder cannot be
    invented). Follow the LT-196 pattern for the inverse-walk tests: falsification probes
    over the real catalogs, injectable for units.
  **Verification:** payload pinned — the sim-driver tokenbox snapshot carries the
  attribute, asserted to stay in the low hundreds of bytes (the ADR's measure); translation
  census 0 gaps on the real corpus with the placeholder walk live; tier census 20/2/0;
  warning baseline 0; Playwright tokenbox spec green (status strings announce in en/de);
  gates green (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links).

- [ ] LT-220: Docs round for the client-string channel — HOST_PROFILE, compiler doc, diagnostic sweep, CHANGELOG. **Sequence with or after LT-189 (batches into its one-voice copy round).**
  **Skill:** tech-writer
  **Context:** The copy/docs obligations ADR 0030 s9 leaves behind; the error-message
  lifecycle applies (a diagnostic face retired, a new TSRX code gained).
  1. HOST_PROFILE.md: the i18n section re-taught — client-position `t` reads, the root
     `i18n` attribute, patterns and the `t.key({ … })` call syntax; the carrier-span
     idiom's teaching REPLACED (superseded, not deprecated — remove the LT-195 interim
     guidance, point at ADR 0030 s9).
  2. LE_TRUC_COMPILER.md: the classification (client positions, literal keys only), the
     emission point, the census paragraph's placeholder walk.
  3. The retired `t` face of the server-only diagnostic: sweep
     `.agents/skills/le-truc/references/errors.md` and any prose teaching "`t` is
     server-only" — the retirement counts per the lifecycle.
  4. Final copy: the pattern-placeholder TSRX code (drafted in LT-218), the census
     placeholder-mismatch wording (drafted in LT-219), the computed-`t[dynamicKey]`
     wording if split from the generic message. Batch with LT-189 items 2–8.
  5. CHANGELOG `[Unreleased]` Added bullets (client-string channel, patterns, census
     check); an AGENTS.md "Surprising Behaviors" i18n bullet if the changed `t`-in-thunk
     rule warrants one.
  **Check:** `check:links` after doc moves; errors.md's entry inventory matches the
  diagnostics union (code added, none deleted — the `t` face was message scope, not a
  code).

- [ ] LT-189: Tech Writer round — `ContextRequestEvent` cross-realm docs plus the standing i18n copy handoffs.
  **Skill:** tech-writer
  **Context:** Three copy items queued from landed work; batch them so the messages read as
  one voice. All follow `workflows/error-message-lifecycle.md`.
  1. **`ContextRequestEvent`'s cross-realm dispatch** (LT-180 review finding):
     `requestContext()` now builds the `context-request` event from the HOST's own realm
     whenever the exported class does not belong to it (`src/helpers/context.ts`, LT-180).
     The class stays exported and unchanged, and in the normal same-realm case it is still
     what gets dispatched — but in a cross-realm host (an iframe, the build's simulation
     realm) the dispatched object is a duck-typed `Event` carrying
     `context`/`callback`/`subscribe`, so a provider written as
     `if (e instanceof ContextRequestEvent)` would stop matching. This is
     protocol-conformant — the Web Components Community Protocol specifies the event's
     fields, not its class, and Le Truc's own `provideContexts()` reads the fields — so it
     is a documentation gap, not an ADR question (Architect ruling, 2026-09-06). Scope: the
     JSDoc on `ContextRequestEvent` and on `requestContext()`, plus the context section in
     `docs-src/pages/` and the `le-truc` skill's context reference. One rule to state: a
     provider checks `event.context`, never `instanceof`.
  2. **TSRX008's dotted-key message** (LT-190 handoff): final copy over the first draft in
     `server/compiler/i18n.ts` — a declared key whose dot-suffix is not one of the six CLDR
     categories is a shape error.
  3. **TSRX047's literal-prose warning** (LT-173 handoff): final copy; the single-letter
     exemption (page data, not prose) must survive the rewording, and the missing-
     *translation*-rides-the-census distinction is the point of the message.
  4. **TSRX048's duplicate-tag error** (LT-202 handoff): final copy over the draft in
     `server/compiler/diagnostics.ts` — one tag, two corpus sources, both files named; the
     "whatever surface it is written in" clause is the dual-front-end fact the message
     teaches.
  5. **The three-arm `boundary` diagnostic wordings** (LT-202 handoff, amended by
     LT-211/208): the arm-shape errors in `server/compiler/frontend/tsx/lower-tsx.ts`
     (missing/ill-typed arms, single-root rule per arm, err-arrow requirement) — final
     copy; the four-arm vocabulary is gone (owner withdrawal, 2026-09-18), so the copy
     covers the three arms plus LT-209's new TSRX049/TSRX050 drafts in
     `server/compiler/diagnostics.ts`. Batch with items 2–3 so the diagnostic families
     read as one voice.
  6. **The TSRX020 retirement copy** (LT-210 handoff, 2026-09-18): the retirement note
     in `server/compiler/diagnostics.ts`'s code union, TSRX018's reworded fix-it
     (`&{`/`&[` no longer introduce anything under the 0.2 pin — drafted, final copy
     owed), and the propagation sweep the retirement leaves behind (per
     `workflows/error-message-lifecycle.md`): HOST_PROFILE.md's lazy-destructuring
     section, LE_TRUC_COMPILER.md §106/§184, and `.agents/skills/le-truc/references/errors.md`
     were updated in the bump commit — verify voice consistency across them. Batch
     with items 2–5.
  7. **The LT-215 reactive-list body diagnostics** (2026-09-18): `validateListBody` in
     both front ends reworded — the admitted server-static class dropped the
     "milestone-3 subset" phrasing for a statement of what the slot-fill contract
     actually reserves (per-item values), and the rejections now name the offending
     reads (`reads item, which derive per item or client-side`). The stale `&{item}`
     sigil spellings in the touched messages modernized to `{item}`. Final copy over
     the drafts in `frontend/tsrx/lower-template.ts` and `frontend/tsx/lower-tsx.ts`;
     batch with items 2–6 so the compiler families read as one voice.
  8. **The LT-196 orphaned-key copy** (2026-09-18): the census reason line in
     `server/compiler/sim/report.ts` (first draft: `orphaned — nothing in the corpus
     declares this key; the entry can never render` — a report record like
     missing/stale, so the wording names the subject, the fact, and stops; census
     records never carry fix-its) and the sync summary line + header step 3 in
     `scripts/i18n-sync.ts` (first draft: `N orphaned key(s) PRUNED — nothing in the
     corpus declares them, so they could never render`). Propagation sweep per
     `workflows/error-message-lifecycle.md`: HOST_PROFILE.md's census sentence,
     LE_TRUC_COMPILER.md's census paragraph, and the CHANGELOG Added bullet must
     read as one voice with the final wording. **Sequence with LT-217**, which
     narrows the carve-out to declared keys and rewords the sync header step 3 and
     the ADR 0030 s5 orphan-direction sentence itself — run item 8 after it (or
     accept a second pass over those two spots).

---

## P2b — Compiler partitioning & hardening (external review, 2026-09-18)

**Provenance:** [COMPILER_REVIEW.md](COMPILER_REVIEW.md) — an external review of all of
`server/compiler/` (46 modules, ~21.9k lines) by Claude Opus, evaluated by the Architect
2026-09-18. **The review held up:** all four correctness findings (§1) were independently
verified against the source (two by direct read — the `offenders`-array truthiness bug at
`frontend/tsx/lower-tsx.ts:641`, the `resolveComposeRefs` IR mutation at
`analysis/compose-refs.ts:118`; the rest via a verification pass), and a 16-claim structural
spot-check came back 13 clean / 3 with minor count drift and zero refutations
(`emitServerModule` is ~1,076 lines, not 993; the estree walks number 12, not ~11; the
drivers' early-exit literal appears 6× per file, multi-line). Task text cites the review's
section numbers; its file:line citations were accurate at capture except where noted —
`front-end.ts`/`emit-server.ts` line numbers drift while LT-194's (now-landed, pending
review) edits sit uncommitted in this tree (re-grep before trusting them in those files).

**Sequencing:** **LT-221 first** (defects). LT-224–LT-234 are behaviour-preserving mechanical
moves verified against the existing golden + parity suites — interleavable with feature
work; the only hard edges are **LT-233 before LT-218 (P2)** and wave ordering (LT-228 before
LT-229/LT-232, which name the files it creates). **LT-235 is a grilling session, not
cleanup.** **No ADR is owed for LT-221–LT-234** — nothing there changes a documented
decision (review §3; Architect concurs). **Declined with the review, recorded so future
reviews don't re-propose:** memoising the §2.11 redundant traversals (not a measured
problem; a second implicit-consistency contract is the disease being treated) and
restructuring `sim/` (§2.12 is doc/type-surface honesty, folded into LT-222). The review's
"LT-222+" numbering assumed LT-221 was taken; it wasn't.

- [x] LT-221: Fix the compiler's verified correctness defects (review §1). — done ✓ (2026-09-18)
  **Skill:** le-truc-dev
  **Context:** All verified at evaluation. (1) `notBuildTime` in
  `frontend/tsx/lower-tsx.ts:637` returns `offenders ? … : 'reads impure ambient state'` —
  an ARRAY is always truthy, so the impure arm is unreachable and an empty offender list
  prints `reads , which derive per item or client-side` (the `.tsrx` twin,
  `lower-template.ts:646`, joins first and is correct — port its shape). Pin: a
  reactive-list expr reading `Date.now()` draws the impure message on `.tsx`. (2) `first()`
  reason strings interpolate UNESCAPED into generated client source (`emit-client.ts:267`
  and `:332–338`; `naming.ts:66` carries the author's message verbatim; ~15 further
  `'<…>'` interpolation sites in the file): `first('input', "the user's name")` emits a
  syntax error in the generated module, and arbitrary content is source injection into
  build output. `emit-server.ts` already `JSON.stringify`s the equivalent positions —
  point-fix the same way (the `jsString()` consolidation is LT-234). Pins: apostrophe,
  backslash, and `', evil(), '` payloads compile and round-trip. (3) Quoted class-map keys
  emit dot access (`emit-client.ts:452` and `:212`): `class={() => ({ 'has-error': invalid
  })}` generates `(…).has-error` — bracket access with an escaped key; same pin shape.
  (4) `resolveComposeRefs` MUTATES the `ComponentIR` (`analysis/compose-refs.ts:118` pushes
  a `ref` attr), so a second `analyzeClient` over the same IR trips the `claimed` check at
  `:105` and emits a spurious `firstSelectorDuplicate`; the ordering contract lives only in
  a comment in `analysis/plan.ts`. Fix: return the resolved attachments and apply once at
  the caller; pin idempotence. (5) The `.tsx` `@for` reserved-name check omits the
  `keyName === 'first'` arm its `.tsrx` twin has (`lower-tsx.ts:738` vs
  `lower-template.ts:766`) — add it; pin both surfaces.
  **Also settle the §1.4 adjacent gap:** `countForSelector` (`analysis/selectors.ts:197`)
  includes `pendingChildren` while `allComposeNodes`/`composeNodesBySource`
  (`:291`/`:317`) omit them — write the probe (a compose site inside a `@pending` arm
  against the duplicate-`id` check at `effects.ts:1629`); if reachable, align with
  `countForSelector` or rule why excluded, in the handoff.
  **Verification:** goldens + parity byte-identical for the corpus (every fix touches an
  error arm or currently-broken output; if any golden moves, investigate — don't re-pin
  blind); warning baseline 0; tier census 20/2/0; gates green (typecheck,
  `bun test server/tests`, check:tsrx, build:docs).
  **Done (2026-09-18):** all five findings plus the probe landed; every fix TDD'd
  (failing pin first). (1) `notBuildTime` now joins before testing — the impure-ambient
  arm is reachable on `.tsx`, `reads ,` is gone. (2) `jsString()` (module-local, LT-234
  supersedes): plain printable ASCII keeps today's single-quoted bytes, anything else
  goes out JSON-quoted — applied at ALL author-data sites in `emit-client.ts`
  (first/all selectors+messages incl. the reconcile itemEvents path, query/hole
  selectors and their synthesized messages, attribute/event/harvest-mark names,
  observedAttributes, style/class key arrays) — the `', evil(), '` injection payload now
  emits as an inert string literal, and a backslash no longer round-trips into a
  backspace escape. (3) Two halves, one family: `objectKeys` DROPPED its
  `allowStrings` option — string-literal keys are always extracted — because the old
  "class maps never use string keys" assumption silently discarded every quoted key
  (`bindClass(el, [])`, no diagnostic: the server rendered the class, the client could
  never toggle it); AND the two per-key dot-access sites now route through
  `memberAccess()` — identifier-safe keys keep today's dot bytes, everything else
  emits bracket access. **Finding beyond the review: §1.3's example was imprecise** —
  a quoted MAP key never reached dot access because it never extracted at all (the
  sixth defect, found by the RED pin); the `class:`-PREFIX spelling was the reachable
  dot-access path. (4) `resolveComposeRefs` keeps immediate attachment but the claimed
  check is now name-aware: a claimed ref bound to the SAME name is the pass's own
  earlier attachment — idempotent re-analysis attaches nothing and reports nothing;
  two distinct names on one element still draws TSRX041. (5) **Ruled N/A, no code
  change:** both `.tsx` loop lowerers hard-set `keyName: null` — the `.map()` grammar
  has no key clause (keys live in `createList`'s keyConfig), so the missing arm is
  grammar asymmetry, not a defect; a `.tsx` pin for the `itemName === 'first'` arm
  (which both surfaces have) already exists in the loop tests.
  **Probe ruling (§1.4 adjacent): UNREACHABLE.** `singleRootOf` filters
  `kind === 'element'` and the `@pending` arm demands exactly one root ELEMENT, so a
  compose site cannot reach a pending arm through valid authoring — the compose walks'
  pending-arm omission is consistent garbage-in protection, not a live duplicate-`id`/
  resolution gap. The probe test pins the arm-shape rejection; revisit the walks in the
  same commit if compose-in-pending ever becomes a supported shape (LT-230 settles the
  walk policy). **Second finding flagged for LT-222:** the `class:`-prefix emission
  branch in `emitTopEffect` (`effects.ts` watch-attr, `attr.startsWith('class:')`) has
  NO producer in either front end — `class:has-error={…}` compiles silently and
  emits nothing (the attr is dropped before classification) — a vestigial authoring
  spelling and a silent drop; decide there whether to wire it or delete the branch
  (the branch is now memberAccess-safe either way).
  **Changed:** `server/compiler/frontend/tsx/lower-tsx.ts` (join-first notBuildTime);
  `server/compiler/emit-client.ts` (`jsString`/`memberAccess`, all author-data sites);
  `server/compiler/ast-utils.ts` (`objectKeys` accepts string keys, option deleted);
  `server/compiler/analysis/loops.ts` + `analysis/effects.ts` (call sites, 5×);
  `server/compiler/analysis/compose-refs.ts` (name-aware claimed check);
  tests: `emitted-literals.test.ts` (new, 4), `class-map.test.ts` (+2),
  `compose.test.ts` (+2: idempotence, probe ruling), `diagnostics.test.ts` (+2: the
  impure message on both surfaces).
  **Verification (run):** `bun run typecheck` exit 0; full `bun test server/tests`
  1628 pass / 0 fail / 1 error (the pre-existing LT-207 tier-corpus inter-test error);
  **goldens + parity byte-identical — the generated dir is `git diff`-clean after a
  full corpus regeneration**; `check:tsrx` exit 0, warning baseline 0, tier census
  20/2/0; `build:docs` exit 0, simulation pass 2/8/20 unchanged; biome clean on
  touched files.

- [ ] LT-222: Delete the compiler's dead surface (review §2.10); fix stranded docs; honest `sim/` labels (§2.12).
  **Skill:** le-truc-dev
  **Context:** All verified by grep at evaluation. Delete: `duplicatedChannelArg`
  (`analysis/reactivity.ts:90` — zero callers; the inline twin at `first-refs.ts:310`
  stays); `QueryPlan.explicitType` (threaded through 5 signatures, no caller ever supplies
  a value — `naming.ts:74`'s conditional write of the never-truthy param goes with it);
  `parserImport` (`emit-client.ts:61`, identity fn used only as a truthiness test);
  `queryName` (`emit-client.ts:68`, returns its own argument in both branches); the unused
  `lineOf` import (`analysis/effects.ts:21`); `TopEffectPlan.async.okText`
  (`analysis/plan.ts:343`, only ever `true`); `ParserKind`'s `null` arm (`plan.ts:36`);
  the unreachable `AssignmentExpression`/`SequenceExpression` branches and with them dead
  `flattenSequence` (`to-estree.ts`); the exported-never-imported `lowerComposeElement`
  (`frontend/tsx/lower-tsx.ts:874`); `returnTypeOfFunction`/`typeAnnotationForBinding`/
  `typeOfAnnotation` exports used only internally (`infer-type.ts`);
  `newerGrammarHint`'s already-rejected `await` entry (`frontend/tsrx/compiler.ts:81`);
  `SIM_PATCH_TABLE` (test-only) and `PROTOTYPE_PATCHES` (empty array with a live 23-line
  applier in `sim/realm.ts:482`, a re-export, and ONE caller outside the compiler —
  `scripts/lib/substrate-probe.ts:287`; handle it, don't break the probe).
  **Found by LT-221 (2026-09-18), decide here:** the `class:`-prefix emission branch in
  `emitTopEffect`'s watch-attr handling (`attr.startsWith('class:')`) has NO producer in
  either front end — an authored `class:has-error={…}` compiles silently and emits
  NOTHING (dropped before classification; the corpus never uses the spelling). Either
  wire the classification (a reactive `class:` attr becomes a per-key watch — a real
  feature decision, take it back to the Architect) or delete the branch and let the
  unknown-attr diagnostics fire; the silent drop is the one unacceptable state. The
  branch is already memberAccess-safe from LT-221.
  **Ruled: KEEP the retired-spelling tombstones** — `LEGACY_PASS_ATTR`/`LEGACY_HTML_ATTR`
  (classify-attributes.ts:111/118) and the `onText` sigil hook (its sole consumer
  diagnoses the retired `&{expr}` via LIVE TSRX018, whose fix-it LT-189 item 6 is still in
  copy): they power a live diagnostic for pre-0.2 spellings, not dead code; revisit at
  packaging. Consolidate: `serverKnown` is computed identically at `front-end.ts:1191` and
  `:1660` — compute once and thread (divergence would make lowering and downstream
  silently disagree). Docs: `indent.ts`'s module doc names a nonexistent `pushStatement`
  and mislocates `reindent`; move the four stranded doc blocks onto their subjects
  (`ir.ts:51`, `analysis/reactivity.ts:54`, `first-refs.ts:416`, `analysis/effects.ts:1235`).
  While in `sim/patch-table.ts`, fix §2.12's dishonest labels: `CAPABILITY_PATCHES` is a
  classifier input (read by `tier.ts`), never applied; `SIM_PATCH_TABLE`'s "whole table"
  comment; `sim/index.ts`'s substrate-swapping claim vs `SimulationRealm`'s public jsdom
  type (`realm.ts:155`) — fix the comments/types, not the design.
  **Verification:** `bun run typecheck` first (deleted exports surface there — bun test
  does not type-check), `bun test server/tests` green, goldens + parity byte-identical,
  warning baseline 0, census 20/2/0; grep confirms each deleted name is gone repo-wide.

- [ ] LT-223: `diagnostics.ts` hygiene — sort by code, retire TSRX031, named `RoutingSignalOrigin`, `invalidSource` line numbers.
  **Skill:** le-truc-dev
  **Context:** Review §2.9. The 54-factory object is unordered (TSRX039 sits between 008
  and 009) — sort by code and band-comment the groups; the cheapest anti-drift win in the
  file. **Retire `TSRX031`** from the `DiagnosticCode` union (no factory, no emitter; the
  prose mentions at `analysis/effects.ts:790/929` go too) — **a TSRX code is being
  retired: Tech Writer reviews the removal** per the error-message lifecycle (a deleted
  code leaves references behind; sweep
  `.agents/skills/le-truc/references/errors.md` and docs even though nothing ever emitted
  it). Move the `TSRX004/013/043` spellings out of the union into a named
  `RoutingSignalOrigin` union in `analysis/tier.ts` (they exist only to document that
  separate `origin` union). `formContextMismatch` (`diagnostics.ts:1173`) takes
  `source: string` it never uses — drop the param. `invalidSource` (`:192`) hard-codes its
  line to `undefined`, so every `export const i18n` error reports NO line number despite
  offsets being in scope at callers (e.g. `front-end.ts:581`) — thread the offset and give
  the line; pin the improved output. Not scheduled from the same section (recorded for
  Tech Writer's next compiler copy batch): the TSRX005/006/007/009 `what`-passthrough
  style drift and the `DiagnosticSite` parameter collapse.
  **Verification:** `bun test server/tests` (the 2.6k-line diagnostics suite is the
  harness), typecheck, warning baseline 0, census 20/2/0.

- [ ] LT-224: Split `front-end.ts` into the six modules of review §2.2.
  **Skill:** le-truc-dev
  **Context:** The single highest-value move in the review: verbatim module scans
  (~197–417), params contract (~565–673), setup extraction (~692–1161), template-output
  resolution (~1233–1400), post-lowering validation (~1482–1601), IR assembly
  (~1610–1745) — nothing couples them except `SetupExtraction`, so the split is file
  surgery, and `extractSetup` becomes the front end's only remaining monster. **Sequence
  after LT-194 lands and is reviewed** (its edits to `front-end.ts` were uncommitted in
  this tree at scheduling, 2026-09-18). `ExtractContext`'s relocation is wave 4 (LT-235)
  — do not smuggle it in here. Check `LE_TRUC_COMPILER.md`/`HOST_PROFILE.md` for
  file-path references to `front-end.ts`; run check:links after.
  **Verification:** goldens + parity byte-identical; full gates green.

- [ ] LT-225: Lift `emitServerModule`'s four closures to module scope behind an `EmitContext`.
  **Skill:** le-truc-dev
  **Context:** Review §2.1. `emit`/`emitElement`/`emitFor`/`emitListFor` are already
  lexically separate, close over 7 variables, and sit inside a ~1,076-line function (the
  review's 993 undercounted — the file ends inside the function). Pass an explicit context
  instead; the async-boundary and compose branches may split out of `emit` in the same
  move if they lift cleanly.
  **Verification:** goldens byte-identical (the whole point — the golden suite is the
  proof), full gates green.

- [ ] LT-226: Split `runEffects` at its own comment bands; dedupe the lazy-text gate.
  **Skill:** le-truc-dev
  **Context:** Review §2.1/§2.5. Construct lowering (~232–607), control-flow addressing
  (~657–1309), compose (~1327–1393), and the duplicate-compose-`id` *validation*
  (~1622–1647 — shares nothing with effect planning) become units with `ctx` passed
  explicitly instead of captured by 22 nested closures. Extract the ~70-line lazy-text
  emission gate cloned at `effects.ts:542`/`:1483` — the comment at `:1519` records that
  the copies ALREADY drifted (the nested path tolerates violations silently): converge on
  the strict behavior only if the corpus holds warning baseline 0; otherwise keep the
  tolerance, stated once in the shared helper. Lift the compose-`id` scan as
  `validateComposeIds`.
  **Verification:** goldens + parity byte-identical; warning baseline 0; census 20/2/0.

- [ ] LT-227: Split `runLoops` and `runHarvest` at their existing pass banners.
  **Skill:** le-truc-dev
  **Context:** Review §2.1. `runLoops` (433 lines) is two unrelated algorithms separated
  by a `// --- Pass 1b` banner → `runEachLoops`/`runReconcileLoops`. `runHarvest` (628)
  Pass 2 (~240–378) already produces the `Site[]` + `thunkRendered` that Pass 3 consumes
  — make it a return type: `collectRenderSites`/`planHarvests`.
  **Verification:** goldens + parity byte-identical; full gates green.

- [ ] LT-228: Split `ast-utils.ts` into `vocabulary.ts` + `ast-utils.ts`.
  **Skill:** le-truc-dev
  **Context:** Review §2.2 tail. A ~420-line name-table module (~17–438) and an
  AST-helper module (~442–765) share one file, and DOM knowledge
  (`DIRTY_FLAG_CONTROL_TAGS`) that is emitter business sits in the shared layer — move it
  emitter-side. Primes LT-232 (derive the subsets) and gives LT-229/LT-231 homes named
  for what they hold.
  **Verification:** goldens + parity byte-identical; typecheck (import paths move); full
  gates green.

- [ ] LT-229: One `walkEstree(node, visit, { skip })` for the twelve hand-rolled estree walks.
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 10. Twelve `Object.entries` walks (`front-end.ts` ×3,
  `analysis/reactivity.ts`, `evaluability.ts` ×3 — compiler root, not `analysis/`,
  `analysis/tier.ts`, `ast-utils.ts`, `frontend/tsrx/compiler.ts`, `analysis/harvest.ts`
  ×2) carry five different skip-lists; only `ast-utils.ts:676` skips type positions
  today. The shared walk takes the skip-list as a parameter; EACH site migrates
  preserving its current behavior, and converging divergent answers (notably: do we
  descend into type positions?) is an explicit per-site decision with a test or a stated
  no-op rationale — silently converging could change analyses. Migrating
  `reportLeTrucImportMismatch`'s inner visit (`front-end.ts`) onto the shared walk fixes
  a latent bug for free: the copy lacks the `ForStatement`/`ForOfStatement`/`CatchClause`
  cases `freeIdentifiers` later grew — pin the corrected behavior.
  **Verification:** goldens + parity byte-identical; the import-mismatch pin; full gates.

- [ ] LT-230: Route the sixteen `TemplateNode` walks through `walk.ts`; settle the `pendingChildren` policy once.
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 11. Sixteen hand-rolled template walks against a
  `walk.ts` whose authorized-exception list (`walk.ts:11`) is shorter than the actual
  list; five exclusivity-aware cascades in `analysis/selectors.ts` alone disagree on
  max-vs-sum and pending-arm handling — the soil the §1.4 adjacent gap grew in. Route
  them through `walk.ts` (keeping per-site aggregation semantics), narrow the
  authorized-exception list to what genuinely remains (walks whose recursion IS the
  semantics), and record ONE policy for `pendingChildren` arms, informed by LT-221's
  probe.
  **Verification:** goldens + parity byte-identical; the LT-221 probe still pins; full
  gates.

- [ ] LT-231: Collapse the hand-maintained compiler vocabularies (review §2.5).
  **Skill:** le-truc-dev
  **Context:** Five divergent "names the client can resolve" lists (`analysis/plan.ts:546`;
  `analysis/loops.ts:98` — missing `plainLocalNames`/`clientLeTrucNames`/`isPending`;
  `loops.ts:384`; `analysis/harvest.ts:579`; the inverse at `plan.ts:614`) plus six
  copies of the user-facing message string; four subtly different "is this a signal read"
  answers (`harvest.ts:38`, `analysis/reactivity.ts:160`, `harvest.ts:163`,
  `ast-utils.ts:461`); `refOf` defined at `effects.ts:633` then hand-inlined at
  `:983`/`:1603`; three "element has its own client construct" versions, one
  (`loops.ts:194`) a hand-written kind list missing `style-map`/`pass`/reactive
  `html`/`server`+`bindsProp`. One function per question. Where convergence changes an
  answer (the `loops.ts` lists look like false-rejection bugs), the corpus must stay
  byte-identical and warning-0 — pin each converged answer on synthetic fixtures so the
  fix is visible.
  **Verification:** goldens + parity byte-identical; warning baseline 0; census 20/2/0;
  synthetic pins for each converged answer.

- [ ] LT-232: Derive the name-set subsets; extend the parity test.
  **Skill:** le-truc-dev
  **Context:** Review §2.5/§3 item 13. `REAL_EXPORT_NAMES` duplicates
  `SIGNAL_CONSTRUCTORS` and `PARSER_FACTORIES` entry-for-entry (its own comment admits
  "hand-maintained against the barrel"); `MUTABLE_SIGNAL_CONSTRUCTORS` is a hand-copied
  subset living in `front-end.ts:427`. Derive subsets from supersets; relocate the
  mutable set beside `SIGNAL_CONSTRUCTORS` (post-LT-228: into `vocabulary.ts`); extend
  `globals.test.ts`'s parity test (only `FACTORY_CONTEXT_MEMBER_NAMES` has one) to pin
  every set against the `@tsrx/core` barrel.
  **Verification:** typecheck; the extended parity test; goldens + parity
  byte-identical.

- [ ] LT-233: `SurfaceAdapter` + shared `runFrontEnd` — collapse the copied front-end drivers. **GATES LT-218 (P2): land before it.**
  **Skill:** le-truc-dev
  **Context:** Review §2.3/§3 item 14. `compileSource` (`frontend/tsrx/compiler.ts:199`)
  and `compileSourceTsx` (`frontend/tsx/compiler-tsx.ts:106`) are the same eight-step
  script — the setup slice, `decl.body.type`, three message strings, and a
  verbatim-duplicated ~200-character async-rejection message are the only differences;
  the early-exit literal repeated 6× per driver collapses into the shared driver. Same
  for the `lowerFor`/`lowerListFor`/`validateListBody` triples: header parsing genuinely
  differs, the program after `itemName`/`iterableName` is one — this copied seam is
  where the §1.1 and §1-(5) drifts happened. Shape: a `SurfaceAdapter`
  (`componentBodyType`, `splitSetupAndOutput`, `stylesheetOf`, `outputShapeLabel`,
  `lowerChildren`, `lowerElement`, `preScans`) + `runFrontEnd(ctx, ast, adapter)`; each
  `compileSource*` becomes parse + adapter + call. Fold `SurfaceWording`
  (`lower-shared.ts:56` — three strings while ~30 surface-specific fragments sit inline
  at call sites) into one complete surface vocabulary; the current version is worse than
  nothing (anti-drift theatre). The per-item `ref` message drift (.tsx generic vs .tsrx
  explicit rejection) closes here; final wording batches with the LT-189 compiler
  families.
  **Verification:** goldens + parity byte-identical (the parity suite is the standing
  cross-surface contract); warning baseline 0; census 20/2/0; full gates green.

- [ ] LT-234: Shared code-generation kit — `CodeBuilder`, `jsString()`/`jsTemplate()`, `HtmlWriter`, `commonIndent()`.
  **Skill:** le-truc-dev
  **Context:** Review §2.8/§3 items 15–16. `emit-server.ts` interpolates `${tab(depth)}`
  ~60 times with every call site hand-managing depth; `emit-client.ts` runs 33
  consecutive `append` calls with trailing commas written as string suffixes; escaping is
  three functions plus bare `JSON.stringify` plus raw interpolation — the inconsistency
  behind §1.2/§1.3, which LT-221 point-fixed and this task closes structurally (migrate
  those point-fixes onto `jsString()`). Extract: a `CodeBuilder` owning
  lines/depth/open/close (making the three copied `cursor.offset` bookkeeping sites —
  `emit-client.ts:227/279/611` — an invariant); the `jsString`/`jsTemplate` pair as THE
  sanctioned way to put an author string into generated source; an `HtmlWriter`
  generalising the existing private `Part[]`/`pushArgument` model
  (`emit-server.ts:70/79`); and `commonIndent()` shared by `spans.ts`'s twin
  computations (differing only in whether line 0 participates — make it a parameter).
  Give the server emitter the client's reserved-name policy: it mints
  `__html`/`__arm${n}`/`__async${n}`/`__children${n}`/`__key` with no collision check
  against author names (an author `const __html` shadows the buffer and confuses
  `retainReferenced`'s token match). Channel/tier note (ADR 0028): compiler-internal
  naming policy — it renames, it does not error; no new runtime check, no new TSRX code.
  **Verification:** goldens byte-identical for the corpus (escaping output must not
  change for legal inputs); a pin that an author `__html` no longer collides; full gates
  green.

- [ ] LT-235: Wave-4 type-level design session — IR discriminated unions, pass contracts (review §2.6–2.7). **Grilling first; produces an ADR + tasks.**
  **Skill:** architect
  **Context:** The one band that is design work, not cleanup — it changes the IR contract
  `LE_TRUC_COMPILER.md` §4 documents, so it wants an ADR (via adr-keeper) and a Tech
  Writer pass on that doc. Grill before scheduling implementation: (a)
  `ForIR.listSignal: string | null` discriminating two entirely different lowerings →
  `ServerForIR | ReactiveForIR`; (b) `try.pendingChildren: TemplateNode[] | null`
  discriminating error-vs-async boundary (with the immediate cast back at
  `effects.ts:1081`); (c) `SignalIR.init` meaning different things per `constructor`;
  (d) consolidating the four parallel `first()` collections on `ComponentIR`
  (`refReasons`, `unmatchedOptionalRefs`, `deferredComposeRefs`, `optionalRefs` — a Map,
  two differently-shaped arrays, a Set) and the seven parallel `expose()` fields; (e)
  relocating `ExtractContext` (front-end-only mutable state WITH function members) out of
  `ir.ts`, restoring its "no runtime values" leaf property; (f) typed pass contracts for
  `AnalysisContext` (`analysis/plan.ts:389`) — loops-before-harvest, byte-stable query
  registration order, `composeRegistry === undefined` silently disabling a pass,
  `ambiguousComposeNodes` as the already-reported channel — the hardest item: failure
  modes today are silent WRONG TIERS, not errors. **Coordinate with LT-212** (P4:
  `@for`'s `@empty` arm adds ForIR surface) — this redesign should land first or
  LT-212's shape gets reshaped under it; LT-212 is not urgent.
  **Deliverable:** ADR, amended LE_TRUC_COMPILER.md §4, and LT-236+ implementation tasks
  with the channel/tier fields the ADR 0028 process requires.

---

## P3 — Gate-wave residue (independent of P1/P2; parallelizable)

- [ ] LT-207: Stop the simulation realm's dependency-wait timers from leaking past teardown (LT-202 NOTES residue).
  **Skill:** le-truc-dev
  **Context:** `bun test server/tests` exits 0 or 1 nondeterministically at HEAD: 3
  unhandled `DependencyTimeoutError` "errors between tests" with 0 failures (verified
  pre-existing on the clean base, f4d66be0). Mechanism (hypothesis from LT-202): the
  parity suite's sim-realm disposal leaves the library's 200 ms dependency-resolution
  timer running; its rejection then lands on the torn-down window (`customElements.get`
  on a disposed realm) and bun fails whichever test is awaiting when it arrives.
  Timing-dependent — corpus-order failed twice in a 3-file subset run, passed in both
  full-suite runs. The realm should cancel or absorb in-flight dependency-resolution
  timers on `dispose()` (or the driver should drain them before teardown) so a disposed
  realm can never emit an unhandled rejection into the next test.
  **Acceptance:** three consecutive full `bun test server/tests` runs exit 0; the
  3-file subset that failed during LT-202 exits 0 repeatedly; no test asserts on the
  leaked rejection today, so fixing it changes no pinned behavior.

- [ ] LT-188: Load the composed-children closure before the simulation pass renders (LT-169 review finding). **Land before P5 adds composition across tiers.**
  **Skill:** docs-server-dev
  **Context:** `server/effects/simulate.ts` loads a client module for each Simulated-tier
  component and nothing else. Children-first replay needs every composed child's tag DEFINED in
  the realm before its ancestor upgrades — `RegistryEntry.composesTags` exists for exactly this,
  and its own JSDoc states the case: a child that a parent's client module never imports (pure
  server-splice composition, no `pass()`/`first()` binding) is never pulled in by the import
  graph. A Simulated-tier parent composing a **Folded**-tier child therefore renders that child
  un-upgraded, and the served markup is silently wrong with no assertion to catch it. Today's
  corpus hides the hole: the only composing Simulated parent is `form-combobox` →
  `form-listbox`, and both are Simulated. Wave 4 (P5) will break that coincidence.
  Fix: the LOAD set becomes the subjects plus the transitive `composesTags` closure over the
  registry, children-first and de-duplicated against `realm.definitions` (the load-once
  assertion). The RENDER set stays Simulated-tier only, so `assertSimulatedTier()` and the
  no-realm-work-for-another-tier invariant are untouched — defining a tag is not simulating a
  component, and the ADR 0029 saving is unaffected.
  Second gap, same file: captured host-console output reaches `realm.diagnostics` but is only
  PRINTED on the normal path, through `gateOnSimReport`/`formatSimReport`. If the pass throws
  earlier (a `load()` assertion, an importer error), those lines die with the realm — print what
  was captured before rethrowing.
  **Channel:** the build report, unchanged; no new diagnostic kind and no TSRX code moves.
  Acceptance: a fixture with a Simulated parent server-splicing a Folded child renders the child
  UPGRADED, and removing the closure fails that test (pin the negative — a fixture whose child
  happens to be Simulated proves nothing); the existing "no realm render for another tier" pin
  stays green; a pass that throws during load still prints its captured diagnostics;
  `bun test server` green.

- [ ] LT-186: A TSRX rule for an unkeyed element sibling of a `@for` in a reconcile container (LT-185's compiler half).
  **Skill:** le-truc-dev
  **Context:** LT-185 cost form-tokenbox its only text input: the `.tsrx` port dropped the
  `data-unreconciled` attribute, `reconcile()` removed the input as an unkeyed child of
  `data-container`, and nothing said so. LT-185 added the DEV_MODE warning for the runtime half.
  This is the compiler half, and the **user's direction (2026-09-06) is that TSRX is the better
  channel precisely because it is earlier** — the author learns at compile time instead of by
  opening a browser in dev mode. The shape is statically decidable for the `.tsrx` corpus: an
  element sibling of a `@for` inside the same `[data-container]`, carrying neither `data-key`
  nor `data-unreconciled`, will be removed at the first reconcile. Note the two channels are
  **complementary, not alternatives** — the compiler cannot see hand-authored HTML written by a
  library consumer, which is the case the runtime warning keeps covering. Do not retire the
  LT-185 warning when this lands.
  **Channel:** compiler (a new `TSRX0NN`), per ADR 0028 sub-design 1 — **confirmed at the
  LT-185 review**, and it is the user's direction: the compiler is earlier than a browser
  dev-mode warning. **Tier:** 1 (Prevented). **Error, not warning** — decided here so it is not
  re-litigated at implementation: the compile-warning baseline's target is zero (ADR 0029 s6,
  REQUIREMENTS M23), so a warning would either be fixed immediately or break the baseline, and
  the fix-it is one attribute. Check the false-positive shape FIRST — a container that
  legitimately self-cleans a dirty server render: if a corpus component needs that, come back
  before writing the rule rather than weakening it.
  **A deviation from ADR 0028's usual pairing, stated so it is not "fixed":** the ADR's Prevented
  tier says the runtime check "remains, behaving as Contained". Here the runtime half is LT-185's
  DEV_MODE advisory, not a Contained error — nothing fails at runtime, so do NOT convert it to a
  `console.error` or invent an error class to match the pattern.
  **Copy:** Tech Writer owns the final wording and reviews it against LT-185's runtime message so
  the two agree (the ADR 0028 lifecycle applies — this introduces a code).
  Acceptance: the form-tokenbox shape at its pre-LT-185 state produces the diagnostic; a sibling
  carrying `data-unreconciled` does not, and neither does `module-list.tsrx` (whose container
  holds only the `@for`) — pin both negatives, the vacuous assertion is the failure mode; the
  compile-warning baseline stays at 0 over the corpus; `bun test server` green.

- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Skill:** docs-server-dev
  **Context:** Filed by the LT-144/LT-145 review (2026-09-03), re-confirmed present 2026-09-17.
  Two tests in `server/tests/compiler/gate-wave-verification.test.ts` pass today but don't verify
  the behavior their name/comment claims — a regression in the underlying compiler behavior
  would fail neither.
  1. **`'the reactive spelling plans a client binding the static spelling does not'`** (line
     ~440) only asserts `hostVariant.spans`/`bareVariant.spans` are truthy — true of any
     compiled component. Fix: assert on the actual compiled `clientCode`, e.g.
     `hostVariant.clientCode` contains a `watch(...host.count...bindText(` call and
     `bareVariant.clientCode` does not (confirmed by hand at review: the distinction is real and
     present today).
  2. **`'composed under form-combobox, initial render stays hermetic'`** (line ~483) only
     asserts the string `<form-listbox` appears in the composed output — trivially true.
     `form-combobox` composes its listbox with `filterable={false}`, so there is no clear button
     to check; the acceptance-relevant behavior is the other known composed-filter case from the
     LT-154 review (the combobox's selected-but-`hidden` inner option is authored `truc:pass`
     filter wiring). Assert the first option renders both `aria-selected="true"` AND `hidden=""`
     in the initial (pre-`truc:pass`) render, matching `sim-driver.test.ts`'s own corpus
     snapshot for `form-combobox`.
  Acceptance: both tests fail if the underlying compiled/rendered behavior regresses;
  `bun test server/tests` stays green.

- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. About which binding helper the compiler emits, not
  about server-execution tiering. v2.6 added `bindAria()` (ADR 0026) and the compiler does not
  know about it: all 7 reactive ARIA bindings in the corpus lower to `bindAttribute` with a
  **compiler-synthesized `String()`** — `String(selected.get() === pid)` (module-tabgroup),
  `String(host.value === optValue)` (form-listbox), `String(parseOklch(host.value).h ?? 0)`
  (form-colorgraph) — precisely the hand-rolled coercion ADR 0026 §2 exists to remove.
  **Fix:** lower a reactive `aria-*` attribute on an element target to
  `watch(<thunk>, bindAria(el, '<idlName>'))`, dropping the synthetic `String()` and letting the
  helper apply ARIA's own coercion (boolean → `'true'`/`'false'`, number → decimal, `nil` →
  clear). **Two hard constraints.**
  1. The attribute→IDL mapping is a **lookup table, not a transform**: ARIA attribute names
     carry no inner hyphens, so `aria-valuenow` gives no clue where the camel hump falls
     (`ariaValueNow`). Build the table by enumerating `ARIAMixin`'s names and applying the
     library's own forward rule (`ariaAttributeName`, `src/bindings.ts:512`) — do not
     hand-maintain a second list that can drift from the platform.
  2. `ARIAMixin` splits into **44 string-valued props and 8 element-reference props**
     (`ariaActiveDescendantElement`, `ariaControlsElements`, `ariaDescribedByElements`,
     `ariaDetailsElements`, `ariaErrorMessageElements`, `ariaFlowToElements`,
     `ariaLabelledByElements`, `ariaOwnsElements`) that take `Element`/`Element[]`. An IDREF
     *string* must NEVER be routed to one — `aria-describedby="x"` is not
     `ariaDescribedByElements`. Map string-valued props only; leave the IDREF attributes on
     `bindAttribute`. All of the corpus's IDREF ARIA is server-static today, so nothing
     regresses.
  Acceptance: the 7 sites lower to `bindAria` with no `String()`; the golden clients update; all
  Playwright example specs stay green (they assert on the ARIA *attributes*, which native
  reflection still mirrors for element targets); the post-ADR-0029 zero-warning gate holds (use
  the gate, not a hand-maintained expected count).

- [ ] LT-148: Route the component's OWN host ARIA to `internals`, and diagnose CSS that depends on host ARIA attributes. **Depends on LT-147's mapping table.**
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. Per ADR 0026 §1, host semantics belong on
  `internals.aria*`: invisible in markup, unclobberable by framework attribute rewriting, and
  still overridable by the consumer's own attribute. **Fix:** a reactive `aria-*` on the ROOT
  element lowers to `watch(<thunk>, bindAria(internals, '<idlName>'))` rather than to an
  attribute write on the host. **The two halves must land in the same commit,** because the
  routing is what makes the diagnostic necessary: `bindAria()` on an `ElementInternals` target
  **removes the shadowing content attribute** at its first value assertion (ADR 0026 §1,
  stale-attribute rule), so a server-rendered `aria-expanded="false"` on the host is deleted at
  hydration — by design, and fatal to any CSS selecting on it. **So:** diagnose a selector in
  the component's own `<style>` block that matches the HOST on an `aria-*` content attribute
  (e.g. `module-tabgroup[aria-expanded="true"]`), with the fix-it naming `:state()` (ADR 0016
  §8) as the component-owned styling hook. **The distinction is load-bearing and the diagnostic
  is wrong without it:** ARIA on CHILD elements stays on the attribute channel (native IDL
  reflection mirrors element-target writes), so the corpus's three existing
  `&[aria-selected="true"]` selectors — nested under tab buttons and option buttons in
  `module-tabgroup` and `form-listbox` — are CORRECT and must NOT warn. Only host-matching
  selectors do. **Zero corpus sites exercise either half today**, so write both fixtures first;
  this is a forward-looking guard in the LT-125/129 posture.
  **Carried from LT-177.** (1) This task owns the serialization pin LT-177 deferred: a corpus
  fixture whose root `aria-*` binding serializes WITH the attribute under simulation — LT-177's
  realm-level test pins the mechanism only, and a `.tsrx` fixture was meaningless before any
  root ARIA binding existed. (2) Under simulation `internals` is now non-null for
  non-form-associated components, so an imperative `internals.states.add(…)` in a factory throws
  a `TypeError`; route custom states through `bindState()`, which capability-probes and no-ops
  on skeletal internals.
  Acceptance: a root `aria-*` thunk lowers to the internals form; a host `[aria-*]` style
  selector warns; the three child selectors stay silent; the simulation serialization pin holds;
  the zero-warning gate holds.

- [x] LT-216: Refresh TESTS.md's test-file tree and count (LT-198 review residue, mostly pre-existing). — done ✓ (2026-09-18)
  **Skill:** docs-server-dev
  **Context:** TESTS.md's "File naming and location" tree bills itself as "the source of
  truth" while missing roughly fifty files: the entire `compiler/` subtree,
  `effects/{build-effect,chapter-pages,simulate}.test.ts`, `helpers/generated-tsrx.ts`,
  and — added by LT-198 — `effects/pages-locale.test.ts`. The count line
  ("31 files, 671 tests") predates the tier/i18n/compiler test waves; the suite is
  84 files / 1601 tests as of 2026-09-18. Regenerate the tree from
  `find server/tests -name '*.test.ts'` and re-pin the count with a date — or, if the
  hand-maintained tree keeps rotting, replace it with the instruction to list the files
  (`find` or `bun test --list`) so the doc stops promising a snapshot it cannot keep.
  While there, check the per-area verification recipes still name files that exist.
  **Done (2026-09-18):** took the task's second option — replaced, not regenerated. The
  hand-maintained tree was missing 53 of the suite's 84 test files (the entire `compiler/`
  subtree incl. `compiler/tsx/`, plus `schema/collapsible`, `templates/chapter-nav`, and
  four `effects/` tests) while billing itself "the source of truth", and tests are added in
  nearly every task, so a regenerated enumeration rots the same way. TESTS.md now carries a
  directory-level skeleton (dirs + naming convention + the stable root modules, explicitly
  labelled NOT an enumeration), the authoritative file list is the command
  `find server/tests -name '*.test.ts' | sort`, and the count line is re-pinned with a date
  (84 files / 1601 tests, 2026-09-18) pointing at the `bun test` summary line as the live
  source. Deviation from the task text, verified: `bun test --list` does NOT list — the
  flag is silently ignored and the suite runs — so the doc recommends `find` only. Recipe
  check: all six verification Processes name files and scripts that exist (incl. the
  Playwright bin and all five Process-5 output files on disk), and both helper files
  (`test-utils.ts`, `generated-tsrx.ts`) are as documented.
  **Changed:** `server/TESTS.md` only (the File-naming-and-location skeleton + count line).
  **Verification (run):** `bun test server/tests` 1601 pass / 0 fail / 1 error across 84
  files (the 1 error is the pre-existing LT-207-family inter-test error, not this change);
  `check:links` 410 green.

---

## P4 — v3.0 deprecated-surface removal (separate branch; gates wave 4)

**Owner sequencing, 2026-09-04:** both removals run on a **separate branch**, and land **before
any wave-4 migration** (LT-095–LT-111) so migrated twins and newly generated clients never
target the removed forms. ROADMAP § "Dead ends: deprecated in 2.x, removed in 3.0" already
declares both; these tasks implement it. The Cause & Effect 2.0 re-export surface rewrite is a
separate track, blocked on CE 2.0 shipping — out of scope here.

- [ ] LT-178: Remove the `pass()` unrestricted-write short forms (ADR 0012 removal).
  **Skill:** le-truc-dev
  **Context:** ADR 0012 scheduled removal for the next major; the major is in pre-release
  (3.0.0-next.1) and the DEV_MODE warning still fires in `swapSlots`
  (`src/helpers/reactive.ts`). Delete the property-key and bare-writable-signal input forms from
  `PassedProps` handling and `toSignal` resolution — the thunk (read-only) and `{ get, set }`
  descriptor (mediated) forms remain the only inputs. ADR 0012's status records the examples as
  already migrated; sweep `examples/`, `test/`, and `docs-src/` for stragglers anyway.
  **Retires a DEV_MODE deprecation warning — Tech Writer reviews the copy removal** (warning
  message, JSDoc on `pass()`/`PassedProps`, CHANGELOG breaking entry, ROADMAP dead-end
  check-off). Channel note: this retires a check and adds none.
  Acceptance: the short forms are gone from the types and the runtime; nothing warns because
  nothing exists to warn about; `bun test` green; CHANGELOG carries the breaking entry.

- [ ] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone).
  **Skill:** le-truc-dev
  **Context:** ADR 0018's v3.0 milestone, still pending at 3.0.0-next.1:
  `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` return `void`;
  `FactoryResult`/`EffectDescriptor` leave the public return contract (`src/types.ts`,
  `index.ts`); the `forEachUnseen` return-reconciliation in `src/component.ts` is deleted, as is
  `each()`'s copy kept only for the v2.3→v3.0 window (ADR 0017). Hand-authored descriptor
  registration remains `watch(() => true, descriptor)` — the only documented path. Sweep
  examples/tests for `return [...]` factories. **Tech Writer reviews the doc touchpoints**
  (AGENTS.md, ARCHITECTURE.md § Effect Descriptors, CONTEXT.md Factory/Effect Descriptor
  entries, CHANGELOG breaking entry).
  Acceptance: helpers return `void`; `FactoryResult` is not exported; a bare-statement helper
  call cannot silently no-op (the collector is the only registration path); `bun test` green.

- [ ] LT-212: `@for`'s `@empty` arm (LT-210 item 1, re-anchored). **Gate: before P5's first wave-4 migration (owner sequencing, 2026-09-17); not urgent — no migrated component uses it today.**
  **Skill:** le-truc-dev
  **Context:** Spec: optional arm after the template block. New IR (an empty arm on
  `ForIR`), both emitters, analysis addressing. `.tsx` needs no new spelling — an
  empty state is already `{items.length === 0 ? … : items.map(…)}` — so decide
  whether `@empty` lowers to that shared conditional+loop shape or earns its own IR
  (keys and addressing may differ). Dual-surface story per ADR 0032 s6: paid in both
  surfaces (the `.tsx` lowering is the conditional+map shape) or the s6 exception
  recorded.
  **Acceptance:** parity extended for the empty case; goldens unchanged for untouched
  behavior; warning baseline 0, census 20/2/0 hold.

- [ ] LT-213: Dynamic `<{expression}>` tags (LT-210 item 2, re-anchored). **Gate: before P5's first wave-4 migration; not urgent.**
  **Skill:** le-truc-dev, with architect ruling the tier story if it needs one
  **Context:** Spec: closing tag repeats (`</{expression}>`). Not expressible in
  standard TSX — if the capability stays `.tsrx`-only, ADR 0032 s6's exception
  mechanism records it. The server semantics are the hard part: a tag name unknown at
  compile time folds only when the expression is server-known; decide which tier
  renders the unknown case and what the client does at connect. Also check the
  `.tsx` collision: a capitalized local-variable tag reads as compose (PascalCase =
  compose), so a `.tsx` spelling via a local tag variable must not blur compose
  dispatch.
  **Acceptance:** the unknown-tag case has a ruled tier and a pinned fixture;
  compose dispatch unaffected.

---

## P5 — Wave 4: example migrations

**Gated on LT-178/LT-179 only** (P4) — the other gates landed 2026-09-18: LT-202 (the
`.tsx` front end in the build) and LT-210 (the TSRX pin upgrade, 0.2.3; owner sequencing
2026-09-17). LT-183 returned GO (ADR 0032, dual front end) — **migrations author
`.tsx`**;
the spike's four fixtures (`spike/tsx/`) and FINDINGS' surface mapping are the shape
reference. Otherwise unblocked. The canonical pattern is LT-092's: same-commit cutover — delete the `.ts` twin, point
`examples/main.ts` at the generated client, drop any CEM exclusion, keep the demo/spec green
against the served compiled component. Surface compiler gaps in NOTES.md — or fix them
directly if small (LT-088 precedent) — never weaken a component to dodge a gap. **Per
migration, record the tier and the reason** alongside the zero-warning check; only the
Simulated tier opens a realm, so Folded and Static both mean near-zero added build cost
regardless of occurrence count.

**Two LT-165 obligations land on wave 4's first Static-tier component.** (a) `check:tsrx`
type-checks each module at its OWN classified tier and the Static census is empty, so the build
type-checks the Static emit path nowhere today; `emit-tier.test.ts`'s "dropped ⇒ name absent"
assertion stands in for it. The first real Static component closes the gap for free — confirm it
does. (b) Census reasons carry `origin: detail (line N)` but not the signal's `resolution`
(`realm` vs `none`), which is self-evident for today's Simulated reasons but not for a Static
one: a Static reason must also say why NOTHING answers it. Add the resolution to the reason text
then — the format is pinned and its tests update with it.

**Suppression records are incomplete by design** (LT-165 step 7). Reactive `truc:html`,
`class:`/`style:` maps (a shared-surface attribute, where a per-site revert would undo other
bindings' legitimate work) and `truc:pass`-into-child sites are NOT recorded, and a parent's
render does not consult a composed child's records. No corpus component hits these today. A
migration that produces a Simulated-tier component with an unresolvable read behind one of those
shapes must extend the record set FIRST — surface it in NOTES.md rather than shipping a site
that is suppressed in name only.

**`data-unreconciled` must survive its migration** (LT-185's root cause). Porting a component
to `.tsrx` silently dropped that attribute from form-tokenbox's input, and `reconcile()` then
removed the input as an unkeyed child — nowhere to type, no diagnostic. **`module-calctable`
(LT-109) and `module-todo` (LT-111) both carry `data-unreconciled` in their hand-written
sources today.** When migrating either, diff the emitted markup's attributes against the `.ts`
twin's before calling the port done, and assert the opt-out survives hydration the way
`equivalence-audit.test.ts`'s LT-185 regression test does for form-tokenbox. **LT-186 (P3) makes
this a compile error** — if it has landed by then, these two migrations get the check for free
and this note is redundant; if it has not, do the manual diff.

- [ ] LT-095: Migrate `basic-blogmeta` by reshaping it into a template owner with typed byline props (LT-033 decision). **Carries LT-173's deferred blogmeta fold verification.**
  **Skill:** le-truc-dev
  **Context:** Design decided 2026-08-29: fully-typed props, NO arbitrary pass-through
  (mediaqueries precedent) — `author` (string), `avatar` (optional URL string), `published`
  (datetime string), `modified` (optional datetime string), `reading-time` (optional number,
  minutes). The template re-emits ALL the schema.org microdata the old light DOM carried —
  `itemprop="author"`/`itemscope`/`itemtype="https://schema.org/Person"`, `datePublished`,
  `dateModified`, and `<meta itemprop="timeRequired" content="PT{n}M">` derived from the
  reading-time prop — with the avatar `<img>` behind an `@if` on the avatar prop and the
  modified span a conditional branch on prop presence. Author-supplied arbitrary siblings inside
  `<basic-blogmeta>` are dropped; consumers port to props. Locale formatting and invalid-date
  handling expressed via setup consts (server-safe, the `fn2Digits` precedent). Consumers to
  port: `examples/basic/blogmeta/basic-blogmeta.html`, `server/effects/pages.ts`
  (`emitBlogCards`), `docs-src/layouts/blog.html`, the examples.md demo markup.
  **Date handling is prescribed** (ADR 0030 s2, and it is what makes the fold possible): use
  `Date.UTC(y, m - 1, d)` with `timeZone: 'UTC'` in the formatter — never shifts the day, reads
  no ambient state. The current `new Date(year, month - 1, day)` + zone-less
  `Intl.DateTimeFormat` reads the build machine's timezone and must not survive the migration.
  Verify the component classifies Folded once migrated; LT-173 step 6 deferred its fold
  verification here.

- [ ] LT-096: Migrate `module-codeblock` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** Smallest hand-written example (~43 lines). **Known pre-existing bug to fix during
  this migration** (LT-117 review): the twin calls `copyToClipboard(code, copy, {...}` bare — the
  `EffectDescriptor` is created and discarded, so the copy-click listener never attaches (label
  stays "Copy" on click; verified at HEAD). Per AGENTS.md it needs registration —
  `watch(() => true, copyToClipboard(...))` — plus a spec assertion that click actually
  copies/toggles the label. **Perf:** this is one of the two components that move page chrome
  into the simulated corpus (~299 occurrences in the built docs). Record the simulated build
  stage's wall time before and after, and record the tier and reason. (LT-193 has since removed
  the render cache this entry originally said to verify engaging — the cache no longer exists
  by the time wave 4 runs.) Its `first('code')`/`first('button.overlay')`/`first('basic-button.
  copy')` refs predict Simulated, but ~299 occurrences make that ~0.33 s — not a blocker.

- [ ] LT-097: Migrate `module-cem-list` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~39 lines, an `each()` loop over CEM manifest data. Watch for: loop body reactive
  attrs on non-root children (the LT-037 fix), selector uniqueness among repeated items.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. culori usage follows the `asOklch.ts`/`_common`
  setup point (modes must be registered there, LT-091 finding 3).

- [ ] LT-099: Migrate `module-pagination` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Has a spec — keep it green against
  `/test/module-pagination`.

- [ ] LT-100: Migrate `module-catalog` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Has a spec — keep it green against
  `/test/module-catalog`.

- [ ] LT-101: Migrate `module-dialog` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Has a spec. Watch
  for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related
  event handlers as bare `on()` statements.

- [ ] LT-102: Migrate `module-splitview` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Watch for:
  `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for
  exactly this class of code).

- [ ] LT-103: Migrate `module-scrollarea` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Has a spec. Watch for: the
  effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069
  acceptance case). **This component drove ADR 0029's three-tier shape and its tier is the thing
  to verify.** It reads `scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/
  `offsetHeight` and emits exclusively through `bindState(internals, …)`. **Expected tier:
  Folded** — the geometry reads live in scroll/observer callbacks and the
  `bindState(internals, …)` output never reaches served HTML (Static is equally acceptable; both
  are never simulated, so the ~2.3 s is unpaid either way). **Simulated is the outcome to
  investigate:** at 1,966–2,091 occurrences it reproduces the ~2.3 s ADR 0029 exists to avoid —
  either reshape the migrated component so its reads stay in client-only positions (per its
  demonstrated patterns) or surface the over-signal in NOTES.md. Record the actual tier, the
  reason, and the wall-time figures either way; only wrong served HTML is a correctness bug.

- [ ] LT-104: Migrate `module-lazyload` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. culori usage follows the `_common` setup point. If
  it composes other form components multiple times, use the static-attr discriminator addressing
  (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Also ports
  `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the
  compiled artifact (or the served page, matching the corpus's spec conventions); mocks served
  under `/test/module-listnav/mocks/...` stay working. Note: LT-200 (merged with `next`)
  moved this component's initial hash sync into effect activation — the ported template must
  keep that shape.

- [ ] LT-108: Migrate `module-carousel` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

- [ ] LT-110: Migrate `module-ticker` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.

- [ ] LT-111: Migrate `module-todo` to `.tsx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.

---

## P6 — Cleanup round (after the corpus port)

- [ ] LT-093: Make TSRX004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Skill:** le-truc-dev
  **Context:** Re-confirmed empirically 2026-08-29: `const DEFAULT = 'red'; const color =
  createCell(DEFAULT)` consumed only through a style-map still fires TSRX004's "never rendered"
  message, though the signal IS credited as rendered (`thunkRendered`) —
  `substituteArgExpr`'s free-name gate rejects the verbatim initializer because the client
  module may not define the name. **Step 1 (small):** split the diagnostic — "rendered but
  initializer not client-portable" (name the offending free names) vs "never rendered".
  **Step 2 (goal):** feed signal-initializer free names into `computeClientNeededNames` as
  client-needed seed positions so plain-setup and import-local names in initializers place
  client-side; the fixpoint has grown accretively (clientSetup statements, composed refs, pass
  set-thunks — LT-069/087/088), so the plumbing gap is much narrower than when option (b) was
  judged heavy. Also fold in a compiler unit test for the `imports.plainLocalNames`
  `badFreeNames` widening (currently unexercised after the LT-091 redesign), and the LT-116
  finding that `returnsNumber`'s heuristic misses number-signal reads (`count.get()`) in `value`
  thunks, which now lack `String()` coercion under property dispatch — consult `inferredType` so
  the coercion fires for number-typed signal reads (no corpus offender today; add the unit test).
  **Re-triaged 2026-09-06 (LT-165 step 5 landed).** The ADR 0029 concern stands and has
  sharpened: TSRX004 left the diagnostic channel, so a false firing on a fully
  phase-1-resolvable component now tiers it into simulation **silently** — it buys a realm and
  says nothing. It is not invisible, though: the tier census records the reason with its
  TSRX004 origin and line, so the failure mode is inspectable rather than lost. Stays in P6 on
  that basis. **Cheap check to run at the end of wave 4, before this task:** scan the census for
  any Simulated component whose ONLY reason is a TSRX004 origin — each one is a candidate false
  firing, and the list sizes this task's real payoff.

- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge).
  **Skill:** le-truc-dev
  **Context:** LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement reads
  it, but the check is `containsSignalGet(stmt.node, …)` on the statement itself. Hoisting the
  predicate into a plain setup const — `const isOpen = () => open.get(); watch(() => !isOpen(),
  …)` — moves the read out of the statement and the signal draws TSRX004 again, so the author
  must repeat the predicate at every site (`form-combobox.tsrx` does, with a comment saying
  why). **Re-checked 2026-09-06 (LT-165 step 5 landed) — the original premise is false.**
  "The diagnostic is loud, not silent" no longer holds: TSRX004 left the diagnostic channel, so
  hoisting a predicate into a plain setup const now routes the whole component to the Simulated
  tier with **no warning at all** — the author gets a jsdom realm instead of a one-line fix-it,
  and the `form-combobox.tsrx` comment ("repeat the predicate, here is why") is unenforced
  guidance the next author has no way to discover. The census reason still names the origin, so
  it is diagnosable after the fact. **Architect question at pickup:** this may warrant moving
  out of P6 — raise it rather than assuming the P6 placement still reflects its cost.
  **Fix:** resolve reads through `component.plainSetup` consts the statement names — the same
  one-hop widening `computeClientNeededNames` already does — or fold into LT-093, which is the
  same free-name-through-a-const wall from the other direction. The negative case is pinned in
  `server/tests/compiler/client-setup-credit.test.ts`; flip that test when fixing.

- [ ] LT-187: `reconcile()` misreports a DUPLICATE `data-key` as "key not present in the source" (LT-185 review finding).
  **Skill:** le-truc-dev
  **Context:** Pre-existing, found reading the removal branch during the LT-185 review. In
  `classify()` (`src/helpers/reactive.ts`) a child is adopted only when
  `harvested !== null && keySet.has(harvested) && !current.has(harvested)`. A SECOND child
  carrying a `data-key` that is in the source but already claimed by an earlier sibling falls
  through all three conditions to the removal branch, where it draws the keyed message —
  "key not present in the source" — which is false. The key IS present; the child is a
  duplicate. An author chasing that message looks at their data source, where nothing is wrong,
  instead of at the two elements sharing a key in their markup. Removing the duplicate is the
  correct action, so only the message is wrong, not the behaviour.
  **Fix:** distinguish the two cases at the branch — `keySet.has(harvested)` separates "duplicate
  key, first occurrence wins" from "key not in source" — and give the duplicate its own message
  naming the collision.
  **Channel:** runtime DEV_MODE advisory (REQUIREMENTS S3), same as its sibling — NOT an ADR 0028
  tier, for the reason recorded in LT-185's review. Statically decidable for the `.tsrx` corpus
  in principle, but the compiler emits `data-key` on `@for` items itself and cannot produce a
  duplicate, so no `TSRX` rule is owed; hand-authored `reconcile()` markup is the only source.
  **Copy:** Tech Writer owns the wording; batch it with LT-185's and LT-186's messages so all
  three read as one family.
  Acceptance: a duplicate-key child draws the duplicate message, a genuinely absent key still
  draws the existing one, and both are pinned (the existing message has no test today — add one
  while there); `test:src` green.

- [ ] LT-134: TSRX035 and TSRX042 give opposite advice on the same construct (LT-131 review finding).
  **Skill:** le-truc-dev
  **Context:** TSRX035 (`duplicateIdAcrossArms`) tells the author "Give each arm's element a
  distinct id" — a static id per arm. TSRX042 then warns on each of those static ids. Both are
  individually true (TSRX035 is about two ids colliding within ONE instance, TSRX042 about one
  id colliding across TWO instances) and the server-arg fix satisfies both at once, but neither
  message says so, and an author fixing TSRX035 as instructed walks straight into TSRX042. No
  corpus component hits it today. **Fix:** make TSRX035's fix-it name the server-arg shape too —
  "give each arm's element a distinct id, taken as server args so they stay unique per instance
  (TSRX042)" — and check whether TSRX038 (`duplicateComposeId`) needs the same. Cheap,
  message-only; the point is that the diagnostic set should not contain a loop. **Tech Writer
  reviews the copy.**

- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
  **Skill:** le-truc-dev
  **Context:** A `@for (const x of items)` loop lowers CLIENT-side to
  `const items = all('<selector>')` — the loop's collection name becomes a query variable that
  SHADOWS the server arg of the same name. Setup or `expose()` code reading the arg then means
  two different things per half: server `items.length` is the array length, client
  `items.length` is `undefined` on a `Cell`. **Verified 2026-08-30, and it is loud:**
  `expose({ n: () => items.length })` over a `@for (const item of items)` loop compiles with
  ZERO compiler diagnostics but fails `check:tsrx` with `TS2339: Property 'length' does not
  exist on type 'Cell<HTMLSpanElement[]>'`, mapped back to the right `.tsrx` line. So this is a
  message-clarity task, not a correctness hole — same posture as LT-125. The tsc text names
  `Cell<…>` but never says *why* the author's `string[]` arg became one, and the fix (rename the
  loop binding, or project the value through `expose()`) is not discoverable from it. **Fix:**
  detect the collision in the compiler — a `@for` collection name that also names a server arg,
  where the arg is read outside the loop body — and emit a dedicated diagnostic naming both the
  shadowing and the rename. Low priority: no corpus component hits it, and the build already
  stops.

- [ ] LT-138: The `truc:html={}` sanitizer default is inverted between server and client (LT-128 verification finding). **Gated: deferred until a component actually authors `truc:html`; none does today.**
  **Skill:** le-truc-dev
  **Context:** The two halves of one `.tsrx` source disagree on the default trust posture:
  `server/compiler/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` →
  entities, so nothing ever renders — safe but inert), while the client's
  `dangerouslyBindInnerHTML` (`src/bindings.ts:652`) ships NO sanitizer and assigns raw unless
  `configureHtmlSanitizer()` was called. Both are configurable and both document themselves as
  "the library owns no sanitizer", but the DEFAULTS point opposite ways. For a reactive
  `truc:html={() => …}` that means an unconfigured app server-renders escaped, inert text and
  then flips to live markup on hydration — a visible content change and an inconsistent security
  posture from one authored attribute. **Unverified:** no corpus component authors the
  attribute, so this has never run end to end; confirm the flip with a fixture before designing
  the fix. **Decide** which default is right, then make both halves agree, and make
  `configureHtmlSanitizer` on one side not silently leave the other unconfigured.
  **One sanitizer serves both channels (settled by LT-152, 2026-09-03).** jsdom is in the build
  regardless of tiering, and DOMPurify's documented Node path
  (`createDOMPurify(new JSDOM('').window)`) was verified on it against two hostile payload sets.
  So: DOMPurify server-side through `configureHtmlSanitizer`, DOMPurify client-side, and
  `sanitize-html` retires. That matters beyond tidiness — two sanitizers with different
  allowlists mean a `truc:html` value that survives the server's filter can be altered by the
  client's at connect, i.e. a hydration diff in the one place a hydration diff is a security
  question. The retirement is small: `sanitize-html` was never a production dependency
  (`configureHtmlSanitizer` is called only from `server/tests/compiler/features.test.ts:25`).
  **ADR 0010's policy is untouched** — the library still ships no sanitizer and the consumer
  still supplies the hook; this is about what the compiler runtime is configured with and what
  the docs recommend.
  **Target state (owner, 2026-08-31): seamless Trusted Types.** The API is Baseline 2026 and the
  client half is already shaped for it — `Sanitizer` returns `string | TrustedHTML` and
  `dangerouslyBindInnerHTML` assigns through a cast a Trusted-Types-enforcing CSP accepts
  (`src/bindings.ts:35`, `:682`). The blocker is TypeScript's DOM lib and it has NOT lifted:
  `lib.dom.d.ts` in the installed TS 6.0.3 still has no `TrustedHTML` interface, which is why
  `src/bindings.ts:32` carries a local `type TrustedHTML = object` placeholder. **Unverified:**
  whether TS 7 fixes it — the published `typescript@7.0.2` tarball ships no `lib.dom.d.ts` in
  the old layout, so check against however TS 7 delivers its DOM lib before planning. Two things
  follow if it has landed: drop the placeholder for the real type, and decide whether the SERVER
  half gets a Trusted-Types-shaped seam too (it produces strings into markup so it cannot hold a
  `TrustedHTML`, but it can share one policy-configuration entry point with the client so an app
  configures trust ONCE rather than per environment — which is the actual fix for the
  inverted-defaults problem).

---

## P7 — Backlog (not scheduled)

- [x] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2). — retired as moot ✓ (architect, 2026-09-17, ADR 0032)
  **Skill:** le-truc-dev
  **Context:** RETIRED: `.tsx`-authored code gets editors through plain tsserver — there is
  no generated module to project and no span table to remap for the primary surface
  (ADR 0032 s3; the plugin's premise was `.tsrx`-everywhere authoring). CLI-first (LT-011)
  covers CI/agent workflows. **Re-open conditions (either):** `.tsrx` authoring resurges as
  a dominant surface (the span-table projection becomes relevant again); OR precise
  EDITOR feedback on authored `.tsx` is demanded — LT-209 gives CI per-file precision with
  compiler-emitted ambients, but tsserver cannot do per-file programs, so the wide `host`
  overlay stays in editors until a per-file language-service projection exists.

- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Skill:** le-truc-dev
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed the current
  unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no
  client task) only when the resolved value is read nowhere outside its own arm AND the guarding
  promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer
  of the async boundary — build fixtures around it, same caution as LT-077.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Skill:** le-truc-dev
  **Context:** Architecture decision 2026-08-29: generation-time inlining.
  `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the
  docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines
  `DEV_MODE='"true"'`), pass it to the compiler as a `devMode` option, and the compiler INLINES
  the folded constant into generated client modules. Generated code must never reference
  `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the
  library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration
  assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch —
  emitted only under the generation-time dev flag and folded away entirely otherwise.

- [ ] LT-214: Selector-prefix warning — ADR 0033 sub-design 5 (the scoped-styles "support" that lands in code). **GATED on owner acceptance of ADR 0033 — parked with it: the whole package is a ROADMAP.md backlog item (likely 3.1) pending the TSRX-feature commitment, so this task waits too.**
  **Skill:** le-truc-dev (Tech Writer owns the message copy)
  **Context:** The profile's open question answered: the compiler parses the authored
  stylesheet (upstream exports reusable `parseStyle`/`analyzeCss` — evaluate against
  a minimal hand parser) and **warns when a top-level selector neither leads with the
  component's tag name nor is an at-rule**. Channel: compiler; **tier 2 Contained**
  (ADR 0028 s1) — a warning, not an error, because a deliberately global rule must
  stay possible (the structural escape hatch). All 22 corpus components already
  conform (verified 2026-09-18), so the warning baseline must stay 0 at landing —
  the gate that proves the check neither fires on the corpus nor misses its shape.
  HOST_PROFILE.md's styles section and `docs-src/pages/styling.md`'s compiled-component
  callout update from "documentation-only guarantee" to the warning.
  **Acceptance:** a fixture with an unprefixed top-level selector warns with the
  ruled copy; the corpus stays at warning baseline 0; `check:tsrx`/`typecheck` green.
