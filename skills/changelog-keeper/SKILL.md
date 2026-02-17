---
name: changelog
description: Update CHANGELOG.md with user-facing changes. Use after meaningful code changes, when asked to add release notes, or to prepare a release.
user_invocable: true
---

# Changelog Keeper

Maintain `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com) conventions.

## Structure

The changelog uses this heading hierarchy:

```markdown
# Changelog

## [Unreleased]

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

## 0.16.0

### Added
...
```

- `## [Unreleased]` is always the first version section. New changes go here.
- Only include categories that have entries.
- Version 0.18.0 is the baseline. Do not document changes before it.

## Adding entries

1. Read `CHANGELOG.md`.
2. Determine which changes are user-facing by inspecting the diff (`git diff main..HEAD -- src/ index.ts` or as directed). Ignore generated/built files: `docs/`, `types/`, `index.js`, `index.dev.js`, `index.js.map` — these are committed for GitHub Pages and JS consumers but do not represent source changes.
3. Classify each change into exactly one category: Added, Changed, Deprecated, Removed, Fixed, or Security.
4. Write concise bullets describing user-visible behavior. Use backticks for public API names.
5. Do not duplicate existing entries.
6. Edit the file in place using the Edit tool.

## Preparing a release

When asked to release a version:

1. Move all `[Unreleased]` entries under a new `## X.Y.Z` heading.
2. Leave an empty `## [Unreleased]` section above it.
3. Update `version` in `package.json` and the `@version` tag in `index.ts` to match.

## Entry style

- One behavior change per bullet.
- Factual and concise; skip implementation-only details.
- Include migration notes under Changed or Removed when behavior breaks compatibility.
- Bold the API name or short summary at the start: `- **\`createMemo\` \`watched\` option**: description...`
