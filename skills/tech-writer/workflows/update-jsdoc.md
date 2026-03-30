<required_reading>
1. references/document-map.md → `<jsdoc_in_src>`
2. references/tone-guide.md → `<jsdoc>` section
</required_reading>

<process>
## Step 1: Read the source file

Read the file containing the function(s) to update. Do not update from memory.

## Step 2: Update JSDoc for changed functions

For each changed function, update the JSDoc block:

```typescript
/**
 * Sets text content of an element by replacing child nodes.
 *
 * @since 0.8.0
 * @param {Reactive<string, P, E>} reactive - Property name, signal, or reader; defaults to the effect name
 * @returns {Effect<P, E>} Effect that updates text content reactively
 */
const setText = …
```

Rules:
- Summary line: one sentence, present tense, describes what the function does
- `@param`: one line each; describe semantics and non-obvious constraints, not the TypeScript type
- `@returns`: one line
- `@since`: the version the function was introduced; do not update this when modifying the function
- `@throws`: only for errors that occur in correct usage (not programmer-error throws)
- `@example`: only when usage pattern is non-obvious

## Step 3: Update `@param` names to match the current signature

If a parameter was renamed, the `@param` tag name must match exactly:

```typescript
// ✗ Old
@param {string} name - Name of the attribute

// ✅ Updated if parameter was renamed to `attr`
@param {string} attr - Name of the attribute
```

## Step 4: Remove JSDoc for deleted functions

When a function is removed, remove its JSDoc block with it. Do not leave orphaned doc comments.

## Step 5: Verify TypeDoc will pick up the changes

TypeDoc reads JSDoc from files exported via `index.ts`. Confirm the function is still exported (or removed from exports if deleted). The generated API pages in `docs-src/api/` will reflect changes on the next `bun run build:docs` run — do not manually edit those files.
</process>

<success_criteria>
- `@param` names match current function signatures
- `@returns` matches current return type semantics
- `@since` is present on all public functions
- No `@param` tags reference removed parameters
- Register is brief and precise — one line per tag
</success_criteria>
