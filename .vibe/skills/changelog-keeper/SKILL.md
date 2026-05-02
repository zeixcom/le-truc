---
name: changelog-keeper
description: Maintain CHANGELOG.md for the @zeix/le-truc library. Use after meaningful code changes, when asked to add release notes, or to prepare a release.
user_invocable: true
---

## Objective
Maintain `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com) conventions, adapted to this project's style: technically precise, developer-focused entries that include implementation detail when it explains *why* behavior changed or *how* to migrate.

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
- `## 0.15.0` is present as a baseline marker ("Changes before this version are not documented").

## Adding Entries
1. Read `CHANGELOG.md`.
2. Inspect the diff to identify changes: `git diff main..HEAD -- src/ index.ts .vibe/skills/` or as directed. Changes to `.vibe/skills/` are considered as significant as source code changes — skills govern how code is generated and reviewed.
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
- **Include implementation details** when they explain *why* the behavior changed, *how* the fix works, or *what internal invariant* is preserved. This changelog is read by developers and AI agents integrating or contributing to the library — precision is expected.
- **Use before/after framing for Fixed entries**: "Previously, X. Now, Y."
- **Include migration notes** under Changed or Removed when behavior breaks compatibility. State clearly what consumers must change and why.
- Use backticks for all public API names, internal types, flags, and file names.

**Skill changes** (changes to `.vibe/skills/`):
- Classify as **Changed** when an existing skill's behavior, scope, or reference material is updated; **Added** when a new skill or workflow file is introduced; **Removed** when one is deleted.
- Bold the skill name and the affected file or section: `- **\`changelog-keeper\` \`adding_entries\`**: description…`
- State what the skill now does differently and why — the audience is developers who invoke skills and need to know when their mental model of a skill's behavior has changed.
