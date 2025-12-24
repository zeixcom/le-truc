# Documentation System

Le Truc uses [Markdoc](https://markdoc.dev) for its documentation system, providing a powerful authoring experience with custom components, validation, and HTML template literals for easy schema development.

## Markdoc Features

### Custom Schemas & Components

Le Truc documentation extends Markdoc with custom schemas located in `server/markdoc/schema/`:

- **Hero sections** (`{% hero %}`): Page headers with titles and introductions
- **Carousels** (`{% carousel %}` with `{% slide %}`): Interactive slide presentations
- **Tab groups** (`{% tabgroup %}`): Accessible tabbed content areas
- **Callouts** (`{% callout .danger %}`): Styled notification boxes
- **Code demos** (`{% demo %}`): Live examples with source code
- **Source displays** (`{% sources %}`): Lazy-loaded code snippets

### Shorthand Syntax Support

Full support for Markdoc's shorthand syntax with custom attribute types:

```markdown
{% section .breakout #main-section %}
Content with CSS classes and IDs
{% /section %}

{% callout .danger %}
Danger callout with validation
{% /callout %}
```

**Custom Attribute Types:**
- `ClassAttribute`: Handles `.class` shorthand, converts objects to space-separated strings
- `IdAttribute`: Ensures IDs are always strings
- `CalloutClassAttribute`: Validates callout classes against allowed values (`info`, `tip`, `danger`, `note`, `caution`)

### HTML Template Literals

Le Truc documentation server includes a custom `html` template literal parser for creating Markdoc Tags with JSX-like syntax:

```typescript
// Instead of verbose Tag constructors:
return new Tag('div', { class: 'container' }, [
  new Tag('h2', {}, ['Title']),
  new Tag('p', {}, ['Content'])
])

// Use readable HTML template literals:
return html`<div class="container">
  <h2>Title</h2>
  <p>Content</p>
</div>`
```

**Features:**
- Template interpolation: ``html`<div>${content}</div>` ``
- Attribute interpolation: ``html`<div class="${className}">` ``
- Nested structures with proper parsing
- Error handling with fallback callouts

### Validation System

Comprehensive validation prevents content errors:

```typescript
// Schema validation example
validate(node: Node) {
  const errors: ValidationError[] = []

  if (slideNodes.length === 0) {
    errors.push({
      id: 'carousel-no-slides',
      level: 'critical' as const,
      message: 'Carousel must contain at least one slide'
    })
  }

  return errors
}
```

**Error Handling:**
- Build-time validation catches content issues
- Critical errors render as styled callout components
- Development warnings for non-critical issues
- TypeScript support for error objects

### Content Utilities

Helper functions for common schema tasks:

```typescript
import {
  extractTextFromNode,
  renderChildren,
  splitContentBySeparator,
  html
} from './server/markdoc/utils'

// Extract plain text from Markdoc nodes
const title = extractTextFromNode(headingNode)

// Transform child nodes with config
const content = renderChildren(node.children)

// Split content by HR separators (for tabs/carousels)
const sections = splitContentBySeparator(children, 'hr')
```

### File Organization

```
server/markdoc/
├── markdoc.config.ts    # Main Markdoc configuration
├── attributes.ts        # Custom attribute types
├── utils.ts             # Utilities and HTML parser
└── schema/              # Custom schemas
    ├── callout.markdoc.ts
    ├── carousel.markdoc.ts
    ├── hero.markdoc.ts
    └── ...
```
