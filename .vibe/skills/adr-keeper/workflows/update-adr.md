# Update ADR Workflow

## Prerequisites

- Only ADRs with "🔄 Proposed" status can be updated
- Accepted/Rejected/Superseded ADRs are **immutable**
- For changes to Accepted ADRs, use supersede workflow instead

## Steps

1. **Check ADR status**
   - Read the ADR file
   - If status is not "🔄 Proposed", refuse and suggest supersede workflow

2. **Identify what to update**
   - Ask user: "Which sections need updating? (Context/Decision/Alternatives/Consequences/Related)"

3. **Make minimal changes**
   - Only update the specified sections
   - Preserve all other content exactly
   - Do not change the ADR number or filename

4. **Update the index if status changes**
   - If status changes from Proposed to Accepted/Rejected:
     - Update status in `references/adr-index.md`
     - Update "Last updated" date

5. **Verify**
   - Read back the updated ADR
   - Confirm changes are minimal and correct

## Questions to Ask User

- "Which ADR number?"
- "What is the current status?" (if not Proposed, refuse)
- "Which sections need to change?"
- "What are the new values for those sections?"
- "Should the status change? (Proposed → Accepted/Rejected)"

## Example

User: "Update ADR 0001 to Accepted status"

1. Check status: Currently "🔄 Proposed" ✓
2. Identify: Only status change
3. Make change: Update status line to "✅ Accepted"
4. Update index: Change status in adr-index.md
5. Verify: Confirm status is now Accepted in both files

---

User: "Add more alternatives to ADR 0002"

1. Check status: Currently "🔄 Proposed" ✓
2. Identify: Alternatives section
3. Make change: Add new bullet points to Alternatives
4. Update index: No status change, no index update needed
5. Verify: Confirm new alternatives are listed
