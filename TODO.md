# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-21): the compiler measured, its install story sound, and
the last v3.0 deprecation gates cleared.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1 and P4
bands. The previous iteration ("the compiler's shape") is fully landed and reviewed —
LT-263, LT-271/272, LT-255 + LT-267, LT-256 and LT-265 are in `DONE.md`. **Landed within
this iteration (2026-09-21, also in `DONE.md`):** LT-273 (config validation, bounded
search, configured scan everywhere — reviewed ✓), LT-278 (ADR 0038) and LT-279
(absent-substrate docs).

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
spelling, and `grep -rn "examples/\*\*" scripts/ server/` has no runnable scan code outside
`corpus-config.ts`'s defaults (pin test and doc prose excepted — ruling recorded in the
LT-273 `DONE.md` entry); the `pass()` short forms and the factory return contract are gone from the library
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

- [x] LT-178: Remove the `pass()` unrestricted-write short forms (ADR 0012 removal). — done, pending review ⏳
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

  **Landed 2026-09-21 on `remove/pass-short-forms` (branched from v3 @ a8a3bdee per the
  owner's 2026-09-04 separate-branch sequencing) — done, pending review ⏳.** Handoff for
  review:
  - **Runtime decision worth review:** `pass()` no longer resolves entries through the shared
    `toSignal` (watch() keeps it untouched) — a new `toPassedSignal` accepts exactly thunk |
    `{ get, set }` descriptor and returns `undefined` for everything else, so a retired form
    (prop-key string, bare writable signal, AND bare read-only `Memo`/`Task`, which 2.x
    admitted without warning) now fails the PRE-EXISTING eager validation
    (`InvalidPassPropertyError`, nothing swapped) instead of silently resolving. The check
    count is net-negative (DEV_MODE warning deleted; the throw rides the ADR 0011 validation
    that already existed). First-draft copy for the failure reason lives in `swapSlots`
    (`'could not be resolved to a signal — pass() accepts a thunk () => … …'`) — Tech Writer,
    that caller-side reason string plus the CHANGELOG Removed entry and the ADR 0012 status
    paragraph are the copy to review; `InvalidPassPropertyError` itself and `errors.ts` are
    untouched.
  - `PassedProps`/`PassHelper` lost the `<P>` type parameter (it existed only to type the
    property-key form); `FactoryContext.pass` follows. JSDoc updated; regenerated `index.js` +
    `types/` committed (source-driven diffs only, no minifier churn).
  - Sweep verdict: zero stragglers — `examples/` already thunk/descriptor-only (compiler's
    `truc:pass` IR only ever carried thunks/descriptor-thunks), root `test/` clean,
    `docs-src/pages/` clean; prose updated where it still said "deprecated, warns in
    DEV_MODE": AGENTS.md, ARCHITECTURE.md § Pass, CONTEXT.md **Pass**, ROADMAP dead-end
    bullet struck (removed, LT-178), both `le-truc` skill references, `le-truc-dev`
    non-obvious.md. ADR 0012 status records the removal. `docs-src/api/**` TypeDoc output and
    `_media/` mirrors NOT regenerated/refreshed (no build refreshes `_media` — the known
    systemic gap).
  - Gates re-verified live in THIS tree: `bun test src/tests` 487 ✓, `bun test server/tests`
    1691 ✓ (91 files, matches the re-pinned TESTS.md), `check:size` ✓, `check:links` ✓ (614),
    targeted Playwright (pass + debug specs, Chromium) 17 ✓. Bare `bun test` is NOT a gate —
    it sweeps the Playwright specs and reports 40 false failures.

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
