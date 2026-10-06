# BACKLOG

Planned tasks out of scope for the current iteration. The bands are priority-ordered — the
planned pick order for future iterations, not a schedule. This file is a built view: the store
is `queue/` (one `LT-NNN.md` per task, plus `ITERATION.md`, `BANDS.md`, `LEDGER.md`); only the
Architect moves tasks between files, contributors annotate in place through
`bun run scripts/queue.ts`, and a task may not be started from here while it is outside the
current iteration's chain in `TODO.md`.

**Where landed work went.** Compacted records live in `DONE.md`; the rationale in `adr/`,
`ARCHITECTURE.md` and the compiler docs; the user-facing summary in `CHANGELOG.md
[Unreleased]`; the full record in `git log -p`. Do not re-derive a decision from a task
entry — read the ADR.

**Standing framing.** The governing premise is the general-purpose framework (REQUIREMENTS §1,
ADR 0034): the published package is `@zeix/le-truc-compiler`, TSX-only at 3.0; template
emission is a v3.0 requirement; and the partial-readiness invariant (ADR 0034 s4) — a fold may
depend only on its props and a closed, enumerable set of page-ambient values — constrains every
design in every band. Server evaluation is three tiers, Folded / Simulated / Static, decided
per component with unresolvability per expression; the compile-warning baseline's target is
zero, and routing signals ride the tier census rather than the diagnostic channel (ADR 0029).
The Simulated tier is kept, SSG-only for all of 3.x (ADR 0035).

## P1 — The v3.0 release track (ADR 0034)

Everything v3.0 does not ship without: the publishable TSX-only `@zeix/le-truc-compiler`
package (LT-254), template emission against the ruled target-emitter interface (LT-257,
ADR 0043), the 2.x codemod (LT-259), and the two Zeix pioneer projects that are the release
gates (LT-260, LT-261). The owner has ruled the first publish waits for the P6 cleanup round —
publishing a package its consumers cannot yet use is not a milestone — so this band sits above
the others in priority but behind P6 in practice. Inside the band the order is LT-254 →
LT-257 → the pioneers, because a pioneer cannot start before the package exists and emission
is proven. LT-377 (no TypeScript types in the published declarations, ADR 0034 s8) lands with
or after LT-254's declaration build.

## P2 — Internationalization follow-ups (ADR 0030)

Residue of the ICU MessageFormat switch: LT-352 pins the examples' hand-copied `i18n`
attributes against the real render, and LT-362 reports client-message bytes per page with the
dedupe trigger. The standing ruling: serialized-message growth is per instance, per non-source
locale, per adopting component — measured, not argued, and deduplication only pays when a tag
repeats on a page. Small and independent; nothing here gates another band.

## P2b — Compiler product-readiness

The equivalence contract between the authored surfaces, the diagnostics, and the shared walks
— from the external review and COMPILER_REFLECTION. Two standing rules: adopt a maintained
library where one exists instead of authoring version twelve, and two review proposals stay
declined (memoising the redundant estree traversals; restructuring `sim/`) so future reviews
do not re-propose them. The CSS-departures cluster waits on its design session: LT-409 rules
on ADR 0033 s7's departures and re-scopes or strikes LT-405, LT-407 and LT-408. LT-460 sits
above its P6 consumers on purpose: a compose site in an async-boundary arm is an equivalence
gap, and the composition batch below is about to multiply compose-site call sites. LT-381
changes the tier census and warning baseline by design and needs the owner's sign-off; LT-246
waits for the corpus-port migrations to settle the census.

## P3 — Gate-wave residue

Latent correctness and diagnostic-precision items, independent of the release track and of
each other. The one ordering rule inside the band is LT-148 after LT-147 (the `internals`
routing builds on LT-147's reverse IDL name table); everything else is freely pickable and
safe to interleave with any band. None blocks the publish — they exist because the gate wave
found them, and they are cheap to pick when a band above stalls.

## P4 — Migration guards for 2.x authors

Guards for hand-written 2.x components migrating to 3.0: today only LT-281 (flag a non-void
factory return, authored-surface rule plus DEV_MODE warning). The Cause & Effect 2.0 re-export
rewrite joins this band when CE 2.0 ships; it is blocked upstream, not by us. The band grows
only if migration feedback surfaces new sharp edges — deliberately small, so it never competes
with the release track.

## P5 — Migration-review residue

Compose-site and setup-const ergonomics the wave-4 example migrations surfaced (LT-309,
LT-331, LT-333, LT-336, LT-337). LT-310 (reactive attributes on the component root) is the
band's one design session: it needs an ADR 0024 s3 check and an owner ruling before any
implementation. The band's old compose-site event-handler item is absorbed by LT-461's ruled
handler-args design in P6 and carries only its tombstone.

## P6 — Cleanup round and the composition batch

The cleanup round the first publish waits for (see P1), unblocked by the corpus port's close.
It carries two kinds of work: the standing cleanup items (LT-093, LT-135, LT-136, LT-282,
LT-437), and the composition batch — convert the compiled corpus from raw custom-element
markup to sub-components (LT-463) through the design spine LT-465 → LT-462 (ADR 0048) and
LT-461's ruled handler-args design, the compiler enabler LT-460 (kept in P2b), LT-464 and
LT-466, retiring basic-pluralize last (LT-467). The section-menu chrome migration (LT-469, from
LT-446's ruled design) closes the last uncompiled example folder and interleaves freely.
Ordering matters: the design spine and
enablers before the corpus conversion, while the cleanup items interleave freely because none
of them touches the compose machinery.

## P7 — Backlog (not scheduled)

Owner-parked designs, explicit 3.0 non-goals, and items gated on a real need. The non-goals
are recorded in their ADRs rather than as tasks — stage 2 of style composition (ADR 0042 s3),
Shadow DOM mode (ADR 0033 s8), the foreign-runtime tier (ADR 0032), publishing the `.tsrx`
front end (ADR 0034 s1) — so this band holds only what has an entry. The fetched-partials
family waits here as owner-gated design sessions: LT-448 (partials bringing new components —
script admission, loading, `allow-scripts`) beside LT-450 (HTML partials on demand).
Gated-on-need items (LT-214, LT-269, LT-270, LT-357) wake when a consumer appears; everything
else moves up only by owner direction.
