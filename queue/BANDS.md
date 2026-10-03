# BACKLOG

Planned tasks out of scope for the current iteration. Part of the 3-file mini-kanban
(owner, 2026-09-18):

- **BACKLOG.md** (this file) — everything planned; new tasks are created here, with full context.
- **TODO.md** — the current iteration only. The Architect moves tasks here at iteration
  planning; do not start a task that is still only in this file.
- **DONE.md** — done-and-reviewed tasks since the last release, compacted to what is still
  load-bearing (rulings recorded nowhere else, live handoffs by ID, changed-artifact facts for
  the `writer`'s changelog).

Only the Architect moves tasks between files; contributors annotate the status suffix on the entry in place. Task IDs are global and
sequential across all three files; the "Next free task ID" line lives in TODO.md's header.
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

## P3 — Gate-wave residue (independent of P1/P2; parallelizable)

**Moved to TODO.md 2026-10-02:** LT-186 (the corpus port needs it for LT-109/LT-111).

## P4 — Migration guards for 2.x authors

**Retitled 2026-10-01.** This band held the v3.0 deprecated-surface removals (LT-178, LT-179;
both landed, see `CHANGELOG.md [Unreleased]` Removed). It then collected the ADR 0037 work
(LT-274–LT-276), which moved to `TODO.md` 2026-10-01. What remains is the residue that protects
early adopters migrating hand-written 2.x components. The Cause & Effect 2.0 re-export rewrite
is a separate track, blocked on CE 2.0 shipping.

---

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

## P6 — Cleanup round (after the corpus port)

---

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
