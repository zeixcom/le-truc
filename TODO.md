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
this iteration (2026-09-21, also in `DONE.md`):** LT-266 (the size bet, measured — the bet
holds, 3.7× less over the wire; reviewed ✓), LT-273 (config validation, bounded
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

**Next free task ID: LT-281.** (LT-280 filed in BACKLOG.md P5 on LT-266 review: the
reactive-list per-item channel design that gates the loop-heavy composite migrations.)

---

- [x] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone).
  **Skill:** le-truc-dev
  **Status:** 2026-09-21, done on `remove/factory-return`, pending review ⏳. Helpers
  (`watch`, `on`, `pass`, `each`, `reconcile`, `provideContexts`) return `void` and push into the
  ambient collector — the only registration path; `FactoryResult` is deleted from
  `src/types.ts`/`index.ts` (acceptance met), `forEachUnseen` and the factory/extension
  return-reconciliation in `src/component.ts` are gone, and `activateResult` is now the flat
  `activateDescriptors`. `EffectDescriptor` stays exported as the input type of the one
  documented hand-authored path, `watch(() => true, descriptor)`. `each()`'s callback adopts
  `reconcile()`'s `bindItem` contract (returned `MaybeCleanup` = per-element scope teardown);
  extension `onConnect` returns a single `EffectDescriptor`. All 483 src tests green;
  typecheck, lint, `check:links`, `check:size` clean; index.js + types/ regenerated. Docs
  touched for Tech Writer review (AGENTS.md, ARCHITECTURE.md ×2 sections, CONTEXT.md ×3
  entries, ROADMAP.md dead-ends band, CHANGELOG breaking entry, le-truc + le-truc-dev skill
  references). **Open Tech Writer rider (pre-existing, LT-178):** a parallel session's
  in-flight `swapSlots` reason-string edit was present in this tree mid-task and was reverted
  so this branch lands pure — see NOTES.md.
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
