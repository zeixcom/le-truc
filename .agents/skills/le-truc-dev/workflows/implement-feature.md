# Implement Feature

## Required Reading
1. references/source-map.md — locate the relevant source file(s)
2. references/library-boundaries.md — confirm the feature belongs in le-truc
3. references/non-obvious.md — check for tricky behaviors that apply to this area
4. Read references/cause-effect-integration.md if the feature involves signal types or reactive graph interactions

## Process

### Step 1: Confirm Scope

Read references/library-boundaries.md. If the feature requires no browser/DOM API, it likely belongs in `@zeix/cause-effect`, not here. Clarify with the user before proceeding.

### Step 2: Read the Relevant Source File(s)

Use references/source-map.md to locate the file(s) involved. Read them fully before proposing or writing any changes. Do not infer from memory.

### Step 3: Understand the Existing Pattern

Identify how similar features are implemented:
- DOM helpers in `src/bindings.ts` return typed handler functions or `SingleMatchHandlers` objects for use with `watch()`
- Parsers use `asParser()` branding (see `src/component.ts` and `src/parsers/`) 
- Method producers use `defineMethod()` branding
- Context uses the Web Components Community Protocol (see `src/context.ts`)

New features should follow the same internal patterns. Consistency is more important than elegance.

### Step 4: Check Authoritative Documents

Read ARCHITECTURE.md, CONTEXT.md, REQUIREMENTS.md, AGENTS.md, and relevant ADR files in `adr/` for any non-obvious constraints that apply to the area you are changing.

### Step 5: Implement

Write the smallest change that satisfies the requirement. Prefer extending existing abstractions over new ones. If a new exported function is needed:

- Add it to the appropriate `src/` file
- Export it from the appropriate `src/` file and from the package entry point
- Add TypeScript type declarations if needed

### Step 6: Update Tests

Add or update tests for the new behavior. Run the full test suite and confirm it passes.

### Step 7: Update Documentation if Public API Changed

If the change adds or modifies a public API:
- Update the relevant section of documentation

Do not update documentation for internal-only changes.

### Step 8: Post-Task Protocol

Follow the post-task protocol defined in SKILL.md.

## Success Criteria
- Feature is confirmed in scope for le-truc (not cause-effect)
- Source file(s) read before writing
- Existing internal patterns followed (`bind*` helpers, `asParser`, `defineMethod`, etc.)
- Tests pass, linter clean
- Public API documentation updated if the exported surface changed
