# BACKLOG

Planned tasks out of scope for the current iteration. Part of the 3-file mini-kanban
(owner, 2026-09-18):

- **BACKLOG.md** (this file) — everything planned; new tasks are created here, with full context.
- **TODO.md** — the current iteration only. The Architect moves tasks here at iteration
  planning; do not start a task that is still only in this file.
- **DONE.md** — done-and-reviewed tasks since the last release, compacted to what is still
  load-bearing (rulings recorded nowhere else, live handoffs by ID, changed-artifact facts for
  Changelog Keeper).

Only the Architect moves tasks between files (Tech Writer may execute the mechanical move when
delegated); developers annotate the status suffix on the entry in place. Task IDs are global and
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
the open-source library. [COMPILER_REFLECTION.md](COMPILER_REFLECTION.md) (the six-question
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

- [ ] LT-254: Stand up the publishable package `@zeix/le-truc-compiler` (TSX-only) and discharge the LT-206 packaging deferrals.
  **Skill:** le-truc-dev
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
  surface is `.tsx` needs a stated rationale, and Tech Writer reviews the copy of anything
  renamed (channel: compiler; the error-message-lifecycle sweep applies).
  **Check:** `npm pack` on a clean checkout produces a tarball that installs into an empty
  project and compiles a single `.tsx` component, with no `@tsrx/core` in the dependency tree.

- [ ] LT-255: Generalize the corpus scan — glob the consumer's components, not `examples/`.
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s1; the reflection's §7. `scripts/build-tsrx.ts` globs
  `examples/**/*.tsrx` and writes to `server/generated/tsrx/`; the registry and the TSRX048
  contract are this-repo-shaped. A consumer's sources live wherever their project puts them, and
  their output directory is theirs to choose.
  **Deliverable:** a configured source glob and output root with this repo's paths as defaults,
  so the docs build is one consumer of the general mechanism rather than the mechanism itself;
  the registry contract restated in consumer terms; the config surface documented where an
  installing user will read it. **Depends on LT-254** for where the config lives.
  **Check:** the repo's own build produces byte-identical output through the generalized path,
  and a scratch project outside the repo compiles a component with only a config file.

- [ ] LT-263: The simulation seam — move the build report out of `sim/`, split the patch table by audience, make the realm interface DOM-free. **Blocks LT-256.**
  **Skill:** le-truc-dev
  **Context:** [ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s3–s4.
  ADR 0034 s5 committed jsdom to an optional peer dependency; the code cannot honour that commitment.
  Three couplings, each verified in the LT-239 session: `server/compiler/tier.ts:62` imports
  `./sim/patch-table` — the **classifier** consults the simulation to decide which components are
  Simulated, and `tier.ts:243` returns the table's `note` as the census reason; `sim/report.ts` is
  not simulation at all but the **build report** (`tierCensus`, `translationCensus`, `formatCensus`,
  `Census`, `CensusEntry`, `CLASSIFIED_DIAGNOSTICS`), imported by `server/effects/i18n.ts`,
  `server/effects/tsrx.ts` and `scripts/check-tsrx.ts`, none of which simulate; and
  `SimulationRealm.window` is typed `JSDOM['window']`, which `sim/index.ts`'s own header already
  flags — so the published compiler's `.d.ts` names jsdom and an opted-out consumer cannot typecheck.
  **Deliverable:** (a) the census and build-report channel moves compiler-side, leaving only *realm*
  diagnostic classification in `sim/`; (b) `patch-table.ts` splits by audience — the classifier-facing
  half (what the realm cannot answer, plus the reason vocabulary) compiler-side, the applier-facing
  per-runtime force/fill/stub entries with the realm; (c) the realm interface becomes DOM-free,
  `(markup, component, locale, options) → (html, diagnostics)`, with no `window`, `Document` or
  substrate type crossing it — the driver keeps jsdom's types internally. **Shape the seam as a
  versioned, resolver-based package boundary, not an in-process module boundary** (s4): activation is
  intended to become *installation*, and retrofitting a package boundary later is a breaking change.
  **Channel:** none new — this moves existing reporting, it does not add a check. The
  `unavailable substrate` reason is LT-256's, and this task only makes it emittable.
  **Check:** with jsdom uninstalled, `tsc --noEmit` passes against the published type surface, the
  corpus compiles, and the tier census prints with every component classified — before LT-256 adds
  the routing change. Census 20/2/0 and warning baseline 0 unchanged with jsdom present; the
  equivalence audit (ADR 0029 s7) and its pinned per-component diffs are byte-unchanged.

- [ ] LT-264: Split `@zeix/le-truc-simulation` out of the compiler package. **Not a v3.0 deliverable — a later 3.x, once the seam has a consumer.**
  **Skill:** le-truc-dev
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

- [ ] LT-256: jsdom as an optional peer dependency; `unavailable substrate` as a tier-census reason.
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s5 and the ADR 0029 s6 amendment (2026-09-19). A published compiler's
  dependency weight is a consumer-visible cost, and jsdom serves a capability two of 22 corpus
  components use. It becomes an **optional peer dependency** — not gated on SSG vs SSR, since
  simulation is build-time in both cases.
  **Deliverable:** the peer-dependency declaration; substrate detection at build start;
  components the classifier routed Simulated route **Static** when the substrate is absent and
  record `unavailable substrate` as their census reason. **This is a census row, not a
  diagnostic** — the zero-warning baseline ([M23](REQUIREMENTS.md#m23-census-reporting-zero-warning-baseline))
  is unaffected, and a missing substrate must never fail the build (channel: none — it is a
  routing outcome, not an author-fixable problem; no tier applies). CI gains a second
  configuration: the compiler exercised **with and without** the substrate installed.
  **Depends on LT-263 — hard, not preferential** ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5
  amendment; [ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s5).
  This task's premise does not hold until the seam lands: `tier.ts` imports `sim/patch-table` to
  decide tiers *and* to source the reason vocabulary, the census itself lives in `sim/report.ts`,
  and `SimulationRealm` names `JSDOM['window']` in the published type surface. Absent the
  substrate there is no classifier, no census, and no typecheck — so "route Static and record
  `unavailable substrate`" cannot be implemented first and de-tangled afterwards.
  **Check:** `npm install` without the optional peer, then a corpus build: green, with the two
  Simulated components routed Static and named in the census with the new reason.

- [ ] LT-257: Template emission — **the target-emitter interface, with Twig as its first implementation** ([M27](REQUIREMENTS.md#m27-backend-neutral-template-emission)). **Release-gating; pioneer 2's critical path.**
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s3. For a CMS, a folded HTML partial and a template are the same
  artifact: a Craft page's props are *content* — arbitrary title text, an entry list — so
  pre-folding per prop signature is combinatorially dead. What folding can do is resolve
  everything prop-independent and leave the props as **holes**, which is what a template is.
  **Scope change (owner, 2026-09-19, LT-239 follow-up; ADR 0034 s3 amendment, [ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) amendment):
  the deliverable is **a target-emitter interface with Twig as its first implementation**, not a
  Twig emitter. Only the interface is a 3.0 commitment; the set of targets is not. This is a
  scope sentence now and a rewrite later — HTL is already known to be coming, and a second target
  hard-coded against a shape never designed to have two is the expensive outcome. **Decide the
  interface before writing the first emitter**, not by extracting it from Twig afterwards.
  **Deliverable:** a third emission target beside the client module and the CSS — the
  component's markup with every prop-independent expression folded and every server arg emitted
  as a variable in the target's language. The interface carries at minimum: hole emission, the
  per-target escaping contract, and the unescapable-position refusal. Locale dimensionality is locale × component (ADR 0030 commits 3.0 to
  per-locale pages), so the emitter emits one partial per component per locale **or** one
  partial with a locale hole — the choice is the emitter's and must be recorded in the ADR
  either way.
  **The escaping contract is a security boundary, not a formatting detail.** The compiler
  becomes responsible for output encoding in a language it does not execute; a mis-encoded hole
  is an XSS in a consumer's page. The emitter places Twig's escaping at every hole, and a hole
  in a position Twig cannot escape safely is a **compile-time diagnostic** (channel: compiler;
  tier 1 Prevented per [ADR 0028](adr/0028-tiered-error-surfacing.md) s1) — never a silently
  unsafe emit. A per-target escaping test corpus is part of this task, not a follow-up. New
  diagnostic code: Tech Writer owns the final copy.
  **Depends on** LT-254 (where it ships), LT-258 (the invariant it relies on).
  **Check:** every corpus component emits a Twig partial; the escaping corpus passes, including
  the negative cases; **the interface is exercised by a second, deliberately trivial target**
  (even a debug/JSON dump) so "a second target needs no reshaping of the first" is tested rather
  than asserted; a Twig render of the partial with the same args produces output equivalent
  to the SSG fold (the same equivalence discipline [ADR 0029](adr/0029-tiered-server-evaluation.md) s7 applies to the two evaluation mechanisms).

- [ ] LT-258: Make the partial-readiness invariant a compiler check.
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s4. The invariant — folded output depends only on the component's own
  props plus a closed, enumerable set of page-ambient values — is checkable **now**, before the
  emitter exists, and it must be, because the failure mode is a design landing between now and
  LT-257 that quietly forecloses template emission. The closed ambient set today is the reserved
  `i18n` parameter's five members ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md) s2).
  **Deliverable:** a check in the fold path that a folded expression's inputs are the component's
  own args or a member of the declared ambient set, and nothing else; the ambient set declared in
  **one** place the check reads, so adding to it is a visible, reviewable act rather than a
  diffuse one. Violations are a compile-time diagnostic (channel: compiler; tier 1 Prevented);
  new code, Tech Writer owns the copy.
  **Check:** the corpus passes unchanged; a fixture that reaches page context outside the
  declared set fails the build with the ruled message.

- [ ] LT-259: The 2.x → 3.0 codemod, and the drift-cost measurement it instruments.
  **Skill:** le-truc-dev
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
  **Skill:** architect
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
  **Skill:** architect
  **Context:** ADR 0034 s3/s6. LT-257 is the mechanism; this is the proof, and the owner has
  ruled it must pass **before v3.0 releases**. What is being verified is not that Twig files are
  produced but that a CMS page carries **real content in its initial HTML with no JavaScript**.
  **Deliverable:** the Craft integration — where partials land, how the build fits their
  pipeline, how the `i18n` ambient set is passed through the include; the escaping contract
  exercised against real content, adversarial cases included; a recorded list of what the
  emitter had to grow. **Depends on LT-257. Blocks the v3.0 release.**
  **Check:** JavaScript disabled, a Craft-rendered page shows content-bearing folded markup from
  a compiler-emitted partial; enabling JavaScript corrects nothing that was already right.

- [ ] LT-262: AEM/HTL integration spike — ahead of pioneer 3, not during it.
  **Skill:** architect
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

---

- [ ] LT-265: Document, version and export the front-end contract. **Not release-gating; do it while LT-254 is shaping the package.**
  **Skill:** le-truc-dev + tech-writer
  **Context:** [ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md), amended
  2026-09-19. The front-end boundary this repo built for two surfaces is already minimal and
  already the one an arbitrary front end would use — a front end is
  `source → { component, diagnostics, routingSignals }`, handed to `compileFromIR`, and
  `frontend/tsx/index.ts` and `frontend/tsrx/index.ts` are the *same shell* over it. Its only
  defect is that it is internal, unversioned, undocumented and unexported. **This task is
  documentation and versioning — not a plugin API**: no registry, no lifecycle hooks, no
  discovery mechanism. Those would be a guess at an interface that already has two real
  implementations telling us its shape.
  **Deliverable:** the IR's shape and the three front-end outputs documented where an
  implementer will read them; the [ADR 0028](adr/0028-tiered-error-surfacing.md) diagnostic
  tiers and the meaning of a routing signal documented as part of the contract (this is the
  refusal channel a third-party front end needs to fail honestly rather than emit a silently
  wrong component); `compileFromIR` and the IR types exported from `@zeix/le-truc-compiler`
  under a stated stability policy. Record in the docs that **component-model connectors
  (React/Vue/Solid) are third-party by name** — the engineering risk of tracking a target
  framework's minor versions transfers with ownership, the reputational risk does not.
  **Depends on LT-254** (what "exported from the package" means).
  **Check:** a scratch front end outside the repo — even a trivial one over a toy syntax —
  compiles a component end-to-end using only the published exports and the written contract,
  and its refusal path produces a real diagnostic.

- [ ] LT-266: Measure the size bet — emitted bytes for the same component authored in Le Truc and in React.
  **Skill:** le-truc-dev
  **Context:** [ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md), amended
  2026-09-19. The project's thesis is that a JSON payload, JS-ified templates and a framework
  runtime are replaceable by HTML plus a small runtime that harvests initial state from the DOM
  and applies fine-grained effects. Everything a framework does is *representable* — subtree
  variance as inert `<template>` tags, non-rendering state as a component-local attribute
  payload — so the ceiling is not expressive but **economic**, and it has never been measured.
  The shared JSX shape makes the comparison cheap, which is the reason to do it now rather than
  after anyone proposes a connector.
  **Deliverable:** a small set of representative components (at minimum: one static-ish, one
  with a few shape variants, one with client-only derived state needing a config payload)
  implemented both ways, with **emitted bytes + runtime, over the wire, compressed** reported
  per component per side. Report the payload separately from the runtime, since the runtime
  amortizes across a page and the payload does not.
  **Why it matters beyond curiosity:** this number is the acceptance criterion for any future
  front-end connector — a connector whose output approaches what it replaces has failed the bet
  while technically working — and it is a REQUIREMENTS §1 claim that is currently unevidenced.
  **Check:** the numbers are reproducible from a script in `scripts/`, and the finding is
  recorded whichever way it comes out. **A result that does not favour Le Truc is the valuable
  outcome, not a reason to re-run the study.**

- [ ] LT-267: Make the build's file IO runtime-neutral — Node, Bun and Deno.
  **Skill:** docs-server-dev
  **Context:** the LT-239 follow-up (2026-09-19). A published compiler should need *a* JS
  runtime, not Bun specifically, and should emit standard `.ts` and `.css` that any bundler
  consumes — the emitted files are the interface, so no bundler abstraction is wanted or
  planned. Good news from the survey: **`server/compiler/` contains no Bun-specific API at
  all**, and `scripts/sim-portability-check.ts` already proves the realm serializes
  byte-identically on Bun, Node and Deno. The coupling is entirely in the build orchestration —
  `Bun.Glob`, `Bun.file`, `Bun.write`, `Bun.spawn` and `import.meta.dir` across
  `server/effects/` (`static-assets.ts`, `examples.ts`, `css.ts`, `build-effect.ts`,
  `page-render.ts`, `simulate.ts`, `tsrx.ts`, `llms-full-manifest.ts`) plus `scripts/`.
  **Deliverable:** a thin file-IO and process-spawn layer those effects call, with a Bun
  implementation and at least one other, so the published package's own build path is not
  Bun-only. **Coordinate with LT-255**, which is already touching exactly these globs — doing
  both at once is cheaper than sequencing them, and LT-255 should not harden a Bun-shaped glob
  API on its way through.
  **Check:** the corpus compiles and the emitted `.ts`/`.css` are byte-identical under Bun and
  under at least one other runtime.

## P2 — Internationalization follow-ups (ADR 0030)

**Pruned 2026-09-17** — LT-173 (reserved `i18n` parameter + catalog pipeline), LT-175
(render-cache measurement; its containment landed in LT-174, its removal ruling became
LT-193), LT-174 (per-locale page rendering), LT-190 (per-category message keys), LT-191
(locale inheritance, `lang` config-only), LT-192 (review residue) all landed and reviewed;
ADR 0030's corpus-multiplication consequences bullet was retracted in place 2026-09-07.
History: `git log -p`, ADR 0030, `CHANGELOG.md` `[Unreleased]`, and the compacted entries in
`DONE.md`. Two review
handoffs became tasks: **LT-201** (the ADR amendment; done — DONE.md) and **LT-189** (the
Tech Writer copy round, scope widened).

- [ ] LT-218: The client-message `i18n` attribute — compiler analysis, server emission, client evaluator preamble (ADR 0030 sub-design 9). **Depends on LT-250.**
  **Skill:** le-truc-dev
  **Sequencing (re-ruled 2026-09-19):** two gates, one now discharged. Land the P2b
  SurfaceAdapter consolidation (**LT-233**) first — it collapses the two copied front ends this
  task must edit in lockstep. The **LT-240** message-model gate is **resolved** (owner ruling
  2026-09-19, ADR 0030 amended): the grammar is ICU MessageFormat 1, and the serialization
  shape is **the build-parsed AST**, not the raw pattern and not a compiled function. Land
  **LT-250** (the parser, the shared evaluator, the server fold) before this task — it supplies
  the AST shape this task serializes and the evaluator this task inlines.
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
     own **parsed patterns** and compose-graph inheritance applies unchanged. An
     argument-less message serializes as a plain string (unchanged); a message with
     arguments serializes as LT-250's compact AST. Only client-referenced keys (owner
     ruling): a server-folded key never rides the attribute. The root-attribute exclusion
     covers TSRX039; authored `i18n` attributes are already rejected in classify-attributes.
  3. **Client preamble:** the generated client factory gains an inlined, guarded
     `JSON.parse(host.getAttribute('i18n'))` merged over the declared source-locale record,
     which the compiler emits already parsed for the same keys — NO new `@zeix/le-truc`
     export (ADR 0030 s8). Alongside it the compiler inlines **LT-250's evaluator, narrowed
     to the constructs this component's patterns actually use** — an interpolation-only
     component gets a concatenation; `Intl.PluralRules(host.lang)` does category selection;
     nobody pays for `select` or date formatting unless used. No ICU parser on the client,
     no `eval` (CSP-clean). Client-position `t.key` reads rewrite to the local; a call site
     is validated by LT-250's diagnostic. Parsed once at connect, fixed for the connection;
     malformed JSON warns in DEV_MODE and falls back to the source record in production.
  **Pins:** the attribute carries only client-referenced keys (a folded-only key stays off
  it); absent when the set is empty (a component without client-evaluated messages renders
  byte-identical — pin one); a de render bakes translated **parsed** patterns into the
  attribute; the inlined evaluator is narrowed (a component with no plural message emits no
  `Intl.PluralRules` call — pin by fixture);
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
  - **Census pattern-integrity walks (ADR 0030 s5, re-ruled 2026-09-19):** two new
    `TranslationGap['status']` cases, both report channel — not warnings, translator-paced,
    same reasoning as missing/stale/orphaned; Tech Writer owns wording, batch with LT-189
    item 8. (a) **argument preservation** — a translation whose argument set differs from the
    source pattern's; (b) **plural-arm coverage** — a translation whose `plural` arms do not
    cover `Intl.PluralRules(lang).resolvedOptions().pluralCategories`. A third case,
    **unparseable pattern**, falls back to the source pattern and reports — it must NOT fail
    the build (a translator typo cannot make a locale unbuildable; same ruling as a missing
    key). `i18n:sync` flags all three and can auto-fix none. Follow the LT-196 pattern for the
    inverse-walk tests: falsification probes over the real catalogs, injectable for units.
    **Note this replaces, not extends, the deleted reachability carve-outs** (LT-251) — the
    census gets simpler in shape, not smaller in line count.
  **Verification:** payload pinned — the sim-driver tokenbox snapshot carries the
  attribute, asserted to stay in the low hundreds of bytes (the ADR's measure); translation
  census 0 gaps on the real corpus with the placeholder walk live; tier census 20/2/0;
  warning baseline 0; Playwright tokenbox spec green (status strings announce in en/de);
  gates green (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links).

- [ ] LT-220: Docs round for the ICU message model and the client-message channel — HOST_PROFILE, compiler doc, diagnostic sweep, CHANGELOG. **Sequence with or after LT-189 (batches into its one-voice copy round); scope widened 2026-09-19 by the LT-240 ruling.**
  **Skill:** tech-writer
  **Context:** The copy/docs obligations ADR 0030 s4/s5/s6/s9 leave behind; the error-message
  lifecycle applies (diagnostic faces retired, new TSRX codes gained).
  0. **The message model itself** (new, LT-240): messages are ICU MF1 patterns; `t.key` is a
     string or `t.key({ … })` a call; plurals/`select`/inline formatting live in the pattern.
     The per-category key convention and `truc:case`/`truc:case-type` are **retired** — remove
     their teaching outright rather than deprecating it, and state the replacement for exotic
     variance (a ternary, or `@if`/`@switch`). State the type caveat explicitly: `t` is
     `string | ((args) => string)` and **authors must not rely on the wider type**, because
     per-key precision arrives later and tightens it.
  1. HOST_PROFILE.md: the i18n section re-taught — client-position `t` reads, the root
     `i18n` attribute carrying parsed patterns, and the `t.key({ … })` call syntax; the
     carrier-span idiom's teaching REPLACED (superseded, not deprecated — remove the LT-195
     interim guidance, point at ADR 0030 s9).
  2. LE_TRUC_COMPILER.md: the classification (client positions, literal keys only), the
     emission point, the census paragraph's two pattern-integrity walks, and the removal of
     the pruning/`pluralCategories` description.
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
  **S0 hold — RESOLVED 2026-09-19 (LT-240 ruled: ICU MF1).** Consequences for the held items:
  **item 2 is WITHDRAWN** — the dotted-key CLDR shape rule is deleted by LT-251, so TSRX008's
  message is retired rather than reworded; the retirement still runs the error-message
  lifecycle sweep (that is LT-251's obligation, verified here). **Item 8 proceeds**, with one
  amendment: the orphan census/sync copy must no longer reference reachability or plural
  categories — every locale now carries the same key set, so an orphan is unconditional.
  LT-219's census wording is no longer "placeholder preservation" but the three cases in that
  task (argument preservation, arm coverage, unparseable). The non-i18n items (1, 3–7, 9, 10)
  were never held.
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
  2. ~~**TSRX008's dotted-key message** (LT-190 handoff)~~ — **withdrawn 2026-09-19.** The
     rule the message documents (a dot-suffix must name one of the six CLDR categories) is
     deleted by the LT-240 ruling; the code is retired in LT-251, which owns the lifecycle
     sweep. Nothing to word here.
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
  9. **The `class:`-prefix rejection copy** (LT-222 handoff, 2026-09-18): the new
     TSRX006 reason in `server/compiler/classify-attributes.ts` (first draft:
     "`class:token={…}` is not a TSRX spelling — a per-class reactive binding is a
     class map: `class={() => ({ token: value })}`. A `class:token` attribute
     renders into the markup verbatim and the browser ignores it."). No new code —
     the existing malformed-attribute channel carries it — but the copy is new, and
     both prior spellings were SILENT, so the fix-it line is the load-bearing part.
     Batch with items 2–8.
  10. **The union restructure** (LT-223 handoff, 2026-09-18): retirement treatment
     standardized to the keep-member form the lifecycle doc prescribes — `TSRX020`
     is a kept member again (was deleted-with-comment, the file's one outlier),
     `TSRX031` keeps its member with an expanded note, and `TSRX004`/`013`/`043`
     left the `DiagnosticCode` union for tier.ts's named `RoutingSignalOrigin`
     (they are census origins, not emitted codes; position comments mark where the
     numbers are spent). Check `.agents/skills/le-truc/references/errors.md` and the
     lifecycle doc itself still describe the treatment accurately.

- [ ] LT-250: ICU MessageFormat — the build half: parser dependency, AST, shared evaluator, server fold, argument diagnostic (ADR 0030 s4). **Gated by LT-233 (SurfaceAdapter); gates LT-218, LT-251, LT-252.**
  **Skill:** le-truc-dev
  **Context:** The LT-240 ruling (owner, 2026-09-19; ADR 0030 s4 amended) in code. A message
  value becomes an ICU MF1 pattern; `t.<key>` resolves to a string when the pattern takes no
  arguments and to a function of its arguments when it does.
  1. **Parse, don't compile.** Add `@messageformat/parser` as a **devDependency** (build-time
     only), plus `@messageformat/number-skeleton` / `@messageformat/date-skeleton` where
     skeletons appear — they resolve to plain `Intl` options at build time, so nothing
     skeleton-shaped survives into the AST. `@messageformat/core` goes in as a **test oracle
     only** and must not be imported from `server/compiler/` production paths (pin that with
     a dependency test).
  2. **One evaluator, ours, used by both sides.** A compact AST walk over the parsed pattern.
     `Intl.PluralRules` / `NumberFormat` / `DateTimeFormat` do the locale work. The SAME
     evaluator runs the server fold and is inlined into the client preamble by LT-218 — the
     point of owning it is that a server-rendered string and the client's recomputation
     cannot disagree. Keep it emitter-agnostic and free of compiler imports so LT-218 can
     inline a narrowed form of it.
  3. **Fold at render.** `t.key({ … })` with server-known arguments folds in the value
     harness like any other call (`evaluability.ts` — new node shape, existing rule). A
     message with client-reactive arguments is left to LT-218's channel.
  4. **Argument validation** — the compiler checks a call site's arguments against the parsed
     pattern's argument set: **new TSRX code, tier 1 Prevented, error** (statically decidable,
     author-fixable; Tech Writer owns copy, batch with LT-189). Lives in the shared
     post-lowering pass so it cannot drift between the two authored surfaces. A computed
     `t[dynamicKey]` stays rejected, unchanged.
  5. **Types stay loose deliberately.** `t` is `string | ((args: …) => string)`; per-key
     precision via compiler-generated `.d.ts` is explicitly deferred (owner ruling: build-time
     diagnostics suffice for v3). It is additive to every artifact here — but it TIGHTENS the
     type, so the "do not rely on the wider type" note is an LT-220 obligation, not optional.
  **Check:** the evaluator's server output is differentially tested against
  `@messageformat/core` over the corpus patterns plus a negatives set (this is what the oracle
  is for); folded markup for an argument-less message is byte-identical to today's; gates green
  (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links); warning baseline 0;
  tier census unchanged (a folded message is not a routing signal).

- [ ] LT-251: Delete the per-category machinery — `truc:case`, pruning, `pluralCategories`, the dotted-key rule, the census reachability carve-outs. **Depends on LT-250 and LT-252 (nothing may still author the retired vocabulary when this lands).**
  **Skill:** le-truc-dev
  **Context:** The deletion half of the LT-240 ruling (ADR 0030 s5/s6 amended). Survey at
  ruling time: **86 references across 25 non-generated files.** Not all are deletions — count
  it as the touch set, not the win.
  - **Vocabulary:** `truc:case` / `truc:case-type` out of `classify-attributes.ts`, `ir.ts`,
    `validate-lowered.ts`, `registry.ts`, `runtime.ts`, `assemble-ir.ts`, both front-end
    lowerings, and both surface profiles (`frontend/tsx/host-profile.d.ts`,
    `frontend/tsrx/globals.d.ts`).
  - **Pruning:** ADR 0030 s6's per-locale alternative pruning in `emit-server.ts` and its
    `pluralCategories` plumbing — including the cardinal∪ordinal union fallback, which has no
    successor because the pattern states which type is in play.
  - **Census:** the reachability carve-outs in BOTH walks (the LT-190 missing/stale direction
    and the LT-217 orphan direction), and the registry's case-type input to them. Every locale
    now carries the same key set; an orphan is unconditional.
  - **Shape rule:** the `<key>.<category>` convention and its CLDR-category validation;
    **TSRX008 retires** (LT-189 item 2 withdrawn accordingly). Retirement runs
    `tech-writer`'s `workflows/error-message-lifecycle.md` in full — keep-member treatment in
    the `DiagnosticCode` union per LT-223, and sweep
    `.agents/skills/le-truc/references/errors.md`, HOST_PROFILE.md and LE_TRUC_COMPILER.md.
  **Check:** `grep -r "truc:case\|pluralCategor\|caseType"` over non-generated sources returns
  nothing outside the retirement notes; no fixture still pins per-locale pruned markup; gates
  green; warning baseline 0.

- [ ] LT-252: Corpus and catalog migration to ICU patterns — `basic-pluralize` (both surfaces), six locale catalogs, manifest rebaseline. **Depends on LT-250; gates LT-251.**
  **Skill:** le-truc-dev
  **Context:** The ruling's own check: *every component authored against `truc:case` is a
  component rewritten.* At ruling time that is exactly one — `basic-pluralize`, in
  `examples/basic/pluralize/basic-pluralize.tsrx` and its `.tsx` twin — which is why the
  ruling landed on 2026-09-19 rather than after the next authoring.
  - **Component:** the six `truc:case` spans plus their six `hidden` thunks collapse to one
    element and one thunk: `{() => t.tasks({ count: host.count })}`. The `.none` / `.some`
    split and the `ordinal` prop survive (ordinal selection moves inside the pattern via
    `selectordinal`). Both surfaces stay byte-identical per the ADR 0032 parity contract.
  - **Catalogs:** rewrite `i18n/{ar,cy,de,lv,pl,zh}.json` — `basic-pluralize.task.{zero,one,
    two,few,many,other}` collapse into one `basic-pluralize.tasks` pattern per locale.
    **The six-category locales (ar, cy) are the real test**: their arms move inside the value,
    which is the whole point. de's four category keys become one.
  - **Manifest:** this is the ADR 0030 s5 **sanctioned rebaseline** — sources, translations and
    `i18n/manifest.json` change in ONE commit, so no translation is marked stale for a change
    that altered no meaning. Say so in the commit message; it is the precedent the MF2
    migration will cite.
  **Check:** translation census 0 gaps across all six locales with the new pattern walks live;
  rendered markup for an en page shrinks from six spans to one (pin the byte delta — it is the
  ADR's headline consequence); `basic-pluralize.spec.ts` green in en and de; tier census 20/2/0
  (the component must stay Folded); parity green across both surfaces.

- [ ] LT-253: MF2 migration insurance — round-trip fixtures and the documented rebaseline procedure. **Depends on LT-252.**
  **Skill:** le-truc-dev
  **Context:** ADR 0030's Alternatives records MF1 as a deliberate bet with a kept-open exit:
  `@messageformat/icu-messageformat-1` parses MF1 into the MF2 data model and `messageformat@4`
  serializes it, both from the same maintainers. The bet is only cheap if the exit is *tested*
  rather than asserted. Cost grows with pattern and locale count, so build the harness while
  the corpus is one component.
  - A test that walks every corpus pattern MF1 → MF2 → renders both → asserts identical output
    for a matrix of argument values across all six locales. This is the claim "the migration is
    mechanical," turned into a gate.
  - Pin the two known-lossy spots explicitly: **nested-to-flat arm expansion** (MF1 nests
    plural-inside-select; MF2 uses one flat multi-selector, so arms multiply out — semantically
    identical, textually larger) and **escaping** (MF1 `'{'` quoting vs MF2 `|literal|` /
    backslash — where codemods go subtly wrong). At least one fixture per spot.
  - Write the rebaseline procedure down beside the fixtures, citing LT-252's commit as the
    precedent: one commit, sources + translations + manifest together.
  **Check:** the round-trip suite is green and is wired into `bun test server/tests`, so an MF1
  pattern the exit cannot carry fails at authoring time rather than at migration time.

---

## P2b — Compiler product-readiness: equivalence contract, consolidation, library substitutions (external review + reflection, 2026-09-18)

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
`front-end.ts` has since been split (LT-224, done — see DONE.md) and `emit-server.ts` has
been refactored (LT-225), so re-grep before trusting line numbers in those files.

**Re-scoped 2026-09-18 by [COMPILER_REFLECTION.md](COMPILER_REFLECTION.md) under the framework
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
concurs); **LT-242 amends the ADR 0032 equivalence contract** and carries its adr-keeper pass.
**Declined with the review, recorded so future reviews don't re-propose:** memoising the §2.11
redundant traversals (not a measured problem; a second implicit-consistency contract is the
disease being treated) and restructuring `sim/` (§2.12 is doc/type-surface honesty, folded into
LT-222). The review's "LT-222+" numbering assumed LT-221 was taken; it wasn't.

- [ ] LT-242: Extend the parity suite to diagnostics — the equivalence contract covers failed compiles too (ADR 0032 amendment).
  **Skill:** le-truc-dev
  **Context:** Reflection §2 (rank #2 of its list; cheap). The parity suite — the same component
  authored in both surfaces must render byte-identically — tests successful renders. **All three
  live drifts COMPILER_REVIEW §2.3 documented live in the diagnostic path**, where the parity
  suite could not have caught any of them (the `offenders` truthiness bug — fixed LT-221; the
  `keyName` arm — ruled grammar asymmetry, LT-221; the per-item `ref` message — closes in
  LT-233). Under the framework premise the equivalence contract is a **product promise to users
  of either surface**: the same invalid component must produce the same code and the same
  message text, or one surface teaches its users lies the other never hears. This is cheaper
  than the `SurfaceAdapter` refactor and catches the class the refactor is meant to prevent —
  it also then verifies LT-233's message consolidation, which is why it runs first.
  **How:** extend `server/tests/compiler/tsx/parity.test.ts` (or a sibling) to compile a set of
  invalid fixtures through both front ends asserting equal `DiagnosticCode` + equal message
  text. Surfaces legitimately differ in vocabulary fragments (surface-register words and the
  like) — define that allowlist explicitly as a table in the test; LT-233's `SurfaceWording`
  fold then shrinks it toward zero where the review's item 14 says it should. Seed with
  negative pins for the three §2.3 shapes plus a sample of each diagnostic family.
  **ADR:** this amends the ADR 0032 equivalence contract (the s6 anti-drift statement) —
  adr-keeper pass in the same change; the contract sentence in `ARCHITECTURE.md`
  § Authoring Surfaces gains "and diagnose identically."
  **Verification:** the three §2.3 shapes are pinned (two already fixed — the pins prove they
  stay fixed); `bun test server/tests` green; `check:links` after the doc touches.

- [ ] LT-233: `SurfaceAdapter` + shared `runFrontEnd` — collapse the copied front-end drivers. **GATES LT-218 (P2, with S0's LT-240): land before it.**
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
  families. Runs after LT-242 so the diagnostic-parity net catches any message drift
  this consolidation could introduce.
  **Verification:** goldens + parity byte-identical (the parity suite is the standing
  cross-surface contract); the LT-242 diagnostic-parity pins stay green; warning
  baseline 0; census 20/2/0; full gates green.

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

- [ ] LT-229: One shared estree walk on `eslint-visitor-keys` — retire the twelve hand-rolled skip-lists (reflection §5 supersedes the review's author-it-yourself item 10).
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 10, re-pointed by reflection §5: where a maintained library
  already IS the shared thing, adopt it instead of writing version twelve. Twelve
  `Object.entries` walks (`module-scans.ts`
  ×3 — ex-`front-end.ts`, LT-224,
  `analysis/reactivity.ts`, `evaluability.ts` ×3 — compiler root, not `analysis/`,
  `analysis/tier.ts`, `ast-utils.ts`, `frontend/tsrx/compiler.ts`, `analysis/harvest.ts`
  ×2) carry five different skip-lists; only `ast-utils.ts:676` skips type positions
  today. **Re-frame under the framework premise: external users author TSX constructs the
  corpus never saw — the skip policy is exactly where hand-rolled answers break, and
  `eslint-visitor-keys` is that answer, maintained against every estree node type.** The
  shared walk takes its key set from `eslint-visitor-keys` (walker body may still be
  `estree-walker`/`zimmerframe` or ~30 lines in-house — the KEYS are the borrowed part);
  EACH site migrates
  preserving its current behavior, and converging divergent answers (notably: do we
  descend into type positions?) is an explicit per-site decision with a test or a stated
  no-op rationale — silently converging could change analyses. Migrating
  `reportLeTrucImportMismatch`'s inner visit (`module-scans.ts`) onto the shared walk fixes
  a latent bug for free: the copy lacks the `ForStatement`/`ForOfStatement`/`CatchClause`
  cases `freeIdentifiers` later grew — pin the corrected behavior. Browser purity (M25):
  `eslint-visitor-keys` is pure data — confirm no node-only import path before adopting.
  **Verification:** goldens + parity byte-identical; the import-mismatch pin; full gates.

- [ ] LT-243: Adopt `@typescript-eslint/typescript-estree` for `to-estree.ts` (reflection §5 — the highest-leverage single swap).
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table, rank 1: `frontend/tsx/to-estree.ts` (848 lines) re-implements
  exactly what `@typescript-eslint/typescript-estree` maintains — converting the `typescript`
  AST to ESTree, against every `typescript` major. This retires ADR 0032's stated "Bad"
  consequence ("the converter must track `typescript`-major AST drift"). **The framework premise
  is what makes it urgent rather than tidy:** the corpus is 22 components the converter was
  written against; thousands of users authoring arbitrary TSX is precisely the input surface
  where a hand-written converter's coverage gaps become the support burden — and its bugs miscompile
  silently, the class COMPILER_REVIEW §1 exists to police. Both parser upgrades are reviewed
  changes per REQUIREMENTS §5; treat this as one (a devDependency swap, build-time only,
  browser-pure — typescript-estree is pure JS, confirm no node-only path).
  **How:** map the lowerings' consumed node shapes first (the converter's output feeds the
  shared lowerers; the swap must preserve those shapes or adapt them behind `to-estree.ts`'s
  existing interface so no caller changes). Keep the module boundary — callers consume
  `to-estree.ts`, not the library.
  **Verification:** goldens + parity byte-identical for the corpus; the estree fixtures in
  `server/tests/compiler/` green unchanged; the four `.tsx` tsc gates keep their exit codes;
  full gates green; `scripts/build-tsrx-browser.ts` smoke (browser purity) green.
  **Check:** the pinned `typescript` version ↔ typescript-estree compatibility matrix — record
  the supported range in the module doc so the next `typescript` bump knows what to verify.

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
  fix is visible. **Reflection §5 addition:** the `freeIdentifiers` fork (a scope-analysis
  fork that never received a known bug fix — it lacks the `ForStatement`/`ForOfStatement`/
  `CatchClause` cases the original grew; LT-229's walk migration fixes the *import-mismatch
  copy*, not this one) evaluates `@typescript-eslint/scope-manager`/`eslint-scope` (~−300
  lines, and a maintained scope manager cannot have that class of gap) against collapsing
  in-house — pick one in the handoff with the reasoning stated; a library adoption here is
  a reviewed dependency change per REQUIREMENTS §5, same as LT-243.
  **Verification:** goldens + parity byte-identical; warning baseline 0; census 20/2/0;
  synthetic pins for each converged answer.

- [ ] LT-245: Spike `css-select` + `parse5` for the structural-uniqueness proof; a real selector parser for `selector-syntax.ts` if the pattern holds.
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table, rank 4 — and the one wave-3 substitution that needs a spike
  before commitment. The structural-uniqueness proof (the moat: `first()` selector synthesis,
  exclusivity, cardinality) currently walks the IR/template by hand in five near-identical
  copies in `analysis/selectors.ts` (590 lines) that disagree on max-vs-sum and pending-arm
  handling (COMPILER_REVIEW §2.4; the soil LT-221's probe grew in). **Alternative shape: parse
  the markup the emitter itself produces** and query it with a real CSS engine (`css-select`;
  parse5 is already a dep) — the same question answered with far less machinery, dissolving the
  per-callsite re-litigation the hand walks cause. **Needs care, stated up front:** the proof is
  over the template INCLUDING unrendered branches, so branch arms must be materialized for the
  probe; and the proof reasons about constructs (compose sites, `@for` items) that have no
  DOM-bytes existence until render — the spike must show the materialized-probe model covers
  those before any GO. If the pattern holds, the same substitution covers
  `selector-syntax.ts` + `parseSimpleSelector`'s subset via `postcss-selector-parser`/`css-what`
  (~−250 lines) — the subset is currently the limiting factor on what `first()` can verify
  (descendant combinators, `:not()` are "cannot verify"); a real parser widens verification and
  shrinks code at once. Browser purity (M25): css-select/css-what/postcss-selector-parser are
  pure JS — confirm before adopting.
  **Deliverable:** spike findings + a GO/NO-GO ruling recorded here; if GO, implementation
  tasks with the per-site behavior-preservation discipline the other swaps carry.
  **Verification (spike):** the corpus's structural-uniqueness answers are reproduced
  identically for all 22 components (a differential harness: old walks vs materialized probe);
  goldens byte-identical; full gates.

- [ ] LT-230: Route the sixteen `TemplateNode` walks through `walk.ts`; settle the `pendingChildren` policy once.
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 11. Sixteen hand-rolled template walks against a
  `walk.ts` whose authorized-exception list (`walk.ts:11`) is shorter than the actual
  list; five exclusivity-aware cascades in `analysis/selectors.ts` alone disagree on
  max-vs-sum and pending-arm handling — the soil the §1.4 adjacent gap grew in. Route
  them through `walk.ts` (keeping per-site aggregation semantics), narrow the
  authorized-exception list to what genuinely remains (walks whose recursion IS the
  semantics), and record ONE policy for `pendingChildren` arms, informed by LT-221's
  probe. **The five `analysis/selectors.ts` cascades ride LT-245's outcome**: a css-select
  GO replaces them wholesale (the library owns the traversal); a NO-GO keeps them here on
  the shared walk. Sequence after LT-245's ruling either way.
  **Verification:** goldens + parity byte-identical; the LT-221 probe still pins; full
  gates.

- [ ] LT-232: Derive the name-set subsets; extend the parity test.
  **Skill:** le-truc-dev
  **Context:** Review §2.5/§3 item 13. `REAL_EXPORT_NAMES` duplicates
  `SIGNAL_CONSTRUCTORS` and `PARSER_FACTORIES` entry-for-entry (its own comment admits
  "hand-maintained against the barrel"); `MUTABLE_SIGNAL_CONSTRUCTORS` is a hand-copied
  subset living in `setup-extraction.ts` (ex-`front-end.ts:427`, LT-224). Derive subsets from supersets; relocate the
  mutable set beside `SIGNAL_CONSTRUCTORS` (post-LT-228: into `vocabulary.ts`); extend
  `globals.test.ts`'s parity test (only `FACTORY_CONTEXT_MEMBER_NAMES` has one) to pin
  every set against the `@tsrx/core` barrel.
  **Verification:** typecheck; the extended parity test; goldens + parity
  byte-identical.

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

- [ ] LT-247: Adopt `magic-string` under `spans.ts` (reflection §5).
  **Skill:** le-truc-dev
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

- [ ] LT-246: Make tier contamination legible at the compose edge — the census names the re-routing edge.
  **Skill:** le-truc-dev
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

- [ ] LT-244: Relocate `ExtractContext` out of `ir.ts` (LT-235 item (e); review §2.6/§3 item 19 — carved out of the design session).
  **Skill:** le-truc-dev
  **Context:** Reflection §6's "cheap way to keep the option," worth doing on its own merits and
  ahead of LT-235's full session. `ir.ts` is documented as a pure-type leaf — "a serializable
  `ComponentIR`" — and `ExtractContext` (front-end mutable state WITH function members) is the
  one violation. Evicting it (to `setup-extraction.ts` or its own module, beside its only
  consumers) restores the leaf property: the IR becomes a serializable data structure again,
  which preserves the native-rewrite option for free (reflection §6) and is a precondition for
  wave-4's type-level contracts treating the IR as data.
  **Verification:** typecheck (import moves); goldens + parity byte-identical; `ir.ts` imports
  no function-bearing front-end state (grep pin); full gates green.

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
  **carved out as LT-244** (the reflection §6 free option — landed ahead of this session so
  the IR's leaf property holds while it designs against the IR); (f) typed pass contracts for
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

- [ ] LT-188: Load the composed-children closure before the simulation pass renders (LT-169 review finding). **Land before P5 adds composition across tiers. Gate discharged: LT-239 kept the Simulated tier ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s1), so this runs.**
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

- [ ] LT-248: Document tag-name style scoping as a known limit, not a feature (reflection §2).
  **Skill:** tech-writer
  **Context:** ADR 0033 scopes component styles by custom-element name — right for light-DOM
  components, but it means co-location buys no isolation: two components can collide through a
  shared descendant selector, and collision safety rests on convention. In-house that was a
  footnote; **for a framework in thousands of projects it is a doc obligation** — state the
  limit where users read (`docs-src/pages/styling.md`'s compiled-component callout and
  `server/compiler/HOST_PROFILE.md`'s styles section): scoped by tag name, global-ish by
  default for descendant selectors, no encapsulation boundary. This is NOT the parked ADR 0033
  work (tag-name nesting, upstream-pattern composition — ROADMAP backlog, LT-214 rides with
  it); it is the one honest sentence the reflection asks for.
  **Verification:** `check:links` green; the two docs say the same thing in the same words
  (one is user-facing, one is the authoring profile).

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

**Framework framing (S0, 2026-09-18):** the corpus is no longer only a playground — it is the
**public showcase of the authoring surfaces** for the library's users, which is also the
resolution of COMPILER_REFLECTION §2's "default by rule, not by practice" finding: the owner's
LT-238 ruling (all three spellings side by side) makes the corpus the honest side-by-side demo
of the surfaces' trade-offs, and the wave-4 migrations bank the `.tsx`-default DX story the
reflection asked to see banked somewhere. **Gated on LT-178/LT-179 only** (P4) — the other gates landed 2026-09-18: LT-202 (the
`.tsx` front end in the build) and LT-210 (the TSRX pin upgrade, 0.2.3; owner sequencing
2026-09-17). LT-183 returned GO (ADR 0032, dual front end) — **migrations author
`.tsx`**;
the spike's four fixtures (`spike/tsx/`, moving to the example folders by LT-237) and
`ARCHITECTURE.md` § Authoring Surfaces are the shape reference. Otherwise unblocked. The canonical pattern is LT-092's: same-commit cutover — delete the `.ts` twin, point
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

- [ ] LT-238: Relax "one authored source per component tag" to a canonical-plus-variants rule (owner ruling, 2026-09-18). **Gates LT-237 and every remaining wave-4 migration.**
  **Skill:** architect (design + ADR) → le-truc-dev (implementation)
  **Context:** The owner has ruled that this repo must carry **all three spellings of a
  component side by side** — the hand-written `.ts` twin, the `.tsx` compile and the `.tsrx`
  compile — for two reasons: (a) each must pass the same Playwright spec, so the spec is the
  equivalence contract at runtime the way the parity suite is at build time; (b) the three
  spellings side by side are the honest showcase of the surfaces' trade-offs, which is
  exactly what ADR 0032's dual ruling asks readers to weigh. Today the corpus forbids this:
  one tag declared by two corpus files fails the build (TSRX048), and the P5 migration
  pattern above says "delete the `.ts` twin."
  **The design question this needs answered first — do not skip to the code.** Three
  spellings of one tag collide in three places, not one: the emitted artifact names
  (`<tag>.server.ts` / `<tag>.client.ts` / `<tag>.css`), the corpus registry (`RegistryEntry`
  is keyed by tag, and `truc:pass` legality is decided through it), and the browser
  (`customElements.define` throws on the second registration). Two shapes answer it, and
  they trade off differently:
  (a) **Canonical + suffixed variants** — one spelling owns the tag, the others compile to a
  derived tag (`basic-counter--tsx`) and their own artifacts. All three can be registered on
  one page, so the showcase is a side-by-side demo and the spec can address each directly.
  Cost: the derived tag leaks into the registry, compose sites, and CEM output.
  (b) **Canonical + build-selected variants** — one tag, three builds, a page-level or
  build-level switch picking which spelling is served. The spec is run three times unchanged,
  which is the cleanest possible reading of goal (a). Cost: the showcase is no longer
  simultaneous, so goal (b) needs the docs to render sources rather than live components.
  Recommendation to grill, not to assume: (b) for the test contract, with the docs showing
  all three sources from the same folder — but this is the owner's call and it should be
  made before either LT-237 or the next migration. **Framework note (S0):** under the
  general-purpose goal the showcase is external-facing — the side-by-side demo is part of
  the product story for library users, so weigh goal (b) (simultaneous live demos) at full
  weight when grilling, not as a nice-to-have.
  **Obligations.** This amends ADR 0032 sub-design 6 and the `ARCHITECTURE.md` § Authoring
  Surfaces sentence "One component tag has exactly one authored source" — record via
  `adr-keeper`, do not edit the ruling in place. TSRX048 narrows rather than retires (it must
  still catch two *canonical* sources for one tag): **channel = compiler, tier 1 Prevented**,
  statically decidable, no runtime half. **Tech Writer reviews the new TSRX048 copy** — the
  message names both files today and will need to name the canonical-source rule instead.
  Rewrite the P5 migration pattern above in the same commit: "delete the `.ts` twin" becomes
  "retain the `.ts` twin as a variant."
  **Verification:** a corpus carrying all three spellings of one example compiles clean; the
  example's Playwright spec passes against each; TSRX048 still fires for two canonical
  sources; `bun test server/tests`, typecheck, warning baseline 0.

- [ ] LT-237: Move the spike's `.tsx` fixtures into their example component folders. **Depends on LT-238.**
  **Skill:** le-truc-dev
  **Context:** `spike/tsx/` is not spike residue — it is the live corpus for
  `server/tests/compiler/tsx/parity.test.ts`, `tsx/typecheck.test.ts` and
  `dual-corpus.test.ts`, and the only `.tsx` source in the repo. `spike/` implies disposable;
  these are permanent gates. Move the four ported components beside their `.tsrx` twins —
  `spike/tsx/basic/counter/basic-counter.tsx` → `examples/basic/counter/`, likewise
  `basic/pluralize`, `form/listbox`, `form/combobox` — which is what LT-238's rule change
  makes legal. The synthetics, negatives, probes and four tsconfigs
  (`sync-el`, `async-el`, `combobox-bad-args`, `async-bad-arms`, `bad-host-typo`,
  `jsx-probe`, `jsx-probe-neg`) are test fixtures, not examples: move them to
  `server/tests/compiler/fixtures/tsx/` instead, which also shortens their relative paths
  into `server/compiler/frontend/tsx/host-profile.d.ts`. Update the three test files' path
  constants, the four tsconfigs' `include`/`exclude`, and the `spike/tsx/` references in this
  file and `adr/archive/0032-spike-findings.md`; delete `spike/` once empty.
  **Watch:** the parity suite pairs `examples/**.tsrx` against the `.tsx` copy. Once the four
  live in one folder under LT-238's rule, the pair is a folder-local fact rather than a
  cross-tree one — keep the test asserting byte-identical server output and CSS, since that
  is the standing equivalence contract `ARCHITECTURE.md` § Authoring Surfaces names.
  **Verification:** `bun test server/tests` green with no fixture-path skips; the four tsc
  gates keep their exit codes (0 positive, 2 negative); check:links.


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

- [ ] LT-249: Report non-string catalog values — a malformed `i18n/<locale>.json` entry is silent in both the census and sync (LT-217 review falsification). **Survives the LT-240 ruling, and grows a sibling:** ICU adds a second malformed-value class (a string that is not a parseable pattern), handled in LT-219 — land them as one `malformed` family with consistent copy, and drop the "LT-219 placeholder precedent" phrasing below for LT-219's argument-preservation case.
  **Skill:** docs-server-dev
  **Context:** Found by accident during the LT-217 review (2026-09-18): a catalog entry whose
  value is not a string — probed as a nested group, `{"basic-pluralize": {"stray.few":
  "wenige"}}` instead of the flat compound `"basic-pluralize.stray.few"` — is silently ignored
  everywhere: the translation census reports **0 gaps**, `i18n:sync` reports nothing and prunes
  nothing, and the entry sits in six catalogs forever. This is the silent-wrong-answer class in
  the exact channel (LT-196's) built to make catalog data problems loud, and the shape is
  realistic: a hand-editor nesting "under the component" is the most natural mistake there is.
  **Channel and tier (ADR 0028 s1):** the **build report / translation census**, tier **not
  applicable — a report, not an error**, same posture as missing/stale/orphaned: a catalog is
  DATA, the build never fails on it, and the compiler has no jurisdiction. Tech Writer owns the
  census wording (batch with LT-189 item 8's family).
  **How:** in `collectI18n`'s orphan walk (and the declared walk where values are read), a key
  whose value fails `typeof === 'string'` pushes a census record (new `TranslationGap['status']`
  case or reuse `orphaned` with a distinct reason — Architect's call at pickup; a distinct
  `malformed` case reads better). `i18n:sync` lists malformed entries in its summary and
  **cannot auto-fix** (it must not guess a shape — follow the LT-219 placeholder precedent).
  **Falsification probe to pin:** plant a nested-group value in a scratch catalog; census
  reports it; sync lists it unpruned; the flat twin behaves as today.
  **Acceptance:** the probe above pinned over the real catalogs with injection (LT-196 test
  pattern); committed catalogs stay gap-free; census/sync summaries unchanged when all values
  are strings.
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
