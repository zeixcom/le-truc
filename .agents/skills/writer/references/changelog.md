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
- `DONE.md`, the done ledger: compacted done-and-reviewed entries with their rulings and changed-artifact facts. It is a generated view of the queue store — the ledger prose lives in `queue/LEDGER.md`; read it only. The Architect prunes the store afterwards, from the task IDs you report as consumed.
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

## Recording an iteration

The Architect asks for this when an iteration is complete: every task reviewed and integrated. You do it in one session; nothing is committed.

1. **Refuse a dirty changelog.** If `git status --porcelain` lists `CHANGELOG.md`, stop and say so: the owner's diff must be this pass alone.
2. **Collect the sources.** The diff base is `git log -1 --format=%h -- CHANGELOG.md`, unless the Architect names another ref. Take every task with status `reviewed` or `done` (`bun run scripts/queue.ts list --status reviewed`, then `--status done`), and find each task's commits with `git log --grep=<LT-ID> --format=%h --reverse`. Add the unticketed commits: `git log --format="%h %s" --no-merges <base>..HEAD -- src/ index.ts server/compiler/ skills/ .agents/skills/ package.json`, keeping only subjects that name no LT-ID.
3. **Decide per source.** Read `## [Unreleased]` first. A source is *covered* when an existing bullet already states its change, even in other words; *internal* when nothing an integrator, author or skill reader can observe changed (a byte-identical refactor, a test, a queue or harness-only change); otherwise *record* it. Merge commits and `review: … nit fixes` commits belong to their task.
4. **Draft, then check each bullet against the code** — `git show` the commits. Drop a bullet the change does not support or a user cannot observe. Hold every bullet to *Entry style*: the bold lead, the 4-sentence and 300-character ceilings, "Previously, X. Now, Y." for Fixed.
5. **Write.** Append each bullet at the end of its `###` category under `## [Unreleased]`, creating a missing heading in the order of *Structure*. Change no existing line. If two bullets state the same change, keep the better one.
6. **Report:** the bullets recorded per task, the sources judged covered or internal (one line of reason each), the **consumed** task IDs — every task whose changelog obligation is now met, recorded, covered or internal alike — and a commit subject: `docs(changelog): record LT-NNN, …`.

## Skill drift before a release

Before a release the owner asks you to check the user-facing skills, `skills/le-truc/` and `skills/cause-effect/`, for drift. Read each file in full and check every concrete claim — a name, path, export, `LTC` code, default, behavior, ADR citation — against its source: `index.ts` and the `src/` JSDoc, `server/compiler/diagnostics.ts`, `server/compiler/HOST_PROFILE.md`, the ADRs and `examples/` for `le-truc`; the installed `node_modules/@zeix/cause-effect` and what `index.ts` re-exports for `cause-effect`. Fix wrong guidance in place and record it in `CHANGELOG.md` as product. When the skill is right and the source is wrong, do not fix the source: report it to the Architect as a task draft. A claim you cannot verify either way is not drift. The in-repo skills under `.agents/` are out of scope here; any role fixes drift there when it meets it, through `.agents-proposals/`.

## Release

When the owner asks for release `X.Y.Z`:

1. Make sure `## [Unreleased]` is current: if tasks were reviewed since the last iteration was recorded, record them first (*Recording an iteration*).
2. Rename `## [Unreleased]` to `## X.Y.Z`. Leave no empty `[Unreleased]` behind.
3. Set `version` in `package.json`.
4. Set the version comment in `index.ts` to `// Le Truc X.Y.Z`.
