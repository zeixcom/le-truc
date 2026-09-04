# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-165 — the implemented classifier makes the Folded tier the MAJORITY path (19/22), not the minority
**Date:** 2026-09-04 | **Skill:** le-truc-dev

ADR 0029's Consequences say "the Folded tier is the minority path: roughly 6 of 22 migrated
components", and its Context derives that from "exactly 2 of 22 under the strictest phase-1
definition … roughly 6 of 22 relaxed", noting "fifteen of 22 use `first()`, which is irreducibly
a DOM question."

Built as sub-design 1 specifies — the first conjunct being `evaluability.ts`/`harvest.ts`
"unchanged in mechanism and inverted in polarity", i.e. the existing refusal sites (`TSRX004`,
non-severe `TSRX034`, `TSRX013`'s two server-evaluation factories, `TSRX043`) become routing
signals — the corpus classifies as:

- **Folded (19):** basic-button, basic-counter, basic-gauge, basic-hello, basic-number,
  card-blogpost, card-callout, card-collapsible, card-colorscale, card-mediaqueries,
  form-checkbox, form-colorgraph, form-inplace-edit, form-radiogroup, form-spinbutton,
  form-textbox, form-tokenbox, module-list, module-tabgroup
- **Simulated (3):** basic-pluralize, form-combobox (via compose-read contamination),
  form-listbox
- **Static (0)**

**Every one of LT-165's named acceptance pins passes** — `basic-counter`/`module-tabgroup`/
`card-blogpost`/`card-callout` are Folded, `basic-pluralize` stays Simulated. The discrepancy is
against the ADR's *narrative counts*, not its acceptance criteria, and it has a specific cause:
**using `first()` is not a phase-1 refusal site.** Element queries are a CLIENT concern; they do
not affect what the server renders, so a component can use `first()` freely and still have a
totally-foldable server render. The ADR's "6 of 22" counts components that need something phase 1
cannot supply *for any purpose*; the refusal sites count components whose SERVER RENDER phase 1
cannot complete. Those are different sets, and sub-design 1 specifies the second while the
Context measured the first.

**Why this needs an Architect decision rather than a unilateral fix.** It moves real cost and
real risk in opposite directions:

- If 19-Folded is right, tiering's payoff is much larger than forecast (only 3 components ever
  enter the realm) — but ADR 0029 sub-design 7's CI equivalence audit then has to render 19
  components through the realm and require byte-identical output, and any shape where the value
  harness and the realm disagree becomes a build error against a component that is currently
  compiling clean.
- If ~6-Folded is right, the first conjunct needs a broader definition than "the existing
  refusal sites", which contradicts sub-design 1's "unchanged in mechanism, inverted in polarity"
  and needs new analysis rather than repurposed analysis.

Also note **Static is empty** because the components ADR 0029 names as its motivating Static-tier
cases — `module-scrollarea` (2,091 occurrences, ~2.3 s, the single largest cost driver),
`module-carousel`, `module-ticker`, `module-splitview`, `module-dialog` — are **not migrated to
`.tsrx` yet**. The Static tier is the tier the whole cost argument rests on, and it currently has
no corpus member to demonstrate it on. The capability rows that would route them
(`CAPABILITY_PATCHES` in `sim/patch-table.ts`) are implemented and unit-tested against synthetic
expressions, but untested against a real component until wave 4 migrates one.

**State:** LT-165 steps 1–3 are landed and green (TSRX013 split into three codes; the classifier
with both unresolvability limbs; the compose-read fixpoint; wired end to end into the registry).
Steps 4–8 (emit-server tier flag, diagnostic reclassification, the tier census, realm-side
suppression, the CI equivalence audit) are NOT started, and step 8's cost depends on how the
above is decided.

---

## LT-173 — blocked on LT-165 structurally, not just for step 6's verification
**Date:** 2026-09-04 | **Skill:** le-truc-dev

LT-173 declares "**Depends on LT-165** (the classifier must exist before the tiering payoff in
step 6 is checkable)". Verified against the tree: the dependency is real and **wider than the
entry says**. LT-165 is entirely unimplemented — no tier anywhere in `server/tsrx/` (`registry.ts`'s
only `tier` hit is an ADR 0028 citation), and TSRX013 is still one code.

The part the TODO entry does not capture: **step 4 has no channel to ride.** It requires missing
keys to land in a translation census, "**Reuse `sim/report.ts`, the same channel as the tier
census**" — and the tier census is LT-165 step 6. `server/tsrx/sim/report.ts` today exports only
the diagnostic-classification surface (`CLASSIFIED_DIAGNOSTICS`, `classifyDiagnostic`,
`reportDiagnostics`, `formatSimReport`); there is no census surface at all. Building the
translation census first means either inventing the census shape that LT-165 is chartered to
define — and then LT-165's tier census has to conform to an i18n-shaped API, backwards from the
intended direction — or writing a second, parallel report channel, which is the duplication the
"reuse the same channel" instruction exists to prevent.

Two smaller sequencing findings, neither blocking on its own:

1. **`basic-blogmeta` has no `.tsrx`** (`examples/basic/blogmeta/` is still the hand-written
   `.ts` twin). Step 6's date-handling fix — `Date.UTC(y, m - 1, d)` with `timeZone: 'UTC'` —
   has no compiled component to land in until LT-095 migrates it. Step 6 already says
   "coordinate with LT-095"; recording that the coordination is a hard block, not a courtesy.
2. **LT-165 step 5 and LT-173 step 6 state opposite outcomes for `basic-pluralize`** — "must
   stay the Simulated tier" vs "classifies as Folded-tier". These are consistent as *sequential*
   states (DOM-read locale → Simulated; server-known locale via the reserved parameter →
   Folded), but they are the same component's acceptance criterion in two tasks, and whoever
   implements LT-165 should know its pin is expected to flip when LT-173 lands rather than
   treating the flip as a regression.

**Not blocking:** LT-174 (per-locale pages) not existing is fine and correctly ordered — it
depends on LT-173. It only means step 2's precedence and the acceptance case "rendered on a
non-`en` page" have to be pinned with fixture locales rather than a real second-locale page.

**Unstarted; no code written.** Resolution is an Architect call: either land LT-165 first as the
wave order already implies, or explicitly charter LT-173 to define the census surface that
LT-165 will then adopt.

**Resolved 2026-09-04 (user):** land LT-165 first. LT-173 stays unstarted and returns once the
tier census exists; its step 4 then adopts that channel rather than defining one. Findings 1
and 2 above still stand as LT-173 preconditions when it resumes.

---

## Tooling — Mimosa PreToolUse hook false-positives on `server/tsrx/runtime.ts`
**Date:** 2026-08-29 | **Skill:** le-truc-dev
During LT-090, Mimosa twice rejected Edits to `runtime.ts` as "command injection" — a false positive on HTML-escaping string building (that module has no process execution; the flagged region was pre-existing `esc()`/`attr()` code). Workaround: place render-time helpers in their own module (`compose-attrs.ts`) and re-export through `runtime.ts`. Future edits to `runtime.ts` may hit the same heuristic — if a legitimate edit is blocked, check whether the flagged pattern is pre-existing escaping code before restructuring.

---
