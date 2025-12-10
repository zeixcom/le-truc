# Template System Guide for Authors

A modern, type-safe template system for generating HTML and XML content in the markdown plugin. This system provides reusable, composable templates with automatic escaping and error handling.

## Why This System Exists

The original approach used verbose template literals with poor editor support:

```typescript
// Old approach: Hard to maintain
const menuHtml = `<nav><ol>${pages.map(page => `<li><a href="${page.url}">${page.title}</a></li>`).join('')}</ol></nav>`
```

The new system provides:

- Syntax highlighting and TypeScript checking via tagged template literals
- Automatic HTML/XML escaping
- Reusable, composable templates
- Built-in error handling and validation

## Core Template Files

### 1. HTML/XML Templates (`utils.ts`)

Core tagged template functions for HTML and XML generation:

```typescript
import { html, xml } from '../templates'

export function menu(pages: PageInfo[]): string {
  return html`
    <section-menu>
      <nav>
        <ol>
          ${pages.map(
            page => html`
              <li>
                <a href="${page.url}">${page.title}</a>
              </li>
            `,
          )}
        </ol>
      </nav>
    </section-menu>
  `
}
```

Available template tags:

- `html` - HTML with automatic escaping
- `xml` - XML with automatic escaping
- `css` - CSS (no escaping)
- `js` - JavaScript (no escaping)

### 2. Menu Templates (`menu.ts`)

Navigation menu generation:

```typescript
import { menu, menuItem } from '../templates'

const navigationHtml = menu(pages)
```

### 3. Fragment Templates (`fragments.ts`)

Component documentation with tabbed interfaces:

```typescript
import { enhancedTabGroup } from '../templates'

const componentHtml = enhancedTabGroup('my-component', panels, highlightedCodes)
```

### 4. Code Block Templates (`code-blocks.ts`)

Interactive code blocks with syntax highlighting:

```typescript
import { codeBlock, transformCodeBlock } from '../templates'

const codeHtml = codeBlock({
  lang: 'typescript',
  code: 'function hello() {}',
  highlightedCode: '<pre>highlighted</pre>',
  filename: 'example.ts',
})
```

### 5. Service Worker Templates (`service-worker.ts`)

Service worker JavaScript generation:

```typescript
import { serviceWorker } from '../templates'

const swContent = serviceWorker({
  cssHash: 'abc123',
  jsHash: 'def456',
  cacheName: 'my-app-v1',
})
```

### 6. Other Specialized Templates

- `sitemap.ts` - XML sitemap generation
- `toc.ts` - Table of contents generation
- `performance-hints.ts` - Resource preloading hints

## Adding New Templates

### Step 1: Choose the Right File

- **Menu-related**: Add to `menu.ts`
- **Component docs**: Add to `fragments.ts`
- **Code-related**: Add to `code-blocks.ts`
- **Service worker**: Add to `service-worker.ts`
- **Table of contents**: Add to `toc.ts`
- **Sitemap**: Add to `sitemap.ts`
- **Performance hints**: Add to `performance-hints.ts`

### Step 2: Write Your Template Function

```typescript
// Example: Adding a breadcrumb template to menu.ts
import { html } from './utils'

export function breadcrumb(pages: PageInfo[], currentPage: string): string {
  return html`
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb">
        ${pages.map(
          page => html`
            <li class="${page.url === currentPage ? 'current' : ''}">
              <a href="${page.url}">${page.title}</a>
            </li>
          `,
        )}
      </ol>
    </nav>
  `
}
```

### Step 3: Add Type Definitions

```typescript
// Define your data interfaces
interface BreadcrumbItem {
  url: string
  title: string
  isActive?: boolean
}

// Type your function
export function breadcrumb(items: BreadcrumbItem[]): string {
  // implementation
}
```

### Step 4: Import in Plugins

Import from the main templates module:

```typescript
import { breadcrumb } from '../templates/menu'
```

## Essential Utilities

### Safe Rendering with Error Handling

```typescript
import { safeRender } from '../templates/utils'

// Safe template generation with fallback
const menuHtml = safeRender(() => menu(pages), '<nav></nav>')
```

### Validation

```typescript
import { validateHtml, validateXml } from '../templates/utils'

const sitemapXml = sitemap(pages, baseUrl)
const { valid, errors } = validateXml(sitemapXml)
if (!valid) {
  console.error('Invalid sitemap:', errors)
}
```

### HTML/XML Escaping

```typescript
import { escapeHtml, escapeXml } from '../templates/utils'

const safeTitle = escapeHtml(userInput)
const safeUrl = escapeXml(urlInput)
```

## Best Practices

### 1. Use Safe Rendering

Always wrap templates in error handling:

```typescript
// Good
const menuHtml = safeRender(() => menu(pages), '<nav></nav>')

// Avoid
const menuHtml = menu(pages) // Could throw errors
```

### 2. Keep Templates Small and Focused

```typescript
// Good: Composable templates
const menuItem = (page: PageInfo) =>
  html`<li><a href="${page.url}">${page.title}</a></li>`

const menu = (pages: PageInfo[]) =>
  html`<nav>
    <ol>
      ${pages.map(menuItem)}
    </ol>
  </nav>`

// Avoid: Large monolithic templates
```

### 3. Use the Right Template Tag

```typescript
// HTML content - use html tag
const htmlContent = html`<div>${content}</div>`

// XML content - use xml tag
const xmlContent = xml`<url><loc>${url}</loc></url>`

// CSS content - use css tag
const styles = css`
  .class {
    color: ${color};
  }
`

// JavaScript content - use js tag
const script = js`const value = ${JSON.stringify(data)};`
```

### 4. Validate Important Output

```typescript
const sitemapXml = sitemap(pages, baseUrl)
const { valid, errors } = validateXml(sitemapXml)
if (!valid) {
  console.error('Invalid sitemap:', errors)
}
```

### 5. Use TypeScript Types

```typescript
// Define clear interfaces for your data
interface PageInfo {
  url: string
  title: string
  description: string
  emoji: string
}

// Type your template functions
export function menu(pages: PageInfo[]): string {
  // implementation
}
```

## Common Patterns

### List Generation

```typescript
const listItems = items.map(item => html`<li>${item.name}</li>`)
const list = html`<ul>
  ${listItems}
</ul>`
```

### Conditional Content

```typescript
const optionalSection = condition ? html`<section>${content}</section>` : ''
```

### Attribute Handling

```typescript
const button = html`
  <button class="${isActive ? 'active' : ''}" ${isDisabled ? 'disabled' : ''}>
    ${label}
  </button>
`
```

### Safe Array Mapping

```typescript
import { mapSafe } from './utils'

const safeList = html`<ul>
  ${mapSafe(items, item => html`<li>${item.name}</li>`)}
</ul>`
```

## Testing Your Templates

```typescript
import { validateHtml } from '../templates/utils'

// Test template output
const result = myTemplate(testData)
expect(result).toContain('<expected-element>')

// Validate generated HTML
const { valid, errors } = validateHtml(result)
expect(valid).toBe(true)
```

## Current Template Structure

Templates are organized into focused files:

- `utils.ts` - Core template tags and utilities
- `menu.ts` - Navigation menu templates
- `fragments.ts` - Component documentation fragments
- `code-blocks.ts` - Interactive code block templates
- `service-worker.ts` - Service worker generation
- `sitemap.ts` - XML sitemap templates
- `toc.ts` - Table of contents templates
- `performance-hints.ts` - Resource preloading templates
- `constants.ts` - Shared configuration

## Getting Help

- Check existing templates in each file for patterns
- Use TypeScript's IntelliSense for available functions
- Run `bun run test` to ensure your templates work correctly
- Validate your HTML/XML output during development

This system is designed to be simple and focused. When in doubt, prefer smaller, composable templates over complex ones.
