# PLAN: ADR & requirements cross-reference repair (status, links, anchors, index)

## Goal

The ADRs are the project's decision memory and are actively consumed by agents (adr-keeper, architect, le-truc-dev skills) — but their cross-references have rotted in four verified ways:

1. **ADR 0012's status is wrong.** It says `🔄 Proposed`, but the decision is fully implemented and shipped: the DEV_MODE warning exists in `src/helpers/reactive.ts` (the `ADR-0012` comment block in `swapSlots`), JSDoc on `pass()`/`PassedProps` documents the deprecation, all examples are migrated to thunk/descriptor forms, and CHANGELOG 2.2.0 lists it under Deprecated (merged as PR #57).
2. **Relative links are broken in 12 of 13 ADRs.** Every ADR except 0011 links `[M1](REQUIREMENTS.md#…)` / `[…](ARCHITECTURE.md#…)` — resolved relative to `adr/`, these point at `adr/REQUIREMENTS.md` and `adr/ARCHITECTURE.md`, which don't exist. Only ADR 0011 correctly uses `../REQUIREMENTS.md`. The template (`adr/0000-template.md`) has the broken pattern, so every future ADR inherits it.
3. **REQUIREMENTS.md anchors don't exist at all.** M1–M16, S1–S5, X1, N1–N2 are `**bold paragraphs**`, not headings — Markdown renderers generate no anchors for them, so even a corrected `../REQUIREMENTS.md#m1-…` link lands at the top of the file.
4. **ARCHITECTURE.md anchors are stale.** ADRs link sections that no longer exist ("The Component Lifecycle", "The Effect System", "The Parser System", "The UI Query System", "The Factory Form — Specification", "#setAccessor — signal creation", "connectedCallback — initialization", "The Context Protocol", "bind* helpers — DOM update handlers", "Safety Utilities"). The current ARCHITECTURE.md has a different heading set.
5. **The adr-keeper index is stale.** `.claude/skills/adr-keeper/references/adr-index.md` (marked "auto-generated") is missing ADR 0013 entirely, shows 0012 as Proposed, says "Total ADRs: 12", and is dated 2026-06-28.

Bonus (small, same sweep): REQUIREMENTS.md **N2** ("Compile-time selector type inference for SVG and MathML", listed as Nice to Have) is already implemented — `src/helpers/dom.ts`'s `KnownTag` covers `SVGElementTagNameMap` and `MathMLElementTagNameMap`. Mark it resolved the same way S1/S2 are marked.

## Exact files to touch

| File | Change |
|---|---|
| `REQUIREMENTS.md` | Convert requirement items to `####` headings; move ✅ markers out of heading text; mark N2 resolved |
| `adr/0000-template.md` … `adr/0013-….md` | Fix `../` prefixes; fix stale ARCHITECTURE anchors; set 0012 status to Accepted |
| `.claude/skills/adr-keeper/references/adr-index.md` | Regenerate: add 0013, update 0012, date, total |
| `scripts/check-doc-links.ts` | **New file** — link/anchor checker used as the acceptance gate |

Do this work **through the adr-keeper skill** where it has a workflow (`update-adr.md` for 0012's status; its index regeneration convention) so the skill's own bookkeeping stays consistent.

## Step-by-step implementation plan

### Step 1 — Give REQUIREMENTS.md real anchors

In `REQUIREMENTS.md`, convert each requirement item from a bold paragraph to a level-4 heading. Example:

```markdown
**M1. Component definition via a single function**     →  #### M1. Component definition via a single function
```

Apply to: M1–M16 (under `### Must Have`), S1–S5 (under `### Should Have`), X1 (under `### Should Avoid`), N1–N2 (under `### Nice to Have`).

Two items have status markers **inside** the bold text: `S1. … ✅ _Resolved in v2.0_` and `S2. … ✅ _Resolved in v2.0_`. The marker must **not** go into the heading (it would change the anchor slug). Convert as:

```markdown
#### S1. Parser/Reader distinction replaced by explicit API

✅ _Resolved in v2.0._ `Reader<T, U>` is removed. …
```

Mark N2 the same way (`✅ _Resolved: `KnownTag` in `src/helpers/dom.ts` covers `SVGElementTagNameMap` and `MathMLElementTagNameMap`._` as the first body line, heading untouched).

The body text of each requirement follows on the next line, unchanged.

### Step 2 — Fix the ADR links (path + anchors)

For every file in `adr/` (including `0000-template.md`), apply:

1. `](REQUIREMENTS.md#` → `](../REQUIREMENTS.md#`
2. `](ARCHITECTURE.md#` → `](../ARCHITECTURE.md#`
   (0011 already has `../` — a global search-replace would double it; use the exact-string forms above, which won't match `](../REQUIREMENTS.md#`.)
3. Then fix the stale anchors. Current ARCHITECTURE.md headings and the mapping to use:

| Old link text/anchor in ADRs | Replace anchor with | Current heading |
|---|---|---|
| `#the-component-lifecycle` | `#lifecycle` | `### Lifecycle` |
| `#connectedcallback--initialization` | `#lifecycle` | `### Lifecycle` |
| `#the-effect-system` | `#effect-descriptors` | `### Effect Descriptors` |
| `#the-factory-form--specification` | `#component-model` | `## Component Model` |
| `#setaccessor--signal-creation` | `#signals-and-properties` | `### Signals and Properties` |
| `#pass--inter-component-binding` | `#inter-component-signal-sharing-pass` | `### Inter-Component Signal Sharing (Pass)` |
| `#the-parser-system` | `#parsers` | `### Parsers` |
| `#the-ui-query-system` | `#query-system` | `## Query System` |
| `#allselector-required` | `#firstselector--allselector` | `### \`first(selector)\` / \`all(selector)\`` |
| `#the-context-protocol` | `#context-protocol` | `### Context Protocol` |
| `#bind-helpers--dom-update-handlers` | `#dom-binding-helpers` | `### DOM Binding Helpers` |
| `#safety-utilities` | `#security` | `## Security` (no Safety Utilities section exists anymore) |
| `#security`, `#ecosystem-tooling`, `#inter-component-signal-sharing-pass` | unchanged | already valid |

Where the anchor changes, also update the **link text** to the current heading name (e.g. `[The Component Lifecycle](…)` → `[Lifecycle](…)`), so text and target agree.

4. One REQUIREMENTS anchor is wrong beyond the path: ADRs 0009 and 0010 link `#m16-security-validation-in-bindattribute`, but the requirement heading is "M16. Security validation in `setAttribute`" → slug `#m16-security-validation-in-setattribute`. Use the slug derived from the actual heading.

### Step 3 — Update ADR 0012's status

Via the adr-keeper skill's `update-adr` workflow: Status section `🔄 Proposed` → `✅ Accepted`, with a one-line note: "Implemented in 2.2.0: DEV_MODE deprecation warning shipped (`src/helpers/reactive.ts`), examples migrated; removal scheduled for the next major."

### Step 4 — Regenerate the ADR index

`.claude/skills/adr-keeper/references/adr-index.md`:
- 0012 row → `✅ Accepted`
- Add 0013 row: `| [0013](0013-cem-plugin-for-le-truc-factory-pattern.md) | Custom Elements Manifest via @custom-elements-manifest/analyzer Plugin | ✅ Accepted | M13 |`
- `Last updated:` → today's date; `Total ADRs: 13 (excluding template)`.
- Note: the index's links are relative to `adr/` **when read from the skill's references dir they don't resolve anyway** — they follow the existing convention of naming files in `adr/`; keep the convention, do not "fix" these to absolute paths.

### Step 5 — Write the acceptance gate: `scripts/check-doc-links.ts`

A small Bun script that:
1. Collects all `[text](target)` links from `adr/*.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md` (skip `http(s)://` targets).
2. For each relative target, resolves the path from the containing file's directory and asserts the file exists.
3. If the target has a `#fragment`, parses the destination file's headings (`^#{1,6} `), slugifies them GitHub-style — lowercase; strip backticks; strip characters other than letters, numbers, spaces, hyphens; spaces → hyphens — and asserts the fragment matches one.
4. Exits 1 listing every broken link as `file:line → target`.

Slugify note: GitHub keeps Unicode letters and appends `-1`, `-2` for duplicate headings; this repo's headings are ASCII and unique, so the simple rule suffices — say so in a comment rather than over-engineering.

Add `"check:links": "bun scripts/check-doc-links.ts"` to `package.json`. (Optionally add it as a CI step if PLAN-ci-guardrails has been executed; otherwise leave it a local tool.)

### Step 6 — Verify

Run `bun run check:links` — zero findings. Spot-check three links by hand on the GitHub web UI after push (relative links + anchors behave slightly differently in local editors than on GitHub; the web UI is the arbiter).

## Edge cases a weaker model would likely miss

- **ADR 0011 already has `../` prefixes** — a blind `REQUIREMENTS.md#` → `../REQUIREMENTS.md#` replacement across `adr/` produces `../../REQUIREMENTS.md` there. Match on `](REQUIREMENTS.md#` (with the bracket) to avoid it.
- **Bold text ≠ heading.** Fixing only the `../` path prefix still leaves every `#m1-…` anchor dead, because REQUIREMENTS.md's items are bold paragraphs. Step 1 is a prerequisite for Step 2's links to work — do them in this order and don't skip Step 1 because the links "look right".
- **The ✅ markers in S1/S2 headings would poison the slugs** (`#s1-…-resolved-in-v20`), silently breaking ADR 0005's links that expect `#s1-parserreader-distinction-replaced-by-explicit-api`. Markers go in the body, not the heading.
- **Slug subtleties:** "Attribute → property initialisation" slugifies to `attribute--property-initialisation` (the arrow drops, the flanking spaces become two hyphens) — this matches the existing ADR link, so converting the heading verbatim is correct; don't "clean up" the arrow. Same for "`first(selector)` / `all(selector)`" → `firstselector--allselector` (backticks, parens, and the slash all drop).
- **M16 has a name mismatch** between the ADR-side link (`…in-bindattribute`) and the requirement heading (`…in \`setAttribute\``). Fix the *links*; renaming the requirement heading instead would be equally valid but changes a document other ADRs and docs may reference — the link fix is the smaller blast radius.
- **`adr/0000-template.md` must be fixed too**, or the adr-keeper skill reproduces the broken pattern in every future ADR. Also grep the skill's own files: `grep -rn '](REQUIREMENTS.md\|](ARCHITECTURE.md' .claude/skills/` and fix any hits with the same rules.
- **Do not touch the `docs/` directory** — it is generated output of the docs pipeline; only `docs-src/`, root-level `.md`, `adr/`, and skill files are sources.
- **ADR 0010 and 0012 contain prose references** like "REQUIREMENTS §7" and unlinked mentions ("Architecture: Security, `bind*` helpers, Safety Utilities" in 0010's Related section is plain text, not links) — leave prose alone; only repair actual `[…](…)` links.

## Acceptance criteria

1. `bun run check:links` exits 0 over `adr/*.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`.
2. Deliberately breaking one anchor (edit, run, revert) makes it exit 1 naming the file and target — proves the checker actually checks fragments, not just file existence.
3. `grep -rn '](REQUIREMENTS.md#\|](ARCHITECTURE.md#' adr/` returns zero hits (all have `../`).
4. REQUIREMENTS.md renders M1–M16/S1–S5/X1/N1–N2 as headings; S1, S2, N2 show ✅ markers in their body lines, not their headings.
5. ADR 0012 status reads `✅ Accepted` with the implementation note; adr-index.md lists 13 ADRs including 0013, 0012 as Accepted, and today's date.
6. The docs build still passes (`bun run build:docs`) — REQUIREMENTS.md isn't in `docs-src/pages/`, so no pipeline impact is expected; this run is the proof.
