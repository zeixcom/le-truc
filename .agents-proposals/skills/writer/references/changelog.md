# Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com) in this project's style. Entries are short, precise and user-facing, so an integrator can decide quickly whether a change affects them. An entry is not a deep-dive.

## Structure

```markdown
# Changelog

## [Unreleased]        ← only while unreleased changes exist

### Added
### Fixed

## 1.0.0              ← released: bare version, no brackets
```

- Create `## [Unreleased]` directly below `# Changelog` when you record the first change after a release. It does not exist between releases.
- Include only the category headings that have entries: Added, Changed, Deprecated, Removed, Fixed, Security.
- A released version may open with a preamble of at most 3 sentences on what the release is about. A patch release usually needs none.
- `## 0.15.0` is the baseline marker ("Changes before this version are not documented").

## Sources

- The diff: `git diff main..HEAD -- src/ index.ts server/compiler/ skills/ .agents/skills/`, or as directed.
- `DONE.md`, the done ledger: compacted done-and-reviewed entries with their rulings and changed-artifact facts. It is a generated view of the queue store — the ledger prose lives in `queue/LEDGER.md`; read it only. The Architect prunes the store afterwards, from the `release-notes` run's `consumed` list: each consumed `queue/LT-NNN.md` is deleted, and its rulings with no other home go into `queue/LEDGER.md`.
- `skills/` holds the skills shipped to users. Record a change there under its own name, as product (`**\`le-truc\` skill \`errors.md\`**: …`).
- `.agents/skills/` holds the in-repo harness. Record a harness change only when it changes how contributors work.

## Entry style

- **One behavior change per bullet.** Open with the API name or a short summary in bold, then a colon.
- **Stay under the ceilings: 4 sentences, and ≤ 300 characters including the bold lead.** If an entry does not fit, it mixes behaviors or carries internals — split it or cut it.
- **Give only rationale the user sees:** what observable behavior changed, plus at most one clause of why. Flag mechanics, spec citations, type-inference stories and invariants belong in commits, ADRs and `ARCHITECTURE.md`.
- **Fixed** entries use "Previously, X. Now, Y."
- **Changed** and **Removed** entries carry a migration note when compatibility breaks: what the consumer must change.
- Put backticks around every API name, flag and file name.
- Never duplicate an existing entry.

Exemplar:

> - **`host.setCustomValidity()` preserves other validity flags**: previously it cleared every other validity flag when setting a custom error. Now it updates only the custom error, like native `<input>`.

## Release

`skill-drift` runs before a release, per unit (`architect`, `contributor`, `writer`, `le-truc`, `cause-effect`, `agents-md`; a full run is ~19 agents), so the shipped skills hold for what ships. When the owner asks for release `X.Y.Z`:

1. Run the `release-notes` workflow (`.claude/workflows/release-notes.js`) first: it appends the reviewed done entries and the unticketed commits to `## [Unreleased]` in the style above and names the entries it consumed — the Architect prunes the queue store from that list.
2. Rename `## [Unreleased]` to `## X.Y.Z`. Leave no empty `[Unreleased]` behind.
3. Set `version` in `package.json`.
4. Set the version comment in `index.ts` to `// Le Truc X.Y.Z`.
