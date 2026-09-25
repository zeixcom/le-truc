# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): wave 4, second batch — six more migrations, and the
three gates they trip.** Drawn from [BACKLOG.md](BACKLOG.md)'s P3 and P5 bands. The previous
iteration ("wave 4 at cadence") is fully landed and reviewed: LT-098–LT-103 serve as compiled
`.tsx` with their twins retained, and every gate they tripped is closed (LT-291, LT-292,
LT-295, LT-296, LT-299, LT-307, LT-312, LT-313, LT-314, LT-316–LT-318, LT-320–LT-324, LT-327).
Compacted records are in `DONE.md`; the public summary is in `CHANGELOG.md [Unreleased]`.

**Why these fifteen.** The six migrations are the text-shape rest of wave 4: every remaining
component that LT-280's per-item-channel design does not gate. Leaves: **LT-104** lazyload,
**LT-106** context-media, **LT-108** carousel and **LT-095** blogmeta (the contract reshape
decided 2026-08-29). Composites: **LT-105** coloreditor and **LT-107** listnav. They trip three
gates, which run first:
- **LT-303** (`<truc:try>`): lazyload is the first `.tsx` migration to author a boundary.
- **LT-325** (generated tag-map typings): coloreditor and listnav are `.tsx` parents that query
  `.tsrx` children. Without it, the hand-listed `examples/tsconfig.json` grows by four more
  clients, the pattern LT-312 retired for compose imports.
- **LT-301** (loop inside a branch): no component in this batch nests one. It is here because the
  shape silently binds only the first item's handler, which is the worst kind of trap for a
  migration to meet by accident. **LT-300** reviews the LTC005 phrases it extends, in one pass.

The parallel slot carries the last iteration's follow-ups: **LT-330** (the `@case` half of
LT-327's false Folded), **LT-329** (`check:sim` green on a clean tree, so the gate reads true),
**LT-328** (HOST_PROFILE after LT-316/LT-320), and two ruled P3 riders, **LT-326** (LTC033 over
loop iterables) and **LT-302** (harness-import aliasing).

**Pulled in (owner, 2026-09-25): LT-338 → LT-319.** The migrations made LTC012's "needs a
`first()` reference" rule visible as dead weight: coloreditor declares eleven references and
listnav one, none of them read, only to satisfy it. LT-338 retires the rule; LT-319 then gives
colorinfo's shared-class `basic-number` sites a `truc:pass` spelling.

**Order.** LT-338 → LT-319 → LT-339. LT-303 → LT-104 → LT-107 (listnav composes lazyload). LT-325 before LT-105 and LT-107.
LT-301 and LT-300 before any migration that meets a loop inside a branch; none is expected.
LT-095, LT-106 and LT-108 are ungated and can start at once. LT-105 and LT-106 write their spec
against the `.ts` twin before migrating (LT-324 precedent).

**Deliberately not here.** LT-109/LT-110/LT-111 wait on LT-280's design grilling, which is
architect work and not scheduled in a developer iteration. LT-309–LT-311 (codeblock
follow-through and two designs) still wait for evidence: this batch shows whether the
root-attribute and compose-event patterns recur. The i18n chain (LT-242 → LT-233 → LT-250), the ADR 0037
implementation (LT-274–LT-276) and the ADR 0033 CSS track (LT-268 → LT-304/LT-306) do not
contend with this batch and keep for later iterations. The P1 publish track stays behind P6.

**Exit criterion:** six more examples serve as compiled `.tsx` with their `.ts` twins retained
(LT-095, LT-104–LT-108), every spec green on every surface they carry, zero warnings, and tier +
reason recorded per migration. Coloreditor and context-media carry specs of their own. No `boundary(`
survives in code (LT-303). *(Amended 2026-09-25, owner: lazyload keeps its hand-written
`watch`; the `<truc:try>` spelling moves to LT-334.)* `bun run build:docs` passes.
`examples/tsconfig.json` hand-lists no generated client (LT-325). A loop inside a branch fails
LTC005 on both surfaces (LT-301, copy reviewed by LT-300). A `@case` test over a
context-member-seeded signal routes Simulated (LT-330). `bun run check:sim` exits 0 (LT-329). A
build-time shuffle in a loop iterable fails LTC033 (LT-326). Args named `items`/`esc` render on
both surfaces (LT-302). A composed `truc:pass` site needs no `first()` declaration, and
coloreditor/listnav carry none they do not read (LT-338). colorinfo passes to its `basic-number`
sites through `truc:pass`, with no imperative `pass(all(…))` (LT-319). No shared-query group
compiles a site silently (LT-339). The census is 27/2/0 before the batch; each migration adds its own entry.

**Next free task ID: LT-341.**

---

### Gates (run first)

All three gates landed and were reviewed on 2026-09-25 (LT-325, LT-301, LT-300; see `DONE.md`).

### Migrations (LT-104 before LT-107; LT-095, LT-106, LT-108 ungated)

All six landed and were reviewed on 2026-09-25 (LT-107 accepted with LT-332; see `DONE.md`).

### Review follow-up (in iteration, 2026-09-25)

LT-332 landed and was reviewed on 2026-09-25 (see `DONE.md`).

### Follow-ups and riders (parallel slot)

All five landed on 2026-09-25 (LT-326 reviewed; LT-302, LT-328, LT-329, LT-330 done). See
`DONE.md`. LT-329's Deno leg still needs one local `bun run check:sim` run (outside the agent
sandbox). LT-326's review filed LT-340 in `BACKLOG.md` P3.
