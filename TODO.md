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

**Status, 2026-09-19.** LT-263, LT-271, LT-272 and **LT-255** are landed and reviewed (in
`DONE.md`). LT-255 ran ahead of LT-267 rather than beside it, and the pairing paid off in the
direction the note hoped: it left the corpus scan touching `Bun.Glob` in exactly one module
(`server/corpus-sources.ts`) and `server/compiler/` free of Bun APIs, so LT-267 has a seam to
replace rather than a hardened API to undo. It also settled the compiler's configuration
surface without LT-254 ([ADR 0036](adr/0036-corpus-configuration-surface.md)), and spun off
**LT-273** (validate that surface) to `BACKLOG.md`.

**Deferred with a date, not a priority:** **LT-266** (measure the size bet) is scheduled for
**the iteration after this one**. It depends on nothing and blocks nothing, which is exactly
why it needs a date — and it gets more expensive once anyone proposes a connector, because
then the number has a stake in it.

**Next free task ID: LT-280.**

---

