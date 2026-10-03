# ADRs

ADRs live in `adr/`: the template is `adr/0000-template.md` and the index is `adr/adr-index.md`. An ADR records timeless reasoning — the problem, the commitment, the rejected alternatives and why, and the lasting trade-offs. It must stay true after the code is refactored.

## Where content goes

| Content | Home — never the ADR |
|---|---|
| Ticket numbers (`LT-NNN`), iteration plans, rounds of shape exploration | The queue files and commit messages |
| Reference tables that drift: diagnostic codes, option lists, per-surface matrices | `ARCHITECTURE.md`, `server/compiler/HOST_PROFILE.md`, `LE_TRUC_COMPILER.md`, JSDoc, or the source constant |
| Code examples for public interfaces | JSDoc and source. The ADR names the key file. |
| Implementation mechanics | Source and `ARCHITECTURE.md` |

Keep a snippet only when the decision itself is a syntax or shape that prose cannot state, and keep it to a few lines.

## Rules

- **Budget: 1500 words and 100 lines.** Check it with `wc -lw adr/NNNN-*.md` before you finish. If an ADR runs over, move the detail out. Do not compress the reasoning. If the reasoning alone runs over, the ADR holds more than one decision — split it.
- **Amendments replace; they do not accumulate.** Fold each round into the existing sections and delete the text it makes obsolete. Never add an "Amendment" heading or a war-story postscript. A lesson that must last goes into `ARCHITECTURE.md` or its own ADR.
- **Keep sections short.** Context is a few problem-first sentences plus links. Decision is the commitment and its mechanism, with numbered sub-designs only when there are genuine moving parts. Consequences are compact Good and Bad lists.
- **Trace every ADR to requirements**: cite the relevant `REQUIREMENTS.md` IDs (M1, S3, …).
- **Number ADRs with the next free 4-digit number.** 0000 is the template.
- **Make the status explicit:** 🔄 Proposed, ✅ Accepted, Rejected, or 🗑️ Superseded by [NNNN]. A new ADR starts as Proposed unless the owner accepts it on the spot.
- **Keep the index current.** Every create or status change updates `adr/adr-index.md` (row and "Last updated").

## Edit in place, or supersede?

1. Check whether the ADR is **published**: `git show main:adr/NNNN-….md`.
   - **Unpublished**: edit it freely, in any section.
   - **Published**: classify the change first.
2. A **non-breaking** change is edited in place:
   - a clarification or factual fix that leaves the decision unchanged;
   - an additive option that changes no existing default or behavior;
   - a cross-reference;
   - a rewording at a major-version milestone (the decision stays the same; only the telling changes).
3. A **breaking** change means a new ADR that supersedes the old one. A change is breaking when it:
   - reverses or contradicts the decision;
   - removes or renames something the ADR committed to;
   - changes a default for existing consumers;
   - adopts an alternative the ADR rejected;
   - flips the outcome.
4. When a change is mixed, split it: fold the additive part in place, and supersede for the breaking part.

**Superseding:**
- Create the new ADR with `Supersedes: [ADR-NNNN](…)`.
- In the old ADR, change only the status line, to `🗑️ Superseded by [ADR-MMMM](…)`.
- Update both index rows.
- Never delete the old ADR.

At a major-version milestone you may also purge implementation detail from published ADRs to meet this style. Keep the course of the decision; change only how it is told.
