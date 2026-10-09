# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Iteration opened 2026-10-09: the first package and the P6 remainder.** The previous
iteration (the P6 cleanup round and the composition batch, opened 2026-10-06) closed on
2026-10-09. The `writer` recorded it in `CHANGELOG.md [Unreleased]`, and its 38 entries are
pruned (`queue/LEDGER.md`, eighth pass).

**Why now (Architect, 2026-10-09).** The first publish waited for the P6 cleanup round (owner,
2026-09-19). That round has closed apart from the conversions LT-463 left raw. D-32 is ruled
(LT-471), so P1 opens unblocked: LT-480 reshapes the contract and LT-254 publishes it. The P6
remainder runs beside it and empties the band, so the corpus a consumer meets in the first
pre-release composes every site LT-463 named. Template emission (LT-257) cannot be built
against ADR 0043 as written, so its design session runs now and the build follows next
iteration.

**Rulings taken at planning (Architect with the owner, 2026-10-09).**
1. **Scope: P1's package track, the P6 remainder, two design sessions and two P2b items.**
   LT-480 → LT-254 → LT-377 build the package. LT-489, LT-492 → LT-493, LT-494 and LT-517 are
   P6, and so is LT-518, the writer copy pass the eighth prune found owed. LT-514 moves from P7 to P6 and joins: it is the last label-as-children conversion and
   needs only P6 work. LT-516 (ADR 0043 amendment) and LT-484 (async-boundary arm roots) are
   design sessions. LT-483 joins from P2b (owner).
2. **LT-259 and the pioneers stay out (owner).** The codemod's drift-cost metric is unruled,
   and its check runs over the pioneer-1 project. It pairs with LT-260, which needs both
   LT-254 and LT-259. LT-257 and LT-261 wait for LT-516's split.
3. **The package is built, not published.** LT-254's check is `npm pack` into an empty
   project. The first pre-release to the registry is an outward-facing act and waits for the
   owner, after this iteration.
4. **One compiler track at a time through the analysis passes** (track X): LT-483 → LT-492.
   LT-483 edits `handleAsyncBoundary` in `analysis/effects.ts`, and LT-492 changes the
   composed-content refusal and its lowering. Run in parallel, they would conflict at
   integration. If LT-484's session rules parity, its compiler task joins track X after
   LT-492.
5. **module-todo and BasicButton change in one order** (track B): LT-489 → LT-494 → LT-514.
   LT-489 and LT-494 both edit module-todo's two surfaces, and LT-514 then moves the sites
   they compose to passed children (LT-514's sequence note).
6. **LT-480 runs alone in the contract files.** It moves `compileCorpus` into
   `server/compiler/` and narrows `RegistryEntry` (ruling 4: every compose-validation field is
   internal). Tracks X and B do not edit `contract.ts`, `registry.ts` or `corpus-compile.ts`.
   A task that finds it must, stops and writes it in `NOTES.md`.
7. **Standing rulings carried from the last iteration.** Acceptance criteria are goals, not
   constraints to satisfy by workaround: a contributor who can meet one only by bending the
   design annotates the task `blocked` and writes the impasse into `NOTES.md` (ruling 8 of
   2026-10-06). An `examples` task that edits a compiled source gates `test:server` and
   `typecheck` (ruling 13 of 2026-10-06). Corpus-level checks stay in P7 (ruling 15 of
   2026-10-06).

**The chain.**
- **R — the package** — P1; the contract reshape runs alone in the contract files (ruling 6).
  ~~LT-480~~ → ~~LT-254~~ → ~~LT-377~~ — the track is complete. (LT-480 reviewed ✓ and integrated
  2026-10-10, b482d527; LT-254 reviewed ✓ and integrated 2026-10-10, 560d91e9 — the package
  stands up, both surfaces, `./macros` + `./runtime`, the peer floor under `check:peer`;
  LT-377 reviewed ✓ and integrated 2026-10-10, 5a62171e — `check:contract`'s second phase pins
  D-33 on the emitted `.d.ts`.) ~~LT-521~~ — LT-480's generated-comment golden re-pin —
  reviewed ✓ and integrated 2026-10-10, 5c3fc619 (the re-pin proved vacuous: no golden carries
  the string; exactly one regenerated line moved). The track is closed with no residue.
- **X — compiler, analysis passes** — one at a time (ruling 4). ~~LT-483~~ → ~~LT-492~~ →
  ~~LT-493~~ → ~~LT-519~~ → ~~LT-520~~. (LT-519 joined by owner instruction, 2026-10-09: filed from
  LT-492's review after the chain was written; P6 band remainder, needs satisfied. LT-520
  filed 2026-10-10 from LT-514's review — the decorated-candidate precision gap; it follows
  LT-519 by `needs:` so the track stays one-at-a-time, and it re-pins the module-todo
  snapshots LT-519's legs sit beside. Both reviewed ✓ and integrated 2026-10-10, c999cb2 and
  9fd470f6.)
- **B — module-todo and BasicButton** — ruling 5. ~~LT-489~~ → ~~LT-494~~ → ~~LT-514~~
  (integrated 2026-10-09/10; the band's conversions are done).
- **D — test harness** — beside everything. ~~LT-517~~ (the probe differential's composed
  leg, integrated 2026-10-09).
- **W — writer copy** — beside everything; area `docs`, a `writer` session. ~~LT-518~~
  (landed 2026-10-09). LT-522 (filed 2026-10-10 from LT-254's review: the compiler package's
  user-facing copy — README, §2 install passage, one experimental-label wording).
- **Design gates** — area `design`: the Architect with the owner, never picked by `start-task`.
  ~~LT-516~~ (ADR 0043 amendment) ruled 2026-10-10 — D-28 closed: the `boundary` operation
  with a three-state result arg, `loop` + `listTemplate` for reactive lists, capture-and-raw
  children through the `composed-markup` context; LT-257 split into LT-527 → LT-528 → LT-529
  (against the new repository, `needs: LT-524`). LT-484 (boundary arm-root parity) is still
  owed. Neither gate holds the iteration open beyond its own ruling: each ends in an amended
  ADR or a recorded refusal, plus banded follow-up tasks. ~~LT-523~~ (the compiler
  repo split) ruled 2026-10-10 → ADR 0049; its chain LT-524 → LT-525 → LT-526 is staged as the
  NEXT iteration's opening, after this one closes.

**Deliberately not here.** LT-259, LT-260, LT-527 → LT-528 → LT-529 (the emission chain,
LT-257's split; ruling 2) and LT-261. The rest of P2b,
including LT-381 (it changes the census by design and needs the owner's sign-off) and LT-246.
LT-515 (lazy children in composed content) and the corpus-level checks stay in P7. P2–P5 stay
where they are.

**Exit criterion.** Every chain task is reviewed and integrated, and both design sessions have
ruled. `npm pack` of `@zeix/le-truc-compiler` installs into an empty project and builds a
corpus through the published entry point — two `.tsx` components, one composing the other, plus one `.tsrx` component proving the experimental surface ships — with `@tsrx/core` only inside the compiler's own dependency closure
(LT-254's check). `contract.test.ts` pins LT-480's set, and `registry.json` carries only the
public projection. P6 is empty: module-splitview and module-todo compose every site LT-463
named, and no corpus form component or BasicButton renders its visible label from a `string`
arg where LT-514 moves it to children. The tier census and the warning baseline are unchanged
from the opening measurement below, except where a task states a by-design change. `typecheck`,
the server suite, `check:contract`, `check:corpus`, `test:variants`, `build:docs` and
`check:links` are green on the closing commit. The net line count of `server/compiler/` is
recorded against the opening measurement; LT-480 grows it by the code it moves in.

**Opening measurement (2b26f032):** `check:corpus` exits 0. The tier census has 43 entries:
36 Folded, 7 Simulated, 0 Static. The compile-warning baseline is 1 unique standing warning,
module-dialog's `body.scroll-lock` (LTC088), a deliberate component-bound page-wide rule that
ruling 7 excepts. The translation census has 0 gaps across 6 locales. `server/compiler/` has
83 modules and 41.4k lines (every `.ts` file except `*.test.ts`, the same net as the 2026-10-06
measurement).

**Status 2026-10-10, after LT-520's review (Architect).** Tracks B, D, W and all of X
(LT-483 → LT-492 → LT-493 → LT-519 → LT-520) are integrated and reviewed. Track R is open:
**LT-480** (already claimed ⚙), then LT-254, then LT-377. LT-516 and LT-484 are design
sessions with the owner — a contributor session does not pick them; they are the only
non-R work left. The writer changelog sweep runs when the iteration closes, not per task.

**Status 2026-10-10, after LT-480's review (Architect).** LT-480 is reviewed ✓ and integrated
(b482d527) — the contract is the D-32 shape: `compileCorpus` published, `RegistryEntry` the
ten-field projection with the `registry.internal.json` sidecar, ADRs 0036 + 0038 amended.
**Pickable now: LT-254** (publish the package — `npm pack` into an empty project; the contract
set it builds on is pinned and green). LT-521 (the generated-comment golden re-pin, LT-480's
residue) is pickable beside it — it touches no contract file. Then LT-377 closes track R.
LT-516 and LT-484 remain design sessions with the owner, never `start-task` picks.

**Status 2026-10-10, after LT-377's review (Architect).** Track R is complete: the contract
reshape (LT-480), the package (LT-254) and the D-33 declaration pin (LT-377) are all
reviewed ✓ and integrated. The iteration's remaining work is four items: **LT-521**
(contributor pick — the golden re-pin above), **LT-522** (a `writer` session, the compiler
package's user-facing copy), and the two design sessions with the owner, **LT-516** and
**LT-484**. When the first two are integrated and both sessions have ruled, the iteration
closes: the `writer` changelog sweep runs, and the exit criterion is verified on the closing
commit. (`typecheck` reads green at HEAD again — the LT-480 pin-test TS2769 residue was fixed
on v3 in LT-377's review session, a one-line assertion widening in
`corpus-config.test.ts`.)

**Status 2026-10-10, after LT-521's review (Architect).** Track R is closed with no residue
(LT-521 reviewed ✓, integrated 5c3fc619). The iteration's remaining work is three items:
**LT-522** (a `writer` session, the compiler package's user-facing copy) and the two design
sessions with the owner, **LT-516** and **LT-484**. When LT-522 is integrated and both
sessions have ruled, the iteration closes: the `writer` changelog sweep runs, and the exit
criterion is verified on the closing commit. (`typecheck` reads green at HEAD — the LT-480
pin-test TS2769 residue was fixed on v3 in LT-377's review session, and holds through
LT-521's branch.)

**Status 2026-10-10, after LT-522's review and the LT-523 session (Architect).** LT-522
reviewed ✓ and integrated (409315c8) — the writer copy pass is in. LT-523 ruled the same day →
ADR 0049: the compiler moves to its own repository (fresh history, `link:` dev loop, mirrored
fixture corpus, public repo). The split chain LT-524 → LT-525 → LT-526 opens the NEXT
iteration; LT-516's template-emission build tasks file against the new repository once the
cutover lands. This iteration's remainder: the LT-516 and LT-484 sessions only — when both
have ruled, the writer changelog sweep runs and the exit criterion is verified on the closing
commit (typecheck is green at HEAD).

**Status 2026-10-10, after the LT-516 session (Architect).** LT-516 ruled with the owner →
ADR 0043 revised in place (D-28 closed: the `boundary` operation with a three-state result
arg; `loop` + `listTemplate` for reactive lists; capture-and-raw children through the new
`composed-markup` escaping context; key-alias confirmed as a census outcome). `COMPILER_SPEC`
§9.2 carries the new mappings and D-28 is Ratified. LT-257 is pruned into LT-527 → LT-528 →
LT-529 — the shared walk with the census folded in, the Twig target, the PHP CI job — all
`needs: LT-524` and building in the new repository (ADR 0049 sequencing). The iteration's
remainder: the LT-484 session only. When it has ruled, the writer changelog sweep runs and
the exit criterion is verified on the closing commit.

**Next free task ID: LT-530.** Next free diagnostic code: LTC091 (LTC090 is LT-527's; LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-527's
(LT-257's before the split);
LTC056 is LT-358's).

---

<!-- entries -->

### Design gates

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

- [ ] LT-484: An element root of an async boundary's pending or catch arm refuses every client construct, while a reactive conditional's element arm root plans them — decide whether boundary arms gain parity.
  **Area:** design
  **Area:** design
  **Filed (Architect, 2026-10-07, from LT-481's residue 3):** the two arm-set kinds treat their
  element roots differently. A reactive `@if`/`@switch` arm root plans its client constructs in
  the arm's mount through `emitConstructEffects`. An async boundary's pending or catch element
  root refuses every client construct except the catch-parameter text channel (LT-449). LT-481
  made a compose root in those same arms plan its `truc:pass` entries, so an author can now pass
  a reactive value to a composed pending root but cannot bind a reactive attribute on an element
  pending root. Both lowerings are arm mounts under `reconcile()`.
  **Question for the session:** should pending and catch element roots plan constructs the way
  reactive-conditional arms do? Or is the refusal deliberate (ADR 0041's three-arm boundary,
  with the in-flight state as the `isPending` idiom outside the boundary) and should be kept,
  with a sharper message that names the idiom? Read ADR 0037, ADR 0041 and LT-449 before
  ruling. Out of the session comes either a `compiler` task or a recorded refusal.

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
