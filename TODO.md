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

**Next free task ID: LT-212.**

---

## P0 — TSX surface adoption (ADR 0032 — dual front end, `.tsx` primary, `.tsrx` retained)

**LT-183 closed 2026-09-17 — spike verdict GO, reviewed ✓ (architect).** Executed in one
session on `spike/tsx-surface` (`db0a0be5`): all four ported components render
**byte-identical** through the unmodified machinery (`git diff v3 -- server/tsrx` is
empty), the corpus's two Simulated-tier components match through the unmodified realm, a
deliberate compose type error reports on the authored parent, and both hard control-flow
shapes work (`boundary({ ok, pending, err })` for the async boundary). Record:
`spike/tsx/FINDINGS.md`; parity suite `server/tests/tsrx-tsx/parity.test.ts` (26/26).
ADR 0032 Accepted with the **owner's dual-front-end amendment (2026-09-17)**: `.tsx` is
the primary authored surface, `.tsrx` stays supported (statement-context control flow is
its ergonomic edge; the forced 22-component codemod is cancelled — it becomes an optional
consolidation pass), and the parity suite + shared front-end modules are the anti-drift
contract. Wave 4 is unblocked once LT-202 lands the front end in the build.

- [x] LT-202: Production merge — land the `.tsx` front end in the v3 build as the second first-class surface (ADR 0032). — reviewed ✓ (architect, 2026-09-17)
  **Skill:** le-truc-dev
  **Review (architect, 2026-09-17):** Approved. The shared extraction is the anti-drift
  contract made structural — `front-end.ts`/`lower-shared.ts` are genuinely
  front-end-neutral (loose `TsrxNode` type only, no parser values), the `Lowering` seam +
  `SurfaceWording` + dispatch hooks put exactly the surface-specific decisions (child node
  types, control-flow expression shapes) in each front end, and `compileFromIR` leaves
  `compileComponent`/`compileComponentTsx` differing only in parser. TSRX048 fires before
  pass 2, names both files, and drops both (the in-memory-FileInfo duplicate test that
  avoids racing the corpus glob is the right call). The four-arm boundary keeps `.tsrx`
  byte-identical by construction (`staleChildren: null`), the `.get()` probe distinguishing
  nil from stale is the minimal server state machine, and parity pins the nil-arm render +
  the `stale:` client handler. Gates re-run at review: typecheck 0, `bun test server/tests`
  1548/0 (3 documented pre-existing unhandled errors — now LT-207), parity 26/26,
  `check:tsrx` 0 / baseline 0 / census 20/2/0.
  **Skill:** le-truc-dev
  **Done (2026-09-17):** all five items landed, plus the owner's two surface folds recorded below.
  1. Shared extraction: `server/tsrx/front-end.ts` (setup-extraction loop via
     `extractSetup`, params contract via `extractParams`, context seeding, template-output
     resolution, the post-lowering validation tail, and the verbatim module scans —
     malformed-selector/import-mismatch/deferred-collector — plus IR assembly) and
     `server/tsrx/lower-shared.ts` (condition validation, element/compose lowering, the
     expression-child lift rule, positional reactivity, and a `lowerChildrenSkeleton` whose
     hooks carry each surface's dispatch). `server/tsrx/pipeline.ts` shares the
     post-front-end assembly, so `compileComponent`/`compileComponentTsx` are thin shells
     differing only in the parser. The `.tsx` front end dropped ~1,040 lines (3,335 → ~2,290
     incl. the production host profile); `.tsrx` emitted bytes and diagnostics are unchanged
     (goldens + 1548-test suite green).
  2. Dual corpus: `compileTsrxCorpus` dispatches per extension; watch effect, `build-tsrx`,
     and `check-tsrx` glob both extensions. **TSRX048** (new, error severity, tier 1
     Prevented): a tag two corpus sources declare fails the run naming every file, before
     pass 2. Pinned by `server/tests/tsrx/dual-corpus.test.ts` (a `.tsx` file compiles
     through the runner end to end; a synthetic duplicate names both files).
  3. `imports.ts`: `parseComposeImports` accepts `.tsrx` AND `.tsx` (cross-surface compose
     falls out of the path-keyed registry); `parsePlainImports` excludes both — the spike's
     local-name-overlap workaround deleted (FINDINGS fact 7's production shape).
  4. FINDINGS fact 6 recorded where it lives now: `lower-tsx.ts`'s IIFE recognition is
     shape-based, documented on `asIife`/`lowerSwitchIife`.
  **Folded in, same session (owner directives, 2026-09-17):** `boundary({ ok, nil, err,
  stale? })` — the four Task-state arms, `stale` optional with `watch()`'s own fallback
  (`TryIR.staleChildren`, null on `.tsrx` so its bytes are unchanged; new server state
  machine distinguishes nil from stale via the `.get()` probe; the single client `watch()`
  gains the `stale` handler) — and the `css` template tag (`<style>{css`…`}</style>`,
  editor CSS highlighting; bare template literal still accepted). The `.tsrx` stale-arm
  spelling is LT-205 (dual-contract debt). Parity 26/26 incl. a four-arm render + stale
  handler pin.
  **Also fixed here (pre-existing, found by the verification gates):** the
  "single destructured args" check had been dead since 4952f586 (see NOTES.md); and
  `check:tsrx` was broken at HEAD — `pluralCategories()` rejected the `undefined` its own
  doc promised cardinal — 6 tsc errors in basic-pluralize's generated server module.
  **Verification:** parity 26/26; `bun test server/tests` 1548 pass / 0 fail (3 unhandled
  inter-test errors pre-exist on the clean base — NOTES.md); `bun run typecheck` exit 0;
  `check:tsrx` exit 0, warning baseline 0, tier census 20/2/0, translation census 0 gaps;
  `build:docs` green (simulation pass 2/8/20 unchanged). **Handoffs:** TSRX048 message copy
  → Tech Writer (draft in `diagnostics.ts`); boundary nil/stale diagnostic wordings ride
  the same review.

- [x] LT-203: Harden the `.tsx` host profile — strict per-element typing, the `host` ambient, and the compose `'truc:pass'` convention (ADR 0032 s3). — reviewed ✓ (architect, 2026-09-17)
  **Skill:** le-truc-dev
  **Review (architect, 2026-09-17):** Approved. The strict table is the right shape of
  strict: per-element entries name the corpus's real light-DOM surface (thunk overloads,
  `class`/`for` with no React aliases, the `data-*` pattern index), and keeping
  `truc:pass` OUT of `CommonLightDom` — only pass targets declare one, keyed per element —
  is what makes excess pass keys a tsc error instead of silently accepted vocabulary. The
  `host` ambient's widening is correctly scoped to the authored-source stand-in with the
  generated client keeping precise types, the two-profiles-never-share-a-program rule is
  enforced in both tsconfigs and stated in both headers, and the `css`/`boundary` ambients
  encode compiler semantics (`never[]` substitutions so tsc refuses what the compiler
  refuses). The same-commit table-extension rule for wave 4 is stated in the profile
  header where migrations will meet it.
  **Owner precision ruling (2026-09-17, post-review):** the `host` ambient's
  `Record<string, any>` and the `boundary` arms' `unknown` are imprecise where the
  information is known — `host` is the lone `any`-hole in an otherwise precise profile
  (`first`/`all` infer through selector literals; args flow through real parameter
  types). Follow-ups LT-208 (boundary arms — cheap, available in the shared profile) and
  LT-209 (precise per-file `host`) carry the fix; the wide `host` stands until LT-209
  lands.
  **Skill:** le-truc-dev
  **Done (2026-09-17):** the profile moved from the spike's stand-in to
  `server/tsrx-tsx/host-profile.d.ts` and hardened.
  1. **Strict per-element `IntrinsicElements`:** every entry names its light-DOM
     attributes — `Reactive<T>` thunk overloads, `class`/`for` (no `className`/`htmlFor`
     entries), `data-*` via a pattern index signature, the corpus's event vocabulary, and
     `truc:case`/`truc:case-type` as compiler-consumed common vocabulary. `truc:pass` is
     deliberately NOT in the common set: only pass targets declare one, keyed per element
     (`form-listbox.filter`, `basic-number.value`) so excess pass keys are tsc errors.
     Component tags carry their real server args (basic-counter/pluralize/number,
     form-combobox/listbox, sync-el, async-el); wave-4 migrations extend the table in the
     same commit (rule stated in the profile header). The spike tsconfigs now include the
     production profile; the root tsconfig excludes it (the two ambient profiles — this
     and `server/tsrx/globals.d.ts` — declare the same global names and must never share
     a program).
  2. **`host` ambient:** `FormAssociatedElement & Record<string, any>`, now documented as
     the authored-source stand-in whose wider form surface exists precisely so
     `host.setCustomValidity(…)` and friends type-check; the generated client keeps the
     precise per-component types.
  3. **Compose convention on the corpus:** `'truc:pass'?: { filter?: () => string }` added
     to `FormListboxProps` and `'truc:pass'?: { value?: () => number }` to
     `BasicNumberProps` (the corpus's composed children that receive pass — combobox,
     gauge, and module-list's basic-button is a hand-written twin, out of scope). Fixture
     form-listbox already declared it; the `.tsrx` twins now match.
  **Also:** the profile carries the owner's folds — the four-arm `boundary` and the `css`
  template tag ambients (see LT-202).
  **Verification:** `bunx tsc -p spike/tsx/tsconfig.json` exit 0 (six fixtures under
  `--strict --jsx preserve` against the strict table); positive probe exit 0;
  `tsconfig.probe-neg.json` exit 2 naming `Property 'truc:pass' does not exist`;
  `tsconfig.neg.json` exit 2 with TS2322 on the authored parent (compose type-flow);
  `bun test server/tests` green (the two props-type additions change only generated type
  text — tier census and warning baseline unchanged).

- [x] LT-206: Rename the compiler tree to match the dual-front-end architecture — `server/tsrx/` → `server/compiler/` with `frontend/tsrx/` and `frontend/tsx/` inside (architect ruling, 2026-09-17). **Land before wave 4's first migration and before LT-204's `LE_TRUC_COMPILER.md` rewrite.** — done ✓ (internal-only; awaiting review)
  **Skill:** le-truc-dev
  **Context:** Post-ADR 0032 the directory names lie. `server/tsrx/` holds the MACHINERY —
  analysis, emitters, tiering, sim, plus since LT-202 the shared front-end modules
  (`front-end.ts`, `lower-shared.ts`, `pipeline.ts`) that serve BOTH surfaces — and
  `server/tsrx-tsx/` reads as a variant of tsrx rather than the co-equal front end it is.
  ADR 0032's own vocabulary is "one machinery layer, two front ends, one registry"; the
  tree should say so. Target shape:
  - `server/compiler/` — the machinery, including the front-end-neutral shared modules
    (they import no parser values by design, so they belong at the machinery level, not
    under a surface).
  - `server/compiler/frontend/tsrx/` — the `.tsrx` front end: `compiler.ts`,
    `lower-template.ts`, `globals.d.ts`, `index.ts` (from `server/tsrx/`).
  - `server/compiler/frontend/tsx/` — the `.tsx` front end: `compiler-tsx.ts`,
    `lower-tsx.ts`, `to-estree.ts`, `host-profile.d.ts`, `index.ts` (from
    `server/tsrx-tsx/`).
  One seam is NOT mechanical: `pipeline.ts` imports `collectComposeElements` from
  `./compiler` — a pure `ComponentIR` walk sitting in the `.tsrx` front end. Move it to a
  shared leaf (e.g. beside `walk.ts`) so the machinery does not depend on a front end.
  Everything else is `git mv` + import-specifier surgery. External importers to repoint:
  the ten `scripts/*.ts` consumers, `server/effects/{tsrx,simulate,i18n}.ts`,
  `server/tests/helpers/generated-tsrx.ts`, `tsconfig.json` (the host-profile exclusion —
  the two ambient profiles still never share a program), `spike/tsx/tsconfig*.json`.
  Tests mirror the source: `server/tests/tsrx/` → `server/tests/compiler/`,
  `server/tests/tsrx-tsx/parity.test.ts` → `server/tests/compiler/tsx/parity.test.ts`.
  **Deliberately OUT of scope** (recorded so nobody "finishes" them later): the
  `package.json` script names (`check:tsrx`, `build:tsrx` — project lexemes cited across
  every task and ADR; revisit at packaging), the `server/effects/tsrx.ts` filename, the
  `server/generated/tsrx/` output directory (authored example imports point at it; wave 4
  rewrites those files anyway — rule on it at packaging), `@tsrx/core` package names, and
  TSRX diagnostic codes. ADRs keep their paths as written — they quote the tree at
  decision time.
  **Verification:** the rename compiles and passes IS the proof — goldens byte-identical
  (no content change beyond import specifiers), `bun test server/tests` green,
  `bun run typecheck` exit 0, `check:tsrx` baseline 0 / census 20/2/0, parity 26/26,
  `build:docs` green, `check:links` green (docs move with the tree: TODO.md header,
  TSRX-HOST-PROFILE.md, server/SERVER.md, server/TESTS.md, LE_TRUC_COMPILER.md path
  references — mechanical sed only; the content rewrite stays LT-204), and the browser
  purity gate (its entry point moves to `server/compiler/frontend/tsrx/index.ts`).
  **Done (2026-09-17):** the tree moved exactly as ruled — 107 `git mv` renames, machinery
  (analysis, emitters, tiering, sim, the front-end-neutral `front-end.ts`/`lower-shared.ts`/
  `pipeline.ts`) at `server/compiler/`, the `.tsrx` front end (`compiler.ts`, `lower-template.ts`,
  `globals.d.ts`, `index.ts`) under `frontend/tsrx/`, the `.tsx` front end under
  `frontend/tsx/`, and `LE_TRUC_COMPILER.md` at `server/compiler/` (LT-204's rewrite target).
  The one ruled seam landed in `walk.ts`: `collectComposeElements` moved beside `collectAttrs`
  (same shape — a collect pass over the one structural visitor), so `pipeline.ts` imports
  `./walk` and the machinery no longer depends on a front end; the `.tsrx` index re-exports it
  from the new home. `smoke.ts` stays at the machinery level and imports `compileSource`
  through the front-end index; its hardcoded `runtimeImport` and ROOT depth followed the move.
  The emitted-runtime specifier changed exactly once — `pipeline.ts`'s
  `runtimeImport: '../../compiler/runtime'` (generated modules live at the unchanged
  `server/generated/tsrx/`, two levels above `server/compiler/`) — and the one test pinning
  that specifier (`le-truc-imports.test.ts`) updated with it; smoke's copy likewise. All other
  surgery was import specifiers and comment path references (mechanical, ordered
  most-specific-first over tracked files, ADRs and historical records excluded). External
  importers repointed as listed plus `tsconfig.typedoc.json`'s comment. Tests mirror the
  source; parity moved to `server/tests/compiler/tsx/` with its snapshot (bun snapshots travel
  with the file). Deliberately-out-of-scope items all untouched: script names, the effects
  filename, the generated output directory, `@tsrx/core`, TSRX codes. Two ADR *links*
  (0029, 0030) pointing at the moved `LE_TRUC_COMPILER.md` were repointed — the only ADR
  edits; prose path quotations stay as written per the ruling.
  **Verification:** all gates re-run and green — `bun run typecheck` exit 0; `bun test
  server/tests` 1548 pass / 0 fail (1 unhandled inter-test error, falsified pre-existing at
  HEAD via a throwaway worktree — see NOTES.md for its tier-corpus face); parity 26/26;
  `check:tsrx` exit 0, warning baseline 0, tier census 20/2/0, translation census 0 gaps;
  `build:docs` green (simulation pass 2/8/20 unchanged); `check:links` 387 green; browser
  purity gate green against the moved entry (incl. the byte-identical-artifacts pin); all five
  client goldens + all three bun snapshot files renamed with 0 content lines (byte-identical);
  spike tsconfigs re-checked (main exit 0, both negative probes exit 2 as designed).

- [x] LT-204: Docs and requirements round for the dual front end (ADR 0032 follow-up f). **The REQUIREMENTS.md/ARCHITECTURE.md/CONTEXT.md drafts landed 2026-09-17 (architect) — review them, don't re-derive them; `LE_TRUC_COMPILER.md` waits for LT-206's new paths.** — done ✓ (docs round + mechanical biome sweep)
  **Skill:** tech-writer (architect co-owns REQUIREMENTS.md/ARCHITECTURE.md touchpoints)
  **Context:** ADR 0032 changes the authoring story; the documentation follows.
  **Architect drafts landed (2026-09-17), tech-writer reviews and owns final copy:**
  REQUIREMENTS.md — the v3 success criterion, both persona bullets, M17 (dual surface,
  `.tsx` default), M21 (the compose `'truc:pass'` args-key convention), M25 and the type
  safety NFR (emit-then-check for generated modules and `.tsrx` sources; direct tsc
  checking for `.tsx`), §5's compiler constraint (two front ends, two parsers), §6
  dependencies (`typescript` joins `@tsrx/core`). ARCHITECTURE.md — the intro paragraph,
  a new "Authoring Surfaces" section before Server Evaluation Tiers, and the tier
  section's surface-neutral wording. CONTEXT.md — **Authored Surface**, **Front End**, and
  **Machinery** entries (ADR 0032's split vocabulary).
  **Still tech-writer's to draft:**
  1. `TSRX-HOST-PROFILE.md` becomes the **dual host profile**: `.tsx` primary (module
     shape, expression control flow, `boundary()`, the `css` template tag, no shorthand,
     the strict `IntrinsicElements` table at
     `server/compiler/frontend/tsx/host-profile.d.ts` as the authoritative light-DOM
     contract — wave-4 migrations extend it in the same commit) with the `.tsrx` profile
     retained as-is.
  2. `AGENTS.md` gains the dual-surface facts (the header's "Authoring or reviewing a
     `.tsrx` component?" pointer becomes surface-aware).
  3. `server/compiler/LE_TRUC_COMPILER.md` (re-homed by LT-206) is stale at HEAD: its module
     map, pipeline diagram, and §1 boundary section
     predate LT-202 — missing the shared front-end modules, the second front end, the
     four-arm `boundary`, the `css` tag, and TSRX048. Also fold in two recorded facts
     with no other home: the `check:tsrx` harness-types contract (a harness signature
     narrower than what pruning/splice emits is caught only by the gate — no unit test
     sits between them; LT-202 NOTES residue) and the wave-4 authoring rule (default
     `.tsx`; `.tsrx` where statement-context control flow argues otherwise).
  4. **LT-014 (Volar plugin) retires as moot** — already recorded in this file's P7;
     verify the re-open condition (`.tsrx` authoring resurgence) is stated there and
     mirror one line wherever editor tooling is discussed.
  5. A biome formatting-only sweep of `server/` (the lint script gates `./src` only; the
     spike merge left drift, e.g. `to-estree.ts` fails `biome check` format at tip) —
     mechanical, rides this docs round (LT-202 NOTES residue).
  **Verification:** `bun run check:links` green; Tech Writer owns final copy.
  **Changed:** reviewed all three architect drafts — accurate against ADR 0032 and the
  landed tree; one surgical fix, REQUIREMENTS.md M24 ("declared inline in the `.tsrx`" →
  "in the authored source, either surface"; architect co-owner may reword). Drafted the
  dual `TSRX-HOST-PROFILE.md` (retitled framing + new "Two surfaces, one profile" and
  "The `.tsx` surface" sections; styles/data-account/tier/i18n/imports sections
  surface-neutralized; the stale "Folded tier is rare / fifteen of twenty-two" bullet
  corrected to the live 20/22 census; `.tsrx`-only sections marked). `AGENTS.md`: header
  pointer now surface-aware + two dual-surface entries (TSRX048 one-tag-one-source; the
  boundary/css/shorthand asymmetries). `LE_TRUC_COMPILER.md` retitled "The Le Truc
  Component Compiler": §1 rewritten around the two front ends + both parser boundaries +
  the wave-4 default rule; §2 diagram redrawn (dual front ends over the shared bands);
  §3 module map rebuilt at the LT-206 paths with `front-end.ts`/`lower-shared.ts`/
  `pipeline.ts`/`tier.ts`/`ast-utils.ts` rows and the never-share-a-program note; §4
  four-arm `try` IR + cross-surface compose; §5 census corrected to 20/2/0 and the stale
  Static-tier component claims rewritten (those components are Folded — their
  unanswerable reads never reach rendered sites); §6 gains the direct-`.tsx` checking
  path, the harness-types contract ("no unit test between the emitter and the gate"),
  TSRX048's corpus-level family, and the LT-014 mirror line; §7 dual glob + TSRX048
  timing + parity suite + snapshot-regen path fix; §8 one-machinery invariant + pin
  isolation scoped per front end. LT-014 re-open condition verified in P7; mirrors live
  in the profile's imports section and the compiler doc's §6.
  **Biome sweep:** `biome check --write server/` fixed 23 files (format +
  organizeImports only — verified by diff scan); `biome check server/` now clean.
  One incident, caught and reverted: `noUnusedImports` is project-aware in Biome 2.x,
  so `--write` crossed the `server/` path scope and stripped two imports from
  `spike/tsx/form/combobox/form-combobox.tsx` plus a suppression comment into
  `async-el.tsx` — reverted (`git restore`); parity pins unaffected.
  **Verification (run):** `bun test server/tests` 1548 pass / 0 fail (1 pre-existing
  unhandled inter-test error, LT-207); `bun run typecheck` exit 0; `check:tsrx` exit 0,
  warning baseline 0, tier census 20/2/0; `biome check server/` clean; `check:links` 387
  green.
  **Folded in, same day (owner ruling, 2026-09-17):** the profile doc is no longer
  TSRX-named — `TSRX-HOST-PROFILE.md` → `server/compiler/HOST_PROFILE.md`, retitled
  "The Le Truc Host Profile", beside `LE_TRUC_COMPILER.md`, where its strict-ambient
  twins (`frontend/tsx/host-profile.d.ts`, `frontend/tsrx/globals.d.ts`) already live.
  Repointed: AGENTS.md's header pointer, ARCHITECTURE.md's intro, REQUIREMENTS.md M21,
  this file's header orientation + LT-208's task text, the compiler doc (sibling-form
  references), the profile's own relative links (`../../` from its new depth), the
  ADR 0024/0030 links (labels + hrefs), `docs-src/pages/styling.md` (pointer moved out
  of "the repo root"; its `.tsrx`-only callout reworded surface-neutral), and the short
  citations in comments across `server/compiler/`, `server/tests/compiler/`, and three
  `.tsrx` examples. ADR prose quotations and spike-era records (TSX_SPIKE.md, this
  file's historical entries) keep the old name per the LT-206 precedent. One enabling
  edit rode the ruling: `scripts/check-doc-links.ts`'s scan list gains
  `server/compiler/*.md` — the relocation had moved the profile's 10 links out of the
  gate's scope (adr/ + three root docs only), making its green vacuous for the moved
  file; count 387 → 397.

- [x] LT-205: A `.tsrx` spelling for the four-state async boundary (the dual-contract debt LT-202's `boundary({ ok, nil, err, stale })` created). — ruled ✓ (architect, 2026-09-17): option (c), the asymmetry stands
  **Skill:** architect (rules the grammar question) with le-truc-dev (implements against the pin)
  **Context:** The owner folded the four-arm boundary into the `.tsx` front end
  (2026-09-17): `nil` (no value yet) and `stale` (re-fetching with retained value) are
  differentiable arms, `stale` optional with `watch()`'s own fallback. The machinery is
  ready — `TryIR.staleChildren` exists, both emitters and the analysis consume it, and
  the `.tsrx` side passes `null` (byte-identical three-arm output, pinned by its
  goldens). What is missing is the GRAMMAR: the pinned `@tsrx/core` 0.1.63 has no stale
  arm (a `@stale` directive would need an upstream change and the ADR 0023 sub-design 2
  pin-upgrade review). Weigh: (a) an upstream `@stale` arm (pin upgrade, the honest dual
  answer), (b) an ambient call INSIDE `.tsrx` templates reusing the `.tsx` lowering
  (no pin change, but two spellings on one surface), or (c) documenting the asymmetry as
  permanent — the dual ruling's escape valve (`.tsx` where the grammar lags). Outcome
  updates ADR 0032 s6's "every new front-end capability is paid for in both surfaces"
  with whichever answer is chosen; until then the asymmetry is recorded in
  `TryIR`/`lowerBoundaryCall` docs and the profile's `boundary` ambient.
  **Acceptance (once ruled):** the chosen spelling compiles through the unmodified
  machinery to the same four-arm IR; parity's four-arm pin extends to the `.tsrx` twin;
  goldens otherwise unchanged.
  **Ruling (architect, 2026-09-17): option (c).** Upstream has moved past the pin —
  0.1.64–0.1.71, then a 0.2 minor line (0.2.0 2026-09-15 → 0.2.3 2026-09-17) — and NO
  version carries a stale arm: the try directive is block/`@catch`/`@pending` in the
  0.2.3 AST vocabulary and in the draft specification alike; the only "stale" strings
  in the package are tokenizer-internals comments. So (a) is dead — there is nothing to
  upgrade to — and the owner rejects (b) on principle: Le Truc introduces no construct
  unavailable to other TSRX hosts. `boundary({ ok, nil, err, stale? })` stays
  `.tsx`-only vocabulary for as long as upstream's grammar lags; a `.tsrx` author who
  needs the stale arm authors `.tsx` or accepts the three-arm fallback (`watch()`'s
  own). ADR 0032 s6 records the exception mechanism (a capability lands in one surface
  only when the other's grammar cannot express it; re-opens when upstream grows the
  construct, caught at the next pin-upgrade review) and notes the pin stays at 0.1.63 —
  nothing in 0.1.64–0.2.3 bears on this gap, and 0.2.x's headline (scoped styles/theme
  machinery) cuts against the host's unscoped-light-DOM profile. Nothing to implement:
  no code, goldens, or parity pins change.

- [x] LT-208: Type the `boundary` arms precisely — three arms, branded `JSX.Element`, `err: Error` (owner precision ruling 2026-09-17; stale arm withdrawn by owner ruling 2026-09-18, see LT-211). — reviewed ✓ (Architect, 2026-09-18)
  **Review:** Approved. Branded Element + contextual `Error` are the right mechanisms and the rejected alternatives are recorded so they stay rejected; the `class: Reactive<string | null>` widening is correct (bindAttribute's nil path removes the attribute). The tsc gate (`typecheck.test.ts`) makes the spike probes standing CI instead of manual.
  **Skill:** le-truc-dev
  **Context:** `host-profile.d.ts` declares `boundary(arms: { ok: unknown; nil: unknown;
  err: (error: any) => unknown; stale?: unknown })` while the compiler REQUIRES every arm
  to be a single-root JSX element (`lower-tsx.ts`'s `singleRootOf` checks are the
  semantics) and ok/nil/stale to be element expressions — only `err` is an arrow. Two
  mechanisms considered do NOT meet the acceptance below, recorded so they are not
  retried: a generic `boundary<T>(arms: { ok: T; … })` cannot reject a non-element arm
  (divergent inference candidates union — `ok: <div/>` + `nil: "oops"` infers
  `T = Element | string`, no error anywhere), and a bare `interface Element {}` cannot
  either (the empty interface accepts any non-nullish value, so `ok: "hi"` passes). The
  shape that does:
  - `interface Element { readonly $$leTrucJsx: 'element' }` in the profile's `JSX`
    namespace. A JSX element expression's type IS `JSX.Element`, so the brand is
    satisfied by construction; a string, number, or function arm fails it.
  - `declare function boundary(arms: { ok: JSX.Element; nil: JSX.Element;
    err: (error: Error) => JSX.Element }): JSX.Element` — `err`'s parameter
    contextually `Error`, never `any`/`unknown`: cause-effect's `match()` guarantees the
    delivered value is an `Error` (non-Errors are wrapped before dispatch —
    `@zeix/cause-effect` 1.5.2 `src/nodes/effect.ts:222,239`), so an unannotated
    `(e) => <p>{e.message}</p>` type-checks and an explicit `(e: string)` is a tsc
    error on the authored file. The `T`-awareness `watch()` gets by inference has no
    channel here — `boundary()` takes no source argument (the compiler discovers the
    signal from the ok arm's lazy child, `analysis/effects.ts:1129`) and the arms are
    elements, not handlers; the value reads inside arms (`{data}`) are already precisely
    typed by ordinary setup inference.
  - No `stale` arm: the owner withdrew the four-arm boundary on 2026-09-18 (LT-211
    carries the machinery removal); this ambient lands three-arm.
  Update the profile header's `boundary` doc and `server/compiler/HOST_PROFILE.md`'s
  `.tsx` control-flow section to match.
  **Acceptance:** the six spike fixtures compile clean under the typed ambient;
  `tsconfig.neg.json`-style probes: a string in an element-arm position and an `err`
  arrow annotated `(e: string)` reading `e.message` are tsc errors at native positions
  on the authored file; parity and `bun test server/tests` green (type text only). No
  new TSRX code — the channel is TypeScript, tier 1 Prevented (ADR 0028 s1 accounting).

- [x] LT-209: Type the authored `.tsx` factory context precisely — a second, author-annotated `FactoryContext`/`FormFactoryContext` parameter (owner ruling, 2026-09-18). **Land before or at the very start of wave 4 (LT-095), so migrated authors get feedback from day one.** — reviewed ✓ (Architect, 2026-09-18)
  **Review:** Approved. The value-parameter realization is sound (generated clients byte-identical — snapshots untouched), the tsNode duck-type read keeps `typescript` out of the shared front end (ADR 0025 s6), and the P-drift pins are exactly the acceptance. Deviations ruled: `isPending` imported-not-ambient and the `.tsrx`-keeps-ambients asymmetry both stand (see NOTES + ADR 0032 s3). Mechanism accepts the param on `.tsrx` sources too — harmless permissiveness; the convention docs say `.tsx` and the raw `.tsrx` editor view cannot resolve the annotation type, so no doc change needed.
  **Skill:** le-truc-dev
  **Context:** The owner rejected both ambient-based mechanisms (compiler-emitted
  `<tag>.host.d.ts` imports; per-file checker programs): authored files already declare
  their own props type and `HTMLElementTagNameMap` augmentation (every spike fixture
  does), and importing generated artifacts for typing is unwanted — the generated client
  "may not exist yet" at authoring time. Global ambients cannot see a file's type
  parameters (a `declare const` cannot reference `<P>`), so the realization of "the
  context uses `FormFactoryContext<P>`" is a VALUE parameter: the component function
  takes a second, destructured, author-annotated context —
  ```tsx
  export function FormCombobox(
  	{ name, label, options, … }: FormComboboxArgs,
  	{ host, first, expose }: FormFactoryContext<FormComboboxProps>,
  ) { … }
  ```
  Both types are already exported (`index.ts:139`). Form-associated components annotate
  `FormFactoryContext<P>` (host: `FormAssociatedElement & P`), plain ones
  `FactoryContext<P>` (host: `HTMLElement & P`) — annotating the wrong one is a compiler
  check: `config.formAssociated` and the annotation's type name are both AST-visible
  (new TSRX diagnostic, channel compiler, tier 1 Prevented; Tech Writer owns the copy).
  The precision is bigger than `host` alone: `watch`/`expose`/`pass`/`on` become
  P-precise (prop-key overloads work), and the P-drift check is FREE — `expose({
  value: asNumber() })` against `Initializers<P>` is an excess-property/assignability
  tsc error when P misses or mistypes the prop, so no compiler check is needed for that
  (channel TypeScript, tier 1).
  1. `extractParams` (`front-end.ts:551`) admits the second param: an ObjectPattern
     whose bound names must be factory-context vocabulary (unknown name → the new TSRX
     diagnostic). The annotation is type-only and erased — `parsePlainImports` must
     admit `import type { FactoryContext, FormFactoryContext } from '@zeix/le-truc'`
     without it reaching emitted imports. The generated factory destructures the SAME
     vocabulary names, so body lowering is unchanged.
  2. Convention (stated in the profile header as the wave-4 rule): destructure every
     factory name you use from the context param; the global ambients remain for the
     migration period (per-file destructures shadow them at function scope). The fate
     of the wide `host` ambient after migration is EXPLICITLY DEFERRED (owner,
     2026-09-18: "we'll see as soon as we have a decent solution") — this task is what
     makes that question concrete.
  3. The six spike fixtures adopt the convention (mechanical). `.tsrx` keeps
     `globals.d.ts` ambients (no parameter grammar; precision stays emit-then-check per
     REQUIREMENTS M25) — document the asymmetry as designed.
  4. Settlements from the owner's 2026-09-18 follow-ups (do not re-open at
     implementation): `i18n` stays a member of the ARGS destructure, not the context —
     the generated client never receives i18n at all (it is server-render-time data;
     the client factory has zero i18n today), so the context parameter structurally
     cannot carry it, and the ambient `i18n: I18n` annotation stays mandatory to
     destructure it (destructuring it from an args type without the member is already
     a tsc error). There are NO silent type fallbacks: unannotated args or context
     params are implicit-`any` hard errors under the strict tsconfigs both surfaces
     check under (channel TypeScript, tier 1 — no TSRX code needed); omitting the
     context param entirely is the ambient form and stays legal until the deferred
     ambient retirement (item 2). An author hand-writing
     `FactoryContext<Record<string, any>>` recreates the hole deliberately — legal TS,
     out of compiler jurisdiction (convention and review, not a diagnostic).
  5. Docs: `HOST_PROFILE.md`'s module-shape / "Types and editors" sections rewritten
     around the param (the `Record<string, any>` stand-in paragraph retires); ADR 0032
     s3 amendment via adr-keeper — context-by-annotated-parameter replaces the
     authored-source ambient stand-in for `.tsx`; AGENTS.md gains the convention.
  **Acceptance:** a typo'd `host.cout` in an authored fixture is a tsc error at native
  position in the ORDINARY tsconfig (no per-file programs, no generated-import);
  `host.value = ''` checks against `Signal<string>`-backed props and
  `host.setCustomValidity(…)` works on form components; a P member missing or mistyped
  against `expose()` is a tsc error; a `formAssociated` component annotating plain
  `FactoryContext` (or the reverse) is the new TSRX diagnostic; all six fixtures and
  all gates green; editors see full precision with no tsserver changes.

- [x] LT-211: Remove the boundary's `stale` arm end-to-end and teach the `isPending` idiom (owner ruling, 2026-09-18). — reviewed ✓ (Architect, 2026-09-18)
  **Review:** Approved with one review fix: the isPending binding scan in `emit-server.ts` read only `lines`/setup/`exposeText`, but the ROOT element's folded attributes are assembled into `rootParts` and pushed into the module body after the scan — a root `class={() => ({ dimmed: isPending(data) })}` emitted an unbound `isPending` reference (TS2304 under check:tsrx). Scan extended to rootParts expressions; regression pin added to parity.test.ts. The `.tsrx` `@if` spelling in this task's text cannot exist (`validateCondition` diagnoses signal conditions by design) — the arrow-thunk attribute is the idiom on both surfaces, taught in HOST_PROFILE.md; ADR 0032 s6's asymmetry dissolved as the amended paragraph records.
  **Skill:** le-truc-dev
  **Context:** The owner withdrew the four-arm boundary: the client never re-renders arm
  content — it toggles `hidden`/`disabled` on server-rendered arms — so a stale arm
  whose only client-side update is its own textContent refresh has no place on a
  server-evaluated construct. At build time a task is resolved (ok), rejected (err), or
  unsettled (nil); "re-fetching with a retained value" exists only once a source updates
  on the client, and the idiom for that is a reactive `isPending` read beside the
  boundary, not a fourth arm: `class={ isPending(signal) ? 'dimmed' : null }` (.tsx) /
  `@if (isPending(signal)) { … }` (.tsrx). This supersedes the four-arm fold-in of
  LT-202 and evaporates the ADR 0032 s6 stale-arm asymmetry that LT-205 ruled on (that
  ruling stands as history; no upstream `@stale` will ever be needed). Note the latent
  defects this removes before they could bite: the emitted `stale: value => …`
  handler (emit-client.ts:606-621) assumes a retained value that cause-effect never
  passes (type AND runtime — `stale?: () => …`, `out = stale()`,
  `effect.ts:34,236`), so the first four-arm generated client would fail typecheck and
  a set `staleText` would render the literal string `"undefined"` (the stale arm ships
  empty server-side — parity.test.ts:225).
  1. Surface: drop `stale` from `lowerBoundaryCall`/`lowerTryArms` (the arm read and
     its single-root diagnostic) and from the `async-el.tsx` fixture. `.tsrx` is
     untouched — it never had a stale spelling.
  2. Machinery: `TryIR.staleChildren` and every consumer — `walk.ts`, `first-refs.ts`,
     `front-end.ts`, `selectors.ts`, `emit-server.ts` (stale root + fieldset),
     `plan.ts` (`staleQuery`/`staleFieldsetQuery`/`staleText`), `effects.ts` (stale-arm
     constraints, `staleText`, and the nil-vs-stale `.get()` probe, which simplifies to
     a three-state machine), `emit-client.ts` (the `stale:` handler). Beware the word:
     census/manifest "staleness" (`TranslationGap['status']`, the i18n staleness
     manifest, memo staleness) is UNRELATED — scope to the boundary arm.
  3. `isPending`: re-export cause-effect's graph-level `isPending` (already exported
     there, `index.ts:32`; tracked via `pendingSubscribe`, so a client watch re-fires
     when the task settles) through le-truc's index; ambient in BOTH profiles; the
     server fold must evaluate `isPending(knownSignal)` (evaluability.ts) — pin a
     fixture with the idiom whose tier stays put and whose class binding updates
     client-side on settle.
  4. Pins: parity's four-arm test becomes three-arm; the `stale: value =>` pin
     (parity.test.ts:230) dies with the handler; `.tsrx` goldens stay byte-identical
     (`staleChildren` was always null).
  5. Docs: ADR 0032 s3/s6 amendment via adr-keeper; `HOST_PROFILE.md`'s boundary
     section teaches the `isPending` idiom; ARCHITECTURE.md's Authoring Surfaces
     boundary paragraph (architect co-owns); AGENTS.md's "fourth arm" bullet. Tech
     Writer reviews the diagnostics-copy residue (LT-189 item 5 loses its stale part).
  **Acceptance:** `grep -rn "staleChildren\|staleText\|staleQuery" server/compiler` is
  empty; a three-arm boundary renders and toggles exactly as before (goldens
  unchanged); the `isPending` fixture passes with the tier census unchanged at 20/2/0;
  `check:tsrx`, typecheck, parity, `bun test server/tests` all green.

- [ ] LT-210: TSRX pin upgrade — 0.1.63 → the chosen 0.2.x, carrying three owner-wanted features: `@for`'s `@empty` arm, dynamic `<{expression}>` tags, and scoped styles. **Gate: land before P5's first wave-4 migration (owner sequencing, 2026-09-17); not urgent before that — no migrated component uses these today.**
  **Skill:** le-truc-dev, with architect co-owning the scoped-styles ruling (it revisits a HOST_PROFILE decision — expect a new ADR)
  **Context (researched 2026-09-17 during LT-205):** upstream moved 0.1.64–0.1.71, then
  the 0.2 minor line (0.2.0 2026-09-15 → 0.2.3 2026-09-17, latest at ruling time).
  0.1.68+ was never evaluated; 0.1.67 was (2026-09-06: additive, corpus
  byte-identical, reverted only for owner-pending timing). ADR 0023 sub-design 2 and
  ADR 0032 s6 govern the review: the bump touches `core.ts`/`core-shim.d.ts` only, on
  the `.tsrx` front end. The verification recipe that worked then: bump pin →
  `bun install` → `bun test server/tests/compiler` → `bun run scripts/build-tsrx.ts` →
  `git status --porcelain` (zero generated-artifact changes = byte-identical corpus) →
  `check:tsrx` (read the standing-warning count; baseline is 0) — plus the parity suite
  and `build:docs`.
  **Corpus risk to clear at the bump itself, before any feature work:** the corpus's 22
  raw `<style>` blocks may trip upstream 0.2's new style diagnostics
  (`STYLE_STANDALONE_*`, including `STYLE_STANDALONE_OUTSIDE_TEMPLATE` for CSS outside
  a template block). The bump lands only with the warning baseline still 0 — configure
  or scope the new diagnostics per the review, never weaken our own.
  **The three features, each with its design questions:**
  1. `@empty` arm on `@for` (spec: optional arm after the template block). New IR (an
     empty arm on `ForIR`), both emitters, analysis addressing. `.tsx` needs no new
     spelling — an empty state is already `{items.length === 0 ? … : items.map(…)}` —
     so decide whether `@empty` lowers to that shared conditional+loop shape or earns
     its own IR (keys and addressing may differ).
  2. Dynamic `<{expression}>` tags (spec: closing tag repeats, `</{expression}>`). Not
     expressible in standard TSX — if the capability stays `.tsrx`-only, ADR 0032 s6's
     exception mechanism records it. The server semantics are the hard part: a tag
     name unknown at compile time folds only when the expression is server-known;
     decide which tier renders the unknown case and what the client does at connect.
     Also check the `.tsx` collision: a capitalized local-variable tag reads as
     compose (PascalCase = compose), so a `.tsx` spelling via a local tag variable
     must not blur compose dispatch.
  3. Scoped styles — the host-decision change. HOST_PROFILE.md's "Styles are unscoped,
     light DOM" (the deliberate divergence from Ripple) is the recorded decision; the
     owner wants scoping supported. 0.2 ships the machinery (`STYLE_*` diagnostics,
     `prepareStylesheetForRender(sheet, mode)` with `scope`/`class-map`/`theme`,
     hash-class application, standalone blocks scoped to siblings). Rule FIRST
     (architect, new ADR): opt-in per component vs new default; interaction with the
     tag-name-prefix convention and docs-src/pages/styling.md; whether upstream's
     sibling-scoping model fits light-DOM SSR output. Implementation follows the
     ruling.
  **Acceptance:** the pin moved to the chosen 0.2.x with the ADR 0023 s2 review
  recorded (what changed 0.1.63 → chosen version, why safe); warning baseline 0 and
  tier census 20/2/0 hold; goldens byte-identical for untouched behavior (or updated
  pinning the new lowerings); each feature's dual-surface story lands per ADR 0032 s6
  — paid in both surfaces, or its s6 exception recorded; parity extended accordingly;
  `check:tsrx`/`typecheck`/`build:docs` green.

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

- [ ] LT-195: Internationalize the corpus's hard-coded accessibility strings (demand check, 2026-09-07). **Depends on LT-173; sequence after LT-193.**
  **Skill:** le-truc-dev
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

- [ ] LT-196: Report orphaned catalog keys in the translation census (ADR 0030 s5 gap).
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

- [ ] LT-198: LT-174 review residue — four deferred minors. **Depends on nothing; any time.**
  **Skill:** docs-server-dev
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

- [ ] LT-194: The document-level page renderer and the page-position ambient `lang` walk. **Depends on LT-174 (landed 2026-09-15).**
  **Skill:** docs-server-dev
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
  **Scope this deliberately, and expect it to be large.** Before building, answer: does the
  renderer replace the verbatim copy of authored markup, or wrap it? What is the unit of
  render — the page, or each occurrence? How does it interact with LT-174's per-locale page
  trees (one renderer pass per locale, locale already fixed)? Write those answers into
  NOTES.md or back to the Architect BEFORE implementing; a wrong shape here is expensive.
  **Constraint that survives regardless:** the page locale and the ambient `lang` at a static
  page position are both build-time constants (LT-191's ruling), so the `Intl` fold, the
  `truc:case` pruning and the root-attribute render all still hold. Do not introduce anything
  that makes either a runtime variable.
  **Perf note:** LT-193's data applies — the Simulated-tier share of page occurrences is 9 of
  3,249. Do not reintroduce a render cache for this; measure first if you think you need one.

- [ ] LT-197: Decide how client-side runtime strings get translated (exploration). **Depends on LT-195.**
  **Skill:** architect (with le-truc-dev for feasibility)
  **Context:** LT-195's survey turned up a category ADR 0030's mechanism **structurally
  cannot serve**: strings built at event time in the browser.
  - `form-tokenbox`: `` `Added token: ${trimmed}` `` and `` `Removed token: ${removedValue}` ``
    written into a `role="status" aria-live="polite"` region.
  - `form-colorgraph`: `setCustomValidity('Color out of gamut')`, three sites.
  ADR 0030 sub-design 6 is explicit that **no message catalog and no locale runtime ship to
  the browser**. These strings are therefore untranslatable today, on any locale, and the
  tokenbox ones are announced to screen-reader users — the accessibility case is the strongest
  one in the corpus, and it is the one the current design cannot reach.
  **Do not assume the answer is "ship the catalog."** That would contradict ADR 0030's payload
  posture and ADR 0003. Weigh at least: (a) server-render the message variants into the DOM
  and have the client select among them (the `truc:case` pattern, generalized — no payload,
  but only works for a closed set); (b) a tiny per-component compiled-in string map in the
  generated client, scoped to that component's declared keys (small payload, ADR 0030's
  "no catalog" is about the CORPUS catalog — is a per-component map the same thing?); (c)
  accept the gap and document it as a known limit. **Measure the payload cost of (b) before
  arguing about it.** Outcome is an ADR 0030 amendment or a new ADR, then tickets.

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
     `server/tsrx/i18n.ts` — a declared key whose dot-suffix is not one of the six CLDR
     categories is a shape error.
  3. **TSRX047's literal-prose warning** (LT-173 handoff): final copy; the single-letter
     exemption (page data, not prose) must survive the rewording, and the missing-
     *translation*-rides-the-census distinction is the point of the message.
  4. **TSRX048's duplicate-tag error** (LT-202 handoff): final copy over the draft in
     `server/tsrx/diagnostics.ts` — one tag, two corpus sources, both files named; the
     "whatever surface it is written in" clause is the dual-front-end fact the message
     teaches.
  5. **The three-arm `boundary` diagnostic wordings** (LT-202 handoff, amended by
     LT-211/208): the arm-shape errors in `server/compiler/frontend/tsx/lower-tsx.ts`
     (missing/ill-typed arms, single-root rule per arm, err-arrow requirement) — final
     copy; the four-arm vocabulary is gone (owner withdrawal, 2026-09-18), so the copy
     covers the three arms plus LT-209's new TSRX049/TSRX050 drafts in
     `server/compiler/diagnostics.ts`. Batch with items 2–3 so the diagnostic families
     read as one voice.

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
  Two tests in `server/tests/tsrx/gate-wave-verification.test.ts` pass today but don't verify
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

---

## P5 — Wave 4: example migrations

**Gated on LT-202 (the `.tsx` front end in the build), LT-178/LT-179, AND LT-210 (the
TSRX pin upgrade; owner sequencing 2026-09-17)**. LT-183 returned GO (ADR 0032, dual
front end) — **migrations author `.tsx`**;
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

- [ ] LT-096: Migrate `module-codeblock` to `.tsrx` with same-commit cutover.
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

- [ ] LT-097: Migrate `module-cem-list` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~39 lines, an `each()` loop over CEM manifest data. Watch for: loop body reactive
  attrs on non-root children (the LT-037 fix), selector uniqueness among repeated items.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. culori usage follows the `asOklch.ts`/`_common`
  setup point (modes must be registered there, LT-091 finding 3).

- [ ] LT-099: Migrate `module-pagination` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Has a spec — keep it green against
  `/test/module-pagination`.

- [ ] LT-100: Migrate `module-catalog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Has a spec — keep it green against
  `/test/module-catalog`.

- [ ] LT-101: Migrate `module-dialog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Has a spec. Watch
  for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related
  event handlers as bare `on()` statements.

- [ ] LT-102: Migrate `module-splitview` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Watch for:
  `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for
  exactly this class of code).

- [ ] LT-103: Migrate `module-scrollarea` to `.tsrx` with same-commit cutover.
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

- [ ] LT-104: Migrate `module-lazyload` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. culori usage follows the `_common` setup point. If
  it composes other form components multiple times, use the static-attr discriminator addressing
  (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Also ports
  `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the
  compiled artifact (or the served page, matching the corpus's spec conventions); mocks served
  under `/test/module-listnav/mocks/...` stay working. Note: LT-200 (merged with `next`)
  moved this component's initial hash sync into effect activation — the ported template must
  keep that shape.

- [ ] LT-108: Migrate `module-carousel` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

- [ ] LT-110: Migrate `module-ticker` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.

- [ ] LT-111: Migrate `module-todo` to `.tsrx` with same-commit cutover — last hand-written example, completes the corpus port.
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
  `server/tests/tsrx/client-setup-credit.test.ts`; flip that test when fixing.

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
  `server/tsrx/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` →
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
  (`configureHtmlSanitizer` is called only from `server/tests/tsrx/features.test.ts:25`).
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
