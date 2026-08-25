# Update ADR Workflow

## Prerequisites

First, determine whether the ADR is **published** — i.e., does it exist in `main`'s history? Check with:

```
git show main:adr/000X-title.md
```

- **Not published** (doesn't exist on `main`, regardless of status): free to edit in place. This includes folding amendments into the original sections, rewriting Decision/Alternatives/Consequences, or any other change — nobody outside the branch has seen it yet, so there's nothing to keep stable.
- **Published** (exists on `main`): still editable in place, but only for a **non-breaking** change (see checklist below). A **breaking** change to a published ADR is never edited in place, regardless of status — use the supersede workflow instead.

## Breaking vs. non-breaking

This is the one judgment call the workflow asks of you — make it explicit, don't guess from vibes.

**Non-breaking (edit in place):**
- Adds a new option, export, or capability alongside the original decision, without changing any existing default or behavior
- Clarifies or corrects wording without changing what was decided
- Fixes a factual error (a wrong function name, a stale version number, a broken link) that doesn't change the decision itself
- Adds a cross-reference to a related or later ADR
- Records an additive extension explicitly designed to preserve backward compatibility — verified, e.g., by a test pinning the old behavior unchanged

**Breaking (supersede instead):**
- Reverses or contradicts the original decision — choosing Y where the ADR chose X
- Removes or renames something the ADR committed to (an API, a behavior, a constraint)
- Changes a previously specified default or behavior for existing consumers
- Adopts an option the ADR's own "Alternatives Considered" section rejected
- Flips the ADR's outcome (Accepted → Rejected, or vice versa)

If a change touches both — e.g., an additive option plus one unrelated behavior change — split it: fold the additive part in place, supersede for the breaking part.

## Steps

1. **Check publication status, then classify the change**
   - Run `git show main:adr/000X-title.md` to check if published
   - If unpublished: any change is in scope, skip to step 2
   - If published: classify the change against the checklist above
     - Non-breaking → proceed to step 2
     - Breaking → refuse, suggest the supersede workflow instead

2. **Identify what to update**
   - Ask user: "Which sections need updating? (Context/Decision/Alternatives/Consequences/Related)"
   - If the user is folding in an amendment or rewriting a section, that's in scope too — rewrite the section directly rather than appending an "Amendment" subsection, whether or not the ADR is published (a non-breaking published amendment should read as a natural part of the decision, not a bolted-on addendum)

3. **Make the changes**
   - Edit the relevant sections directly so the ADR reads as a single coherent decision; no need to preserve a trace of the earlier text, published or not
   - For a non-breaking published edit, still keep the diff proportional to the change — don't rewrite sections the amendment doesn't touch
   - Do not change the ADR number or filename

4. **Update the index if status changes**
   - If status changes (e.g. Proposed to Accepted/Rejected):
     - Update status in `references/adr-index.md`
     - Update "Last updated" date

5. **Verify**
   - Read back the updated ADR
   - Confirm the change was correctly classified as non-breaking (re-check against the checklist) and that no other section drifted out of sync with it

## Questions to Ask User

- "Which ADR number?"
- (Check publication via `git show main:adr/...`) — if published, classify the change against the breaking/non-breaking checklist; if breaking, refuse and suggest the supersede workflow
- "Which sections need to change?"
- "What are the new values for those sections?"
- "Should the status change? (Proposed → Accepted/Rejected)"

## Example

User: "Update ADR 0001 to Accepted status"

1. Check publication: published on `main`. Classify: a Proposed→Accepted status flip records a decision being finalized, not reversed — non-breaking
2. Identify: Only status change
3. Make change: Update status line to "✅ Accepted"
4. Update index: Change status in adr-index.md
5. Verify: Confirm status is now Accepted in both files

---

User: "Add more alternatives to ADR 0002"

1. Check publication: published on `main`. Classify: additive content, doesn't change the Decision — non-breaking
2. Identify: Alternatives section
3. Make change: Add new bullet points to Alternatives
4. Update index: No status change, no index update needed
5. Verify: Confirm new alternatives are listed

---

User: "ADR 0010 needs to record that `dangerouslyBindInnerHTML()` now falls back to a module-level default sanitizer when a call site omits its own `sanitize` option"

1. Check publication: published on `main`. Classify: adds a new opt-in fallback (`configureHtmlSanitizer()`) alongside the existing `sanitize` option; the option's own behavior, and the behavior of every call site that doesn't use the new hook, is unchanged — non-breaking
2. Identify: Decision (new mechanism) and Consequences (new capability) need the addition woven in directly — no "Amendment" heading, published or not
3. Make change: rewrite those sections in place so the ADR reads as a single coherent decision
4. Update index: no status change
5. Verify: confirm no "Amendment" heading was added and the index still lists ADR 0010 once, as Accepted
