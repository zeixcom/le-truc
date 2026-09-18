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

- [x] LT-240: Decide the i18n message model — **ICU MessageFormat 1 adopted** (ADR 0030 s1/s4/s5/s6/s8/s9 + M24 amended) — reviewed ✓
  **Skill:** architect
  **Ruling (owner, 2026-09-19):** a message value is an **ICU MF1 pattern**; `t.<key>` is a string
  when the pattern takes no arguments and a function of its arguments when it does. Rulings that
  live nowhere else:
  1. **The client-render premise narrows deliberately.** ADR 0024 s1's "never client-renders" was
     about not shipping template+data twice and not re-rendering DOM subtrees. Substituting a text
     node from an already-parsed pattern is neither — same category as `basic-number`'s
     `Intl.NumberFormat` call. Recorded in ADR 0030 s6.
  2. **MF1, not MF2** — decisive reason: MF2 spells placeholders `{$token}` where MF1 spells them
     `{token}`, so MF2 would break LT-197's already-ruled pattern channel on day one; TMS tooling
     also speaks MF1 natively. The exit is kept open and *tested* (LT-253), since
     `@messageformat/icu-messageformat-1` + `messageformat@4` make the migration mechanical, and
     `messageformat@4` is itself the `Intl.MessageFormat` polyfill — so MF2 never waits on browsers.
  3. **Parse, don't compile; own the evaluator.** `@messageformat/parser` at build time;
     `@messageformat/core` is a **test oracle only**. One evaluator serves the server fold AND the
     client, so the two sides cannot disagree — the reason a third-party compiler was rejected.
  4. **What ships is the parsed AST**, not a pattern (would need a client parser) and not a compiled
     function (is code, cannot ride the JSON attribute, forces per-locale client bundles). Keeps one
     universal client bundle; evaluator inlined narrowed to the constructs each component uses.
  5. **Build-time diagnostics only for v3**; `t` stays `string | ((args) => string)` and authors must
     not rely on the wider type — per-key `.d.ts` precision is deferred and will tighten it.
  6. **Delete, don't preserve**, the per-category vocabulary: exotic variance has ternaries and
     `@if`/`@switch` on both surfaces.
  7. **A format migration is a sanctioned manifest rebaseline** (ADR 0030 s5) — sources,
     translations and hashes in one commit, so a meaning-preserving rewrite marks nothing stale.
  8. **The per-request seam is declared** (ADR 0030 s1 + M24): per-locale SSG pages are the
     docs-site path; locale is a parameter of the render boundary, and the CMS targets' per-request
     model must not be foreclosed.
  **Changed:** `adr/0030-internationalization-as-build-time-server-data.md` (s1, s2, s4, s5, s6, s8,
  s9, Context fact 3, Alternatives +8 entries, Consequences); `REQUIREMENTS.md` M24.
  **Handoffs:** new **LT-250** (build half), **LT-251** (deletion sweep, 86 refs / 25 files),
  **LT-252** (corpus + catalog migration, manifest rebaseline), **LT-253** (MF2 round-trip
  insurance). Reframed: **LT-218** (gate discharged; serializes the AST), **LT-219** (three census
  cases replace placeholder-preservation), **LT-220** (scope widened to the message model),
  **LT-249** (joins the `malformed` family). **LT-189 item 2 withdrawn** — TSRX008 retires in LT-251.

## P0 — TSX surface adoption (ADR 0032) — reviewed ✓ (closed 2026-09-18)

**LT-183, LT-202, LT-203, LT-204, LT-205, LT-206, LT-208/209, LT-210, LT-211** — all landed and
reviewed: the `.tsx` spike (verdict GO), the production merge (shared front-end modules, the dual
`.tsrx`+`.tsx` corpus with TSRX048, the `css` template tag), the strict per-element host profile
(`server/compiler/frontend/tsx/host-profile.d.ts`, taught in `server/compiler/HOST_PROFILE.md`),
the `server/compiler/` tree with `frontend/{tsrx,tsx}/` inside, the branded three-arm `boundary`
types plus the annotated `FactoryContext`/`FormFactoryContext` second parameter, the `@tsrx/core`
0.2.3 pin (TSRX020 retired; ADR 0033 drafted), and the stale arm removed end to end (the
`isPending` arrow idiom). LT-205's stale-arm asymmetry ruling is superseded as history by
LT-211's withdrawal. **What wave 4 and later inherit:** migrations author `.tsx` by default, extend
the strict `IntrinsicElements` table in the same commit, annotate a typed second context
parameter, and use the three-arm boundary — the authoring rules live in AGENTS.md,
`HOST_PROFILE.md` and ADR 0032; ADR 0033 stays Proposed with LT-214 parked alongside it
(style composition is a ROADMAP backlog item, likely 3.1).

**Decisions that live nowhere else:**
- **Packaging-time deferrals (LT-206) — deliberately NOT renamed with the tree:** the
  `check:tsrx`/`build:tsrx` script names, the `server/effects/tsrx.ts` filename, the
  `server/generated/tsrx/` output directory, `@tsrx/core` package names, and TSRX diagnostic
  codes. (LT-241 now schedules this as the packaging track; the list is restated there.)
- **Changelog verdict (2026-09-18): P0 owed CHANGELOG.md nothing.** The whole band touched
  `server/` (unpublished) and docs; `@tsrx/core` is a devDependency, so the pin bump is not
  integrator-visible.

## P1 — Tiered server evaluation (ADR 0029) — reviewed ✓ (closed 2026-09-06)

**LT-165, LT-185, LT-184, LT-180, LT-169** — all landed and reviewed: the eight ADR 0029 steps,
form-tokenbox's hydration regression fix, the severe `TSRX034` scoped per-expression,
library-contained connect failures reaching the build report, and the simulation driver inside
`build:docs`. Post-LT-190 census **20 Folded / 2 Simulated / 0 Static**; compile-warning baseline
**0**; simulation build-report baseline **0 unclassified**. (The Simulated tier is now S0
LT-239's grilling subject.)

**Review decisions that live nowhere else (2026-09-06).** The simulation pass renders each
component's authored demo HTML (`examples/**/<tag>.html`), not the server render function over
fixture args — the fixture args are a test artifact, the demo markup is what the docs serve. The
pass runs for one-shot builds only — one module cache per process makes a second load of the same
generated client unsound (ADR 0027 sub-design 10), so a watch session never sees the gate. It
captures every host `console.error`/`warn` during a load/render window, not only the library's
containment messages — the console carries no separating marker, and `CLASSIFIED_DIAGNOSTICS` is
the designed escape hatch.

## P2 — Internationalization follow-ups (ADR 0030)

- **LT-201** (adr-keeper) — done ✓. ADR 0030 amended in place (unpublished on v3): s1 gained the
  pages/fragments output split; s3 the full locale-precedence chain (own server arg > compose-graph
  inheritance > authored default > page locale; `lang` is config-only — the IDL guard makes it
  structurally un-exposable — materialized at connect, fixed for the connection); s4 the
  per-category key rules; s5 the census reachability rule.
- **LT-193** — reviewed ✓. LT-166's render cache and LT-175's locale containment removed (review
  caught the stale `RenderStats` re-export — bun test does not typecheck). Standing posture: no
  render cache; the registry's `declaresI18n` survives for compose-graph inheritance; simulated
  stage measured 60→61 ms (no regression).
- **LT-195** — reviewed ✓. Six surveyed accessibility strings route through `{t.key}`
  server-folded sites across five components; de carries real translations (pinned). Rulings on
  falsified premises: `t` in a reactive thunk is TSRX005 (client-only watch; no catalog ships) —
  superseded by the LT-197/LT-218 client-string channel; tokenbox's `Remove` exposed the
  reactive-list gate → LT-215. En-route fix: `i18n:sync`'s `""` placeholder resolved as EMPTY
  text; `i18nRecord` now falls back on empty overrides (pinned). Render fns throw without an
  i18n record (corpus-args `inlineI18n`).
- **LT-215** — done ✓ (Architect ruled; landed same day). Server-static expressions are admitted
  inside reactive-list `@for` bodies in BOTH front ends. The ruling (cited by `validateListBody`):
  the invariant is ADR 0017's slot-fill contract, and "statics only" was sufficient but not
  necessary — an expression whose free identifiers are all server-known folds identically into
  every item and bakes into the served `<template>` per render call; item-derived expressions
  stay rejected (per-item VALUE, no slot channel). `listTemplateLines` bakes admitted attrs/text
  as esc'd Parts. Diagnostic rewording → LT-189 item 7.
- **LT-196** — reviewed ✓. The translation census walks both directions: `TranslationGap['status']`
  gains `'orphaned'`; `i18n:sync` prunes orphans from catalog AND staleness manifest. Channel
  posture ratified: census records never fail the build (a catalog is data, not source).
  The LT-190 probe test injects catalogs (with the inverse walk live, a synthetic corpus against
  the real catalogs would report every committed key).
- **LT-198** — reviewed ✓. The four LT-174 review minors landed. **Ruling recorded (pinned by
  tests, so a reversal is not free): legacy root URLs (`/guide.html`, `/blog/<slug>`, …) 404 is
  ACCEPTED** — a serve.ts redirect map cannot reach the static host that actually serves the
  site, and the locale layout is unreleased, so no population of broken external links exists.
  `serve.test.ts`'s mirrored test server stays in lockstep with serve.ts's routes.
- **LT-217** — reviewed ✓ (Architect, 2026-09-18). The orphan walk checks DECLARATION before
  reachability: undeclared residue (a renamed key, a deleted component) reports and prunes in
  EVERY locale (de/lv/zh included — their category sets lack `few`); the wholesale protection
  for declared keys is unchanged. **Review:** approved — verified against the diff at 1b537c32
  and re-proven live on the committed catalogs (planted `stray.few` reported orphaned in de
  specifically, pruned by sync, `i18n/` byte-clean). Accepted nit: `pluralCategories` is
  computed per declared-category-key, not hoisted per locale as the task text sketched —
  build-time negligible. One finding filed: **a non-string (malformed) catalog value is silent
  in both the census and sync** (falsified en route) → LT-249.
- **LT-194** — reviewed ✓; defect fixed in review commit 27652642 (`class`/`id` stripped from
  forwarded args — they address the host, LT-090). The document-level page renderer
  (`server/effects/page-render.ts`) server-renders qualifying occurrences via parse5
  source-offset splicing; qualification is Folded + `declaresI18n` only (the lang-arg arm was
  withdrawn on basic-number emptiness evidence — page-rendering it would EMPTIFY authored text);
  LT-191's acceptance fixture is served at its home. `emit-server.ts` emits `argsFromAttrs`;
  `paramProps` sits on the IR; parse5 pinned ^7 NOT v8 (jsdom requires CJS).
- **LT-197** — done ✓ (ruled; owner concurred; ADR 0030 sub-design 9 amended in place).
  Client-side runtime strings ride a per-instance root `i18n` attribute: the compiler classifies
  `t.<key>` reads in client positions and serializes only those keys onto the root per render
  call (`i18nRecord(tag, lang)`) — locale stays build-time server data, one universal client
  bundle. Client-referenced keys only; the carrier-span idiom retires; `{placeholder}` patterns
  with `t.key({ … })` call syntax (s4 stage-2 pulled forward). Implementation: LT-218/219/220.

## P2b — Compiler partitioning & hardening (external review; re-scoped by the reflection)

- **LT-221** — done ✓ (commit 7a118afb). All five review §1 defects fixed TDD-first plus a sixth
  found en route (quoted class-map keys never extracted): the `offenders`-array truthiness bug,
  author-data interpolation now `jsString()`-escaped at all `emit-client.ts` sites (the
  source-injection payload emits inert; LT-234 supersedes with the shared kit), bracket access
  for non-identifier keys via `memberAccess()`, `resolveComposeRefs` idempotent (name-aware
  claimed check). Rulings: the `keyName === 'first'` arm is grammar asymmetry, not drift; the
  compose-in-`@pending` gap is unreachable (`singleRootOf` filters to elements).
- **LT-222** — done ✓. The dead surface deleted (every target grep/probe-verified before
  deletion). `class:`-prefix ruled and executed: silently wrong on BOTH spellings, so
  `classifyAttribute` rejects it outright (TSRX006; the emitter branch deleted) — wiring
  Svelte-style `class:x={thunk}` sugar remains an open feature decision (LT-235 agenda).
  **`style:x={…}` and `on:click={fn}` cousins still fall through as server attrs — flagged, not
  fixed.** Retired-spelling tombstones kept deliberately (they power live diagnostics; revisit at
  packaging). `serverKnown` computed once in `seedExtractionContext`.
- **LT-223** — done ✓ (one ruling reversed). `diagnostics.ts` strictly code-ordered with band
  comments; retirement treatment standardized to the lifecycle doc's keep-member form (TSRX020
  restored as kept, TSRX031's note expanded; TSRX004/013/043 left the union for tier.ts's named
  `RoutingSignalOrigin` — a diagnostic with those codes is now unrepresentable); `invalidSource`
  threads offsets (malformed `export const i18n` reports its line). Voice-check → LT-189 item 10.
- **LT-224** — done ✓ (commit 94dd786a). `front-end.ts` (1,799 lines) split into six flat modules
  (`module-scans`/`params`/`setup-extraction`/`template-output`/`validate-lowered`/
  `assemble-ir`); public surface unchanged; `readModuleDecls` rode assemble-ir (LT-235 may
  re-home). Goldens byte-identical.
- **LT-225** — done ✓ (commit 5db7be77). `emitServerModule`'s five closures lifted to module
  scope behind `EmitContext` (10 fields); `emitAsyncBoundary`/`emitCompose` split out; the
  ~600-line assembly tail diff-untouched via stable-collection destructuring. The
  context-passing pattern is the precedent the remaining splits follow.
- **LT-226** — reviewed ✓ (Architect, 2026-09-18; commit 94207592). `runEffects` (1,537 lines) →
  a ~60-line context builder + module-scope units behind `EffectsContext` (21 fields); the
  compose-`id` scan lifted as `validateComposeIds`; the lazy-text gate is one shared
  `emitLazyTextChildren` (the review's recorded drift was STALE — LT-115 had already converged
  both copies strict; one real convergence: the doubled per-child diagnostic now fires once).
  **Review:** approved — verified against the diff, not the handoff: the context's callables are
  AnalysisContext's own passed through (no new function members); both `emitLazyTextChildren`
  call sites carry the right label/selector/`addressHost`; the once-only diagnostic is
  STRUCTURAL (the second code path no longer exists, so the old double-fire cannot silently
  return — unpinned by a test, accepted on that basis). Goldens re-proven: regenerated the
  generated dir from source, `git diff` byte-clean. GOTCHA for all compiler tasks: a compiler
  crash in build-tsrx makes typecheck's `&&`-chained tsc silently not run — check the exit
  code, never grep for "error TS".

## P3 — Gate-wave residue

- **LT-216** — done ✓. TESTS.md's hand-maintained tree (missing 53 of 84 files) replaced by a
  directory-level skeleton plus the authoritative `find server/tests -name '*.test.ts' | sort`
  command; the count line is re-pinned with a date. `bun test --list` is not a real flag — it
  silently runs the suite.

## P7 — Backlog

- **LT-014** — retired as moot ✓ (architect, 2026-09-17; ADR 0032). The Volar span-table plugin's
  premise was `.tsrx`-everywhere authoring; `.tsx`-authored code gets editors through plain
  tsserver. **Re-open conditions (either):** `.tsrx` authoring resurges as a dominant surface; OR
  precise EDITOR feedback on authored `.tsx` is demanded — tsserver cannot do per-file programs,
  so the wide `host` overlay stays in editors until a per-file language-service projection exists.
