# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-19): the compiler's shape — seams, interfaces, and
de-TSRX-ification.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1 band, minus everything that
depends on publishing.

**The ruling that defines it (owner, 2026-09-19).** An earlier plan led with LT-254 on the
argument that first publish freezes the package name, the diagnostic-code vocabulary and the
dependency contract, so it should happen early. **That argument was wrong**: `@zeix/` is a
namespace this project owns, so the name cannot be taken and nothing about publishing is
urgent — and publishing a package no outside consumer can yet use is not a milestone, even
when the pioneers are Zeix-owned. **The first publish happens no earlier than after the P6
cleanup round.** LT-254, LT-259, LT-260 and LT-261 sit behind that gate.

What is left is the work that was never about distribution: a compiler that still carries the
vocabulary of the TSRX-only tool it grew from, and seams that are named in ADRs but absent
from the code.

**Exit criterion:** a **pruned** compiler — no naming that originates in the TSRX-only
approach survives on a surface whose published input is `.tsx` — with its **interfaces
explicitly defined**: the front-end contract (LT-265), the realm interface (LT-263), and the
file-IO layer (LT-267). Not a tarball and not a pre-release; both of those are P6-gated.

**Sequencing, and why.** LT-263 leads: it is the one whose absence fails *silently* —
ADR 0034 s5 committed jsdom to an optional peer dependency and the code cannot honour it.
**LT-271 follows it, not precedes it**: the seam moves the build report out of `sim/` and
rewires `server/effects/tsrx.ts`, so renaming after the structural move is cheaper than
renaming into it — and the vocabulary must settle before LT-267 writes a file-IO API that
would otherwise inherit it. **LT-255 and LT-267 run as one unit** (LT-267 says so: both are in
the same `server/effects/` globs, and sequencing them lets LT-255 harden a Bun-shaped glob API
that LT-267 then has to undo). LT-256 closes out LT-263's payoff; LT-265 lands last, when the
contract it documents has stopped moving.

**Deferred with a date, not a priority:** **LT-266** (measure the size bet) is scheduled for
**the iteration after this one**. It depends on nothing and blocks nothing, which is exactly
why it needs a date — and it gets more expensive once anyone proposes a connector, because
then the number has a stake in it.

**Next free task ID: LT-272.**

---

- [ ] LT-271: Prune TSRX-only vocabulary from the compiler — the LT-206 deferral sweep, carved out of LT-254(c).
  **Skill:** le-truc-dev (Tech Writer owns the copy of anything renamed)
  **Context:** ADR 0034 s1–s2; carved out of LT-254 on 2026-09-19 because this is a **shape**
  problem, not a distribution one, and it should not wait on a publish date. v3.0's published
  input surface is `.tsx`, but the compiler still speaks as the TSRX-only tool it grew from.
  The deferrals LT-206 parked, now scheduled: the `check:tsrx`/`build:tsrx` script names,
  `server/effects/tsrx.ts`, the `server/generated/tsrx/` output directory, `@tsrx/core` package
  names appearing in internal APIs, and the `TSRX###` diagnostic codes. **Each is either renamed
  to surface-neutral vocabulary or consciously kept, with the reason recorded** — a blanket
  rename is as wrong as none, since `.tsrx` remains a first-class repo-internal surface under
  ADR 0032 s6's parity contract and some of these names refer to it correctly.
  **The diagnostic codes are the load-bearing decision.** They become public API at first
  publish, so the vocabulary must be settled *before* P6 even though the publish is after it;
  a code keeping the `TSRX` prefix while the published surface is `.tsx` needs a stated
  rationale, not an omission. Channel: compiler; the error-message-lifecycle sweep in the
  `tech-writer` skill applies to every code touched, including retirements — a deleted code
  leaves references behind.
  **Runs after LT-263** (the seam rewires `server/effects/tsrx.ts`; rename after the move) and
  **before LT-267** (so the new file-IO layer does not inherit the old vocabulary).
  **Check:** a written ledger of every deferred name with its disposition and reason; gates
  green (typecheck, `bun test server/tests`, the renamed check/build scripts, build:docs,
  check:links); corpus output **byte-identical** — this sweep renames, it does not emit
  differently; the census and warning baselines unmoved.

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
  **LT-263 landed the seam (reviewed 2026-09-19); this is what plugs into it.**
  `resolveSimulationProvider()` in `server/compiler/simulation/resolve.ts` already answers
  `null` on absence — detection exists. What is missing is the routing: `effects/simulate.ts`
  currently **throws** a named error when no driver is installed and Simulated-tier components
  exist, which is the one configuration [M28](REQUIREMENTS.md#m28-distribution-and-dependency-weight)
  says must never fail a build. That throw is a deliberate placeholder and its removal is part
  of this task, not a separate cleanup. The census reason text is yours to draft; Tech Writer
  owns the final copy.
  **Also required — raised at the LT-263 review, and only dangerous once this task lands.**
  `resolveSimulationProvider()` catches *every* error from the dynamic import, so a driver that
  is installed but **broken** (a throw during module init, a bad transitive dependency) is
  indistinguishable from one that was never installed. Today that still fails the build, so the
  worst outcome is a misleading message. After this task it becomes a silent degradation: the
  build would route every Simulated component Static, print `unavailable substrate`, and ship
  skeleton HTML for a substrate that *is* there — exactly the class of failure the channel
  discipline exists to prevent. Narrow the catch to genuine module-resolution failure
  (`ERR_MODULE_NOT_FOUND` / Bun's `ResolveMessage`) and let anything else surface, the same way
  `SimulationSeamVersionError` already distinguishes a broken install from an opt-out.
  **Check:** `npm install` without the optional peer, then a corpus build: green, with the two
  Simulated components routed Static and named in the census with the new reason. Plus the
  negative: a driver present but throwing at import fails the build and says so, rather than
  reporting `unavailable substrate`.

- [ ] LT-265: Define and document the front-end contract; designate its export surface. **Re-scoped 2026-09-19 (owner): “clear interfaces defined” is this iteration's exit criterion, so the contract is settled now — the `exports` entry itself rides LT-254 behind the P6 gate.**
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
  **Split 2026-09-19, because LT-254 is now P6-gated and this is not.** *In this iteration:*
  the contract written down, the stability policy stated, and the exact set of symbols that
  will be exported **named** — defining the interface needs no package. *Rides LT-254:* the
  `exports` map entry and the version stamp, which are mechanical once the set is named.
  Coordinate with **LT-271** — it is deciding, in the same iteration, what the public
  vocabulary is called; a contract documented against names LT-271 then renames is worse than
  no document.
  **Check:** a scratch front end outside the repo — even a trivial one over a toy syntax —
  compiles a component end-to-end using only the designated contract surface and the written
  document, and its refusal path produces a real diagnostic. Run against the repo's own
  module paths in this iteration; re-run against the published exports when LT-254 lands —
  the second run is LT-254's check, not this one's.
