<required_reading>
1. references/markdoc-schema.md — schema patterns, attribute system, registration
2. references/template-system.md — if the schema needs to call template functions
3. references/source-map.md — schema file locations
</required_reading>

<process>
## Step 1: Decide the schema type

**Simple schema** (no `transform`): the tag maps directly to a custom element with the content and attributes as-is. Use when Markdoc can render the element directly without restructuring the node tree.

**Transform schema**: the tag needs to restructure children (e.g. split by separator, extract sections), derive attributes from content, or produce complex sub-elements. Use `transform(node, config)` returning a `Tag`.

Read a similar existing schema first:
- Simple: `server/schema/callout.markdoc.ts`
- Transform: `server/schema/demo.markdoc.ts` or `server/schema/carousel.markdoc.ts`

## Step 2: Create the schema file

Create `server/schema/my-tag.markdoc.ts`:

```typescript
import type { Schema } from '@markdoc/markdoc'
import { commonAttributes, richChildren } from '../markdoc-constants'

const myTag: Schema = {
    render: 'my-element',   // custom element name
    children: richChildren,
    attributes: {
        ...commonAttributes,
        // Add tag-specific attributes here
    },
}

export default myTag
```

For a transform schema, add `transform(node, config)` returning `new Tag(...)`.

**Critical:** if you need structural sub-elements inside the transform, use `html` from `../markdoc-helpers` (produces `Tag` objects), not `html` from `../templates/utils` (produces plain strings). See `references/markdoc-schema.md`.

## Step 3: Register in `markdoc.config.ts`

```typescript
import myTag from './schema/my-tag.markdoc'

export const markdocConfig = {
    nodes: { fence, heading, link },
    tags: {
        ...existingTags,
        myTag,    // key becomes the {% myTag %} syntax
    },
}
```

The key in `tags:` determines the `{% tagName %}` syntax. Match it to the schema's intended usage.

## Step 4: Write tests

Create `server/tests/schema/my-tag.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test'
import Markdoc from '@markdoc/markdoc'
import { markdocConfig } from '../../markdoc.config'

describe('my-tag schema', () => {
    test('renders the correct element', () => {
        const ast = Markdoc.parse('{% myTag %}\nContent\n{% /myTag %}')
        const tree = Markdoc.transform(ast, markdocConfig)
        const html = Markdoc.renderers.html(tree)
        expect(html).toContain('my-element')
        expect(html).toContain('Content')
    })

    test('validates attributes', () => {
        const ast = Markdoc.parse('{% myTag badAttr="x" %}{% /myTag %}')
        const errors = Markdoc.validate(ast, markdocConfig)
        expect(errors.length).toBeGreaterThan(0)
    })
})
```

Test: happy path rendering, attribute validation for custom attribute types, edge cases in transform logic (empty content, missing separator, etc.).

Run `bun test server/tests/schema/my-tag.test.ts` and iterate until passing.

## Step 5: Update documentation

- Add the tag to the schema table in `server/SERVER.md` (Registered Schemas section)
- Add to the schemas table in `references/source-map.md`
- If the tag is available to content authors, add usage documentation to `skills/tech-writer/references/markdoc-tags.md`
</process>

<success_criteria>
- `{% myTag %}` renders the expected HTML in the Markdoc pipeline
- `Markdoc.validate()` returns errors for invalid attribute values
- `bun test server/tests` passes (new tests + no regressions)
- Schema registered in `markdoc.config.ts`
- Tables in `server/SERVER.md` and `references/source-map.md` updated
</success_criteria>
