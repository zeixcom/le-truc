<process>
## Step 1: Read the report

Read the issue or report fully. Identify:
- What the user expected to happen
- What actually happened (or what is being requested)
- Any reproduction steps or example code

## Step 2: Classify

Determine the category:

- **Won't do** — request conflicts with project goals, is out of scope, or describes intentional behavior
- **Confirmed bug** — unexpected behavior with a clear reproduction path
- **Clear win feature** — aligns with REQUIREMENTS.md, limited scope, adds obvious value
- **Docs gap** — behavior is correct but confusing because it's undocumented or misleadingly documented
- **Unclear** — cannot classify without more information

To classify correctly:
- Read `REQUIREMENTS.md` (especially Must Have / Should Avoid / Out of Scope sections)
- Read `ARCHITECTURE.md` — many apparent bugs are documented design decisions
- Search the codebase if needed to confirm whether the behavior is by design

## Step 3: Resolve

**Won't do:** Answer the user directly. Explain why the behavior is intentional or out of scope. Reference the relevant section of `REQUIREMENTS.md` if helpful.

**Confirmed bug:** Identify the affected area. Write a task in `TODO.md`:
- Use the next available task ID (`LT-NNN`)
- **Skill:** based on affected area: `le-truc-dev` (src/), `docs-server-dev` (server/), `le-truc` (examples/)
- **Context:** include the reproduction and expected behavior

**Clear win feature:** Confirm alignment with REQUIREMENTS.md. Write a task in `TODO.md`:
- **Skill:** appropriate developer skill
- **Context:** what to add and why it aligns with project goals

**Docs gap:** Write a task in `TODO.md`:
- **Skill:** tech-writer
- **Context:** which document is unclear and what the correct behavior actually is

**Unclear:** Ask the user how to proceed. Do not write a task or make assumptions.
</process>

<success_criteria>
- Issue is classified with clear reasoning
- Won't do: user has a specific explanation grounded in REQUIREMENTS.md or ARCHITECTURE.md
- All other resolvable cases: a correctly formatted task exists in TODO.md
- Unclear cases: escalated to the user, not guessed
</success_criteria>
