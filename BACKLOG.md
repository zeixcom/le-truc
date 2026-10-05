# BACKLOG

Planned tasks out of scope for the current iteration. Part of the per-task queue store
(owner, 2026-09-18; store since 2026-10-03):

- **BACKLOG.md** (this file) — everything planned; new tasks are created here, with full context.
- **TODO.md** — the current iteration only. The Architect moves tasks here at iteration
  planning; do not start a task that is still only in this file.
- **DONE.md** — done-and-reviewed tasks since the last release, compacted to what is still
  load-bearing (rulings recorded nowhere else, live handoffs by ID, changed-artifact facts for
  the `writer`'s changelog).

Only the Architect moves tasks between files; contributors annotate the status suffix on the entry in place. Task IDs are global and
sequential across all three files; the "Next free task ID" line lives in the `queue/ITERATION.md` header.
Bands below are priority-ordered: they are the planned pick order for future iterations, not a
schedule. Band preambles may narrate landed work as history — the compacted records live in
DONE.md.

**Where landed work went.** Compacted done entries live in `DONE.md`; the rationale for what
shipped lives in `adr/` (0024, 0026–0033), `ARCHITECTURE.md`, `server/compiler/LE_TRUC_COMPILER.md`
and `server/compiler/HOST_PROFILE.md`; the user-facing summary lives in `CHANGELOG.md`
`[Unreleased]`; the full task-by-task record stays in `git log -p`. Do not re-derive a decision
from a task entry — read the ADR.

**Strategic framing (2026-09-18).** The owner has stated the governing premise: this repo is the
playground — the goal is a general-purpose framework employed in thousands of projects by users of
the open-source library. [COMPILER_REFLECTION.md](https://github.com/zeixcom/le-truc/blob/6d0544a6/COMPILER_REFLECTION.md) (the six-question
compiler reflection, written the same day) evaluates the compiler against the repo alone; its
recommendations were re-derived under the framework premise when this queue was re-prioritized.
Consequences structured as tasks: the three S0 rulings (moved into TODO.md as the current
iteration) gate the bands beneath them; the wave-3 items are re-pointed from
author-the-shared-thing to adopt-the-maintained-library where one exists; the parity equivalence
contract extends to diagnostics (LT-242). REQUIREMENTS already declares the compiler ships as a
separate package (§5 Required) and the Simulated realm as a Must-Have (M20) — both face the
framework question explicitly, as owner-gated rulings, not by default.

**LT-241 is resolved** (owner, 2026-09-19; [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md),
REQUIREMENTS §1 / M27 / M28). The framework goal is declared, the criteria are external and
falsifiable, and the packaging track is the new **P1** band above. Three consequences reach the
rest of this file: (1) the published package is **`@zeix/le-truc-compiler`, TSX-only at 3.0** —
`@tsrx/le-truc` is dead and `.tsrx` publishes in a later 3.x, so any task naming the package or
treating `.tsrx` support as shippable at 3.0 is stale; (2) **template emission** (M27) is a v3.0
requirement on pioneer 2's critical path, and the **partial-readiness invariant** (ADR 0034 s4)
constrains every design in every band from here forward, not only P1's; (3) **LT-239 is resolved** ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md),
2026-09-19): the Simulated tier is **kept** and scoped **SSG-only for all of 3.x**, because a
simulated component's output cannot be expressed as a template and so never reaches pioneers 2
and 3. jsdom stays an optional peer dependency, but that policy has a prerequisite this file
must sequence — **LT-263, the seam** — without which the compiler cannot classify, report or
typecheck with the substrate absent. Substrate pluggability is **not built** until a candidate
passes the sanitizer criterion (ADR 0027 s2, amended). Consequences elsewhere: **LT-188 runs**
(the tier survives), and the CI equivalence audit is now documented as the *second* consumer of
`sim/` — tier-adjacent tasks must not treat the realm as two components' machinery.

**Standing framing** (ADR 0029, accepted 2026-09-04). Server evaluation is three tiers:
**Folded** (phase 1 resolves it; string folding, no jsdom), **Simulated** (phase 1 cannot
complete AND the realm can answer; pre-played in jsdom), **Static** (neither; static skeleton,
the client corrects at connect). Tier is per **component**; unresolvability is per
**expression** — an impure ambient read (`Date.now()`, `Math.random()`) is omitted in every
tier and is not a routing signal. The compile-warning baseline's target is **zero**: routing
signals ride the tier census on `sim/report.ts`, not the diagnostic channel. Judge a migration
on zero warnings *plus* its recorded tier and reason.

---

## P1 — The v3.0 release track: packaging, template emission, pioneer adoption (ADR 0034)

**Moved to TODO.md 2026-10-02:** LT-370, LT-371, LT-373, LT-374, LT-375 (the pre-publish reshapes) and LT-277. LT-254, LT-257, LT-259–LT-261 stay behind P6.

**Provenance:** the LT-241 owner grilling session (2026-09-19) and [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md).
This band is **release-gating**: v3.0 does not ship until pioneer 1 is live on the published
package and template emission is verified against pioneer 2 (ADR 0034 s6, REQUIREMENTS §1
success criteria). It is placed above P2 for that reason, not because the work is larger.

**The fact that produced this band.** The compiler emits `*.client.ts`, `*.css` and
`*.server.ts` — a TypeScript module only a JS build can execute — so the Folded and Simulated
tiers have exactly one consumer runtime today: this repo's SSG docs site. Pioneers 2 and 3 are
CMS projects (Craft/PHP, AEM/Java) that cannot run it, and folding is build-time while CMS
markup is request-time. **LT-257 is the answer and it is on pioneer 2's critical path**; every
other task here is either what makes the package installable or what proves it worked.

**The standing invariant every task in every band must respect** (ADR 0034 s4, [M27](REQUIREMENTS.md#m27-backend-neutral-template-emission)):
a component's folded output may depend only on its own props and a **closed, enumerable set of
page-ambient values** — today the reserved `i18n` parameter's `lang`, `t`, `timeZone`,
`currency`, `dir`. A design that lets the fold read arbitrary page context forecloses template
emission and the CMS persona with it. LT-258 makes this checkable rather than remembered.

**[Amended 2026-09-19, owner — the publish date moves, and the band splits in two.]** The
earlier plan led with LT-254 on a squatting-risk argument. That argument does not apply:
`@zeix/le-truc-compiler` is in a namespace this project owns, so the name cannot be taken and
nothing about first publish is urgent. **The first publish happens no earlier than after the
P6 cleanup round** — publishing a package outside consumers cannot yet use is not a milestone,
and the pioneers being Zeix-owned does not change that. Consequently **LT-254, LT-259, LT-260,
LT-261 all sit behind P6**, and the P1 work that can proceed now is the part that has nothing to
do with distribution: the seams, the interfaces, and the de-TSRX-ification of a compiler still
shaped like this repo's internal tool. That part is **LT-271** (carved out of LT-254(c)),
**LT-263**, **LT-255 + LT-267**, **LT-256** and **LT-265**. All of them have landed and been reviewed
(history: `CHANGELOG.md [Unreleased]`, `git log`).
**LT-262 and LT-264 are non-goals for 3.0 and have moved to P7.**


- [ ] LT-254: Stand up the publishable package `@zeix/le-truc-compiler` (TSX-only) and discharge the LT-206 packaging deferrals. **Gated on LT-370, LT-371 and LT-375** (the pre-publish reshapes of what stays public: the IR leaves the contract, the diagnostic record takes its published shape, the root-is-host dialect is enforced) **and on the D-32 design session** (which compiler entry points and result types are public, `COMPILER_SPEC.md` §12). *Re-gated 2026-10-01:* the IR is internal (ADR 0034 s8, D-25), so the ADR 0040 reshapes (LT-288, LT-274, LT-276) no longer gate the publish.
  **Area:** compiler
  **Needs:** LT-370, LT-371, LT-375
  **Rider for the D-32 session (LT-370 copy review, 2026-10-02):** ADR 0034 s8 counts the
  generated-module API as public (a change is a major), but `contract.ts` and
  `LE_TRUC_COMPILER.md` §2 say semver applies to the designated set "and to nothing else", and the
  generated-module API is not in it. D-32 rules which way it goes: add it to the policy, or amend
  the ADR. Also there: `RegistryEntry` names `RenderedShape` and `SuppressedSite`, and neither is
  exported. `COMPILER_SPEC.md` Appendix B ("as of 2026-09-29") is stale beyond the two cells
  LT-370 fixed; refresh it in the same session.
  **Rider (LT-243 review, 2026-10-01):** `@typescript-eslint/typescript-estree` becomes a runtime dependency of the package. Weigh it under M28 with its closure: semver, debug, minimatch, ts-api-utils and the `@typescript-eslint/{types,visitor-keys,tsconfig-utils,project-service}` siblings. Record the `typescript` peer range the package inherits (`<6.1.0` at 8.71.0). Weigh it against D-33's stated goal (TypeScript 7.1 or a native parser behind the converter, ADR 0032 s4): the peer range must be able to follow TypeScript, and LT-377 pins that no TypeScript type reaches the published declarations.
  **Context:** ADR 0034 s1–s2. The compiler ships separate from the browser-only
  `@zeix/le-truc`, named for its function rather than its input format. **v3.0 publishes the
  `.tsx` front end only** — `.tsrx` stays a first-class repo-internal surface under ADR 0032's
  parity contract and publishes in a later 3.x gated on `@tsrx/core` 1.0, so the published tree
  must not carry the pinned pre-1.0 parser as a runtime dependency.
  **Deliverable:** (a) register `@zeix/le-truc-compiler` on npm **before the first pre-release**
  — verified available 2026-09-19, and a package name is the one decision that cannot be revised
  after first publish; (b) the package manifest, entry points, and a build that excludes the
  `.tsrx` front end from the published artifact without deleting it from the repo; (c) the
  LT-206 deferrals, now scheduled rather than parked: the `check:tsrx`/`build:tsrx` script names,
  `server/effects/tsrx.ts`, the `server/generated/tsrx/` output directory, the `@tsrx/core`
  package names in internal APIs, and the `TSRX###` diagnostic codes — each either renamed to
  surface-neutral vocabulary or consciously kept, with the reason recorded. **Diagnostic codes
  become public API on first publish**: a code that keeps the `TSRX` prefix while the published
  surface is `.tsx` needs a stated rationale, and the copy of anything
  renamed follows `writer` → error-messages (channel: compiler; the error-message-lifecycle sweep applies).
  **Check:** `npm pack` on a clean checkout produces a tarball that installs into an empty
  project and compiles a single `.tsx` component, with no `@tsrx/core` in the dependency tree.
  **Added 2026-09-24 (ADR 0034 s8):** declare `@zeix/le-truc` as a peer dependency with a
  floor, and add a build check that every runtime export the emitted client modules import
  exists at that floor (resolve the imports against the floor version's published export
  list). ~~State in `contract.ts`'s stability policy that adding a member to an IR union is a
  minor~~ — obsolete 2026-10-01: the IR is not public (ADR 0034 s8; LT-370 removes it from `contract.ts`).
  **Re-scoped 2026-09-19 (owner):** deliverable **(c) — the LT-206 deferral sweep — is carved out
  as LT-271** and runs now, because stripping TSRX-only vocabulary from a compiler whose published
  surface is `.tsx` is a shape problem, not a distribution problem, and it should not wait on a
  publish date. What remains here is (a) and (b): the npm registration and the package manifest,
  entry points and `.tsrx`-excluding build. **Gated behind the P6 cleanup round** — the namespace
  is owned, so the name cannot be taken, and there is no value in publishing a package an outside
  consumer could not yet use. LT-259, LT-260 and LT-261 inherit that gate.
  **Carried in from the LT-255 review (2026-09-19):** LT-255 shipped the corpus configuration
  surface without waiting for this task ([ADR 0036](adr/0036-corpus-configuration-surface.md)),
  so "where the config lives" is settled and no longer gates it. One line comes back here:
  **`runtimeImport`'s default must flip** from this repo's relative
  `'../../compiler/runtime'` to the published package specifier
  (`DEFAULT_RUNTIME_IMPORT` in `server/compiler/emit-paths.ts`), at which point consumers stop
  having to set the field at all. Until then every installing project must set it by hand —
  which is the single most visible "this is not published yet" seam in the config surface, and
  a reason the first pre-release should not be demoed without it.


- [ ] LT-257: Template emission — **build the target-emitter interface ([ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md)) with Twig as its first implementation** ([M27](REQUIREMENTS.md#m27-backend-neutral-template-emission)). **Release-gating; pioneer 2's critical path.**
  **Area:** compiler
  **Needs:** LT-254, LT-274, LT-373
  **Re-scoped (Architect, 2026-10-01):** the interface was designed in LT-360 and is ADR 0043.
  This entry is the build half. Read the ADR first; this text only names the deliverables.
  **Context:** ADR 0034 s3. For a CMS, a folded HTML partial and a template are the same
  artifact: page props are *content*, so pre-folding per prop signature is combinatorially dead.
  The fold resolves everything prop-independent and leaves each server arg as a **hole**.
  **Deliverable:**
  - The shared template walk over the settled IR, writing through `HtmlWriter` (LT-234): the
    emission-operation vocabulary, portable-subset classification (ADR 0043 s1), escaping-context
    assignment and the shared refusals (s3), emittability per component (s2), and the
    `conditional` node's initial winner as a backend conditional beside inert arm templates (s4,
    built by LT-274).
  - The Twig target: syntax table, exhaustive escaping map, `{% include … only %}` composition
    (s5), one partial per component × locale (s6), the declared host helpers — URL allowlist
    check, `le_truc_sanitize_html`, `le_truc_format` over `MessageFormatter` — listed in the
    manifest for the integrator.
  - Census: per-component tier per target, with the routing reasons (`non-portable initial`,
    Simulated → Static).
  - The trivial second target in `server/tests/compiler/targets/` only: an operation dump plus an
    in-process interpreter, compared byte-for-byte with SSG (s8).
  - CI: a PHP job (`twig/twig`, `intl`) running Twig equivalence, the adversarial escaping
    corpus and the ICU equivalence corpus; local runs skip without `php`.
  - Spec sweep (`COMPILER_SPEC.md`): §3.8 drops "calls to functions marked pure"; §9.2's mapping
    table follows ADR 0043 (message calls as pattern-literal formatter calls, `Compose` with the
    closed-scope include); D-23 and O-6 close; §3.7's "the library ships no sanitizer" is
    corrected for the fail-closed escaping default. *Done 2026-10-01 by the Architect in the §13
    team review* — the spec now follows ADR 0043 in §3.7, §3.8, §6.3, §9.1 and §9.2; nothing left here.
  - **`Try` in template targets is undecided** (D-28, deferred to a design session that amends
    ADR 0043). Do not build a placeholder mapping; until the session rules, a `Try` in a
    template-target build has no defined output, so sequence the Twig target's boundary handling
    after that session.
  **New diagnostics (compiler channel, Prevented; only when a template target is configured):**
  LTC057 — a non-portable expression in a hole position (one face for `Intl` formatting over a
  hole, naming the ICU-pattern fix); LTC058 — a hole in a refused position (faces:
  `<script>`/`<style>` content or comment, `on*`/`srcdoc`, attribute or tag name, whole-string
  `style`). LTC056 is taken by the authored-`<script>` refusal (LT-358 rider). Copy follows
  `writer` → error-messages.
  **Depends on** LT-254 (where it ships), LT-274 (the `conditional` node), LT-373 (the reactivity
  class the hole classifier reads), and the D-28 session for `Try`. LT-258, LT-313 and LT-234 have landed.
  **Check:** every corpus component emits a Twig partial in its tier; the escaping corpus passes,
  negative cases included; the test-only second target passes the same equivalence with no
  change to the Twig target or the shared walk; Twig renders are byte-identical to SSG for every
  fixture × locale; zero-warning baseline unchanged for builds with no template target.

  **Added 2026-10-01 — the `COMPILER_SPEC.md` §13 team review** (decisions D-07, D-20, D-25,
  D-26, D-30, D-33; recorded in ADRs 0032, 0033, 0034, 0040, 0044 and `HOST_PROFILE.md` the same
  day). D-04 is parked, D-28 and D-32 are deferred to design sessions, section 15 is open; none of
  those has a task yet.


- [ ] LT-259: The 2.x → 3.0 codemod, and the drift-cost measurement it instruments.
  **Area:** compiler
  **Context:** ADR 0034 s6. Pioneer 1 is a Zeix SSG project migrated from Le Truc 2.x, and
  nothing in the queue covered `.ts` + `.html` + `.css` → `.tsx` until now. The owner's read,
  recorded because it scopes the task: the conversion is always possible — JSX reflects the
  static HTML, the factory body copies over verbatim and already runs, and deterministic
  transforms (inline event handlers, 1:1 effects) do ~80%.
  **It is codemod-assisted, not push-button, and must be documented as such.** The residue is
  chiefly resolving `first()` selectors to structural JSX — the hard cases land exactly where the
  old code was sloppiest, which is the drift the compiler exists to eliminate. Deliverable shape:
  a compiling `.tsx` plus a **report of what it could not resolve**, for judgement. At pioneer
  scale (~50 components) that residue is affordable; sold as push-button it disappoints on
  pioneer 1.
  **Second job — it is the measurement instrument.** The drift-cost data point is a before/after
  on the same components, so the 2.x baseline must be captured **before the codemod runs**.
  Define what is measured (the metric is the task's first decision, not an afterthought) and
  record it where REQUIREMENTS §1's criterion can cite it.
  **Check:** the codemod run over this repo's remaining hand-written twins, and over pioneer 1,
  produces compiling sources plus an honest residue report; the baseline exists before either run.


- [ ] LT-260: Pioneer 1 — take the Zeix SSG project live on the published package, through pre-releases. **Release gate.**
  **Area:** design
  **Needs:** LT-254, LT-259
  **Context:** ADR 0034 s6; REQUIREMENTS §1 success criteria. This is the criterion that can
  actually fail: until a project outside `examples/` compiles through the published tool, every
  compiler line amortizes over 22 demo components. Verified through a **series of pre-releases**,
  so the feedback arrives while the API can still change.
  **Deliverable:** the migration executed with LT-259; the pre-release cadence and what each one
  is meant to learn; the drift-cost number captured and written into REQUIREMENTS §1; a recorded
  list of everything the engagement forced back into the compiler, since that list is the honest
  measure of how repo-shaped the tool still was. **Blocks the v3.0 release.**
  **Check:** the project is in production as the release showcase and builds from a published
  version, not a workspace link.


- [ ] LT-261: Pioneer 2 — verify template emission against the Zeix Craft (PHP) project. **Release gate.**
  **Area:** design
  **Needs:** LT-257
  **Context:** ADR 0034 s3/s6. LT-257 is the mechanism; this is the proof, and the owner has
  ruled it must pass **before v3.0 releases**. What is being verified is not that Twig files are
  produced but that a CMS page carries **real content in its initial HTML with no JavaScript**.
  **Deliverable:** the Craft integration — where partials land, how the build fits their
  pipeline, how the `i18n` ambient set is passed through the include; the escaping contract
  exercised against real content, adversarial cases included; a recorded list of what the
  emitter had to grow. **Depends on LT-257. Blocks the v3.0 release.**
  **Check:** JavaScript disabled, a Craft-rendered page shows content-bearing folded markup from
  a compiler-emitted partial; enabling JavaScript corrects nothing that was already right.


- [ ] LT-377: Pin that no TypeScript type reaches the published declarations (D-33).
  **Area:** compiler
  **Context:** ADR 0034 s8 (2026-10-01): no TypeScript type appears in the public API, so the
  engine can move to TypeScript 7.1 or a native parser without a major. ADR 0032 s4 already
  confines `typescript` API use to the converter. Add a contract check that the package's
  emitted `.d.ts` files import nothing from `typescript` or `@typescript-eslint/*`. Lands with or
  after LT-254's declaration build.
  **Channel/tier:** none (a build check).
  **Verification:** the check fails on a planted `ts.Node` in a public type; full gates.

## P2 — Internationalization follow-ups (ADR 0030)

**Moved to TODO.md 2026-10-02:** LT-353, LT-355, LT-356.

**Pruned 2026-09-17** — LT-173 (reserved `i18n` parameter + catalog pipeline), LT-175
(render-cache measurement; its containment landed in LT-174, its removal ruling became
LT-193), LT-174 (per-locale page rendering), LT-190 (per-category message keys), LT-191
(locale inheritance, `lang` config-only), LT-192 (review residue) all landed and reviewed;
ADR 0030's corpus-multiplication consequences bullet was retracted in place 2026-09-07.
History: `git log -p`, ADR 0030, `CHANGELOG.md` `[Unreleased]`, and the compacted entries in
`DONE.md`. Two review
handoffs became tasks: **LT-201** (the ADR amendment; done — DONE.md) and **LT-189** (the
Writer copy round, scope widened).

**The ICU MessageFormat switch landed 2026-10-01** (iteration opened 2026-09-25: LT-250, LT-308,
LT-252, LT-251, LT-253, LT-218, LT-219, LT-220, LT-189, with LT-242, LT-233, LT-249 and LT-138).
The entries below are that iteration's review follow-ups. LT-358 and LT-359 moved to `TODO.md`
2026-10-01.

**LT-351's byte cost, re-ruled at planning (Architect, 2026-10-01).** The planning input
quoted basic-pluralize at 226 → 728 bytes (cy 373 → 1015). Those are the LT-252 figures from
before **LT-354**. After LT-354 a source-locale render writes no attribute (en 728 → 189), and
cy is 957. ADR 0030's "Markup shrinks" consequence was already corrected to "Fewer elements",
with the byte cost moved to the tradeoffs (LT-351). The ruling stands: the residual cost is per
instance, per non-source locale, per adopting component. No lever applies to a single instance
(single-quoting was declined at 48 bytes gzipped). The one lever left is **deduplicating across
instances**, and it only pays when a tag repeats on a page. So growth is measured, not argued:
**LT-362**.

---


- [ ] LT-352: Pin the hand-copied `i18n` attributes on the examples test pages against the real render (LT-219 review).
  **Area:** compiler
  **Needs:** LT-354
  **Context:** `/test/:component` serves each example's `.html` raw — the page renderer never
  runs there — so `form-tokenbox.html`'s `#german-test` instance carries an `i18n` attribute
  copied by hand from `renderFormTokenbox()` at `de` (LT-219). A later edit to a tokenbox
  pattern or to the de catalog leaves that copy stale, and the Playwright spec then passes
  against wording the build no longer serves. Add one server test that renders the instance's
  args at its `lang` and compares the attribute bytes with the page's. Prefer a small table of
  (page, instance id, tag, args) over a per-component test, so the next hand-copied instance
  is one row. Since LT-252 the table also needs `basic-pluralize.html`'s six locale instances
  (`#welsh-test`, `#german-test`, `#chinese-test`, `#arabic-test`, `#polish-test`,
  `#latvian-test`). **Runs after LT-354**, which rebaselines these bytes. Add
  `module-coloreditor.html`'s pre-rendered form-colorgraph and form-spinbutton (`:22`) as rows:
  they carry no attribute, which is correct at en once LT-354 omits source-equal keys, and the
  pin keeps it so. **Channel:** none (a test). **Check:** editing `form-tokenbox.added` in de.json
  without touching the page fails the test.


- [ ] LT-362: Report client-message bytes per page in the build report, with the dedupe trigger (LT-351 follow-up, re-ruled 2026-10-01).
  **Area:** server
  **Context:** ADR 0030 s9's per-instance `i18n` attribute costs bytes per instance, per
  non-source locale, per adopting component (basic-pluralize cy: 957 bytes after LT-354). Today
  the only measurement is one pinned component in `gate-wave-verification.test.ts`, so growth
  as components adopt the channel is invisible. Add to the build report, per served page: the
  total raw and gzipped bytes of `i18n` attributes, and the largest repeat (the same tag with
  byte-identical attributes, N instances). **Trigger, recorded here so nobody has to argue it
  later:** when any served page carries the same tag's identical attribute on 3 or more
  instances, or the page's `i18n` attributes exceed 2 kB gzipped, the Architect opens the
  cross-instance dedupe design (one per-page, per-tag carrier that the instances reference). Per-locale client modules stay
  declined (LT-351 ruling 2). **Channel:** build report (not a warning, no code); the warning
  baseline is untouched.
  **Check:** the report lists basic-pluralize's test page at cy with the LT-354 byte figure. A
  fixture page with three identical instances shows the repeat.

## P2b — Compiler product-readiness: equivalence contract, consolidation, library substitutions (external review + reflection, 2026-09-18)

**Provenance:** [COMPILER_REVIEW.md](https://github.com/zeixcom/le-truc/blob/6d0544a6/COMPILER_REVIEW.md) — an external review of all of
`server/compiler/` (46 modules, ~21.9k lines **at the 2026-09-18 snapshot**; 69 / ~27.0k when
re-measured 2026-10-01 — re-measure, never cite either as current) by Claude Opus, evaluated by the Architect
2026-09-18. **The review held up:** all four correctness findings (§1) were independently
verified against the source (two by direct read — the `offenders`-array truthiness bug at
`frontend/tsx/lower-tsx.ts:641`, the `resolveComposeRefs` IR mutation at
`analysis/compose-refs.ts:118`; the rest via a verification pass), and a 16-claim structural
spot-check came back 13 clean / 3 with minor count drift and zero refutations
(`emitServerModule` is ~1,076 lines, not 993; the estree walks number 12, not ~11; the
drivers' early-exit literal appears 6× per file, multi-line). Task text cites the review's
section numbers; its file:line citations were accurate at capture except where noted —
`front-end.ts` has since been split (LT-224, done — see DONE.md) and `emit-server.ts` has
been refactored (LT-225), so re-grep before trusting line numbers in those files.

**Re-scoped 2026-09-18 by [COMPILER_REFLECTION.md](https://github.com/zeixcom/le-truc/blob/6d0544a6/COMPILER_REFLECTION.md) under the framework
premise (S0):** the equivalence contract is a product promise to users of both surfaces, so the
parity suite's diagnostic blind spot closes first (LT-242); and where a maintained library
already IS the shared thing the review proposed authoring, **adopt the library instead of
writing version twelve** (reflection §5) — LT-229/LT-231 re-pointed, LT-243/LT-245/LT-247 added.
**Sequencing (re-ruled):** LT-221–LT-226 (defects + dead surface + diagnostics hygiene + the
first two splits) are done (compacted in DONE.md). Planned pick order: **LT-242 first** (the
diagnostic-parity net — it then
verifies LT-233's message consolidation), **LT-233 before LT-218** as before; the
behaviour-preserving mechanical moves (LT-227/228) stay interleavable with feature work;
wave ordering holds (LT-228 before LT-229/LT-232, which name the files it creates); the library
substitutions (LT-243/LT-229/LT-231/LT-245) no longer sit behind S0's LT-239 — it is resolved
(ADR 0035: the tier is kept, SSG-scoped), so tier/evaluability-adjacent items proceed, coordinating
with **LT-263** where they touch `sim/report.ts`, `sim/patch-table.ts` or the realm's type surface; LT-247 after LT-234 (both
touch `spans.ts`); LT-246 after the wave-3 churn so the report format settles once; **LT-235 is
a grilling session, not cleanup** (its item (e) is carved out as LT-244). **No ADR is owed for
the mechanical band** — nothing there changes a documented decision (review §3; Architect
concurs); **LT-242 amends the ADR 0032 equivalence contract** and carries its ADR pass (the Architect).
**Declined with the review, recorded so future reviews don't re-propose:** memoising the §2.11
redundant traversals (not a measured problem; a second implicit-consistency contract is the
disease being treated) and restructuring `sim/` (§2.12 is doc/type-surface honesty, folded into
LT-222). The review's "LT-222+" numbering assumed LT-221 was taken; it wasn't.

**Moved to TODO.md 2026-10-01** (owner input: consolidation kept losing to feature work):
LT-227–LT-232, LT-234, LT-243–LT-245, LT-247, LT-287–LT-289, and from the CSS track LT-268,
LT-304, LT-306 and LT-248. LT-246 stays here until the census format settles after LT-274.
LT-247 came back 2026-10-01, parked and demand-gated (see its entry). The
reflection's line-count claims ("2.5–4k lines") are 2026-09-18 estimates. The iteration
records the actual net delta.

---

**Moved to TODO.md 2026-10-02:** LT-405, LT-407 and LT-408, behind the shadow-root departures design session (LT-409), which carries the owner ruling and the measured input facts. LT-305, LT-342 (ruled inside LT-280's session), LT-378, LT-387 and LT-390–LT-392 moved the same day.


- [ ] LT-246: Make tier contamination legible at the compose edge — the census names the re-routing edge.
  **Area:** compiler
  **Needs:** LT-109, LT-110, LT-111
  **Context:** Reflection §3's recommendation, promoted under the framework premise: the
  compose contamination fixpoint (LE_TRUC_COMPILER.md §5.2) means a parent that *reads* a
  child — `first()` addressing a compose site, or `truc:pass` into it — inherits the child's
  tier, so "I added a `first()` and my component left the Folded tier" is a different-tier
  outcome whose only footprint is the census. In-house that is an inconvenience; for
  thousands of external users it is a support ticket generator. The fixpoint already knows
  the edge it traverses — record it: the census reason for a contaminated component names the
  compose edge (parent file/tag → child tag) that caused the re-route.
  **Channel (ADR 0028/M23 posture):** build report / census record — not a warning, no new
  TSRX code; the warning baseline and the census's regression signal are untouched.
  **Verification:** a fixture whose parent re-routes via a compose edge shows the edge in the
  census reason; the corpus census stays 20/2/0 with reasons extended, not changed; goldens
  byte-identical (census text is not emitted code); full gates.


- [ ] LT-247: Adopt `magic-string` under `spans.ts` (reflection §5). — **parked 2026-10-01** (Architect): demand-gated only
  **Area:** compiler
  **Needs:** LT-234
  **Context:** Reflection §5 table: replaces `spans.ts`'s hand bookkeeping (~−150 lines) and
  buys **real source maps free** — which M25's span-table remapping and the playground
  (ADR 0025, Proposed) both want eventually. Runs after LT-234 (which settles `CodeBuilder`
  and `commonIndent()` so this swap touches one settled surface, not two in-flight ones).
  **Demand note, stated so this doesn't jump the queue:** the payoff is contingent — source
  maps matter when editor/playground tooling consumes them, and ADR 0025 is Proposed. Do it
  when that demand arrives OR as a small output-neutral swap if it retires code without
  changing bytes; goldens byte-identical is the gate either way.
  **Verification:** goldens + parity byte-identical; the span table's remapped positions
  unchanged on a diagnostic-sample fixture; full gates.
  **Ruling (2026-10-01, from the contributor's evaluation):** the "output-neutral swap that
  retires code" route is closed. `magic-string` edits one original string, but a generated
  statement is emitter glue with source slices interpolated and reindented over the assembled
  text, so the swap would add a `Bundle` and a mappings → `SourceSpan` conversion (every
  consumer reads `SourceSpan`) instead of deleting the recorder. LT-234's `CodeBuilder` already
  took the span bookkeeping. It also turns a transitive dependency (via `@tsrx/core`, repo-
  internal) into a direct one of the published `.tsx` compiler. **Reopens only when** a real
  source-map consumer exists: ADR 0025 (playground) accepted, or editor tooling that reads
  standard source maps. The task is then "emit a standard source map", and `magic-string` is one
  candidate among several (deriving a v3 map from `SourceSpan` directly is the other).
  Struck from the current iteration's exit criterion.


- [ ] LT-363: Harden the shared estree walk for constructs the corpus never saw (LT-229 review).
  **Area:** compiler
  **Needs:** LT-243
  **Context:** LT-229's guarantee that the borrowed keys reach everything the old walks reached
  rests on a one-off audit of 51 corpus files. Nothing pins it, and the corpus is exactly the
  input the framework premise says to distrust. Three parts:
  (1) **Pin the key-coverage invariant.** Add a construct-zoo fixture for both parsers (classes
  with `implements`/decorators/parameter properties, enums, namespaces, `satisfies`, generics,
  overloads, `declare`, abstract members, accessors, labeled loops) plus the corpus. Assert that
  every node-valued key on a type `eslint-visitor-keys` knows is in KEYS, `TYPE_POSITION_KEYS`,
  or a comment key. An exception needs an explicit allowlist entry with a decision. A
  `@tsrx/core` bump that adds a key then fails a test instead of silently dropping a subtree.
  (2) **Make `'skip'` mean "erased".** Today it only drops type-position *keys*, so TS type-only
  declarations nested in code still leak. `freeIdentifiers` over
  `() => { type Row = {…}; interface Box { width: number } … }` returns `Row`, `Box`, `width` on
  `.tsrx`, and only `Row`, `Box` on `.tsx`. Under `'skip'`, skip `TSTypeAliasDeclaration`,
  `TSInterfaceDeclaration`, `TSDeclareFunction` and `declare`-flagged nodes wholesale. Keep the
  runtime-bearing TS nodes walked: `TSEnumDeclaration`, non-`declare` `TSModuleDeclaration`,
  `TSParameterProperty`, and the expression wrappers `as`/`satisfies`/`!`/`<T>x`/instantiation.
  (3) **Complete the scope walk.** `ClassDeclaration`/`ClassExpression`/`TSEnumDeclaration`
  bind their id. Non-computed `MethodDefinition`/`PropertyDefinition`/accessor keys are not
  reads (today `class K { m() {} }` reports `K` and `m`). **Mostly landed under LT-231
  (2026-10-01):** class ids, member keys, labels, function hoisting, named function
  expressions and parameter defaults are done and pinned in `converged-answers.test.ts`. What
  remains: `TSEnumDeclaration` binding its id, and a class declared later in a block but read
  from an earlier closure (`function f() { return new C() }; class C {}`), which is legal JS
  and still reports `C`. That is the same sequential-binding model `const` uses, so fix both
  or neither, and state which.
  Then add a surface-parity assertion: `freeIdentifiers` agrees on every zoo construct across
  `.tsrx` and `.tsx`.
  **Sequencing:** after LT-243. typescript-estree replaces `to-estree.ts`, which today drops or
  flattens several zoo constructs on `.tsx`. Weigh `@typescript-eslint/visitor-keys` (a
  superset of eslint-visitor-keys with TS node keys) for the fallback path then. It is the same
  maintainer and the same pure-data shape, and would turn the TS fallback into borrowed keys too.
  **Channel/tier:** none. No diagnostic is added; each changed answer is a correctness fix to an
  existing analysis, pinned per site as LT-229 did.
  **Verification:** goldens + parity byte-identical (the corpus has no nested type-only
  declarations; prove it); the invariant and parity tests; full gates.


- [ ] LT-369: Converge the `.tsrx` in-template client-statement name check onto the setup one (LT-231 review).
  **Area:** compiler
  **Context:** A bare client-only statement beside conditionally rendered `.tsrx` markup
  (`frontend/tsrx/lower-template.ts`, the `client-stmt` lowering) accepts only `JS_GLOBALS`,
  `CONTEXT_NAMES` and signals. The same statement at top level goes through
  `setup-extraction.ts`'s `clientKnownName`, which also accepts refs, setup consts, authored
  imports, expose ambients and the `CLIENT_ONLY_PRIMITIVES`. LT-231 left them apart on purpose.
  Widening the narrow one is only sound if the client module actually EMITS what the statement
  reads at its guarded position, and `computeClientNeededNames` does not walk `client-stmt`
  nodes today. So: extend the client-need walk to `client-stmt` nodes, then share one
  predicate. Pin a ref read and a plain-import read, each compiling and running in the
  generated client. Check the `.tsx` surface's equivalent (an expression statement in a branch)
  for the same answer; ADR 0032 s6 parity applies.
  **Channel/tier:** compiler. This removes false rejections; no diagnostic is added. Any reworded
  rejection copy follows `writer` → error-messages.
  **Verification:** corpus byte-identical; diagnostic parity; the new pins; full gates.


- [ ] LT-372: JSON and SARIF diagnostic reports (D-30, ADR 0044 s4).
  **Area:** compiler
  **Needs:** LT-371
  **Context:** ADR 0044 makes reports views of one diagnostic stream. The terminal reporter is
  the only one today. Add a JSON report (the records as data, censuses as separate records) and a
  SARIF report for CI code scanning, both selectable from the build's CLI. Additive: neither
  changes the record, so this may land after the first publish. A TypeScript language-service
  plugin is a further view and not part of this task.
  **Depends on** LT-371 (the record shape).
  **Channel/tier:** none.
  **Verification:** the SARIF output validates against the 2.1.0 schema; a JSON snapshot of a
  failing fixture build; locations match the terminal view; full gates.


- [ ] LT-381: Widen `first()` verification — authored selectors verified against the materialized probe (LT-245/ADR 0045).
  **Area:** compiler
  **Needs:** LT-379
  **Context:** [ADR 0045](adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md) Decision 5 stages this deliberately apart from the engine promotion (LT-379): once the probe is the engine, an authored `first('nav a.active')` — descendant combinators, `:not()`, attribute operators, all shapes `parseSimpleSelector` returns "cannot verify" for — can be structurally verified by querying the SAME materialized probe, and then used as the addressed contract verbatim (LT-316's authored-first rule) instead of falling back to synthesis. **Authoring-visible change:** selectors that previously fell back to synthesis become the addressed contract, and a verified-but-unmatched authored selector fires LTC026 where a silent miss (and synthesis fallback) happened before — the census and warning baseline change BY DESIGN, so this task enters an iteration only by iteration planning, with the owner's sign-off on the behavior. Scope the first landing to descendant combinators, `:not()` and attribute operators; child/sibling combinators (`>`, `+`, `~`) cannot cross the probe's exclusivity wrappers (ADR 0045 Consequences) — keep them "cannot verify" unless a follow-up first extends the wrapper model. Gate: LT-379 landed.
  **Channel/tier:** no new runtime check; verification widening strengthens tier 1 (Prevented). LTC026's existing wording stands unless it must distinguish verified-miss from unverifiable — if it does, the copy follows `writer` → error-messages.
  **Verification:** new pins (authored selector used verbatim when verified; LTC026 on verified-miss; synthesis fallback unchanged for child/sibling and unparseable); goldens change ONLY where a corpus component's authored selector newly verifies — assert none today, or enumerate the delta in the handoff; full gates.
## P3 — Gate-wave residue (independent of P1/P2; parallelizable)

**Moved to TODO.md 2026-10-02:** LT-186 (the corpus port needs it for LT-109/LT-111).


- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Area:** compiler
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
  **Area:** compiler
  **Needs:** LT-147
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


- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Area:** compiler
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


- [ ] LT-297: `argsFromAttrs` keys attributes by the arg's camelCase name (LT-290 close-out; latent).
  **Area:** compiler
  **Context:** the page-occurrence helper reads `attrs["bigStep"]`, but HTML attribute
  names are case-insensitive and serialize lowercase, so an authored `big-step`/`bigstep`
  occurrence never matches. A camelCase string or Parser arg would silently lose its
  channel and render the default. Not live today: LT-290 removed spinbutton's only
  camelCase channel, and no other corpus arg is camelCase. Key by the attribute name the
  client parser reads (the same mapping `expose()`'s Parser reads at connect), and pin
  it with a camelCase fixture.
  **Check:** a fixture with a camelCase Parser arg renders its authored attribute value;
  goldens unchanged.


- [ ] LT-340: LTC033 sees only the expression written at the site, so an impure read through a setup const, helper or loop const folds (LT-326 review).
  **Area:** compiler
  **Context:** confirmed at review on `.tsx` (`.tsrx` is the same code path). All of these
  compile clean and bake one build-time reading into the page:
  `const shuffled = [...items].sort(() => Math.random() - 0.5)` then a loop over `shuffled`;
  `const shuffle = (xs) => [...xs].sort(() => Math.random() - 0.5)` then `shuffle(items)`;
  a `const id = crypto.randomUUID()` hoisted inside an `@for` body; `{id}` or `{rid()}` as a
  static text child over such a const or helper. Only the inline spelling fails LTC033,
  because `containsImpureAmbient` checks the site's own node. The setup-const and helper forms
  are how a shuffle is usually written, so LT-326 closes only the least common spelling.
  **Rule:** report LTC033 at the server-evaluated position that *reads* the impurity, not at
  the declaration. A setup const whose value never reaches markup is harmless. Reuse LTC054's
  mechanism in `fold-inputs.ts`: the `tainted` fixpoint over setup helpers, extended to
  non-function setup consts and hoisted loop consts, with impure-ambient causes in place of
  page-context reads. Keep the `Intl` scope rule: a helper's locale argument resolves in the
  caller's scope. Static positions only. A reactive thunk reading a tainted const keeps
  today's omit-and-correct behaviour (LT-165 step 5).
  **Channel:** compiler. **Tier:** 1 Prevented (existing LTC033). **Copy:** follows `writer` →
  error-messages, if the builders need a "through `name`" clause naming the carrier. LTC054 reports
  reads through helpers without one, so decide by consistency with it.
  **Check:** the five probes above fail LTC033 on both surfaces. A resolvable-locale `Intl`
  helper still folds. A setup const holding `Math.random()` that is read only in client code
  compiles. Corpus output byte-identical; census unchanged.


- [ ] LT-365: Move the discriminated-compose probe to the positive config as an in-place `@ts-expect-error` (LT-364 review).
  **Area:** compiler
  **Context:** `server/tests/compiler/fixtures/tsx/discriminated-compose.tsx` (LT-346, pins LT-343)
  is a must-fail file in `tsconfig.neg.json`. Its point is that line 27 (`collapsed` without `id`)
  errors and line 26 doesn't. The test pins this by line number and message text in
  `tsx/typecheck.test.ts`, and the editor shows the intended error as a live squiggle. A JSX-comment
  directive on the line before the element says it in place, and was verified 2026-10-01:
  `{/* @ts-expect-error — LT-343: collapsed ⇒ id */}` suppresses the error. An unused directive
  is TS2578, so a regression to a flattening `Omit<P, 'i18n'>` fails the positive config.
  The attribute-line form (`// @ts-expect-error` between attributes of a multi-line tag) does
  NOT work: a missing-prop error is reported at the tag name, so that directive goes unused.
  **Do:** add the directive above the line-27 element; drop the file from
  `tsconfig.json`'s `exclude` and from `tsconfig.neg.json`'s `include`; delete the two
  `discriminated-compose.tsx(…)` assertions from the negative test; update the file's header
  comment (it says "must FAIL tsc") and the positive-config comment in `typecheck.test.ts`.
  **Trade-off accepted:** `@ts-expect-error` accepts *any* error on that line, so the exact
  `LibraryManagedAttributes<` message is no longer pinned. The probe is about which line fails,
  so that's acceptable. The other negative probes (`async-bad-arms`, `bad-host-typo`,
  `i18n-bad-reads`, `combobox-bad-args`) depend on their exact messages and stay in the neg config.
  **Verification:** `bun test server/tests/compiler/tsx/typecheck.test.ts` green. Then, temporarily,
  swap `LibraryManagedAttributes`'s distributive omission in `host-profile.d.ts` for a plain
  `Omit`: the positive config must fail with TS2578. Revert.

## P4 — Migration guards for 2.x authors

**Retitled 2026-10-01.** This band held the v3.0 deprecated-surface removals (LT-178, LT-179;
both landed, see `CHANGELOG.md [Unreleased]` Removed). It then collected the ADR 0037 work
(LT-274–LT-276), which moved to `TODO.md` 2026-10-01. What remains is the residue that protects
early adopters migrating hand-written 2.x components. The Cause & Effect 2.0 re-export rewrite
is a separate track, blocked on CE 2.0 shipping.

---


- [ ] LT-281: Flag a non-void factory return — authored-surface rule + DEV_MODE warning (LT-179 residue).
  **Area:** compiler
  **Context:** TypeScript's void-return assignability means a legacy 2.x `return [...]`
  factory still compiles against LT-179's `(context) => void` factory type while its value is
  silently ignored — a migration trap the types cannot catch (pinned by the "a factory return
  value is ignored" test in `component.test.ts`). ADR 0028 sub-design 1: a factory
  `return`-with-value is statically decidable, so a runtime check owes a compiler rule.
  **Channel and tier (ADR 0028 s1):** compiler — an `LTC` rule for a `return` statement
  carrying a value in factory-body position on authored surfaces, tier 1 Prevented; runtime —
  a `DEV_MODE` warn in `connectedCallback` for hand-authored `.ts` consumers, tier 2
  Contained (the component still enhances; the return is ignored). Not urgent for the
  compiler-authored corpus (generated clients never return); aimed at prerelease early
  adopters migrating 2.x hand-authored components.
  **Check:** catalog rows added; compile-warning baseline 0 holds; batch the copy with the
  LT-275/LT-189 rounds.

## P5 — Wave 4: example migrations

**Moved to TODO.md 2026-10-02:** LT-280 → LT-109–LT-111 (the corpus port), LT-334, LT-335.

---

### LT-098–LT-103 review follow-ups (Architect, 2026-09-25)

The six wave-4 migrations landed Folded or Simulated with zero warnings. Their NOTES were
resolved into the tasks below, and one systemic finding surfaced: the compiler replaces an
authored `first()` selector with its own synthesized one. That silently narrows or widens the
hand-authoring contract (splitview `button.divider` → `button[role="separator"]`, colorinfo
`.hex` → `small`). LT-316 is the gate for the next migration batch (LT-104–LT-108), because
every migration trips it.
**[2026-09-25]** LT-316–LT-318 and LT-320–LT-324 moved to `TODO.md`: they sit on components the
current iteration migrated. LT-319 and LT-325 stay here.
**[2026-09-25, follow-up review]** LT-327 (the LT-323 false-Folded regression) was created here
and moved straight to `TODO.md`. LT-328 and LT-329 stay here.
**[2026-09-25, LT-327 review]** LT-330 created here: the one render position LT-327 could not
credit.
**[2026-09-25, iteration planning]** LT-325, LT-328, LT-329 and LT-330 moved to `TODO.md`
(wave 4, second batch). LT-319 stays here.
**[2026-09-25, LT-303 review]** LT-331 created here. It does not gate the current batch,
because none of LT-104–LT-108's composed children takes a `children` arg.
**[2026-09-25, owner]** LT-319 moved to `TODO.md` with its design, behind the new LT-338
(auto-addressing composed `truc:pass` sites).

### LT-095, LT-104–LT-108 review follow-ups (Architect, 2026-09-25)

The six wave-4 second-batch migrations landed: three Folded (blogmeta, coloreditor,
context-media) and three Simulated (lazyload, listnav, carousel), none reshaped to dodge a tier.
Their NOTES resolve into the tasks below. One finding outranks the batch: the docs examples
navigation has been broken since form-listbox began serving compiled (LT-332). The review also
makes `bun run build:docs` part of every migration's check. It was never run for LT-104–LT-108,
and it was the only thing that caught LT-104's demo regression.
**[2026-09-25, LT-095/LT-104–LT-108 review]** LT-332–LT-337 created here. LT-332 moved straight
to `TODO.md`.


- [ ] LT-309: module-codeblock follow-through from the LT-096 review
  **Area:** examples
  **Context:** Two changes, both on `module-codeblock` (both surfaces where applicable).
  (a) The overlay's `on(overlay, 'click', …)` in `.tsx` setup is a workaround that LT-096's own
  selector fix made unnecessary. Its comment is now false. Inline it as `onClick={() => ({
  collapsed: false })}` on the overlay button and drop the explicit `overlay` ref if nothing
  else reads it. Verified in review: it lowers to `first('button:not(basic-button *)')` plus a
  guarded `on()`. Also fix the emitter printing an empty `if (overlay) {}` guard when a ref's
  only use is a setup `on()`.
  (b) The copy messages are read from the COMPOSED child's host (`copy.getAttribute(
  'copy-success')`). `copy-success` is not an attribute basic-button declares, so this reaches
  past the child's boundary (HOST_PROFILE § data account, bullet 3). The page chrome is also
  inconsistent: `fence.markdoc.ts` writes the pair on both hosts, while `fragments.ts`
  `tabPanel` writes it on the codeblock host only, so tab panels silently fall back. Make
  `copy-success`/`copy-error` module-codeblock's own config attributes: optional args with the
  current defaults, rendered on the root, read from `host`. Drop the duplicate on the inner
  basic-button in both chrome generators, and update the twin in the same commit. This is a
  contract reshape, approved here (the LT-095 checkpoint pattern). Spec: add a tab-panel-shaped
  fixture carrying custom messages on the host only.


- [ ] LT-310: Reactive attributes on the component root element
  **Area:** design
  **Context:** `collapsed={() => host.collapsed}` on a template root is LTC005 today ("reactive
  constructs on the component root"). So reflecting a Parser-exposed prop back onto the host
  stays a hand-written setup `watch('collapsed', bindAttribute(host, 'collapsed'))`, the last
  non-template statement module-codeblock needs besides the copy wiring. The pattern recurs
  (open/collapsed/expanded state on hosts). Design first: the server renders the root attribute
  from the arg, the Parser seeds from it at connect, and the thunk rebinds it. That is one
  channel, but LTC039's root-attribute exemption and the fold of `host.<prop>` on the root need
  checking against ADR 0024 s3 before implementation. Needs an ADR amendment or a short ADR;
  new diagnostics' copy follows `writer` → error-messages.


- [ ] LT-311: Event handlers on compose sites
  **Area:** design
  **Needs:** LT-309
  **Context:** A PascalCase compose site has no event-attribute kind (only arg/pass/ref), so a
  parent's reaction to a composed child's event must be a setup `on(childRef, …)` or a raw
  `EffectDescriptor`. module-codeblock's copy wiring is the case: a guarded
  `watch(() => true, copy ? copyToClipboard(…) : () => {})`, because `if` is LTC005 and
  `watch()` in a const-call is LTC045. Proposal: `onClick={…}` on `<BasicButton>` lowers to
  `on(<compose-ref>, 'click', …)` on the child's host. The listener attaches to the child's
  public element, not its internals, so it respects the boundary; the compiler's optional-ref
  guard replaces the hand-written ternary. `copyToClipboard` then becomes a plain click-handler
  factory. Decide the typing: the `.tsx` host profile needs `on*` in `ComposeSiteAttrs`, and
  `.tsrx` needs the same classification. Depends on LT-309(b) for the message channel.


- [ ] LT-331: Compose-site JSX children must type-check against the child's `children` server arg (LT-303 review).
  **Area:** compiler
  **Context:** To make `<truc:try>`'s `children: JSX.Element` a `tsc` fact, LT-303 declared
  `JSX.ElementChildrenAttribute` in `server/compiler/frontend/tsx/host-profile.d.ts`. That
  declaration is global, so `tsc` now also checks a compose site's JSX children against the
  child's args. But a content-substituting child declares `children?: string`: the server
  renders the markup to a string and forwards it (ADR 0023 s10, `validateComposedChildren`).
  The result, verified 2026-09-25: `<ModuleScrollarea><p>…</p></ModuleScrollarea>` in a `.tsx`
  parent now fails with TS2322 "Type 'Element' is not assignable to type 'string'", although it
  type-checked under the old profile. module-dialog and module-codeblock have the same shape.
  No `.tsx` parent composes one yet. The declaration also fixed a bug that was there before
  LT-303: a child with a *required* `children` arg could not be composed with JSX children at
  all, because `tsc` reported the prop as missing.
  **Design (Architect):** keep `ElementChildrenAttribute`, and have `LibraryManagedAttributes`
  map the child's string `children` arg to JSX content:
  `Omit<P, 'i18n' | 'children'> & ComposeChildren<P> & ComposeSiteAttrs`. `ComposeChildren<P>`
  is `{}` when `P` has no `children`, `{ children?: JSX.Element }` when it is optional, and
  `{ children: JSX.Element }` when it is required. That makes JSX content the authored
  spelling and keeps the markup string out of it. It also keeps the new `tsc` error for JSX
  children passed to a child that declares no `children` arg. That error is correct: the
  compiler has no `{children}` site to substitute them into. Rejected alternative: dropping
  `ElementChildrenAttribute` and making `TrucTryAttrs.children` optional. That brings back
  the required-children bug and gains nothing, because the compiler already enforces the
  async boundary's single-root rule.
  **Channel/tier:** TypeScript, tier 1 Prevented. No runtime or compiler check changes.
  **Check:** a positive fixture composing `ModuleScrollarea` with JSX children and a negative
  one (JSX children passed to a child with no `children` arg), both in
  `server/tests/compiler/fixtures/tsx/` and asserted in `tsx/typecheck.test.ts`. The fixtures,
  negative-fixtures and examples `tsc` programs stay clean apart from the expected new
  negative errors.


- [ ] LT-333: Extend LT-323's client-only credit to plain setup consts (LTC013/LTC043 over-routing).
  **Area:** compiler
  **Context:** LT-323 stopped a *signal* whose consumers are all client-only from routing
  Simulated. A *plain setup const* gets no such credit. `const panels = all(…)` routes on
  LTC013, and `const setHTML = dangerouslyBindInnerHTML(contentEl, …).ok` routes on LTC043, even
  when the only readers are `on`/`watch`/`each` statements and no value reaches markup. That
  lands module-carousel (three LTC013) and module-lazyload (one LTC043) Simulated with no
  reactive render site. **Rule:** the same credit as LT-323, "at least one client-only read,
  none a render read". It must be transitive through consts (LT-327) and through `expose()`
  initializers, which the server module evaluates. A const read by `expose()` is a render read
  for this purpose. The Folded-tier emitter already drops an unreferenced unevaluable const
  (`dropUnreferencedUnevaluable`), so this is a routing change only.
  **Channel/tier:** none (routing).
  **Check:** lazyload and carousel route Folded, or the entry records the residual reason.
  Their sim-driver and equivalence snapshots stay append-only. The census moves from 30/5/0 to
  32/3/0 if both fold. carousel's inline `all()` in its `index` initializer stays, since that
  is an `expose()` read.


- [ ] LT-336: `argsFromAttrs` attribute lookup — the kebab-case convention's fallback and its documentation (LT-095 review).
  **Area:** compiler
  **Context:** **Ruling (Architect, 2026-09-25):** a server arg's page-occurrence attribute is
  its **kebab-case** name (`readingTime` ← `reading-time`), the HTML convention every Parser
  attribute already follows (`allow-scripts`). A `number` arg gets a numeric channel, where a
  blank value is absent and a non-numeric one leaves the occurrence unrenderable. LT-095 landed
  both. **Residue:** form-spinbutton's markup writes `bigStep`, which parse5 lowercases to
  `bigstep`, so the occurrence matches neither the old camelCase lookup nor the new kebab one.
  Either fall back to the lowercased name when the kebab name is absent (HTML's own
  case-insensitive matching), or port spinbutton's markup to `big-step`. The contributor decides
  from how many authored occurrences exist.
  **Docs:** state the convention in HOST_PROFILE (the i18n/page-render section) and
  LE_TRUC_COMPILER.md § page occurrences.
  **Channel/tier:** none.
  **Check:** a page-render test for the chosen spinbutton spelling; corpus output
  byte-identical.


- [ ] LT-337: A destructuring setup const is diagnosed at its reader, not at itself (LT-104 review).
  **Area:** compiler
  **Context:** `const { ok: setHTML } = dangerouslyBindInnerHTML(…)` compiled without a
  diagnostic at the declaration. The generic LTC005 "other than const declarations" message
  then fired at the *next* statement reading `setHTML`, the `watch`, which sends the author to
  the wrong line. Either accept object- and array-pattern consts in the setup subset (bind every
  pattern name as a setup init, which `collectBoundNames` already supports), or diagnose the
  declaration itself with a fix-it (`const x = expr.ok`). Prefer accepting them: the rewrite
  is mechanical and authors write destructuring by habit. **Channel/tier:** compiler, tier 1,
  if diagnosed; none if accepted. Any new copy follows `writer` → error-messages.
  **Check:** lazyload's original destructuring spelling compiles, or fails at its own line.

## P6 — Cleanup round (after the corpus port)

---


- [ ] LT-093: Make LTC004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Area:** compiler
  **Context:** Re-confirmed empirically 2026-08-29: `const DEFAULT = 'red'; const color =
  createCell(DEFAULT)` consumed only through a style-map still fires LTC004's "never rendered"
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
  sharpened: LTC004 left the diagnostic channel, so a false firing on a fully
  phase-1-resolvable component now tiers it into simulation **silently** — it buys a realm and
  says nothing. It is not invisible, though: the tier census records the reason with its
  LTC004 origin and line, so the failure mode is inspectable rather than lost. Stays in P6 on
  that basis. **Cheap check to run at the end of wave 4, before this task:** scan the census for
  any Simulated component whose ONLY reason is a LTC004 origin — each one is a candidate false
  firing, and the list sizes this task's real payoff.


- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge).
  **Area:** compiler
  **Context:** LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement reads
  it, but the check is `containsSignalGet(stmt.node, …)` on the statement itself. Hoisting the
  predicate into a plain setup const — `const isOpen = () => open.get(); watch(() => !isOpen(),
  …)` — moves the read out of the statement and the signal draws LTC004 again, so the author
  must repeat the predicate at every site (`form-combobox.tsrx` does, with a comment saying
  why). **Re-checked 2026-09-06 (LT-165 step 5 landed) — the original premise is false.**
  "The diagnostic is loud, not silent" no longer holds: LTC004 left the diagnostic channel, so
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


- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
  **Area:** compiler
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


- [ ] LT-282: `docs-src/api/_media` mirrors have no refresh path (LT-272 residue, unfiled until the LT-179 review).
  **Area:** server
  **Context:** `_media/*.md` inside the gitignored TypeDoc output dir are hand-copied mirrors
  of repo docs (`REQUIREMENTS.md`, ADRs). No build generates or refreshes them, so they go
  stale silently and freshness depends on somebody remembering (LT-272 hand-refreshed them
  once; the gap was left unfiled). Decide: generate the mirror in `build:docs` from the repo
  sources, or delete it and link the repo files instead. Filed while its staleness was
  re-observed during the LT-179 review.

## P7 — Backlog (not scheduled)

**Moved to TODO.md 2026-10-02:** LT-393.

**[2026-09-19, owner: explicit 3.0 non-goals parked here.]** Everything the framework-goal
sessions and their follow-ups deferred now sits in this band rather than floating as an
unstated intention. From P1: **LT-262** (the AEM/HTL spike — pioneer 3 is not a release gate;
ADR 0034 s6 names pioneers 1 and 2) and **LT-264** (the `@zeix/le-truc-simulation` split —
ADR 0035 s4 defers it to a later 3.x, once the seam has a consumer). Already here and
unchanged in status: **LT-214**, **LT-269**, **LT-270** (ADR 0042's checks over the parsed
sheet, each gated on a real need). **LT-268**, **LT-304**, **LT-305** and **LT-306** (the
accepted ADR 0033 scoping and the baseline guard) moved to P2b on 2026-09-24: they ship in 3.0.
Also non-goals for 3.0, recorded in their ADRs rather than as tasks: stage 2 of style
composition (ADR 0042 s3, ROADMAP), Shadow DOM mode (ADR 0033 s8 records the spelling since 2026-10-01; built on demand),
the foreign-runtime "Mounted" tier (ADR 0032, amended 2026-09-19), and publishing the
`.tsrx` front end (ADR 0034 s1, gated on `@tsrx/core` 1.0).

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Area:** compiler
  **Context:** Architecture decision 2026-08-29: generation-time inlining.
  `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the
  docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines
  `DEV_MODE='"true"'`), pass it to the compiler as a `devMode` option, and the compiler INLINES
  the folded constant into generated client modules. Generated code must never reference
  `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the
  library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration
  assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch —
  emitted only under the generation-time dev flag and folded away entirely otherwise.


- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Area:** compiler
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed the current
  unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no
  client task) only when the resolved value is read nowhere outside its own arm AND the guarding
  promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer
  of the async boundary — build fixtures around it, same caution as LT-077.
  **Re-pinned (LT-276 review, 2026-10-02):** with template-cloned arms every arm ships as a
  template and the client clones on demand; the question is now only whether to omit an arm
  template (and its mount) the client can never select. The form-listbox premise is stale —
  no corpus component uses the boundary (it is named in a comment only); a consumer comes
  with LT-390.


- [ ] LT-214: Dead-rule detection over the parsed stylesheet (ADR 0042 s1). **GATED on a real need** (ADR 0042 is Proposed): the selector-prefix half of this task moved to LT-304 with the ADR 0033 ruling (2026-09-24).
  **Area:** compiler
  **Needs:** LT-268
  **Context:** A rule under the component's own tag that matches **zero** elements of the
  rendered template warns: a typo, a renamed class, a rule left stale by a markup refactor.
  `matchesSelector`/`countForSelector` (`server/compiler/analysis/selectors.ts`) already
  answer it and are load-bearing for LT-118's branch-root collision check. **Channel
  compiler, tier 2 Contained**: light-DOM markup is not closed, so the check must
  **exempt** any subtree holding a compose node or `dangerouslyBindInnerHTML`, exempt
  `::slotted` and reaches into composed children, and respect LT-124's deliberate widening
  of class matching for page-authored enhancement. An over-eager version is worse than none.
  **Depends on LT-268.** **Coordinate with LT-245**: if the `css-select` + `parse5` spike
  lands, the check gets cheaper, so do not hand-roll a CSS matcher for it first.
  **Acceptance:** a fixture whose stylesheet names a class no element carries warns; a
  fixture with a compose site or `dangerouslyBindInnerHTML` in the matched subtree does
  **not** warn; corpus warning baseline stays 0.


- [ ] LT-262: AEM/HTL integration spike — ahead of pioneer 3, not during it.
  **Area:** design
  **Context:** ADR 0034 s3 and its Bad consequence: AEM is a build-**integration** problem, not
  an emit problem. Component dialogs, the authoring model and clientlibs are undesigned, and the
  HTL emitter is the smallest part of it. Pioneer 3 is a client engagement, which is the wrong
  place to discover the shape.
  **Deliverable:** a spike answering how a compiler-emitted HTL partial reaches an AEM component,
  how clientlibs consume the generated client module and CSS, what the dialog/authoring model
  demands of the server-args surface, and what HTL's escaping contract requires that Twig's did
  not; the verdict written as tasks or as a recorded limitation. **Not release-gating for 3.0**,
  but scheduled well before pioneer 3 commits.
  **Check:** the spike either produces the HTL target's task list or records, with reasons, that
  AEM needs something the current artifact set cannot give it.


- [ ] LT-264: Split `@zeix/le-truc-simulation` out of the compiler package. **Not a v3.0 deliverable — a later 3.x, once the seam has a consumer.**
  **Area:** compiler
  **Context:** [ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s4.
  With LT-263's seam in place the substrate can ship as its own package, so activation is
  installation: present or absent, no configuration flag, no dynamic import, no degradation path
  threaded through the compiler. Deliberately **not** scheduled for 3.0 — a third npm name, release
  process and changelog on a release already gated on two external projects (ADR 0034 s6), against a
  saving of ~50 KB of JavaScript over the optional peer dependency, since jsdom is the weight and an
  opted-out consumer never installs it either way.
  **Deliverable:** the package, an exact-range peer on `@zeix/le-truc-compiler`, and a CI matrix — the
  substrate executes *generated client modules*, so the two-phase load/render contract, the `define()`
  recording, the children-first compose ordering key and the emission shape all cross the boundary and
  the pair is in permanent version lockstep. **jsdom must be a regular `dependency` of the new package,
  not a devDependency** — a devDependency is not installed for consumers.
  **Check:** a consumer project installs the compiler alone and builds green with Simulated components
  routed Static; adding the substrate package alone re-enables the tier with no config change.


- [ ] LT-269: Typed custom-property seam — `@property` registration derived from the signal's type (ADR 0042 s2). **GATED on a real consumer**: `bindStyle`/`setStyle` appears **nowhere** in the corpus or the docs components today, so this must follow a use, not precede one.
  **Area:** compiler
  **Needs:** LT-268
  **Context:** `bindStyle` (`src/bindings.ts`) takes `string`, so every value crossing from
  a signal into CSS is stringly-typed at exactly the point where both sides are known at
  compile time — `infer-type.ts` has the signal's value type and the stylesheet is in the
  same file. Where a signal drives a custom property, check the two agree and emit
  `@property --x { syntax: '<number>'; inherits: false; initial-value: … }`, which hands
  enforcement to the browser too (invalid-at-computed-value-time instead of a silently
  dead declaration) and brings interpolation and animation along. **The hard part is the
  syntax, not the plumbing:** `inferType` returns only `string`/`number`/`boolean`/
  `unknown`, and `<length>` vs `<number>` is precisely the distinction CSS makes and
  TypeScript does not — so infer the syntax from the **CSS side**, where the property is
  consumed (`width: var(--w)` implies `<length>`), reusing LT-268's parse rather than
  inventing author-facing branded types. Channel: compiler; **tier 2 Contained** for the
  TS↔CSS disagreement, with the emitted registration carrying the runtime half.
  **Depends on LT-268.** **Check:** a fixture whose numeric signal drives a `<length>`
  property warns; the emitted `@property` block round-trips through the equivalence audit.


- [ ] LT-270: Typed style handle — stage 1 of style composition, unblocked from TSRX 1.0 (ADR 0042 s3).
  **Area:** compiler
  **Needs:** LT-268
  **Context:** ADR 0033 sub-design 6 parked the whole composition package on TSRX 1.0
  because `.tsx` "has no such construct". That holds for **standalone** blocks only — a
  `<style>` in a children list with raw CSS as template syntax, which JSX cannot spell and
  which Le Truc wants least anyway (one tag-scoped sheet per component leaves
  sibling-scoping no role). **Assigned blocks** (`const theme = <style>{css`…`}</style>`)
  and `class={theme.dark}` are ordinary TSX, and that is where the anti-drift property
  lives: the class map is minted from the sheet the compiler parsed, so `theme.dark`
  cannot name a class the sheet does not define — a typo becomes a compile error instead
  of a silently dead class. **Stage 1 is the whole benefit with none of the machinery:**
  `theme.dark` lowers to the literal `"dark"`, emission stays verbatim, output stays
  byte-identical, no hashing and no selector rewriting. The one real surface change is
  accepting a `<style>` in **setup** position — today the sheet must be a `<style>` child of
  the root (D-07; LT-375 migrates the fragment spellings) — and `.tsrx` must accept the same spelling or the two front
  ends drift (ADR 0032 s6). **Stage 2 (`apply={theme}`, several sheets merged, selectors
  regenerated into `my-element .dark` / `:host(.dark)`) stays backlogged on the original
  terms** — that is where sub-design 6's "CSS must be generated" cost actually sits.
  **Depends on LT-268.** **Check:** a fixture naming a class absent from its own sheet
  fails the build; corpus output byte-identical; both front ends accept the same spelling.


- [ ] LT-345: A generated fallback `id` for an element whose ARIA relation needs one (LT-308 review; owner, 2026-09-26).
  **Area:** design
  **Context:** LT-343 makes module-codeblock's `id` required when collapsed, so the overlay's
  `aria-controls` always points at something. The ergonomic alternative the owner named is the
  one several JS frameworks ship: derive a stable id when the author omits one. The
  hand-authored Markdoc fence (`server/schema/fence.markdoc.ts`) and the tab-panel fragment
  (`server/templates/fragments.ts`) would benefit most, because they render collapsed blocks
  with no id and no `aria-controls` at all. Design questions first. Where is the id minted:
  compiler, server runtime, or page renderer? What makes it stable across builds: a content
  hash of the tag, source path and occurrence index? How do we guarantee uniqueness per page
  when the same component composes twice? Does it serialize into the client, or is it
  DOM-is-truth once rendered? Is it opt-in per argument or a general facility? Not before a
  second consumer beyond codeblock appears, or the docs fence wants `aria-controls`.
  **Constraint (Architect, 2026-10-01):** the data account (`HOST_PROFILE.md` bullet 5, LTC042)
  and `COMPILER_SPEC.md` §3.3 rule out a compiler-generated id. A design either mints it outside
  the compiler (the page renderer or the Markdoc schema) or amends that rule explicitly.
  **Channel:** none until designed. The design names its own.


- [ ] LT-357: Trusted Types target state for `truc:html` (LT-138 review; gated).
  **Area:** runtime
  **Context:** **Gated on TypeScript's DOM lib declaring `TrustedHTML`.** As of 2026-10-01 it
  does not: TS 6.0.3, 7.0.2 and 7.1.0-dev.20260930.4 (whose `lib.dom.d.ts` ships in the
  `@typescript/typescript-<platform>` packages) mention it only in `Document.write` doc
  comments. When the gate lifts: (1) drop the `type TrustedHTML = object` placeholders in
  `src/bindings.ts` and `examples/test/audit/test-audit.ts` for the real type; (2) decide
  whether the server's `configureHtmlSanitizer` should accept a Trusted-Types-shaped policy
  config, so one config module serves both realms. The server already stringifies a
  `TrustedHTML` result (`server/compiler/runtime.ts` `sanitizeHtml`). LT-138 already settled the
  shared entry point and the fail-closed default; this task covers only typing and the
  policy shape. No new runtime check; channel: TypeScript.


- [ ] LT-376: The source-to-source adapter seam, experimental (D-17, D-18; ADR 0032 s6).
  **Area:** compiler
  **Needs:** LT-371
  **Context:** ADR 0032 s6 (2026-10-01): the external extension point is an **adapter** that
  translates another format into host-profile `.tsx` plus a source map back to its input; the
  compiler remaps diagnostics through that map (ADR 0044 s2). Only a component translated with no
  error mixes with native ones; no plugin machinery; experimental until a first-class reference
  adapter ships. Deliverables: accept an input source map on the `.tsx` entry point; remap
  diagnostic locations to the adapter's input; a declared host-profile version the adapter
  targets; a toy conformance adapter in the test suite (emits `.tsx` plus a map, compiles through
  every tier, proves errors remap to the toy source). This also gives LT-247 a real source-map
  consumer for its reopen condition (input maps, not output maps — check whether that changes its
  ruling).
  **Gated on** the D-32 design session (the entry-point shape the source map rides on), LT-371
  (`location`), and section 15's O-1 (is there adapter demand), O-7 (diagnostic wording) and O-10
  (type access). D-04 is parked, so `.tsrx` is not the reference adapter by default.
  **Channel/tier:** none until designed; adapter-side refusals stay in the adapter's own channel
  (adapters never mint `LTC` codes).
  **Verification:** the toy adapter's conformance run; full gates.


- [ ] LT-412: `watch(prop, { stale })` never fires when a Slot fronts a Task (found 2026-10-03, cause-effect skill rewrite).
  **Area:** design
  **Context:** cause-effect's `match()` routes to `stale` only when the argument is literally a Task
  (`isTask(s) && s.isPending()`, `nodes/effect.ts:231`). A read-only async-thunk prop is stored as
  the bare Task, so `stale` works there. A writable prop is a Slot (`src/component.ts:566`), so
  when a parent `pass()`es an async thunk into it, the child's `watch('prop', { stale })` falls back
  to `ok` and the retained value shows with no in-flight signal. Decide where it is fixed: in
  cause-effect (`match()` checks the free `isPending(s)`, which may see through a Slot; that is an
  upstream issue) or in `watch` (resolve the Slot's current backing before `match`). Until then,
  the `cause-effect` skill documents the edge.
  **Channel/tier:** none — a semantics fix, no new check.
  **Verification:** a `reactive.test.ts` case: a parent passes an async thunk into a Slot-backed
  child prop, and the child's `stale` handler fires during a re-fetch.


- [ ] LT-413: `check:skills` — fail on retired diagnostic codes and removed API names in `skills/` (SKILLS_REPORT R4).
  **Area:** compiler
  **Context:** `skills/le-truc/` and `skills/cause-effect/` ship in the package, so drift in them
  is a product defect, and `check:links` does not scan `skills/`. Add `scripts/check-skills.ts`
  and a `check:skills` script. It fails when a skill file names an `LTC`/`TSRX` code that
  `server/compiler/diagnostics.ts` does not define or lists as retired (except in `errors.md`'s
  retired list), when `errors.md` lacks a row for an emitted code, or when a skill names an
  export that `index.ts` does not export (an allowlist covers prose words in backticks).
  Also check that relative links inside `skills/` resolve. Add it to the `docs` gates in the
  `contributor` skill (owner's `.agents/` pass, via `.agents-proposals/`).
  **Channel/tier:** build check, tier 1 Prevented.
  **Verification:** green at HEAD; a fixture skill file naming a retired code or a removed export fails it.


## Unbanded

- [ ] LT-134: LTC035 and LTC042 give opposite advice on the same construct (LT-131 review finding). — closed as moot (Architect, 2026-10-02)
  **Area:** compiler
  **Ruling:** LTC035 retired at LT-275 — template-cloned arms keep every non-winning arm
  out of the document, so the diagnostic loop this task described cannot arise. LTC038
  (duplicate compose-site ids) never had the loop: its fix ("distinct ids, or address the
  instances by class") names no per-arm shape. Nothing to do; the residual LTC042 advice
  stands on its own row in `errors.md`.

