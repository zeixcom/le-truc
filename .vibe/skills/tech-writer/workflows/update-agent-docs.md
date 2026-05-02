# Update Agent Docs

## Required Reading
1. references/document-map.md → `<AGENTS_md>`
2. references/tone-guide.md → `<AGENTS.md>` section
3. The relevant source file — read the current implementation before writing

## Process

### Step 1: Read `AGENTS.md` and the source

Read the full `AGENTS.md`. Read the source file(s) that changed or that contain the behavior in question.

### Step 2: Determine whether an entry is needed

The bar for inclusion is high: **a competent Le Truc developer would not predict this behavior from reading the public API alone.** If they would, it does not belong in `AGENTS.md`.

Examples that belong here:
- Parser branding requirement (because `fn.length` is unreliable)
- `pass()` Le-Truc-only scope (because name implies broader applicability)
- `undefined` from a reader restores the original DOM value (not blank)
- `all()` observer laziness (only activates when Memo has a reactive reader)
- `setAttribute` security validation that throws (unexpected for a simple setter)

Examples that do NOT belong here:
- Standard reactive patterns (dependency tracking, batching)
- Behaviors clearly documented in JSDoc or on the docs site
- Anything obvious from the function's name and signature

### Step 3: Add, update, or remove entries

**Adding an entry:**

```markdown
- **`asParser()` branding is required for reliable parser detection**: `isParser()` checks only for `PARSER_BRAND`. Unbranded functions are NOT treated as parsers regardless of their signature. Always wrap custom parsers with `asParser()`. In `DEV_MODE`, unbranded functions trigger `console.warn`.
```

Entry structure:
1. **Bold statement** — one declarative sentence naming the behavior
2. Brief implication — one or two sentences on why it matters
3. Code example — only when the correct pattern is non-obvious from the statement alone

**Updating an entry:** Replace only the part that changed. Keep the entry terse.

**Removing an entry:** Delete the entire entry. Do not leave a stub or comment.

### Step 4: Keep entries in a consistent order

Group by area: parser system, effect system, coordination, security, debug. Within each group, more surprising behaviors first.

## Success Criteria
- Every entry is accurate for the current implementation
- No entry describes behavior that has changed or been removed
- Register is terse and direct — no transitional padding
- No entry violates the "non-obvious" bar
