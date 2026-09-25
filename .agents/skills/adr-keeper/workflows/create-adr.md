# Create ADR Workflow

## Steps

1. **Check for existing ADRs on the same topic**
   - Run `grep -r "keyword" /adr/` to search existing ADRs
   - If an Accepted ADR already covers this, don't create a new one — use update-adr.md instead. If it's unpublished, amend it in place regardless of the change. If it's published (`git show main:adr/000X-title.md`), classify the change against update-adr.md's breaking/non-breaking checklist: non-breaking still amends in place; only a breaking change goes through supersede-adr.md

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
   - Use the template from `/adr/0000-template.md`
   - Filename: `/adr/000X-title-in-kebab-case.md`
   - Set status to "🔄 Proposed" initially
   - Fill in all sections
   - Keep sections tight per SKILL.md `<essential_principles>`: Context a few problem-first sentences, Decision commitment + mechanism, Consequences compact Good/Bad lists. No postscripts.
   - No ticket numbers, no drifting reference tables, no public-interface code examples — link the living document or key source file instead

5. **Check the budget**
   - Run `wc -lw adr/000X-title.md` — at most 1500 words and 100 lines
   - Over budget: move implementation detail out (SKILL.md table), or split the ADR if the reasoning alone is too long

6. **Update the index**
   - Add entry to `/adr/adr-index.md`
   - Format: `| [000X](000X-title-in-kebab-case.md) | Title | 🔄 Proposed | M1, S3 |`
   - Update "Last updated" date

7. **Verify**
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
5. Check budget: `wc -lw` — well under 1500 words / 100 lines
6. Update: `/adr/adr-index.md`
7. Verify: Read back and confirm
