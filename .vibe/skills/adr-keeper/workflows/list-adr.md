# List ADRs Workflow

## Steps

1. **Read the index**
   - Display the contents of `references/adr-index.md`

2. **Optionally filter by keyword**
   - If user provided a keyword:
     - Run: `grep -i "keyword" /adr/*.md`
     - Display matching ADRs with context

3. **Optionally show full content**
   - If user wants to see a specific ADR:
     - Read and display `/adr/000X-title.md`

4. **Format output**
   - For index display: Show the markdown table
   - For search results: Show filename, title, and matching lines

## Questions to Ask User

- "Do you want to see all ADRs or filter by keyword?"
- "Do you want to see the full content of any specific ADR?"

## Example Outputs

### All ADRs

```
| Number | Title | Status | Related Requirements |
|--------|-------|--------|---------------------|
| [0001](0001-use-cause-effect-for-reactive-primitives.md) | Use Cause & Effect for Reactive Primitives | ✅ Accepted | M1, M2 |
| [0002](0002-factory-form-over-builder-pattern.md) | Factory Form Over Builder Pattern | ✅ Accepted | M1, M3 |
| [0003](0003-html-first-no-client-side-rendering.md) | HTML-First: No Client-Side Rendering | ✅ Accepted | M1, X1 |
```

### Filtered by "reactive"

```
adr/0001-use-cause-effect-for-reactive-primitives.md:
- Use @zeix/cause-effect as the reactive primitive layer

adr/0002-factory-form-over-builder-pattern.md:
- Enables reactive properties via expose()
```
