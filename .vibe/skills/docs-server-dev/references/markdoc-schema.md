# Markdoc Schema

Schema authoring: simple vs. transform schemas, helpers, attribute system, and registration. Read before adding or changing a Markdoc tag.

## Two Schema Patterns

### Simple Schema (no transform)

Use when the tag maps directly to an HTML element or custom element with no structural transformation needed. Markdoc renders `render` with the given attributes and children.

```typescript
import type { Schema } from '@markdoc/markdoc'
import { richChildren, titleAttribute } from '../markdoc-constants'

const callout: Schema = {
    render: 'card-callout',
    children: richChildren,
    attributes: {
        class: {
            type: CalloutClassAttribute,
            default: 'info',
        },
        title: titleAttribute,
    },
}

export default callout
```

### Transform Schema

Use when you need to reshape the node — split content, extract attributes from children, or produce a non-trivial Tag structure.

```typescript
import { type Node, type Schema, Tag } from '@markdoc/markdoc'
import { commonAttributes, richChildren } from '../markdoc-constants'
import { transformChildrenWithConfig } from '../markdoc-helpers'

const myTag: Schema = {
    render: 'my-element',
    children: richChildren,
    attributes: commonAttributes,
    transform(node: Node, config) {
        // Transform children using the Markdoc config
        const children = transformChildrenWithConfig(node.children ?? [], config)

        // Return a new Tag with any derived attributes
        return new Tag('my-element', node.attributes, children)
    },
}

export default myTag
```

## The `html` Tag Builder in `markdoc-helpers.ts`

When you need to produce structural sub-elements (buttons, headings, wrappers) inside a transform, use the `html` tagged template literal from `markdoc-helpers.ts`. It parses an HTML string into Markdoc `Tag` objects — **not** an HTML string.

```typescript
import { html } from '../markdoc-helpers'

// Returns Tag objects, NOT a string
const button = html`<button class="prev" aria-label="Previous">‹</button>`
```

**Never import `html` from `templates/utils.ts` inside a schema transform.** That `html` produces plain strings for page output. Mixing them causes subtle bugs where Tag objects are rendered as `[object Object]`.

## Attribute System (`markdoc-constants.ts`)

### Ready-made Attribute Definitions

Import these instead of defining attributes inline:

| Export | Type | Use for |
|--------|------|---------|
| `classAttribute` | `ClassAttribute` | Optional `class` attribute |
| `idAttribute` | `IdAttribute` | Optional `id` attribute |
| `styleAttribute` | `String` | Optional inline `style` |
| `titleAttribute` | `String` | Optional `title` |
| `requiredTitleAttribute` | `String` (required) | Required `title` |
| `commonAttributes` | `{ class, id, style }` | All common HTML attributes as a spread |
| `styledAttributes` | `{ class, id, style, title }` | Common + title |

### Custom Attribute Classes

A custom attribute class implements `validate(value): ValidationError[]` and optionally `transform(value): any`. Use when you need to restrict values (e.g. `CalloutClassAttribute` restricts to `info | tip | danger | note | caution`) or normalize them (e.g. `ClassAttribute` accepts `{ "foo": true }` shorthand).

```typescript
export class MyValueAttribute {
    private allowed = ['a', 'b', 'c']
    validate(value: any): ValidationError[] {
        if (!this.allowed.includes(value)) {
            return [{ id: 'invalid-value', level: 'error', message: `...` }]
        }
        return []
    }
}
```

### Children Definitions

| Export | Allows |
|--------|--------|
| `standardChildren` | Inline content (paragraphs, text, inline code) |
| `richChildren` | All block content (headings, lists, code blocks, inline, etc.) |

## Registering a New Schema

1. Create `server/schema/my-tag.markdoc.ts` exporting the schema as default
2. Import and register in `server/markdoc.config.ts`:
   ```typescript
   import myTag from './schema/my-tag.markdoc'
   // nodes (for overrides): fence, heading, link
   // tags: everything else
   export const markdocConfig = {
       nodes: { ... },
       tags: { ..., myTag },
   }
   ```
3. Write a test in `server/tests/schema/my-tag.test.ts`
4. Add to the schemas table in `server/SERVER.md` and `references/source-map.md`

For node overrides (overriding a built-in Markdoc node type like `fence` or `heading`), add to `nodes:` instead of `tags:`.

## Testing Schemas

Use the Markdoc pipeline directly in tests — no mocking needed:

```typescript
import { describe, expect, test } from 'bun:test'
import Markdoc from '@markdoc/markdoc'
import { markdocConfig } from '../../markdoc.config'

describe('my-tag schema', () => {
    test('renders correctly', () => {
        const source = `{% myTag title="Hello" %}\nContent\n{% /myTag %}`
        const ast = Markdoc.parse(source)
        const content = Markdoc.transform(ast, markdocConfig)
        const html = Markdoc.renderers.html(content)
        expect(html).toContain('my-element')
        expect(html).toContain('Hello')
    })
})
```

## Node Overrides vs. Tags

| Type | Markdoc built-in | How to override |
|------|-----------------|-----------------|
| Node | `fence`, `heading`, `link`, `paragraph`, etc. | Register under `nodes:` in config |
| Tag | Custom `{% tag %}` syntax | Register under `tags:` in config |

Node overrides replace the default rendering for that node type everywhere. Tags are opt-in — only used when the author writes `{% tag %}`.

Current node overrides: `fence` (code blocks), `heading` (accessible anchors), `link` (`.md` → `.html` rewriting).
