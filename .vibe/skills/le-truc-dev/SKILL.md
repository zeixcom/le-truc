---
name: le-truc-dev
description: Expert developer for the @zeix/le-truc library. Use when implementing features, fixing bugs, or answering questions about the library's internals, public API, architecture, or its relationship to @zeix/cause-effect.
user_invocable: false
---

## Scope
This skill is for development work **on the @zeix/le-truc library itself** — use it only inside the le-truc repository where `ARCHITECTURE.md`, `src/`, and authoritative documents are present at the project root.

For building components with the le-truc public API, use a different skill. For deep dives into cause-effect signal internals, use the cause-effect-dev skill.

## Essential Principles

**Read before writing.** Always read the relevant source file(s) before proposing or making changes.

**Authoritative documents are the source of truth.** ARCHITECTURE.md, REQUIREMENTS.md, CONTEXT.md, AGENTS.md, and ADR files in `adr/` define the precise behavior. Check them before assuming.

**Library boundary is firm.** `@zeix/cause-effect` owns all reactive primitives. Le Truc owns the component model, DOM effects, parsers, context protocol, and accessibility. If a proposed feature requires no DOM API, it belongs in cause-effect, not here. See references/library-boundaries.md.

**`asParser()` and `defineMethod()` branding is required.** `isParser()` checks only for `PARSER_BRAND` — unbranded functions are NOT treated as parsers. Always brand custom parsers and method producers.

**Run the project's own test suite** after every change (check `package.json` for the command).

**Run the linter** after every change to `src/`.

## Intake
What kind of task is this?

1. **Implement** — add or extend library functionality
2. **Fix** — debug or fix unexpected behavior
3. **Question** — understand the internals, API, or a design decision

Wait for response before proceeding.

## Routing

| Response | Workflow |
|---|---|
| 1, "implement", "add", "extend", "build", "create" | workflows/implement-feature.md |
| 2, "fix", "bug", "debug", "broken", "wrong", "unexpected" | workflows/fix-bug.md |
| 3, "question", "explain", "how", "why", "what", "which" | workflows/answer-question.md |

**Intent-based routing** (if the user provides clear context without selecting):
- Describes a change to make → workflows/implement-feature.md
- Describes something not working → workflows/fix-bug.md
- Asks how something works → workflows/answer-question.md

After identifying the workflow, read it and follow it exactly.

## Reference Index
All in `references/`:

| File | Contents |
|---|---|
| source-map.md | Le Truc authoritative documents + source file locations |
| library-boundaries.md | What belongs in cause-effect vs. le-truc |
| cause-effect-integration.md | How le-truc uses cause-effect internally |
| non-obvious.md | Tricky behaviors not obvious from the code |

## Workflows Index
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| implement-feature.md | Add or extend library functionality |
| fix-bug.md | Diagnose and fix unexpected behavior |
| answer-question.md | Answer questions about the API, internals, or design |

## Post-Task Protocol
After completing any task, in this order:

1. **Run tests** — all tests must pass
2. **Run linter** — no new lint errors
3. **Update TODO.md** (only if the task was assigned via TODO.md):
   - If the change affects the **public API surface** → mark as pending review with handoff notes
   - If the change is a **bug fix, test, or internal-only** → mark as done
4. **Write to NOTES.md** if you encountered an unexpected challenge or want to deviate from the plan
