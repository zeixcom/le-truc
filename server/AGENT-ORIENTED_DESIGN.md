# Agent-Oriented Design

Since GitHub Pages lacks dynamic headers, we use **Parallel Path Discovery** to make documentation content discoverable by AI agents and crawlers.

## Implementation Overview

The docs server (`server/`) builds static content from `docs-src/` to `docs/`. This design adds three features to the existing build pipeline:

1. **MD-Mirror Effect**: Generates clean Markdown copies of all pages in `docs/`
2. **Link Discovery**: Injects alternate link tags into HTML `<head>` sections
3. **Root Discovery**: Generates `docs/llms.txt` manifest file

All three features integrate with the existing reactive build system (`build.ts`, `file-signals.ts`, `effects/*`).

---

## 1. MD-Mirror Build Step

**Location:** `server/effects/md-mirror.ts` (new effect)

**Input:** Source files from `docs-src/pages/**/*.md` (via `docsMarkdown.sources`)

**Output:** Clean Markdown files written to `docs/{relativePath}.md` alongside existing `docs/{relativePath}.html`

### Transformation Rules

Process the **raw Markdown content** (before Markdoc AST transformation) to strip custom tags and convert to standard Markdown:

| Source Pattern | Replacement |
|--------------|--------------|
| `{% tabs %}...{% /tabs %}` | Strip container, process children |
| `{% tab title="X" %}...{% /tab %}` | `### X\n\n...` |
| `{% tab %}...{% /tab %}` | `\n---\n...` |
| `{% callout .CLASS title="T" %}...{% /callout %}` | `> **T:** ...` |
| `{% callout .CLASS %}...{% /callout %}` | `> **CLASS:** ...` |
| `{% hero %}...{% /hero %}` | Strip tags, keep content |
| `{% section %}...{% /section %}` | Strip tags, keep content |
| `{% carousel %}...{% /carousel %}` | Strip tags, keep content |
| `{% slide %}...{% /slide %}` | Strip tags, keep content |
| `{% demo %}...{% /demo %}` | Strip tags, keep content |
| `{% listnav %}...{% /listnav %}` | Strip tags, keep content |
| `{% blogmeta %}` | Strip tag |
| `{% blogpost %}...{% /blogpost %}` | Strip tags, keep content |

### Integration

- **Dependencies:** Runs after `docsMarkdown.processed` (needs raw content with frontmatter already extracted)
- **Output:** Writes to `OUTPUT_DIR` (same as `pagesEffect`)
- **Trigger:** Part of the `build()` initialization in `build.ts`

---

## 2. Link Discovery (Head Metadata)

**Location:** Modify `server/effects/pages.ts` (in `applyTemplate()` function)

**Change:** Inject discovery link into the `<head>` of every generated HTML page:

```html
<link rel="alternate" type="text/markdown" title="Agent-readable content" href="./{relativePath}.md">
```

### Implementation Details

In `applyTemplate()`, add to the `replacements` object:

```typescript
const replacements: Record<string, string> = {
  // ... existing replacements
  'alternate-link': `<link rel="alternate" type="text/markdown" title="Agent-readable content" href="./${processedFile.relativePath}">`,
}
```

Then update all layout templates to include `{{ alternate-link }}` in the `<head>` section.

**Path Resolution:** Uses relative paths (e.g., `./index.md`, `./api/define-component.md`) for portability across hosting environments (GitHub Pages, Netlify, local dev, etc.).

---

## 3. Root Discovery (llms.txt)

**Location:** `server/effects/llms-manifest.ts` (new effect)

**Output:** `docs/llms.txt` — the entry point for AI crawlers

### Format Specification

```markdown
# Le Truc Documentation
> High-performance, signal-based web components.

## Core Reference
- [Architecture Overview](./intro.md)
- [Defining Components](./api/define-component.md)
- [...all other pages...

## Component Library
- [Module Lazyload](./components/lazyload.md)
- [Context Router](./components/router.md)
- [...all other pages...

[...additional sections as needed...]
```

### Generation Logic

1. **Source:** Use `docsMarkdown.pageInfos` (same data that powers menu and sitemap)
2. **Grouping:** Organize pages by their `section` field:
   - No section → "Core Reference"
   - `api` → "API Reference" 
   - `components` → "Component Library"
   - `blog` → "Blog"
   - `examples` → "Examples"
   - Other sections → capitalized section name
3. **Ordering:** Within each section, sort by `PAGE_ORDER` from `config.ts`, then alphabetically
4. **Paths:** Use relative paths from `docs/` (e.g., `./intro.md`, not `/docs/intro.md`)
5. **Include all pages:** Every `.md` page that generates HTML should be listed

### Integration

- **Dependencies:** Runs after `docsMarkdown.pageInfos` (needs final page metadata)
- **Trigger:** Part of the `build()` initialization in `build.ts`
- **Output:** Single file at `OUTPUT_DIR/llms.txt`

---

## Build Pipeline Integration

```
Handled by build.ts:

solutions (List<FileInfo>)
  → processed (Memo: frontmatter extraction)
  → pageInfos (Memo: navigation data)
  → fullyProcessed (Task: Markdoc → HTML)
      ├─▶ md-mirror.ts (NEW: → Clean Markdown)
      │
      ├─▶ pages.ts (MODIFIED: → HTML + alternate link)
      │
      └─▶ llms-manifest.ts (NEW: → llms.txt)
```

### Effect Dependencies

| Effect | Depends On | Output |
|--------|-----------|--------|
| `mdMirrorEffect` | `docsMarkdown.processed` | `docs/**/*.md` |
| `pagesEffect` (modified) | `docsMarkdown.fullyProcessed` | `docs/**/*.html` (with link tag) |
| `llmsManifestEffect` | `docsMarkdown.pageInfos` | `docs/llms.txt` |

All three effects run in parallel after the Markdoc pipeline completes. No additional ordering constraints needed.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `server/effects/md-mirror.ts` | CREATE | MD-Mirror effect |
| `server/effects/llms-manifest.ts` | CREATE | llms.txt generation effect |
| `server/effects/pages.ts` | MODIFY | Add alternate link injection |
| `server/build.ts` | MODIFY | Register new effects |
| `server/config.ts` | MODIFY (if needed) | Add llms.txt path constant |
| `docs-src/layouts/*.html` | MODIFY | Add `{{ alternate-link }}` to `<head>` |

---

## Testing

Each feature should have corresponding tests:

- **md-mirror.ts:** Test tag stripping, tab → heading conversion, callout → blockquote conversion
- **pages.ts link injection:** Test that alternate link appears in generated HTML with correct href
- **llms-manifest.ts:** Test that all pages appear in llms.txt, grouped by section, with correct relative paths
- **Integration:** Verify `bun run build:docs` produces all expected outputs

Test files:
- `server/tests/effects/md-mirror.test.ts`
- `server/tests/effects/llms-manifest.test.ts`
- Update existing `server/tests/effects/pages.test.ts` if needed
