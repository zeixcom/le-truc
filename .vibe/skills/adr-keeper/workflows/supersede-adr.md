# Supersede ADR Workflow

## Steps

1. **Identify the ADR to supersede**
   - Confirm ADR number with user
   - Read the existing ADR

2. **Create the new ADR**
   - Use the create-adr workflow to create a new ADR
   - In the "Supersedes" field, reference the old ADR: `Supersedes: [ADR-000X](000X-title.md)`
   - In the old ADR, add: `🗑️ Superseded by [ADR-000Y](000Y-title.md)` to the status line

3. **Update the index**
   - Update the old ADR's status in `references/adr-index.md` to "🗑️ Superseded by [000Y](000Y-title.md)"
   - Add the new ADR to the index with status "🔄 Proposed" (or "✅ Accepted" if immediately accepted)
   - Update "Last updated" date

4. **Verify**
   - Confirm old ADR has superseded status
   - Confirm new ADR references the old one
   - Confirm index is updated

## Questions to Ask User

- "Which ADR number are you superseding?"
- "What is the title for the new ADR?"
- "What is the context for the new decision?"
- "What is the new decision?"
- "Should the new ADR be Proposed or Accepted?"

## Example

User: "ADR 0001 is obsolete, we're switching to a custom reactive implementation"

1. Identify: ADR 0001 "Use Cause & Effect for Reactive Primitives"
2. Create new ADR:
   - Number: 0004 (next sequential)
   - Title: "Use Custom Reactive Implementation"
   - Supersedes: ADR-0001
   - Status: 🔄 Proposed
3. Update old ADR 0001:
   - Change status to: `🗑️ Superseded by [ADR-0004](0004-use-custom-reactive-implementation.md)`
4. Update index:
   - Change ADR 0001 status to superseded
   - Add ADR 0004 with Proposed status
5. Verify: All references are correct

## Important Notes

- The old ADR is **not deleted** - it remains for historical reference
- The old ADR's content is **not modified** except for the status line
- The new ADR should explain **why** the old decision is being replaced
