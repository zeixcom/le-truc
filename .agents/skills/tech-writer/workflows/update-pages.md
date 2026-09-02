# Update Pages

## Required Reading
1. references/markdoc-tags.md — Markdoc tag reference before editing any page
2. references/document-map.md → the entry for the specific page being updated
3. references/tone-guide.md → `<pages>` section
4. references/ste100-style.md — sentence and vocabulary rules at the strength the section's text type calls for (see references/tone-guide.md → Text Types; most pages mix Full-strength reference material with Working-strength explanation prose; `blog/` posts are narrative — see workflows/write-blog-post.md)

## Process

### Step 1: Identify which page(s) to update

Use the document map to confirm the page is the right target. Guide pages form two chapters (sidebar groups, prev/next steppers — see `CHAPTERS` in `server/config.ts`):

| Page | Topic |
|---|---|
| `index.md` | Philosophy and positioning |
| `getting-started.md` | Installation and first component |
| `components.md` | Chapter *Building Components* — anatomy, lifecycle, element queries |
| `props.md` | Chapter *Building Components* — `expose()`, parsers, signal types, read-only props, methods |
| `effects.md` | Chapter *Building Components* — `on()`, `watch()`, `bind*` helpers, `each()`, bidirectional binding |
| `extensions.md` | Chapter *Building Components* — `formAssociated()`, `observedAttributes()`, `debug()` |
| `data-flow.md` | Chapter *Coordinating Components* — mechanism choice, `pass()`, the catalog scenario |
| `lists.md` | Chapter *Coordinating Components* — `createList()`, `reconcile()`, add/remove |
| `context.md` | Chapter *Coordinating Components* — `createContext()`, `provideContexts()`, `requestContext()` |
| `async.md` | Chapter *Coordinating Components* — `Task`, `match()` states, `deriveList()` fetch |
| `styling.md` | CSS scoping and custom properties |
| `examples.md` | Navigation list of all example components |
| `api.md` | **Generated** by `apiEffect` from TypeDoc output — never edit by hand |

### Step 2: Read the current page

Read the full page file before making any changes.

### Step 3: Read the relevant source

Read the source file(s) that the page documents. Do not update from memory.

### Step 4: Make surgical edits

Apply the minimum change needed. Do not rewrite accurate sections. Do not change the Markdoc tag structure unless it is genuinely wrong.

Structural constraints:
- A page needs **at least two `{% section %}` blocks with H2 headings** — the in-page table of contents renders only for ≥2 H2s.
- The hero lead is one bold sentence plus at most two plain sentences. It states what the page teaches, not what it covers ("**Declare reactive properties with `expose()`.**", not "This page covers properties.").

#### Updating a code example

Replace the code in the fenced block. Preserve the `#filename` annotation if present. Verify the updated example compiles (check imports against `index.ts`, check API names against source files).

#### Adding a new section

Follow the existing structure: wrap in `{% section %}`, use `## H2` for the heading, add a `{% callout %}` only if there is a non-obvious constraint worth highlighting.

#### Updating `examples.md` navigation

When an example component is added to `examples/`, add it to the `{% listnav %}` in the correct category group. Link format: `[ComponentName](./examples/component-name.html)`. Categories: Basic, Card, Context, Docs, Form, Module.

When an example is removed or renamed, update or remove its entry.

#### Interactive teaching components

Teaching components (prefixed `docs-`) live in `examples/docs/<name>/` and are ordinary example components: `<name>.ts`, `<name>.css`, `<name>.html` (test fixture), `<name>.md` (example doc — required, the examples effect keys off it), and a `<name>.spec.ts` Playwright spec. Register them in `examples/main.ts` and `examples/main.css`, list them in the `Docs` group of `examples.md`, and embed them on guide pages with `{% demo %}`. The page must still teach without the interactive — it is enhancement, not content.

#### `api.md` is generated

`api.md` is written by `apiEffect` from TypeDoc output and is gitignored. New exports appear automatically after `bun run build:docs`. To change what appears there, update JSDoc in `src/` — never edit the file.

### Step 5: Verify Markdoc structure

After editing, confirm:
- Every opening tag has a matching closing tag (`{% tag %}` … `{% /tag %}`)
- Self-closing tags use `/%}` (`{% sources … /%}`)
- Frontmatter YAML is valid (no unescaped colons in unquoted strings)
- Code blocks are correctly fenced (matching backtick count)

## Success Criteria
- Page accurately reflects current API and patterns
- All code examples compile against current `index.ts`
- Markdoc tags are syntactically correct
- `examples.md` and `api.md` navigation lists are complete and ordered
- No changelog language ("previously", "as of version X")
- Each section carries the dials of its text type: reference sections are uniform and neutral; explanation sections open from the reader's problem, vary their rhythm, and commit to opinions with reasons
