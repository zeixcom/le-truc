# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Iteration opened 2026-10-10: the two-repo split and template emission.** The previous
iteration ("the first package and the P6 remainder", opened 2026-10-09) closed on 2026-10-10:
all 18 entries reviewed and integrated, both design gates ruled (LT-516 → ADR 0043 amended;
LT-484 → full parity, LT-530 filed; LT-523 → ADR 0049), the `writer` recorded it in
`CHANGELOG.md [Unreleased]`, and the entries are pruned (`queue/LEDGER.md`, ninth pass).

**Why now (Architect, 2026-10-10).** The package stands (`@zeix/le-truc-compiler`, LT-254) but
still compiles from this repo's own sources, and template emission — v3.0's other requirement
(M27) — has its ruled interface (ADR 0043 as amended) and no emitter. ADR 0049 directs the
split first ("the third front end is born in its final home"), so the iteration opens with the
split chain and builds the emitter in the new repository. This repo keeps the corpus healthy
ahead of the pioneers: the accessibility gate and two examples riders.

**Rulings taken at planning (Architect with the owner, 2026-10-10).**
1. **Scope: the two-repo spine plus corpus riders.** S — the split: LT-524 → LT-525 → LT-526.
   E — emission, new repo: LT-527 → LT-528 → LT-529 (all `needs: LT-524`). P — parity, new
   repo: LT-530 (`needs: LT-524`). G — the accessibility gate: LT-508 (`needs: LT-525`).
   R — riders: LT-511, LT-513 (beside everything).
2. **Prerequisite owner act before LT-524:** publish `@zeix/le-truc@3.0.0-next.1` to the
   registry (LT-523's ruling) — the new repository types its peer against it and proves
   `check:package` from there.
3. **No compiler-source front window.** LT-524 mirrors the tree on a quiet checkout; no task
   touches `server/compiler/`, `server/tests/compiler/` or `server/runtimes/` in this repo
   after the mirror lands (work there diverges and is lost at LT-525). At cutover (LT-525's
   review), compiler-internals tasks are re-pointed — the setup-const cluster
   LT-459 → LT-333 → LT-458, LT-363, LT-369, LT-497 and the corpus-gate follow-ons
   LT-506/LT-509/LT-510 — internals to the new repository's tracker (ADR 0049 s7),
   corpus-level gates stay here consuming the linked package.
4. **The emission chain builds only in the new repository** (ADR 0049 sequencing, LT-516's
   split). LT-527 owns LTC057/LTC058/LTC090; the boundary fixture lands with it (no corpus
   component uses `Try` yet).
5. **LT-508 re-scoped at planning to consumer-side placement:** `CORPUS_RENDER_ARGS` lives
   under `server/tests/` here, never the mirrored `server/tests/compiler/`, and the gate runs
   post-cutover so its first green run doubles as an adoption proof (the entry carries the
   note).
6. **LT-259, LT-260 and LT-261 stay out (owner, carried):** the codemod's drift-cost metric
   is unruled, the pioneers are external engagements timed by the owner, and pioneer 2 needs
   LT-529 regardless.
7. **Standing rulings carried from the 2026-10-06/-09 plannings:** acceptance criteria are
   goals, not constraints to satisfy by workaround (a contributor who can meet one only by
   bending the design annotates `blocked` and writes the impasse into `NOTES.md`); an
   `examples` task that edits a compiled source gates `test:server` and `typecheck`; the
   corpus-level checks stay standalone, never part of the compile step or `bun test`.

**The chain.**
- **S — the split** — P1; ADR 0049; this repo and the new one. LT-524 (bootstrap: fresh
  history, the moved tree, mirrored fixture corpus, registry-typed peer, its own gates, public
  from the first push) → LT-525 (cutover: consume `@zeix/le-truc-compiler`, delete the
  in-tree compiler, re-point the docs build; goldens re-pin the harness import once, by
  design) → LT-526 (publish and CI hardening: branch protection with required checks on both
  repositories, the compiler's first pre-release — owner act, CHANGELOG entries).
- **E — template emission** — P1; the new repository; `needs: LT-524`; ADR 0043 as amended.
  LT-527 (the shared walk, operation layer, census routing, the boundary fixture, and the
  test-only second target; LTC057/LTC058/LTC090) → LT-528 (the Twig target: syntax table,
  exhaustive escaping map, one partial per component × locale, byte-equivalence on the real
  engine) → LT-529 (the PHP CI job; coordinates with LT-526 if still open).
- **P — boundary-arm parity** — P2b; the new repository; `needs: LT-524`; LT-484's ruling.
  LT-530 (factor the conditional arm-content planner, thread it through
  `handleAsyncBoundary`, retire `boundaryDeepConstructOf` and four refusal faces). Parallel to
  E — it touches `analysis/effects.ts`, the emission chain adds new code.
- **G — the accessibility gate** — needs LT-525 (post-cutover, consumer-side). LT-508
  (`check:html`: html-validate + axe-core over every corpus component's server render, the
  seeded allowlist triaged at review into corpus follow-ups).
- **R — examples riders** — beside everything; this repo only. LT-511 (delete the 22 orphaned
  hand-written sheets no twin serves), LT-513 (module-cem-list addresses its passed content
  through declared roles).

**Deliberately not here.** LT-259, LT-260, LT-261 (ruling 6). The setup-const cluster,
LT-363, LT-369, LT-497, LT-506, LT-509 and LT-510 (ruling 3 — re-pointed at cutover, not
now). LT-381 (changes the census by design; owner sign-off when it enters). The design gates
LT-310, LT-448, LT-450, LT-456 and LT-515 (need-gated, owner-timed). P2–P5 stay where they
are.

**Exit criterion.** Every chain task is reviewed and integrated. Both repositories are real
and green: `zeixcom/le-truc-compiler` is public with typecheck, suite, contract, package,
peer and lint as required checks (ADR 0049 s7); le-truc consumes the compiler through `link:`
in development and the pinned pre-release in CI, with no `server/compiler/` directory left.
This repo's tier census (36/7/0), translation census (0 gaps) and compile-warning baseline
(1 unique standing warning, module-dialog's LTC088) are unchanged from the opening
measurement below, except where a task states a by-design change. In the new repository, the
dump target's renders are byte-identical to SSG for every emittable fixture × locale, and the
Twig equivalence corpus passes on the real engine. `check:html` is seeded and green in this
repo. On this repo's closing commit: `typecheck`, `test:server`, `check:contract`,
`check:corpus`, `test:variants`, `build:docs` and `check:links` are green.

**Opening measurement (d7bcb68a):** `check:corpus` exits 0. The tier census has 43 entries:
36 Folded, 7 Simulated, 0 Static. The compile-warning baseline is 1 unique standing warning,
module-dialog's `body.scroll-lock` (LTC088), ruling-7-excepted (the css-probe LTC088 is a
test-fixture warning, present at HEAD and uncounted — LT-519's review). The translation
census has 0 gaps across 6 locales. `server/compiler/` has 87 modules and 43.5k lines (every
`.ts` file except `*.test.ts`) — the last opening measurement of the in-tree compiler. All
seven gates green at this commit (closing verification of the previous iteration:
`test:server` 3743/0, `test:variants` 537, `check:links` 804).

**Next free task ID: LT-531.** Next free diagnostic code: LTC091 (LTC090 is LT-527's; LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-527's
(LT-257's before the split);
LTC056 is LT-358's).

---

<!-- entries -->

### S — the split

- [ ] LT-524: Bootstrap the `le-truc-compiler` repository — fresh history, the moved tree, mirrored fixture corpus, registry-typed peer, its own gates.
  **Area:** compiler
  **Needs:** LT-523
  **Gates:** typecheck, test:server, check:contract, check:peer, check:package
  **Area:** compiler
  **Prerequisite (owner act, before this task): `@zeix/le-truc@3.0.0-next.1` on the registry** — the
  new repository types its runtime peer against the published package and proves it from there.
  **Context:** ADR 0049 (LT-523 session, 2026-10-10). The destination `../le-truc-compiler` exists,
  empty. Fresh history: the first commit is the moved tree; `zeixcom/le-truc-compiler` is public
  from the first push (owner act at the end of this task); le-truc is untouched by this task.
  **Do:**
  1. **Move per ADR 0049 s2**: `server/compiler/` (87 modules), `server/runtimes/` (the ADR 0038
     seam), `server/tests/compiler/` with fixtures (97 files), the four package scripts
     (`build:compiler`, `check:contract`, `check:peer`, `check:package`), `tsconfig.compiler.json`,
     the `compiler/` assembly dir (it becomes the repository root — manifest, README, `src/` from
     `server/compiler/`, rewire the build script's roots), and the compiler docs
     (`LE_TRUC_COMPILER.md`, `HOST_PROFILE.md`, `VOCABULARY_LEDGER.md`, `COMPILER_SPEC.md`), plus
     the simulation portability check.
  2. **Mirror the fixture corpus** at the defaults' relative paths: `examples/**` (both surfaces,
     composition sites, i18n catalogs) such that `sources`, `outDir`, `locales` defaults compile
     the new repo's own tree (ADR 0049 s4). Corpus-level checks that live in le-truc (census,
     goldens) are NOT recreated against the mirror; this corpus serves the moved unit tests and
     the defaults' honesty.
  3. **Registry-typed peer**: `@zeix/le-truc` becomes a devDependency; `tsconfig.compiler.json`'s
     `paths` mapping to le-truc's committed `types/` is deleted. `check:peer` reads the export
     list and version from the installed/registry package (ADR 0049 s5); the lockstep convention
     (runtime publishes first) goes in its header.
  4. **Repository posture** (ADR 0049 s7): MIT `LICENSE` in the first commit, CI workflows for the
     six checks (typecheck, suite, contract, package, peer, biome), publish workflow present but
     disabled, no queue tooling. `git init`, first commit, gates green in the new repo.
  5. **Hand-off**: the owner creates `zeixcom/le-truc-compiler` (public) and pushes.

  **Not in scope:** any change inside le-truc (LT-525), npm publish of the compiler (LT-526).
  **Channel/tier:** none (repository structure).
  **Verification:** all five gates green inside the new repository; `check:package` installs the
  runtime peer FROM THE REGISTRY and compiles + renders the corpus; the defaults compile the
  mirror with no config file.

- [ ] LT-525: le-truc cutover — consume `@zeix/le-truc-compiler`, delete the in-tree compiler, re-point the docs build; goldens re-pin the harness import once, by design.
  **Area:** compiler
  **Needs:** LT-524
  **Gates:** typecheck, test:server, check:corpus, check:links
  **Area:** compiler
  **Context:** ADR 0049 s3. With LT-524's repository live, le-truc stops compiling with its own
  sources: the compiler becomes a devDependency — `link:../le-truc-compiler` for development, the
  pinned registry pre-release in CI (state the exact mechanism in the annotation; one spelling in
  `package.json`, the CI override documented in the workflow).
  **Do:**
  1. **Consume the package**: devDependency added; `corpus-compile.ts`, `corpus-sources.ts`,
     `build-corpus`, `check-corpus`, the docs build, the dev server and `file-signals` import
     `compileCorpus` (and the loader) from `@zeix/le-truc-compiler`. Root tsconfig `paths` entries
     for `/macros` and `/runtime` are deleted (node_modules resolution).
  2. **Delete the moved tree**: `server/compiler/`, `server/runtimes/`, `server/tests/compiler/`,
     the four moved scripts, `tsconfig.compiler.json`, `compiler/`, the four moved docs files, the
     moved check scripts from root `package.json`.
  3. **Become a real consumer**: `le-truc.config.json` is deleted (its single field, the
     `runtimeImport` pin, is the thing that flips — generated modules import
     `@zeix/le-truc-compiler/runtime`); `REPO_EMIT_PATHS` in the test helpers reverts to the
     package default; the goldens re-pin the harness import line — the ONE by-design golden
     change of the cutover, byte-identity through the installed package thereafter (ADR 0049 s3).
  4. **Rewire the prose**: AGENTS.md (HOST_PROFILE path), ARCHITECTURE.md (the assembly sentence),
     REQUIREMENTS §5 ("built in-repo" → built in `zeixcom/le-truc-compiler`), SERVER.md/TESTS.md
     path references, and every doc link into the moved files (the moved docs live in the new
     repo; le-truc links point there).
  5. **`scripts/lib/baseline.ts`'s `css-tree`/`lightningcss` imports** get a home: a le-truc
     devDependency (preferred — no new public export) or an export from the package; rule it
     inline and record why.

  **Not in scope:** the new repository's contents (LT-524), publish/CI hardening (LT-526).
  **Channel/tier:** none (build wiring).
  **Verification:** all gates green through the INSTALLED/LINKED package; the docs build renders
  the corpus identically except the re-pinned import line; no reference to `server/compiler`
  survives outside git history.

- [ ] LT-526: Publish and CI hardening — branch protection with required checks on both repositories, the compiler's first pre-release (owner act), CHANGELOG entries.
  **Area:** server
  **Needs:** LT-525
  **Gates:** check:links
  **Area:** server (repo tooling)
  **Context:** ADR 0049 s7 + the release conventions. The split is code-complete after LT-525;
  this task makes the two-repo machinery durable.
  **Do:**
  1. **Branch protection** on `zeixcom/le-truc` and `zeixcom/le-truc-compiler`: required checks
     (the six compiler checks; le-truc's existing set), no direct pushes to the default branch.
  2. **Compiler publish workflow enabled** with the NPM token secret; the **owner publishes
     `@zeix/le-truc-compiler@3.0.0-next.1`** (runtime already on the registry from LT-524's
     prerequisite — runtime first, always, per the lockstep convention).
  3. **CHANGELOG entries** handed to `writer` for both repositories' `[Unreleased]`: the split
     (ADR 0049), the cutover, the pre-releases.
  4. **Convention note**: the lockstep rule (runtime publishes first; compiler CI verifies the
     floor against the registry) recorded in the compiler README's release section.

  **Not in scope:** pioneer-gated stable releases (ADR 0034 s6 stands), template emission.
  **Channel/tier:** none.
  **Verification:** protection rules live on both repos; the two packages install side by side
  from the registry (`check:package` green against the published runtime); CHANGELOGs recorded.

### E — template emission

- [ ] LT-524: Bootstrap the `le-truc-compiler` repository — fresh history, the moved tree, mirrored fixture corpus, registry-typed peer, its own gates.
  **Area:** compiler
  **Needs:** LT-523
  **Gates:** typecheck, test:server, check:contract, check:peer, check:package
  **Area:** compiler
  **Prerequisite (owner act, before this task): `@zeix/le-truc@3.0.0-next.1` on the registry** — the
  new repository types its runtime peer against the published package and proves it from there.
  **Context:** ADR 0049 (LT-523 session, 2026-10-10). The destination `../le-truc-compiler` exists,
  empty. Fresh history: the first commit is the moved tree; `zeixcom/le-truc-compiler` is public
  from the first push (owner act at the end of this task); le-truc is untouched by this task.
  **Do:**
  1. **Move per ADR 0049 s2**: `server/compiler/` (87 modules), `server/runtimes/` (the ADR 0038
     seam), `server/tests/compiler/` with fixtures (97 files), the four package scripts
     (`build:compiler`, `check:contract`, `check:peer`, `check:package`), `tsconfig.compiler.json`,
     the `compiler/` assembly dir (it becomes the repository root — manifest, README, `src/` from
     `server/compiler/`, rewire the build script's roots), and the compiler docs
     (`LE_TRUC_COMPILER.md`, `HOST_PROFILE.md`, `VOCABULARY_LEDGER.md`, `COMPILER_SPEC.md`), plus
     the simulation portability check.
  2. **Mirror the fixture corpus** at the defaults' relative paths: `examples/**` (both surfaces,
     composition sites, i18n catalogs) such that `sources`, `outDir`, `locales` defaults compile
     the new repo's own tree (ADR 0049 s4). Corpus-level checks that live in le-truc (census,
     goldens) are NOT recreated against the mirror; this corpus serves the moved unit tests and
     the defaults' honesty.
  3. **Registry-typed peer**: `@zeix/le-truc` becomes a devDependency; `tsconfig.compiler.json`'s
     `paths` mapping to le-truc's committed `types/` is deleted. `check:peer` reads the export
     list and version from the installed/registry package (ADR 0049 s5); the lockstep convention
     (runtime publishes first) goes in its header.
  4. **Repository posture** (ADR 0049 s7): MIT `LICENSE` in the first commit, CI workflows for the
     six checks (typecheck, suite, contract, package, peer, biome), publish workflow present but
     disabled, no queue tooling. `git init`, first commit, gates green in the new repo.
  5. **Hand-off**: the owner creates `zeixcom/le-truc-compiler` (public) and pushes.

  **Not in scope:** any change inside le-truc (LT-525), npm publish of the compiler (LT-526).
  **Channel/tier:** none (repository structure).
  **Verification:** all five gates green inside the new repository; `check:package` installs the
  runtime peer FROM THE REGISTRY and compiles + renders the corpus; the defaults compile the
  mirror with no config file.

- [ ] LT-527: Template emission — the shared walk and operation layer, the census routing, the boundary fixture, and the test-only second target (ADR 0043 as amended; LT-257's build half, split by the LT-516 session). Builds in the le-truc-compiler repository.
  **Area:** compiler
  **Needs:** LT-524
  **Gates:** typecheck, test:server, check:contract
  **Area:** compiler (the new `../le-truc-compiler` repository; ADR 0049 sequencing — never `server/compiler/` here)
  **Context:** ADR 0043 as revised 2026-10-10 (the LT-516 session, D-28 ruled). The shared
  walk owns every decision; a target owns only syntax. LT-254, LT-274, LT-373 and LT-234 have
  landed; the IR carries the `conditional` node, the `try` node and reactive lists.
  **Do:**
  - The emission-operation vocabulary over the settled IR — text, hole, segment list,
    conditional, **boundary**, loop, **list template**, include, message format, arm template —
    with `HtmlWriter` as the only output path. The operation layer never sees IR nodes.
  - The **boundary operation** (ADR 0043 s4): the three-state result arg (`T` /
    `{ error: { code, message } }` / null → `ok` / `err` / `nil`), the err scope (catch
    parameter → member paths over `error`), inert arm templates beside the winner. Emittable
    only when the task's initial value routes from a server arg; an opaque driver routes the
    partial Static (`non-portable initial`). The synchronous `try` is not emittable (census
    reason, no diagnostic).
  - **Reactive lists** (ADR 0043 s5): the initial items reuse the loop operation verbatim
    (source: the seed arg; key and raw sources as item-scope holes); the list-template
    operation is the inert item shape — no holes, client-written sites empty — stamped
    `data-list="N"`, a direct child of the host in document order whatever the nesting depth.
    Extend the loop-source grammar: a source may be a member path over an enclosing item
    scope (nested lists nest as native loops).
  - **Children capture** (ADR 0043 s3/s5): the parent-owned region captured with its holes in
    parent scope, `truc:html` hooked at its site inside the capture, passed as one more arg in
    the new **composed-markup** escaping context (raw, no hook); the child writes
    `data-children` from the implicit, minted `owner` arg only when a compiled parent passed
    children. The escaping-context union gains the eighth member; every target's switch is
    exhaustive over it.
  - In every inert template (arm, list, boundary): server-arg sites emit as holes the backend
    fills per request; client-written sites bake empty.
  - Portable-subset classification and the shared refusals, both only when a template target
    is configured; SSG-only builds and the zero-warning baseline unchanged.
  - The census routing outcomes per component: `non-portable initial` (reactive and task),
    sync `try`, key-alias harvest (ADR 0047 s4), `ambiguous result shape` — census rows, never
    warnings (M23).
  - A **boundary fixture component** (no corpus component uses `Try` yet; ADR 0041's
    consequence note): result-arg-seeded task with all three arms, in the new repository's
    fixture corpus; offered to this repo's corpus at cutover.
  - The test-only second target in `server/tests/compiler/targets/` (its new-repo path): an
    operation dump plus a small in-process interpreter, byte-compared with SSG for every
    emittable fixture × locale.
  **New diagnostics (compiler channel, Prevented, only when a template target is configured):**
  LTC057 — a non-portable expression in a hole position (one face for `Intl` formatting over a
  hole, naming the ICU-pattern fix); LTC058 — a hole in a refused position (faces:
  `<script>`/`<style>` content or comment, `on*`/`srcdoc`, attribute or tag name, whole-string
  `style`); LTC090 — a boundary result type with its own `error` member (the three-state test
  is ambiguous; fix: rename the field). Copy follows `writer` → error-messages.
  **Depends on** LT-524 (the repository exists; fixture corpus mirrored).
  **Check:** every fixture component emits through the dump target in its tier; dump-target
  renders are byte-identical to SSG for every emittable component × locale; the census carries
  each routing reason; builds with no target configured show zero new warnings and no census
  change.

- [ ] LT-528: Template emission — the Twig target (ADR 0043 as amended): syntax table, exhaustive escaping map, boundary/list/children emission, one partial per component × locale, byte-equivalence on the real engine.
  **Area:** compiler
  **Needs:** LT-527
  **Gates:** typecheck, test:server
  **Area:** compiler (the new `../le-truc-compiler` repository)
  **Context:** ADR 0043 as revised 2026-10-10. The target owns only syntax: a syntax table
  plus an escaping map, switching exhaustively over the operation set and the eight-member
  context union (tsc flags a missing case — that is the interface's safety property).
  **Do:**
  - The Twig syntax table for every operation: native `if`/`for` (loop sources include
    enclosing-item member paths), the boundary as a three-test conditional over the result
    arg, the list template stamped `data-list="N"` at host level, includes with `only` and the
    captured children arg in the composed-markup context (raw emit, no hook, with a generated
    comment naming why it is safe), the conditional's initial winner beside inert arm
    templates.
  - The exhaustive escaping map — text, quoted attribute, URL attribute (the safe-protocol
    allowlist as a Twig check), boolean attribute, class token, style value, HTML (through
    `le_truc_sanitize_html`), composed markup (raw).
  - The `owner` arg: minted collision-free against every component's props; passed by
    compiled compose sites with children; absent for page-rendered instances and pass-less
    includes.
  - One partial per component × locale; argument-less messages and the client `i18n`
    attribute folded; message calls as `le_truc_format` over the localized pattern literal
    (ADR 0043 s6 unchanged).
  - The host-helpers manifest for the integrator: URL allowlist check,
    `le_truc_sanitize_html`, `le_truc_format` over `MessageFormatter`.
  - Byte-equivalence against SSG on the real engine (`twig/twig`, `intl`) for every
    emittable fixture × locale, the boundary fixture included; the adversarial escaping
    corpus, negative cases included.
  **Diagnostics:** none new — LTC057/LTC058/LTC090 are the walk's (LT-527); a target that
  fails exhaustiveness is a tsc error, not a diagnostic.
  **Depends on** LT-527 (the operation layer and the fixture corpus, including the boundary
  fixture).
  **Check:** Twig renders are byte-identical to SSG for every emittable fixture × locale; the
  escaping corpus passes with negative cases; no change to the walk or the dump target
  (the interface's second-target proof holds).

- [ ] LT-529: Template emission — the PHP CI job (twig/twig + intl): Twig equivalence, the adversarial escaping corpus and the ICU equivalence corpus on the real engine; local runs skip without php.
  **Area:** compiler
  **Needs:** LT-528
  **Area:** compiler (the new `../le-truc-compiler` repository)
  **Context:** ADR 0043 s8. Equivalence is byte identity with SSG, checked on the real
  engine — `twig.js` was rejected as the reference renderer (divergent escaping, no ICU).
  **Do:**
  - A CI workflow installing `php` with `twig/twig` and `intl`, running the Twig
    byte-equivalence suite, the adversarial escaping corpus (negative cases included) and the
    ICU equivalence corpus.
  - The job is required-check eligible but tolerant locally: without `php` on the machine the
    suites skip, never fail (the dump target is the PHP-free equivalence check).
  - State the exact local invocation in the README's contributing section.
  **Diagnostics:** none.
  **Depends on** LT-528 (the suites exist). If LT-526's branch protection is still open when
  this lands, add the job to the required-checks list in the same change rather than after.
  **Check:** CI runs the three suites on the real engine and passes; a local run without
  `php` exits green with an explicit skip line; nothing in this repo changes.

### P — boundary-arm parity

- [ ] LT-524: Bootstrap the `le-truc-compiler` repository — fresh history, the moved tree, mirrored fixture corpus, registry-typed peer, its own gates.
  **Area:** compiler
  **Needs:** LT-523
  **Gates:** typecheck, test:server, check:contract, check:peer, check:package
  **Area:** compiler
  **Prerequisite (owner act, before this task): `@zeix/le-truc@3.0.0-next.1` on the registry** — the
  new repository types its runtime peer against the published package and proves it from there.
  **Context:** ADR 0049 (LT-523 session, 2026-10-10). The destination `../le-truc-compiler` exists,
  empty. Fresh history: the first commit is the moved tree; `zeixcom/le-truc-compiler` is public
  from the first push (owner act at the end of this task); le-truc is untouched by this task.
  **Do:**
  1. **Move per ADR 0049 s2**: `server/compiler/` (87 modules), `server/runtimes/` (the ADR 0038
     seam), `server/tests/compiler/` with fixtures (97 files), the four package scripts
     (`build:compiler`, `check:contract`, `check:peer`, `check:package`), `tsconfig.compiler.json`,
     the `compiler/` assembly dir (it becomes the repository root — manifest, README, `src/` from
     `server/compiler/`, rewire the build script's roots), and the compiler docs
     (`LE_TRUC_COMPILER.md`, `HOST_PROFILE.md`, `VOCABULARY_LEDGER.md`, `COMPILER_SPEC.md`), plus
     the simulation portability check.
  2. **Mirror the fixture corpus** at the defaults' relative paths: `examples/**` (both surfaces,
     composition sites, i18n catalogs) such that `sources`, `outDir`, `locales` defaults compile
     the new repo's own tree (ADR 0049 s4). Corpus-level checks that live in le-truc (census,
     goldens) are NOT recreated against the mirror; this corpus serves the moved unit tests and
     the defaults' honesty.
  3. **Registry-typed peer**: `@zeix/le-truc` becomes a devDependency; `tsconfig.compiler.json`'s
     `paths` mapping to le-truc's committed `types/` is deleted. `check:peer` reads the export
     list and version from the installed/registry package (ADR 0049 s5); the lockstep convention
     (runtime publishes first) goes in its header.
  4. **Repository posture** (ADR 0049 s7): MIT `LICENSE` in the first commit, CI workflows for the
     six checks (typecheck, suite, contract, package, peer, biome), publish workflow present but
     disabled, no queue tooling. `git init`, first commit, gates green in the new repo.
  5. **Hand-off**: the owner creates `zeixcom/le-truc-compiler` (public) and pushes.

  **Not in scope:** any change inside le-truc (LT-525), npm publish of the compiler (LT-526).
  **Channel/tier:** none (repository structure).
  **Verification:** all five gates green inside the new repository; `check:package` installs the
  runtime peer FROM THE REGISTRY and compiles + renders the corpus; the defaults compile the
  mirror with no config file.

- [ ] LT-530: Boundary-arm construct parity — the async boundary's arms plan client constructs exactly like reactive-conditional arms (ADR 0037 s3/s4 honored; LT-484's ruling). Builds in the le-truc-compiler repository.
  **Area:** compiler
  **Needs:** LT-524
  **Gates:** typecheck, test:server
  **Area:** compiler (the new `../le-truc-compiler` repository)
  **Ruled (LT-484 session, 2026-10-10, owner — option A, full parity):** the refusals were
  residue of the LT-449 → LT-460 → LT-481 channel-by-channel build-out, not a recorded
  decision: ADR 0037 s3 ("arm content owns its effects… `watch()`/`on()`/`pass()` are usable
  inside an arm") and s4 ("the boundary switches to the same mechanism") already grant the
  vocabulary, and the refusal's own citation (ADR 0024 s13, "deeper elements have no
  addressing") was superseded by the arm-scope machinery (ADR 0045 proof, LT-424 recursion).
  `isClientConstructAttr` covers client-only attributes, so retry/cancel handlers in
  catch/pending arms do not compile today — the gap parity closes.
  **Do:**
  - Factor the conditional arm-content planner out of `handleReactiveConditional`
    (`analysis/effects.ts`): root-construct emission (`emitConstructEffects`), the
    `mountScope` + `localFor` addressing for nested elements, `collectKeyAttrs`, and the
    `planNested` recursion for nested arm sets and reactive lists (LT-424). Thread it
    through `handleAsyncBoundary`'s three arm plans (`ok`/`nil`/`err`).
  - Retire `boundaryDeepConstructOf` and the four refusal faces: the ok-root-via-child-channel
    refusal (root constructs + the lazy signal child now coexist, as the `truc:html` thunk
    channel already proved), the err-root refusal, the pending-arm refusal, and the
    deep-construct refusal ("Deeper elements have no addressing"). These are faces of
    existing codes, not codes — no LTC retires; the arm-scope proof's existing
    unaddressable-element face covers nested elements inside boundary arms.
  - Keep the value-channel disciplines untouched: driver-channel detection (direct lazy child
    or `truc:html` thunk), the one-catch-read rule, the message-element discriminator inside
    composed content, and the compose-arg catch-read refusal (LT-460). The ok arm's value
    write and construct effects coexist in one mount, as the thunk channel already does.
  - Fixtures on both surfaces: a retry handler in a catch arm, a cancel handler in a pending
    arm, a reactive attribute on a nested element inside each arm, a nested conditional and a
    nested reactive list inside an arm, beside the existing driver-channel/one-read/
    discriminator cases staying green. Goldens re-pin.
  - Rewrite `HOST_PROFILE.md`'s boundary section (the driver channels and one-catch-read rule
    stay; the sanctioned-channel-only model goes) and check `AGENTS.md`'s boundary bullet
    still reads true (a proposal through `.agents-proposals/` if copy must move).
  **Channel/tier (ADR 0028):** no new checks. Four refusal faces retire; none arrive.
  **Depends on** LT-524 (the repository). Independent of LT-527 → LT-529 (this touches
  `analysis/effects.ts`; the emission chain adds new code) — parallelizable; LT-527's boundary
  fixture may exercise an arm construct if this lands first.
  **Check:** every fixture compiles and behaves on both surfaces; the arm-scope selector proof
  holds inside boundary arms (nested elements addressable, unique-class failures report); the
  server render and the zero-warning baseline are unchanged (client-written sites inside inert
  arm templates already bake empty); the four faces no longer fire anywhere in the corpus.

### G — the accessibility gate

- [ ] LT-525: le-truc cutover — consume `@zeix/le-truc-compiler`, delete the in-tree compiler, re-point the docs build; goldens re-pin the harness import once, by design.
  **Area:** compiler
  **Needs:** LT-524
  **Gates:** typecheck, test:server, check:corpus, check:links
  **Area:** compiler
  **Context:** ADR 0049 s3. With LT-524's repository live, le-truc stops compiling with its own
  sources: the compiler becomes a devDependency — `link:../le-truc-compiler` for development, the
  pinned registry pre-release in CI (state the exact mechanism in the annotation; one spelling in
  `package.json`, the CI override documented in the workflow).
  **Do:**
  1. **Consume the package**: devDependency added; `corpus-compile.ts`, `corpus-sources.ts`,
     `build-corpus`, `check-corpus`, the docs build, the dev server and `file-signals` import
     `compileCorpus` (and the loader) from `@zeix/le-truc-compiler`. Root tsconfig `paths` entries
     for `/macros` and `/runtime` are deleted (node_modules resolution).
  2. **Delete the moved tree**: `server/compiler/`, `server/runtimes/`, `server/tests/compiler/`,
     the four moved scripts, `tsconfig.compiler.json`, `compiler/`, the four moved docs files, the
     moved check scripts from root `package.json`.
  3. **Become a real consumer**: `le-truc.config.json` is deleted (its single field, the
     `runtimeImport` pin, is the thing that flips — generated modules import
     `@zeix/le-truc-compiler/runtime`); `REPO_EMIT_PATHS` in the test helpers reverts to the
     package default; the goldens re-pin the harness import line — the ONE by-design golden
     change of the cutover, byte-identity through the installed package thereafter (ADR 0049 s3).
  4. **Rewire the prose**: AGENTS.md (HOST_PROFILE path), ARCHITECTURE.md (the assembly sentence),
     REQUIREMENTS §5 ("built in-repo" → built in `zeixcom/le-truc-compiler`), SERVER.md/TESTS.md
     path references, and every doc link into the moved files (the moved docs live in the new
     repo; le-truc links point there).
  5. **`scripts/lib/baseline.ts`'s `css-tree`/`lightningcss` imports** get a home: a le-truc
     devDependency (preferred — no new public export) or an export from the package; rule it
     inline and record why.

  **Not in scope:** the new repository's contents (LT-524), publish/CI hardening (LT-526).
  **Channel/tier:** none (build wiring).
  **Verification:** all gates green through the INSTALLED/LINKED package; the docs build renders
  the corpus identically except the re-pinned import line; no reference to `server/compiler`
  survives outside git history.

- [ ] LT-508: check:html — validate and axe-check every corpus component's server render.
  **Area:** compiler
  **Needs:** LT-525
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Filed (Architect, 2026-10-08):** traces to REQUIREMENTS §4 Accessibility (the corpus's
  server-rendered markup is valid HTML and passes the fragment-applicable axe-core rules; the
  no-JS accessibility tree, ADR 0026). A probe run on 2026-10-08 rendered all 43 corpus tags and
  found real defects (form-colorgraph's slider labelled by an id the render does not contain,
  duplicate ids, `<meter>` without `value`), so the gate has something to catch.
  **Re-scoped at planning (Architect, 2026-10-10, next-iteration ruling 5): consumer-side
  placement, post-cutover.** The `CORPUS_RENDER_ARGS` helper lands under `server/tests/` here —
  NOT `server/tests/compiler/`, which mirrors to the le-truc-compiler repository at LT-524 — and
  the gate runs after LT-525, compiling the corpus through the linked/pinned package, so its
  first green run doubles as an adoption proof. Update the smoke test's import path
  accordingly (item 1's source table now lives in this repo, not the mirrored tree).
  **Context:**
  1. **Shared render args.** Move the `ARGS` table out of
     `server/tests/compiler/server-render-smoke.test.ts` into
     `server/tests/compiler/corpus-args.ts` as an exported `CORPUS_RENDER_ARGS`; the smoke gate
     imports it. One table feeds both gates. A tag absent from the table renders from `{}`.
  2. **The gate.** `scripts/check-html.ts`, wired as `check:html` in `package.json`. It compiles
     the corpus with `compileCorpus` into a per-run temporary directory (never `config.outDir`,
     the LT-140 posture) and removes it on exit. Then it calls each tag's `render<Name>()` with
     its args and wraps the markup as
     `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>TAG</title></head><body><main>MARKUP</main></body></html>`.
  3. **HTML conformance:** add `html-validate` as an exact-pinned devDependency and use its
     programmatic API with the preset that checks conformance to the HTML standard only
     (`html-validate:standard`; confirm the name against the pinned version). No stylistic rules.
     Declare every registry tag as a custom element that accepts flow content, so a corpus tag
     is never reported as unknown.
  4. **Accessibility:** run axe-core (already a devDependency) inside a `jsdom` window
     (`runScripts: 'outside-only'`, evaluate `node_modules/axe-core/axe.min.js`), with
     `axe.run(document)`. Disable the rules that need real layout or a whole page:
     `color-contrast`, `landmark-one-main`, `page-has-heading-one`, `region`. Count only
     `violations`; `incomplete` is not a finding.
  5. **Allowlist:** `scripts/check-html.allow.json`, an array of `{ tag, tool, rule, reason }`.
     A finding the list doesn't match fails the gate, and so does an entry that matches no
     finding (a stale allowance never lingers). Seed it with every finding HEAD produces, each
     with the reason `untriaged at gate landing (LT-508)`. The Architect triages them at review
     into corpus follow-ups.
  6. **Output:** one line per finding, `TAG: <html-validate|axe>/<rule>: <message> (<selector>)`,
     using html-validate's `selector` and axe's `node.target`. Exit non-zero on any failure.
     Authored-source locations are LT-509's job.

  Out of scope: the inert `<template data-arms|data-list>` content (LT-510) and hydrated or
  interacted states (Playwright, the `runAxe()` fixture in `examples/test/fixtures/aria.ts`).
  Not part of the compile step or `bun test`: like `check:corpus`, the gate stands alone.
  **Check:** `bun run check:html` passes on HEAD with the seeded allowlist. A unit test under
  `server/tests/` covers the allowlist matcher: an unmatched finding fails, a stale entry fails,
  a matched finding passes. The handoff lists the seeded findings.
  **Channel/tier:** none. A corpus gate over rendered output, not a runtime check. Its result
  depends on render args the compiler never sees, so no `LTC` code.

### R — examples riders

- [ ] LT-511: Corpus — delete hand-written component sheets that no twin serves.
  **Area:** compiler
  **Gates:** test:server, check:corpus, test:variants, build:docs, check:links
  **Area:** compiler
  **Filed (Architect, 2026-10-08; LT-507 review):** ADR 0033 s10 serves a folder's hand-written
  `.css` only with its `.ts` twin, and `examples/main.css` imports the compiler's emitted sheet for
  every compiled folder. 22 folders keep a `.css` with no `.ts` twin beside it, sheets from before
  their twins were retired: basic-button, basic-gauge, basic-hello, card-blogpost, card-callout,
  card-collapsible, card-colorscale, form-checkbox, form-colorgraph, form-combobox,
  form-inplace-edit, form-listbox, form-radiogroup, form-spinbutton, form-textbox, form-tokenbox,
  module-blogarchive, module-demo, module-list, module-tabgroup, section-hero and section-menu's
  `chapter-nav.css`. They drift from the authored sheets (LT-504 and LT-507 edited the sources,
  not these), and a reader can mistake one for the component's CSS.
  **Do:** for each file, confirm that nothing reads it: no `@import`, spec, build or corpus script,
  docs page (a source listing or `{% demo %}`), or `le-truc.config.json` entry. Delete the files
  nothing reads. Report any that are read, and by what.
  **Check:** `build:docs` and `check:links` green; `test:variants` and the component specs pass;
  the served `docs/assets/main.css` is byte-identical to `v3`'s.
  **Channel/tier:** none. Corpus housekeeping.

- [ ] LT-513: module-cem-list addresses its passed content through declared roles, not inline reach-ins.
  **Area:** examples
  **Needs:** LT-474
  **Gates:** test:server, typecheck, check:corpus, test:variants, build:docs, check:links
  **Area:** examples
  **Needs:** LT-474
  **Filed (Architect, 2026-10-08; owner ruling on LT-474's survey):** module-cem-list (`.tsrx` and
  `.tsx`) reaches into the content the `{% cem-list %}` tag renders (`server/schema/cem-list.markdoc.ts`)
  through inline calls: `on(first('form-textbox'), …)` and an `all('card-collapsible')` in a watch
  thunk. LTC083 checks declared references only, so the reach-in compiles. The reference corpus
  should model ADR 0048 s2's contract rather than its gap. Extending verification to inline
  literal-selector calls is not part of this task; it waits for a second case.
  **Do:**
  1. Declare the roles on cem-list's `children` prop, `Children<{ filter: 'form-textbox'; item:
     'card-collapsible' }>` or names that read better, on both surfaces, identical.
  2. Give the matching elements in the `{% cem-list %}` output the role classes.
  3. Address them through declared references: `const filter = first('.filter', …)` and the items
     through `all('.item')`, so LTC083 sees them. Required or optional per LT-474's rework.
  4. Check every other page that authors cem-list content and add the classes there too.
  **Check:** `check:corpus` clean; the cem-list docs page and its spec behave as before
  (`test:component module-cem-list`, and the filter narrows the list on the built docs page).
  Variant sets stay byte-identical.
  **Channel/tier:** none. Corpus authoring under the existing LTC083.
