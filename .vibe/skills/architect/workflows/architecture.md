<process>
## Step 1: Read the inputs

1. Read `REQUIREMENTS.md` fully — goals, constraints, personas, non-negotiables
2. Read `CONTEXT.md` — understand the domain vocabulary and challenge any conflicting terminology
3. Read the relevant sections of `ARCHITECTURE.md` — understand the current system before proposing changes
4. Check `adr/` directory for existing ADRs on related topics

## Step 2: Explore the codebase

Use the existing source to understand patterns and constraints:
- Identify which files are affected by the proposed change
- Understand how similar features are already implemented
- Note constraints the design must respect (naming conventions, ownership boundaries, signal types)

## Step 3: Ask focused questions

Before designing, clarify anything not resolved by the inputs:
- Technical constraints or integration points missing from REQUIREMENTS.md
- Which existing patterns the solution should follow or intentionally break from, and why
- Testing strategy for new or changed behavior
- Rollout considerations (breaking change vs. additive)
- Ambiguous terms that need definition in CONTEXT.md

**Wait for answers before proceeding.**

## Step 4: Design and challenge

Propose a solution. For each major decision:
- State what you chose and why
- Name the alternatives considered and why they were rejected
- Make tradeoffs explicit — ergonomics vs. complexity, flexibility vs. explicitness

If a proposal feels over-engineered, say so and propose a simpler alternative. Prefer extending existing patterns over introducing new abstractions.

When terms are clarified during discussion, update CONTEXT.md inline — don't batch these up.

Show the design to the user and wait for confirmation or objections before writing documents.

## Step 5: Update ARCHITECTURE.md

Update the relevant sections to reflect the agreed design. For every significant decision, add a row to the Key Decisions table:

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|

Keep the document accurate and concise — it is the developer's primary reference.

## Step 6: Record ADR (for significant decisions)

For decisions that should be permanently documented:
- Use the `adr-keeper` skill to create an ADR
- Reference the ADR number in ARCHITECTURE.md

## Step 7: Write tasks to TODO.md

Break the implementation into ordered, actionable tasks. Each task must:
- Have a unique ID (`LT-NNN`, next available number)
- Be scoped to a single skill (`le-truc-dev`, `docs-server-dev`, `tech-writer`)
- Have enough **Context:** that the developer doesn't need to make architectural decisions
- Be ordered so dependencies come first

Use the format defined in the skill's `<todo_format>` section. Create `TODO.md` at the project root if it doesn't exist.
</process>

<success_criteria>
- Design traces back to REQUIREMENTS.md — no features invented
- Key Decisions table updated in ARCHITECTURE.md for every significant choice
- TODO.md has ordered tasks with IDs and sufficient context
- No task requires the developer to guess intent or make architectural decisions
- Significant decisions recorded as ADRs
- Open questions either resolved or escalated to the user
</success_criteria>
