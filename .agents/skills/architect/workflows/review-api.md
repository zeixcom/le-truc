<process>
## Step 1: Read the handoff

Locate the task marked `— done, pending review ⏳` — in `TODO.md` or `DONE.md`. Read the full handoff block:
- **Changed:** which files and locations were modified
- **How:** the implementation approach
- **Check:** where the developer flagged review focus

## Step 2: Read the changed files

Read the changed source files in full. Do not review from the handoff summary alone — the summary may omit details that matter for DX or consistency.

## Step 3: Evaluate against REQUIREMENTS.md

Read the relevant sections of `REQUIREMENTS.md`. Ask:
- Does the API surface align with the project's goals and stated Must Have / Should Have requirements?
- Does it serve the intended personas?
- Does it introduce anything that belongs in "Should Avoid" or "Out of Scope"?

## Step 4: Evaluate DX and consistency

Read `ARCHITECTURE.md` and existing ADRs for established patterns. Ask:
- Is the API ergonomic? Would a component author write this naturally?
- Is naming consistent with the existing surface (`bindText`, `bindProperty`, `watch`, `on`, etc.)?
- Are defaults sensible? Is it easy to misuse?
- Does it extend existing patterns cleanly, or introduce a new concept? If new — is it justified?

## Step 5: Resolve

**Approved:** Update the task status in place — in whichever file the entry lives — from `— done, pending review ⏳` to `— reviewed ✓`. Add a one-line **Review:** note if useful for the record. Then move the entry to `DONE.md` in compacted form: keep the ID, title, final status, rulings recorded nowhere else, live handoffs into open tasks (referenced by LT-ID), and the changed-artifact facts the Changelog Keeper needs; drop verification transcripts and file-line inventories.

**Issues found:** Do not ask the developer to re-open or redo the task. Instead:
- Create one or more follow-up tasks in `BACKLOG.md` that reference the original (e.g. "Refine API surface from LT-002 review")
- Be specific: name the exact API, describe the problem, and suggest what a better design would look like
- If an issue is architectural (requires design work first), do that design work, then write the task
</process>

<success_criteria>
- Changed files read in full, not just the handoff summary
- Review grounded in REQUIREMENTS.md and ARCHITECTURE.md — not personal preference
- Task status updated in place; approved entries moved to DONE.md in compacted form
- Issues produce concrete, actionable follow-up tasks with sufficient context
</success_criteria>
