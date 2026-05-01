<process>
## Step 1: Read existing requirements and context

Read `REQUIREMENTS.md` if it exists. Understand what is already established before asking questions.
Read `CONTEXT.md` if it exists. Note any terms that need clarification or conflict with the user's language.

## Step 2: Interview

Ask targeted questions before writing anything. Do not write requirements during the interview.

Focus areas:

**Problem:** What are you solving? For whom? What happens if it's not built?
**Users:** Who are they? Technical level? Environments?
**Workflows:** Walk through end-to-end user journeys including edge cases.
**Constraints:** Integrations, performance, security, timeline.
**Validation:** Has this been validated with users? What alternatives were considered?
**Risks:** What could make this fail?

Push back on:
- Vague requirements ("fast", "user-friendly") — demand measurable criteria
- Solution-first thinking — understand the problem before accepting proposed solutions
- Scope creep — challenge features that don't trace to a core problem
- Ambiguous or conflicting terminology — demand clarification and update CONTEXT.md

Identify and surface:
- Unstated requirements and missing edge cases
- Conflicts between stated requirements
- Assumptions that could prove wrong
- Terms that need precise definitions in CONTEXT.md

Prioritize as Must Have / Should Have / Nice to Have. Escalate conflicts to the user — do not resolve them silently.

**Wait for each answer before proceeding.**

## Step 3: Write or update REQUIREMENTS.md

Use only the sections that are relevant — omit empty sections:

```markdown
# [Name] — Requirements

## 1. Problem Statement
Current situation, pain points, measurable success criteria

## 2. User Personas
Role, technical level, goals, environment, pain points solved

## 3. Functional Requirements
Must Have / Should Have / Nice to Have / Should Avoid

## 4. Non-Functional Requirements
Performance, accessibility, browser support, type safety, reliability

## 5. Technical Constraints
Required/prohibited tech, deployment, integration points

## 6. Assumptions & Dependencies

## 7. Risks & Mitigations

## 8. Out of Scope

## 9. Open Questions
Items needing clarification before architecture begins

## 10. Acceptance Criteria
```

## Step 4: Confirm

Show the document to the user. Wait for confirmation or corrections before closing.
</process>

<success_criteria>
- All Must Have requirements are specific and testable
- Risks have mitigations or are explicitly accepted
- Open Questions section captures everything not yet resolved
- User has reviewed and confirmed the document
</success_criteria>
