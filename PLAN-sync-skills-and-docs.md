# PLAN: Sync stale skills and docs with the current codebase

## Goal

The project's guidance surfaces (skills, ARCHITECTURE.md) have drifted from the code after recent changes (ADR-0015 landed; the skills were migrated from `.vibe/skills/` to `.agents/skills/`). An agent following these stale docs will produce **incorrect code or edit non-existent paths**. Specifically:

1. **`le-truc/SKILL.md` line 53** says `requestContext(context, fallback)` returns `Memo<T>`. ADR-0015 widened this to `Signal<T>` (backed by a `Slot`), and `AGENTS.md` line 40 already documents the correct type. An agent reading the skill will type its consumers wrong.
2. **`tech-writer/SKILL.md`** references `.vibe/skills/` in 5 places (description, scope, intake, routing, workflow index). **`changelog-keeper/SKILL.md`** references it in 2 places (diff command, skill-changes section). The actual path is `.agents/skills/` (confirmed by `.vibe/config.toml` which sets `skill_paths = ["../.agents/skills"]`). `.vibe/skills/` does not exist. An agent told to "update skills in `.vibe/skills/`" will create files in the wrong place or fail.
3. **`ARCHITECTURE.md` line 108** says the scheduler's `schedule(element, task)` is "Used by `on()` for passive events and `dangerouslyBindInnerHTML`." In reality, `on()` uses **`throttle()`** (`src/helpers/events.ts` lines 138, 243), not `schedule()`. Only `dangerouslyBindInnerHTML` calls `schedule()` directly (`src/bindings.ts`). They share the same RAF tick but are different functions.
4. **`docs-server-dev/SKILL.md`** quick-reference table lists `server/TASKS.md` as "Open tasks and design decisions." That file does not exist — only `SERVER.md` and `TESTS.md` exist under `server/`.
5. **`le-truc-dev/SKILL.md` line 10** says "use the cause-effect-dev skill" — no such skill exists (and `PLAN-cause-effect-skill.md` proposes creating a `cause-effect` skill, not `cause-effect-dev`).

This is a high-leverage, low-risk fix: the skills are the instructions that shape every agent's behavior in this repo. Stale instructions compound into wrong work.

## Exact files to touch

| File | Change |
|---|---|
| `.agents/skills/le-truc/SKILL.md` | Line 53: `Memo<T>` → `Signal<T>` |
| `.agents/skills/tech-writer/SKILL.md` | 5 occurrences: `.vibe/skills/` → `.agents/skills/` |
| `.agents/skills/changelog-keeper/SKILL.md` | 2 occurrences: `.vibe/skills/` → `.agents/skills/` |
| `.agents/skills/docs-server-dev/SKILL.md` | Remove or fix the `server/TASKS.md` reference in the quick-reference table |
| `.agents/skills/le-truc-dev/SKILL.md` | Line 10: fix the dangling `cause-effect-dev` cross-reference |
| `ARCHITECTURE.md` | Line 108: correct "Used by `on()`" → "Used by `dangerouslyBindInnerHTML`; `on()` uses the sibling `throttle()` which shares the same RAF tick" |
| `CHANGELOG.md` | `### Docs` entry under unreleased section |

## Step-by-step implementation plan

### Step 1 — Fix `requestContext` return type in `le-truc/SKILL.md`

Read `.agents/skills/le-truc/SKILL.md`. On line 53 (the Factory Context table), change:

```markdown
| `requestContext(context, fallback)` | Return `Memo<T>` for use inside `expose()` |
```

to:

```markdown
| `requestContext(context, fallback)` | Return `Signal<T>` (backed by a `Slot`) for use inside `expose()` |
```

Then search the **entire file** for any other `Memo<T>` references related to `requestContext` (there may be one in a coordination-patterns section around line 91 or 143) and fix them too. The authority is ADR-0015 + `AGENTS.md` line 40: `requestContext(context, fallback)` returns a `Signal<T>` backed by a `Slot`.

**Do not** change references to `Memo<T>` that are about `all()` — `all(selector)` genuinely returns `Memo<Element[]>`. Only `requestContext` changed.

### Step 2 — Fix `.vibe/skills/` → `.agents/skills/` in `tech-writer/SKILL.md`

Read `.agents/skills/tech-writer/SKILL.md`. There are 5 occurrences of `.vibe/skills/`. Replace every one with `.agents/skills/`. They appear in:

- The `description` frontmatter field
- The "Scope" section
- The "Intake checklist" (item 5)
- The "Routing" section
- `workflows/update-skills.md` (a referenced workflow file — check if it exists and fix it there too)

To find them reliably, run:

```bash
grep -n "\.vibe/skills" .agents/skills/tech-writer/SKILL.md
grep -rn "\.vibe/skills" .agents/skills/tech-writer/workflows/ 2>/dev/null
```

Fix every hit. After fixing, re-run the grep to confirm zero remaining occurrences.

### Step 3 — Fix `.vibe/skills/` → `.agents/skills/` in `changelog-keeper/SKILL.md`

Read `.agents/skills/changelog-keeper/SKILL.md`. There are 2 occurrences:

```bash
grep -n "\.vibe/skills" .agents/skills/changelog-keeper/SKILL.md
```

Replace each `.vibe/skills/` with `.agents/skills/`. They appear in the diff command and the skill-changes guidance section.

### Step 4 — Fix `server/TASKS.md` reference in `docs-server-dev/SKILL.md`

Read `.agents/skills/docs-server-dev/SKILL.md`. Find the quick-reference table entry for `server/TASKS.md`. The file `server/TASKS.md` does not exist (confirmed: only `SERVER.md` and `TESTS.md` exist under `server/`). Either:

- **Remove the row** if `SERVER.md` already covers "open tasks and design decisions," or
- **Change it to `server/SERVER.md`** if that's the intended authoritative reference.

Verify by reading `server/SERVER.md`'s table of contents / header to confirm it covers the same scope. The safest fix is to point to `server/SERVER.md` (the "authoritative" doc, per the skill's own language).

### Step 5 — Fix the dangling `cause-effect-dev` reference in `le-truc-dev/SKILL.md`

Read `.agents/skills/le-truc-dev/SKILL.md`. Line 10 references "the cause-effect-dev skill," which does not exist. The current state is:
- `PLAN-cause-effect-skill.md` proposes creating a `cause-effect` skill (not `cause-effect-dev`), but that plan is **not yet executed**.
- The `le-truc-dev` skill has `references/cause-effect-integration.md` which is the "how le-truc uses cause-effect" view.

Fix options (pick the one that matches intent — read the surrounding context to decide):
- If the sentence meant "for signal-level questions, see `references/cause-effect-integration.md`," change it to point there.
- If it meant "a dedicated cause-effect skill exists," remove the reference entirely (it doesn't exist) and replace with guidance to consult `node_modules/@zeix/cause-effect/README.md`.

**Recommended:** change the cross-reference to point to `references/cause-effect-integration.md` within the same skill, since that file exists and is the closest available guidance.

### Step 6 — Fix `ARCHITECTURE.md` scheduler description

Read `ARCHITECTURE.md` lines 106-108. Change:

```markdown
## Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`. Used by `on()` for passive events and `dangerouslyBindInnerHTML`.
```

to:

```markdown
## Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`, keyed per element. It is used by `dangerouslyBindInnerHTML`. The sibling `throttle(fn, signal?)` helper — which shares the same single RAF tick — limits passive event handlers in `on()` to one call per animation frame.
```

This accurately reflects `src/helpers/events.ts` (lines 138, 243: `options.passive ? throttle(rawListener) : rawListener`) and `src/bindings.ts` (the only caller of `schedule()`).

### Step 7 — Changelog

Add a `### Docs` entry under the unreleased section of `CHANGELOG.md`:

```markdown
### Docs

- **Skills and architecture doc sync:** corrected `requestContext` return type (`Memo<T>` → `Signal<T>`) in the `le-truc` skill; fixed stale `.vibe/skills/` → `.agents/skills/` paths in `tech-writer` and `changelog-keeper` skills; corrected the scheduler description in `ARCHITECTURE.md` (`on()` uses `throttle()`, not `schedule()`); removed dangling cross-references in `docs-server-dev` and `le-truc-dev` skills.
```

### Step 8 — Verify no remaining stale references

Run these greps and confirm zero output for each:

```bash
grep -rn "\.vibe/skills" .agents/skills/
grep -rn "Memo<T>" .agents/skills/le-truc/SKILL.md | grep -i requestContext
grep -rn "cause-effect-dev" .agents/skills/
grep -rn "server/TASKS" .agents/skills/
```

Also run `bun run check:links` to ensure no doc links broke (this validates internal links/anchors in `ARCHITECTURE.md`).

## Edge cases a weaker model would likely miss

- **Do not blanket-replace `Memo<T>` in `le-truc/SKILL.md`.** `all(selector)` genuinely returns `Memo<Element[]>` — that is correct and must not change. Only the `requestContext` return type changed from `Memo<T>` to `Signal<T>` (ADR-0015). Scope the replacement to `requestContext` references only.
- **The `description` frontmatter field affects skill auto-discovery.** If `.vibe/skills/` appears in the `description`, the skill loader may fail to match it or route agents to the wrong path. The frontmatter fix in Step 2 is not cosmetic — it affects agent routing. Verify the frontmatter stays valid YAML after the edit (no broken indentation).
- **`workflows/update-skills.md` in tech-writer** may be a separate file referenced by the main SKILL.md. The grep in Step 2 includes it, but a model that only edits the main SKILL.md will miss stale paths in the workflow file. Read the full directory: `ls .agents/skills/tech-writer/workflows/`.
- **`SERVER.md` is 38 KB** — do not read the whole thing just to verify the `server/TASKS.md` reference. Read its header/TOC only (first 50 lines). The goal is to confirm whether it covers "tasks and design decisions," not to audit the whole file.
- **`check:links` validates anchors.** If you change a heading in ARCHITECTURE.md (you should not need to), any `#anchor` links from other docs will break. This plan only changes prose under the existing `## Scheduler` heading — no heading changes, so anchors are safe. But run `check:links` to confirm.
- **The `.claude/skills/` directory is empty.** `PLAN-cause-effect-skill.md` targets `.claude/skills/`, but the active skills are in `.agents/skills/`. Do not "fix" this by creating files in `.claude/skills/` — that is a separate piece of unexecuted work covered by its own plan. This plan only fixes references *within existing skills*.
- **Skill frontmatter `user_invocable` field.** Do not change `user_invocable: true/false` values — those control whether the user can invoke the skill via slash-command. Only the prose and paths are stale.
- **`le-truc-dev` and `docs-server-dev` have `user_invocable: false`.** They are auto-routed, not user-invoked. Their stale references still matter because the orchestrator may route agents to them based on their `description` field. Fix the references but leave the `user_invocable` flag alone.

## Acceptance criteria

1. `grep -rn "\.vibe/skills" .agents/skills/` returns zero matches.
2. `grep -n "requestContext" .agents/skills/le-truc/SKILL.md` shows `Signal<T>` on every hit (no `Memo<T>`).
3. `grep -rn "cause-effect-dev" .agents/skills/` returns zero matches.
4. `grep -rn "server/TASKS" .agents/skills/` returns zero matches.
5. `ARCHITECTURE.md` Scheduler section mentions `throttle()` as what `on()` uses, and `schedule()` for `dangerouslyBindInnerHTML`.
6. `bun run check:links` passes (no broken anchors/links).
7. `CHANGELOG.md` has a `### Docs` entry under the unreleased section.
8. All skill frontmatter remains valid YAML (no indentation/colon breakage) — verify by re-reading each edited file's first 6 lines.
