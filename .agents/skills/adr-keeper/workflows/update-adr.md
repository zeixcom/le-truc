# Update ADR Workflow

## Prerequisites

First, determine whether the ADR is **published** — i.e., does it exist in `main`'s history? Check with:

```
git show main:adr/000X-title.md
```

- **Not published** (doesn't exist on `main`, regardless of status — Proposed or Accepted): free to edit in place. This includes folding amendments into the original sections, rewriting Decision/Alternatives/Consequences, or any other change — nobody outside the branch has seen it yet, so there's nothing to keep stable.
- **Published** (exists on `main`): only "🔄 Proposed" ADRs can still be edited in place. Accepted/Rejected/Superseded ADRs that are published are **immutable** — use the supersede workflow instead.

## Steps

1. **Check publication status, then ADR status**
   - Run `git show main:adr/000X-title.md` to check if published
   - Read the ADR file for its current status line
   - If published AND status is not "🔄 Proposed", refuse and suggest supersede workflow
   - Otherwise (unpublished, any status; or published and Proposed), proceed

2. **Identify what to update**
   - Ask user: "Which sections need updating? (Context/Decision/Alternatives/Consequences/Related)"
   - If unpublished and the user is folding in an amendment or rewriting a section to reflect a corrected decision, that's in scope too — rewrite the section directly rather than appending an "Amendment" subsection

3. **Make the changes**
   - If unpublished: edit the relevant sections directly so the ADR reads as if it were written this way from the start; no need to preserve a trace of the earlier (now-superseded-in-place) text
   - If published and Proposed: keep changes minimal and preserve all other content exactly, per the discipline of a decision already visible to others
   - Do not change the ADR number or filename

4. **Update the index if status changes**
   - If status changes from Proposed to Accepted/Rejected:
     - Update status in `references/adr-index.md`
     - Update "Last updated" date

5. **Verify**
   - Read back the updated ADR
   - Confirm changes are correct (minimal, if published-Proposed; complete, if unpublished)

## Questions to Ask User

- "Which ADR number?"
- (Check publication via `git show main:adr/...`) — if published and not Proposed, refuse and suggest supersede workflow
- "Which sections need to change?"
- "What are the new values for those sections?"
- "Should the status change? (Proposed → Accepted/Rejected)"

## Example

User: "Update ADR 0001 to Accepted status"

1. Check publication: published on `main`. Check status: Currently "🔄 Proposed" ✓ (published-Proposed is still editable)
2. Identify: Only status change
3. Make change: Update status line to "✅ Accepted"
4. Update index: Change status in adr-index.md
5. Verify: Confirm status is now Accepted in both files

---

User: "Add more alternatives to ADR 0002"

1. Check publication: published on `main`. Check status: Currently "🔄 Proposed" ✓
2. Identify: Alternatives section
3. Make change: Add new bullet points to Alternatives
4. Update index: No status change, no index update needed
5. Verify: Confirm new alternatives are listed

---

User: "Fold the amendments to ADR 0010 into the main sections"

1. Check publication: `git show main:adr/0010-....md` fails — not on `main`, so unpublished. Status is "✅ Accepted" but that doesn't matter pre-publication.
2. Identify: Decision, Alternatives Considered, and Consequences all need the amendment content woven in; the "Amendment"/"Amendment 2" headings should disappear
3. Make change: rewrite those sections in place so the ADR reads as a single coherent decision; no superseding ADR needed
4. Update index: no status change
5. Verify: confirm no "Amendment" headings remain and the index still lists ADR 0010 once, as Accepted
