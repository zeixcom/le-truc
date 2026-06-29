# Update Skills

## Required Reading
Read the specific skill file(s) in question before making any changes.

## Process

### Step 1: Identify the skill and file to update

Determine which skill (`le-truc`, `le-truc-dev`, `architect`, etc.) and which file within it (`SKILL.md`, a `references/*.md`, or a `workflows/*.md`) contains the inaccuracy or gap.

### Step 2: Read source and skill file

Read the source file(s) in `src/` that implement the feature in question. Then read the full skill file to be updated. Never update from memory.

### Step 3: Determine the scope of the fix

Skill files have three distinct layers — fix only what is wrong:

| Layer | File | Fix when |
|---|---|---|
| SKILL.md | `.vibe/skills/<name>/SKILL.md` | Intake options, routing, scope declaration, or workflow index are wrong |
| Reference | `.vibe/skills/<name>/references/*.md` | A fact about an API, type, or behavior is incorrect or missing |
| Workflow | `.vibe/skills/<name>/workflows/*.md` | A process step leads the agent to wrong output |

### Step 4: Apply surgical edits

**For a wrong API signature or parameter:** Update the signature and any accompanying prose. Check all other files in the same skill for the same mistake — the same function may be referenced in multiple places.

**For a missing behavior:** Add it where the related API is already documented, not as a standalone section. One clear sentence is usually enough; add a code example only when the pattern is non-obvious.

**For a misleading workflow step:** Replace the step. Do not add a caveat or footnote — the step should simply be correct.

**For cross-skill propagation:** If a skill file references a function that also appears in a sibling skill (e.g., both `le-truc` and `le-truc-dev` document `all()`), check and fix both.

### Step 5: Verify

Re-read the edited sections against the source implementation. Confirm:
- The signature matches `src/` exactly
- No other file in the same skill contradicts the fix
- No new inaccuracy was introduced by the edit

## Success Criteria
- Every claim in the edited file is accurate for the current `src/` implementation
- The fix is surgical — surrounding correct content is untouched
- Sibling skill files that reference the same API are also consistent
