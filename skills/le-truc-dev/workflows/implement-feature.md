<required_reading>
1. references/source-map.md — locate the relevant source file(s)
2. references/library-boundaries.md — confirm the feature belongs in le-truc
3. references/non-obvious.md — check for tricky behaviors that apply to this area
Read references/cause-effect-integration.md if the feature involves signal types or reactive graph interactions.
</required_reading>

<process>
## Step 1: Confirm scope

Read references/library-boundaries.md. If the feature requires no browser/DOM API, it likely belongs in `@zeix/cause-effect`, not here. Clarify with the user before proceeding.

## Step 2: Read the relevant source file(s)

Use references/source-map.md to locate the file(s) involved. Read them fully before proposing or writing any changes. Do not infer from memory.

## Step 3: Understand the existing pattern

Identify how similar features are implemented:
- Effects follow the `updateElement(reactive, updater)` pattern (see `src/effects.ts`)
- Parsers use `asParser()` branding (see `src/parsers.ts`)
- Method producers use `asMethod()` branding
- Context uses the W3C Community Protocol (see `src/context.ts`)

New features should follow the same internal patterns. Consistency is more important than elegance.

## Step 4: Check CLAUDE.md

Read `CLAUDE.md` for any non-obvious constraints that apply to the area you are changing. Key items are summarised in references/non-obvious.md, but the source file is authoritative.

## Step 5: Implement

Write the smallest change that satisfies the requirement. Prefer extending existing abstractions over new ones. If a new exported function is needed:

- Add it to the appropriate `src/` file
- Export it from `index.ts`
- Add TypeScript type declarations to `types/` if the project uses a separate declarations directory

## Step 6: Update tests

Add or update tests for the new behavior. Run the full test suite and confirm it passes.

## Step 7: Update documentation if public API changed

If the change adds or modifies a public API:
- Update the relevant section of `README.md` (public API reference with examples)
- Update `docs-src/pages/` narrative documentation as needed

Do not update documentation for internal-only changes.
</process>

<success_criteria>
- Feature is confirmed in scope for le-truc (not cause-effect)
- Source file(s) read before writing
- Existing internal patterns followed (updateElement, asParser, asMethod, etc.)
- Tests pass
- Public API documentation updated if the exported surface changed
</success_criteria>
