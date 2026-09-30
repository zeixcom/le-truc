# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): the ICU MessageFormat switch, end to end.** Drawn
from [BACKLOG.md](BACKLOG.md)'s P2 band (all of it), two P2b gates, and two P6 items. The
previous iteration ("wave 4, second batch") is fully landed and reviewed: LT-095 and
LT-104–LT-108 serve as compiled `.tsx` with their twins retained, and every gate and rider it
carried is closed (LT-300–LT-302, LT-319, LT-325, LT-326, LT-328–LT-330, LT-332, LT-338,
LT-339). Compacted records are in `DONE.md`; the public summary is in `CHANGELOG.md
[Unreleased]`. LT-329's Deno leg was verified locally by the owner on 2026-09-25 and filed LT-341.

**Why now (owner, 2026-09-25).** The MF1 ruling (LT-240, ADR 0030 s4) is six days old and has
one component authored against the retired `truc:case` shape. That count only grows: every
wave-4 migration that declares `i18n` adds to it. Each new catalog key also raises the MF2
exit's cost (LT-253). The migrations no longer contend for the compiler's front ends, so the
consolidation gate can land without blocking anyone.

**Ruling taken at planning (owner, 2026-09-25; ADR 0030 s4 amended): `t` is typed per key.**
The 2026-09-19 ruling kept `t` as `string | ((args) => string)` and deferred per-key
precision. With that union, every attribute that reads a message (`placeholder={t.filter}`)
fails tsc, because a function is not an attribute value. So **LT-308** is re-scoped: it runs
after LT-250 and types each key from LT-250's parse. Authored `.tsx` gets `I18n<typeof i18n>`
over an `as const` declaration; the generated modules get exact argument records. LT-250 item 5
and LT-220 item 0 are amended to match. The loose union never ships.

**The chain.**
- **Gates (P2b).** **LT-242** puts the diagnostic-parity net in place, then **LT-233** collapses
  the two copied front-end drivers under it. Every later task edits both surfaces, and LT-233
  makes that one edit.
- **Build half.** **LT-250** adds the parser, the shared evaluator, the server fold and the
  argument diagnostic. **LT-308** adds per-key types. **LT-252** rewrites basic-pluralize and
  its six catalogs to one pattern each, as the sanctioned manifest rebaseline in one commit.
  **LT-251** deletes `truc:case`, pruning and `pluralCategories`, and retires LTC008.
  **LT-253** pins the MF2 exit while the corpus is one pattern.
- **Client channel.** **LT-218** adds the per-instance `i18n` attribute and the inlined,
  narrowed evaluator. **LT-219** moves tokenbox, colorgraph and spinbutton onto it, retires the
  carrier span, and adds the census pattern walks. **LT-249** lands with LT-219 as one
  `malformed` census family.
- **Copy.** **LT-220** covers the message-model docs. **LT-189** is the standing one-voice
  Tech Writer round (seventeen items, one withdrawn). The two run as one round, last, so the new ICU codes
  join it.
- **Parallel slot.** **LT-138** ✓ (reviewed 2026-10-01, in `DONE.md`) was promoted by the LT-102 review. module-splitview authors
  `truc:html`, so the inverted sanitizer defaults are now live in the corpus. Its first step
  is the fixture that confirms the flip.

**Order (re-ruled 2026-09-26).** LT-242 → LT-233 → LT-250 → LT-308 → LT-347 → LT-348 → LT-218 →
LT-252 → LT-251. LT-253 after LT-252. LT-218 → LT-349 ✓ → LT-219 ✓ (LT-249 follows); LT-350 before
LT-219 where possible. basic-pluralize's single
pattern re-evaluates when `count` changes client-side, and only LT-218's channel can do that,
so LT-252 now waits for it. LT-347 closed the compiler gap LT-218 would otherwise build on. LT-348 removes the false positives it introduced. LT-220 and LT-189 run as one Tech Writer round after
LT-219, as LT-220's header asks. LT-138 is ungated (LT-346 ✓). LT-351 (Architect) ruled 2026-09-30 → LT-354 ✓ (LT-352 follows it) and LT-355 (backlog).

**Deliberately not here.** The ADR 0037 implementation (LT-274–LT-276) and the ADR 0033 CSS
track (LT-268 → LT-304/LT-306) are the next compiler-heavy candidates. They contend with LT-233
for both front ends, so they wait. LT-280's design grilling (gating LT-109–LT-111) is still
architect work. LT-340 (from LT-326's review) and the rest of P3 stay parallelizable for the
following iteration. The P1 publish track stays behind P6.

**Exit criterion:** both surfaces diagnose identically over the seeded invalid fixtures
(LT-242). One `runFrontEnd` drives both front ends, with goldens and parity byte-identical
(LT-233). An ICU pattern folds server-side, differentially green against `@messageformat/core`,
and `@messageformat/core` is absent from `server/compiler/` production imports (LT-250).
`t.fliter` and a bare `{t.tasks}` in an attribute fail tsc, and `Attr<T>` is `Reactive<T>`
again (LT-308). basic-pluralize renders one span, with the byte delta pinned, and all six
catalogs carry one pattern (LT-252). `grep "truc:case\|pluralCategor\|caseType"` finds only
retirement notes (LT-251). The MF1 → MF2 round-trip suite runs in `bun test server/tests`
(LT-253). tokenbox, colorgraph and spinbutton announce event-time strings in en and de through
the `i18n` attribute, a component without client messages renders byte-identical, and the
census reports argument, arm-coverage, unparseable and malformed entries (LT-218, LT-219,
LT-249). The docs teach the ICU model with no trace of the per-category convention or the
wider-type caveat (LT-220, LT-189). server and client agree on the `truc:html` sanitizer
default (LT-138). Across all of it: warning baseline 0, tier census unchanged from the
iteration's opening measurement (record it before the first change), and `bun run build:docs`
and `check:links` pass.

**Next free task ID: LT-360.**

---

### Gates (run first)

### Build half (LT-250 → LT-308 → LT-218 → LT-252 → LT-251; LT-253 after LT-252)

### Client channel (after LT-250; LT-249 lands with LT-219)

### Copy (after LT-219)

### Parallel slot

