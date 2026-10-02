# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-386 session (2026-10-02).** Three review-relevant facts from routing the
Parser-backed seed through the parser's server fold:

1. **The census moves by design: form-spinbutton Folded → Simulated, and
form-colorgraph + module-coloreditor follow it through compose reads** (the
sub-design-3 mechanism form-combobox already demonstrated for form-listbox).
Spinbutton's Parser fallbacks read `first()` refs
(`value: asNumber(asNumber(0)(input.value))` — the HOST_PROFILE
children-are-data idiom), so the parser instance is not re-declarable in the
render function and its host-prop thunks route off the fold (LTC034-origin
signals) instead of baking a guess. The old raw splice `(value)` agreed with
the client only by luck (`undefined === 0` vs the parsed fallback both
falsy); `@if (host.value === 5)` would have picked different arms. The
iteration exit criterion's census exception list (currently LT-274, LT-276,
LT-304/LT-306) should grow LT-386 when the owner reviews. Consequences
already pinned: the tier map, the sim-driver snapshots (4 components —
attribute ORDER changes because the realm now writes the omitted attrs at
connect), the equivalence audit (the three components' recorded boundary
diffs retire with their Folded status), and page-render LT-290 (a
spinbutton page occurrence no longer qualifies at all — Simulated
occurrences stay authored, so the skip reason moved from 'unrenderable-args'
to no record).
2. **The parser seed sees the SERIALIZED attribute, not the expression's
value** (`attrValue`, a new runtime-harness export): `ordinal={false}`
renders NO attribute, the client parses null → fallback — a raw
`asBoolean()(ordinal)` fold answered `true` and flipped basic-pluralize's
de/pl count=1 renders to the plural arm before the fix. Anyone splicing a
Parser seed by hand must go through `attrValue`.
3. **Residual, deliberate: the bare `() => host.<prop>` mirror
(`hostPropMirrorExpr`) still splices the RAW attribute expression** — it
serves lazy TEXT sites, where `String(raw)` and `String(parsed)` agree for
the string/number parsers; only asJSON object values would render
differently pre-connect. Widening it belongs to a follow-up if a case shows
up.

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
