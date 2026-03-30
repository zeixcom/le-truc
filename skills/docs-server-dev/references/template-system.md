<overview>
`html`/`xml`/`css`/`js` tagged template literals, auto-escaping rules, `raw()`, and composition utilities in `server/templates/`.
</overview>

## The Four Tagged Template Literals

All four are in `server/templates/utils.ts`. They share the same auto-escaping engine.

```typescript
import { html, xml, css, js, raw } from '../templates/utils'
```

| Tag | Escapes | Use for |
|-----|---------|---------|
| `html` | `&`, `<`, `>`, `"`, `'` | HTML page output |
| `xml` | Same as HTML + XML-specific | Sitemap, XML documents |
| `css` | (no escaping — CSS values) | Inline CSS strings |
| `js` | JSON-safe escaping | Inline JS data in `<script>` tags |

**All interpolated values are escaped automatically.** This is the default — you cannot accidentally inject raw HTML.

## `raw()` / `RawHtml` — Bypassing Escaping

When interpolating content that is already trusted and sanitised, wrap it with `raw()`:

```typescript
import { html, raw } from '../templates/utils'

// Shiki-highlighted HTML — already sanitised by Shiki
const page = html`<main>${raw(highlightedCode)}</main>`

// Another template function's output
const nav = html`<nav>${raw(menuHtml)}</nav>`
```

`raw(str)` returns a `RawHtml` instance. The template engine checks `value instanceof RawHtml` and skips escaping for those values.

**Use `raw()` only for:**
- Output of other template functions (`html`, `xml`, etc.)
- Shiki-highlighted HTML from `highlightCodeBlocks()`
- Validated Markdoc output from the Markdoc render pipeline

**Never use `raw()` for:**
- User-supplied content (filenames, query params, file contents)
- Values whose origin you cannot verify

## Composing Templates

Return strings from template functions and compose with `raw()`:

```typescript
function navItem(label: string, href: string): string {
    return html`<li><a href="${href}">${label}</a></li>`
}

function nav(items: Array<{label: string, href: string}>): string {
    return html`<nav><ul>${raw(items.map(i => navItem(i.label, i.href)).join(''))}</ul></nav>`
}
```

Arrays: `items.map(...).join('')` produces a string; wrap with `raw()` to inject it.

## Utility Functions

All from `server/templates/utils.ts`:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `escapeHtml(str)` | `string → string` | Escape HTML entities |
| `escapeXml(str)` | `string → string` | Escape XML entities |
| `generateSlug(text)` | `string → string` | URL-safe lowercase slug |
| `createOrderedSort(order)` | `string[] → compareFn` | Sort by predefined order array |
| `when(cond, str)` | `boolean, string → string` | Conditional string |
| `unless(cond, str)` | `boolean, string → string` | Inverse conditional string |
| `mapSafe(arr, fn)` | `T[], fn → string` | map + join with `raw()` wrapping |
| `fragment(...parts)` | `...string[] → string` | Join string parts |
| `indent(str, n)` | `string, number → string` | Indent each line by n spaces |
| `minify(str)` | `string → string` | Collapse whitespace |

## Template Files

| File | Exports | Used by |
|------|---------|---------|
| `utils.ts` | `html`, `xml`, `css`, `js`, `raw`, `RawHtml`, escaping and utility functions | All templates |
| `constants.ts` | `MIME_TYPES`, `RESOURCE_TYPE_MAP`, `PAGE_ORDER`, `SERVICE_WORKER_EVENTS`, `SITEMAP_PRIORITIES` | Config, templates |
| `fragments.ts` | `tabButton`, `tabPanel`, `tabGroup`, `componentInfo` | `sourcesEffect` |
| `hmr.ts` | `hmrClient()`, `hmrScriptTag()` | `serve.ts` |
| `menu.ts` | `menuItem()`, `menu()` | `menuEffect` |
| `performance-hints.ts` | `preloadLink()`, `performanceHints()` | `pagesEffect` |
| `service-worker.ts` | `serviceWorker()`, `minifiedServiceWorker()` | `serviceWorkerEffect` |
| `sitemap.ts` | `sitemapUrl()`, `sitemap()` | `sitemapEffect` |

## The Two `html` Tags — Critical Disambiguation

| Import path | What it produces | Where to use |
|-------------|-----------------|--------------|
| `server/templates/utils.ts` | **Plain HTML string** for page output | Effects, template functions, `serve.ts` |
| `server/markdoc-helpers.ts` | **Markdoc `Tag` objects** | Schema `transform()` functions only |

These are completely different functions that happen to share a name. Importing the wrong one produces either garbled strings (`[object Object]`) or Markdoc `Tag` objects appearing in page output. Always check the import path.

## Writing a New Template Function

1. Add to the appropriate file in `server/templates/` (or create a new file if it's a distinct concern)
2. Use `html` from `./utils` (not `../markdoc-helpers`)
3. Wrap trusted sub-template output with `raw()`
4. Escape all dynamic values automatically by interpolating them directly (no `raw()`)
5. Export the function and add a test in `server/tests/templates/`

Example of a well-formed template function:

```typescript
import { html, raw } from './utils'

export function alertBanner(level: 'info' | 'warn' | 'error', message: string): string {
    return html`
        <div class="alert alert-${level}" role="alert">
            <p>${message}</p>
        </div>
    `
}
```

`message` is escaped automatically. `level` is also escaped, but since it's always one of three known values, both are safe regardless.
