<required_reading>
1. references/markdoc-tags.md — Markdoc tag reference before editing any page
2. references/document-map.md → the entry for the specific page being updated
3. references/tone-guide.md → `<pages>` section
</required_reading>

<process>
## Step 1: Identify which page(s) to update

Use the document map to confirm the page is the right target. Each page covers a distinct topic:

| Page | Topic |
|---|---|
| `index.md` | Philosophy and positioning |
| `getting-started.md` | Installation and first component |
| `components.md` | `defineComponent` anatomy — `expose()`, `watch()`, `on()`, `bind*` helpers |
| `data-flow.md` | Component coordination — `pass()`, context, `asMethod()`, dynamic lists |
| `styling.md` | CSS scoping and custom properties |
| `examples.md` | Navigation list of all example components |
| `api.md` | Navigation list of all exported API symbols |

## Step 2: Read the current page

Read the full page file before making any changes.

## Step 3: Read the relevant source

Read the source file(s) that the page documents. Do not update from memory.

## Step 4: Make surgical edits

Apply the minimum change needed. Do not rewrite accurate sections. Do not change the Markdoc tag structure unless it is genuinely wrong.

### Updating a code example

Replace the code in the fenced block. Preserve the `#filename` annotation if present. Verify the updated example compiles (check imports against `index.ts`, check API names against source files).

### Adding a new section

Follow the existing structure: wrap in `{% section %}`, use `## H2` for the heading, add a `{% callout .tip %}` only if there is a non-obvious constraint worth highlighting.

### Updating `examples.md` navigation

When an example component is added to `examples/`, add it to the `{% listnav %}` in the correct category group. Link format: `[ComponentName](./examples/component-name.html)`. Categories: Basic, Card, Context, Form, Module, Section.

When an example is removed or renamed, update or remove its entry.

### Updating `api.md` navigation

When a new symbol is exported from `index.ts`, add it to the `{% listnav %}` in the correct category:
- `Functions` — factory functions, effect factories, parsers, utilities
- `Classes` — error classes, `ContextRequestEvent`
- `Variables` — constants like `SKIP_EQUALITY`, `CONTEXT_REQUEST`
- `Type Aliases` — TypeScript type exports

Link format: `[SymbolName](./api/{category}/SymbolName.html)` where `{category}` is `functions`, `classes`, `variables`, or `type-aliases`.

Keep entries in alphabetical order within each category.

When a symbol is removed, remove its link.

## Step 5: Verify Markdoc structure

After editing, confirm:
- Every opening tag has a matching closing tag (`{% tag %}` … `{% /tag %}`)
- Self-closing tags use `/%}` (`{% sources … /%}`)
- Frontmatter YAML is valid (no unescaped colons in unquoted strings)
- Code blocks are correctly fenced (matching backtick count)
</process>

<success_criteria>
- Page accurately reflects current API and patterns
- All code examples compile against current `index.ts`
- Markdoc tags are syntactically correct
- `examples.md` and `api.md` navigation lists are complete and ordered
- No changelog language ("previously", "as of version X")
</success_criteria>
