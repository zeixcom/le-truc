---
name: changelog-keeper
description: Maintain CHANGELOG.md for the @zeix/le-truc library. Use after meaningful code changes, when asked to add release notes, or to prepare a release.
user_invocable: true
---

## Objective
Maintain `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com) conventions, adapted to this project's style: short, precise, user-facing entries. Each entry lets an integrator decide quickly whether the change affects them — it is not a deep-dive.

## Structure
The changelog uses this heading hierarchy:

```markdown
# Changelog

## [Unreleased]        ← only present when unreleased changes exist

### Added
### Fixed

## 1.0.0              ← released versions use bare version numbers, no brackets

### Changed
...
```

- `## [Unreleased]` is only present when there are documented changes not yet released. Create it at the top (below `# Changelog`) when documenting the first new change after a release. It does not exist between releases.
- Released versions use bare version numbers: `## 1.0.0`, `## 0.16.3`, etc. No brackets.
- Only include category headings (`### Added`, `### Changed`, etc.) that have entries.
- A released version may open with a **preamble** of at most 3 sentences telling what the release is about for a skimming integrator (e.g., "Second bridge-name wave ahead of Cause & Effect 2.0…"). No preamble for patch releases that need none.
- `## 0.15.0` is present as a baseline marker ("Changes before this version are not documented").

## Adding Entries
1. Read `CHANGELOG.md`.
2. Inspect the diff to identify changes: `git diff main..HEAD -- src/ index.ts .agents/skills/` or as directed. Changes to `.agents/skills/` are considered as significant as source code changes — skills govern how code is generated and reviewed.
3. If there is no `## [Unreleased]` section, create one immediately below `# Changelog`.
4. Classify each change into exactly one category: Added, Changed, Deprecated, Removed, Fixed, or Security.
5. Write entries following the style guide below.
6. Do not duplicate existing entries.
7. Edit the file in place.

## Preparing a Release
When asked to release a version:

1. Rename `## [Unreleased]` to `## X.Y.Z` — do not leave an empty `[Unreleased]` section behind.
2. Update `version` in `package.json` to match.
3. Update the version comment in `index.ts` to match: `// Le Truc X.Y.Z`.

## Entry Style
- **One behavior change per bullet.**
- **Bold the API name or short summary** at the start, followed by a colon:
  `- **\`createMemo\` \`watched\` option**: description…`
- **Hard ceiling: 4 sentences per bullet. Target ≤ 300 characters** for the whole bullet, bold lead included. If it does not fit, the entry mixes behaviors or carries internals — split it or cut it.
- **User-facing rationale only.** State what observable behavior changed, plus at most one clause of why. **Cut all internals** — flag mechanics, spec citations, type-inference stories, internal invariants. Internals belong in commit messages, ADRs, and `ARCHITECTURE.md`.
- **Use before/after framing for Fixed entries**: "Previously, X. Now, Y."
- **Include migration notes** under Changed or Removed when behavior breaks compatibility. State what consumers must change. Migration notes are user-relevant by definition — keep them.
- Use backticks for all public API names, flags, and file names.

**Condensation exemplar** — the `2.3.4` flag-clobbering entry condensed from ~150 words to the target style:

> - **`host.setCustomValidity()` preserves other validity flags**: previously it cleared every other validity flag when setting a custom error. Now it updates only the custom error, like native `<input>`.

**Skill changes** (changes to `.agents/skills/`):
- Classify as **Changed** when an existing skill's behavior, scope, or reference material is updated; **Added** when a new skill or workflow file is introduced; **Removed** when one is deleted.
- Bold the skill name and the affected file or section: `- **\`changelog-keeper\` \`adding_entries\`**: description…`
- State what the skill now does differently — the audience is developers who invoke skills and need to know when their mental model changed. Same ceilings apply.
