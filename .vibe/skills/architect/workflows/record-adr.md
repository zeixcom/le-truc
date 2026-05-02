<process>
## Step 0: Determine if an ADR is warranted

Before proceeding, evaluate whether this decision qualifies for an ADR using these criteria:

**All three must be true:**

1. **Hard to reverse** — the cost of changing your mind later is meaningful (e.g., API surface, technology choice with lock-in, architectural pattern)
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **Result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

**If any of these are false, skip the ADR:**
- If easy to reverse → you'll just reverse it later, no need to document
- If not surprising → nobody will wonder why, the code is self-explanatory
- If no real alternative → there's nothing to record beyond "we did the obvious thing"

**What typically qualifies:**
- Architectural shape and patterns
- Integration patterns between contexts
- Technology choices that carry lock-in
- Boundary and scope decisions
- Deliberate deviations from the obvious path
- Constraints not visible in the code
- Rejected alternatives when the rejection is non-obvious

Ask the user: "Does this decision meet all three ADR criteria (hard to reverse, surprising without context, real trade-off)?"

If **no** → Document the decision inline in code comments or ARCHITECTURE.md instead.
If **yes** → Proceed to Step 1.

---

## Step 1: Identify the decision

Confirm with the user:
- What is the architectural decision that was made?
- What problem does it solve?
- What was chosen and what were the alternatives?

## Step 2: Check for existing ADRs

Search existing ADRs to ensure this decision isn't already documented:
- Run: `grep -r "keyword" /adr/*.md`
- If an existing ADR covers this, ask if it should be updated (if Proposed) or superseded (if Accepted)

## Step 3: Gather ADR content

Collect the information needed for the ADR:
- **Title:** Short, imperative (e.g., "Use Cause & Effect for Reactive Primitives")
- **Context:** The problem being solved
- **Decision:** What was chosen
- **Alternatives Considered:** Other options and why rejected
- **Consequences:** Tradeoffs, impact on performance, type safety, DX, maintainability
- **Related Requirements:** References to REQUIREMENTS.md (M1, S3, etc.)
- **Related Architecture:** References to ARCHITECTURE.md sections

## Step 4: Invoke adr-keeper skill

Use the `adr-keeper` skill to create the ADR:
- Provide all gathered information
- Set initial status to "🔄 Proposed" unless user confirms it should be "✅ Accepted"

## Step 5: Update references

After ADR is created:
- Update ARCHITECTURE.md if needed to reference the new ADR
- Update any related documentation that should link to the ADR

## Step 6: Confirm

Read back the created ADR and confirm with user that it accurately captures the decision.
</process>

<success_criteria>
- Decision evaluated against ADR criteria before proceeding
- ADR created with all required sections filled
- ADR references relevant REQUIREMENTS.md sections
- ADR is properly numbered and formatted
- ARCHITECTURE.md updated if needed
- User has confirmed the ADR is accurate
</success_criteria>
