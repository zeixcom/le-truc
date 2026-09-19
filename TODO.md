# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-18): the three S0 framework-goal grilling sessions — and
nothing else.** **All three are closed** — the iteration is complete.
**LT-240** (i18n message model → ICU MessageFormat 1; ADR 0030, M24), **LT-241** (framework goal
+ packaging track → [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md),
REQUIREMENTS §1/M27/M28, BACKLOG's new P1 band) and **LT-239** (the Simulated tier →
[ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md): the tier is kept
and scoped **SSG-only** for 3.x, the seam that makes jsdom genuinely optional is scheduled as
**LT-263** and **blocks LT-256**, and the `@zeix/le-truc-simulation` split is deferred to a later
3.x as LT-264). Their rulings gate the backlog bands beneath them — see BACKLOG.md's strategic
framing, whose three cross-cutting consequences are now all resolved rather than pending.

**The next iteration is opened from BACKLOG P1**, which is release-gating: LT-263 first, since
everything in the distribution story depends on it and its absence fails silently.

**Next free task ID: LT-271.**

---
