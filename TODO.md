# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-21): the compiler measured, its install story sound, and
the last v3.0 deprecation gates cleared.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1 and P4
bands. The previous iteration ("the compiler's shape") is fully landed and reviewed —
LT-263, LT-271/272, LT-255 + LT-267, LT-256 and LT-265 are in `DONE.md`.

**Why these six.** **LT-266 leads by owner schedule** (2026-09-19): the size bet was
deferred to "the iteration after the current one" — this one — and it is the acceptance
number any future connector claim is judged against; it depends on nothing and blocks
nothing, so it runs in parallel with the rest. **LT-178 and LT-179 are the critical path**:
wave 4 (P5's example migrations, the biggest remaining band) is gated on **LT-178/LT-179
only** — every other gate landed 2026-09-18 — so clearing them this iteration lets the next
one open the migrations. They run on their own branch per the owner's 2026-09-04 sequencing,
before any migration. **LT-273 finishes the install story** the last iteration built
(ADR 0036): the config file is the entire surface a consumer touches at install time and
currently accepts garbage silently; it also retires the last hard-coded corpus glob
(absorbing the i18n-sync rider LT-277's entry points at) and bounds the config search.
**LT-278 and LT-279 are the review residue** of LT-267 and LT-256 — one ADR (record the
runtime-neutrality decision while it is fresh; publication planning must not precede it) and
one docs pass (SERVER.md's absent-substrate section, TESTS.md's stale count) — both small,
both skills that do not contend for the dev slots.

**Exit criterion:** the size bet has a recorded number, whichever way it comes out;
`le-truc.config.json` rejects malformed input naming the offending key and the accepted
spelling, and `grep -rn "examples/\*\*" scripts/ server/` returns only `corpus-config.ts`'s
defaults; the `pass()` short forms and the factory return contract are gone from the library
on the removal branch (wave 4 unblocked); the runtime-neutrality decision has its ADR, and
SERVER.md/TESTS.md tell the truth again.

**Next free task ID: LT-280.**

---

- [ ] LT-266: Measure the size bet — emitted bytes for the same component authored in Le Truc and in React. **Scheduled early — the iteration after the current one, not this one (owner, 2026-09-19): it depends on nothing and blocks nothing, which is exactly why it needs a date rather than a priority.**
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

- [ ] LT-273: Validate `le-truc.config.json`, and retire the last hard-coded corpus glob.
  **Skill:** le-truc-dev
  **Context:** LT-255 review finding (2026-09-19); [ADR 0036](adr/0036-corpus-configuration-surface.md).
  The config file is **the entire public surface a consumer touches at install time** — the
  first thing the agency-developer persona ([§2](REQUIREMENTS.md#2-user-personas),
  [M28](REQUIREMENTS.md#m28-distribution-and-dependency-weight)) interacts with — and it is
  currently parsed with `JSON.parse(...) as CorpusConfigInput` and no validation at all. Three
  failure modes, all confirmed by probe at review:
  1. **`"outdir"` (wrong case) silently writes to the repo default path** inside the consumer's
     project. It succeeds, in the wrong place, with no signal. This is the one that matters —
     "it compiled but nothing is where I asked" is the worst failure shape for a first install.
  2. `"sources": "src/**/*.tsx"` — a string where an array belongs — spreads into twelve
     single-character globs (`["s","r","c",…]`) and reports twelve garbage patterns.
  3. Any unknown key is silently ignored, so the run falls back to **this repo's**
     `examples/**` globs, which in a consumer project match nothing.
  **Also in scope, because it is the same drift:** `scripts/i18n-sync.ts` still globs
  `examples/**/*.tsrx` **hard-coded and single-extension**, and calls `collectI18n` without
  `i18nDir`. It is an in-repo person-run tool so the defaults are correct today and nothing is
  broken — but it is now the LAST place that hardcodes the corpus scan, and it re-opens exactly
  the ledger gap LT-255 closed: widen `DEFAULT_SOURCES` and `i18n:sync` silently stops seeing
  the new files. LT-255's "a single place to widen" is not true until this is folded in.
  **Third item, small:** `server/effects/compile.ts` still prints `📝 TSRX compilation
  completed (N …)` and throws `TSRX compilation failed — …` on a path that compiles both
  surfaces and is now consumer-configured. The developer was right not to rename it inside a
  byte-identity task; do it here, **with a row in
  [`VOCABULARY_LEDGER.md`](server/compiler/VOCABULARY_LEDGER.md)** recording the disposition —
  that file owns the call, not a side edit.
  **Fourth, a containment guard:** `findConfigFile` walks to the filesystem root, so a stray
  `le-truc.config.json` anywhere above a checkout silently retargets that checkout's build.
  Stop the search at the nearest `package.json` (or `.git`), whichever the project boundary is.
  **Channel and tier — decided here, do not re-litigate:** a malformed config is a **thrown
  startup error, channel: none**. It is read before any component is parsed, so there is no
  source span and no author-fixable *component* mistake, which is what
  [ADR 0028](adr/0028-tiered-error-surfacing.md)'s tiers grade. **No `LTC` code and no Tech
  Writer handoff is owed** — and precisely because the error is untiered, the message text IS
  the whole user experience: name the file, the field, what was received and what was expected,
  and list the accepted keys on an unknown one.
  **Deliverable:** field-level validation of `CorpusConfigInput` (types, unknown keys rejected
  rather than ignored, actionable messages); `i18n:sync` on the configured scan; the vocabulary
  rename plus its ledger row; the config-search boundary.
  **Check:** each of the three probed failure modes produces a message naming the offending key
  and the accepted spelling; `i18n:sync` picks up a `.tsx` component under `examples/`; corpus
  output byte-identical; census 20 folded / 2 simulated / 0 static and warning baseline 0
  unmoved; `grep -rn "examples/\*\*" scripts/ server/` returns only `corpus-config.ts`'s
  defaults.

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

- [ ] LT-278: Record the runtime-neutral build path as an ADR (LT-267 review).
  **Skill:** adr-keeper
  **Context:** the LT-267 review (2026-09-21). The decision — the published compiler
  package's build path requires *a* JS runtime, not Bun specifically; `RuntimeIO` is the
  seam; glob pattern semantics are one shared grammar decided once in
  `server/runtimes/glob.ts`; `check:portability` (Bun/Node/Deno, byte-identical emitted
  trees) is the standing gate — is implemented, gated, and documented operationally in
  `server/SERVER.md`, but no ADR owns it. [ADR 0036](adr/0036-corpus-configuration-surface.md)
  cites LT-267 as a constraint from the config side; [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md)
  is the natural home (the runtime contract is part of the distribution story) or a
  standalone ADR beside it — adr-keeper's call. Record BEFORE the compiler package's first
  publication (P1, P6-gated): the runtime contract is consumer-visible the moment the package
  exists.
  **Check:** the ADR records the decision, the one-grammar ruling (including the LT-277
  edges or their resolution), and the gate; adr-index and cross-links updated;
  `bun run check:links` clean.

- [x] LT-279: Document the absent-substrate routing (LT-256 review docs gap) — done ✓
  **Skill:** tech-writer
  **Changed:** `server/SERVER.md` (simulation section states the absent-substrate routing — Static reroute, `unavailable-substrate` signal, registry rewrite, census rows, green build — plus the broken-substrate failure and registry.json's last-one-shot-build semantics; the `resolve.ts` bullet gains the `isSubstrateAbsence` narrowing); `server/TESTS.md` (count re-pinned to 91 files / 1683 tests, verified live; `contract.test.ts` and `simulation-resolve.test.ts` rows added to the tree). `bun run check:links` clean (611 links); SERVER.md wording matches the landed pass-log copy.
  **Context:** the LT-256 review (2026-09-21). The landed behavior — no jsdom installed:
  the one-shot build routes the Simulated-tier components Static, appends an
  `unavailable-substrate` routing signal, rewrites `generated/registry.json` (the tier
  census's input), logs the census rows, and stays green; a substrate present but broken
  fails the build naming the real cause — is recorded only in code comments and the ADRs
  ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5,
  [ADR 0029](adr/0029-tiered-server-evaluation.md) s6). `server/SERVER.md`'s simulation
  section still reads as if the pass always opens a realm. State it there (the LT-256
  handoff's flagged ask): the absence behavior, the one-shot-only scope, and that
  registry.json reflects the last build's routing outcome. Also re-pin `server/TESTS.md`'s
  count line (says 89 files / 1668 tests as of 2026-09-21; LT-256 + LT-265 made it
  91 files / 1683) and add the `simulation-resolve.test.ts` and `contract.test.ts` rows to
  its tree. Tech Writer owns the census reason and pass-log copy (drafted by the LT-256
  handoff, landed verbatim).
  **Check:** `bun run check:links` clean; the SERVER.md paragraph matches the landed log
  copy.
