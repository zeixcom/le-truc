# Create ADR Workflow

## Steps

1. **Check for existing ADRs on the same topic**
   - Run `grep -r "keyword" /adr/` to search existing ADRs
   - If an Accepted ADR already covers this, ask user if they want to supersede it instead

2. **Determine the next ADR number**
   - List existing ADRs: `ls -1 /adr/*.md | grep -E '^[0-9]{4}-' | sort -n`
   - Use the next sequential 4-digit number (e.g., if highest is 0005, use 0006)
   - Skip 0000 (reserved for template)

3. **Gather required information**
   - Ask user for:
     - Title (short, imperative: "Use X for Y")
     - Context (problem being solved)
     - Decision (what was chosen)
     - Alternatives considered
     - Consequences (good and bad)
     - Related requirements (from REQUIREMENTS.md: M1, S3, etc.)
     - Related architecture sections (from ARCHITECTURE.md)

4. **Create the ADR file**
   - Use the template from `references/adr-template.md`
   - Filename: `/adr/000X-title-in-kebab-case.md`
   - Set status to "🔄 Proposed" initially
   - Fill in all sections

5. **Update the index**
   - Add entry to `references/adr-index.md`
   - Format: `| [000X](000X-title-in-kebab-case.md) | Title | 🔄 Proposed | M1, S3 |`
   - Update "Last updated" date and "Total ADRs" count

6. **Verify**
   - Read back the created ADR
   - Confirm all required sections are filled
   - Confirm references to REQUIREMENTS.md are correct

## Questions to Ask User

- "What problem does this decision solve?" (Context)
- "What are we choosing to do?" (Decision)
- "What other options did we consider?" (Alternatives)
- "What are the tradeoffs?" (Consequences)
- "Which requirements does this relate to?" (Related)
- "Should this be Accepted now, or remain Proposed for discussion?"

## Example

User: "We need to document our choice of Cause & Effect as the reactive primitive layer"

1. Check existing: No ADR for this yet
2. Next number: 0001
3. Gather info:
   - Title: "Use Cause & Effect for Reactive Primitives"
   - Context: "We need a reactive primitive layer..." (references M1, M2)
   - Decision: "Use @zeix/cause-effect"
   - Alternatives: SolidJS signals, Vue reactivity, custom implementation
   - Consequences: Tight coupling but provides Slot, Memo, Sensor types
4. Create: `/adr/0001-use-cause-effect-for-reactive-primitives.md`
5. Update: `references/adr-index.md`
6. Verify: Read back and confirm
