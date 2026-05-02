# Testing

Test categories, commands, file conventions, and the `test-utils.ts` helper API. Read before writing any server test.

## Test Runner

All server tests use **Bun's built-in test runner** (`bun:test`). Never reach for Jest, Vitest, or Node's `test`. Import from `bun:test`:

```typescript
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
```

## Commands

| Command | When to use |
|---------|-------------|
| `bun test server/tests` | Run all tests |
| `bun test server/tests --watch` | Watch mode during development |
| `bun test server/tests --bail` | Stop on first failure |
| `bun test server/tests/schema/fence.test.ts` | Run a single test file |

**Run `bun test server/tests` after every change** before committing.

## Test Categories

| Category | Mocking | File I/O | Network | Typical runtime |
|----------|---------|----------|---------|-----------------|
| **Unit** | None | No | No | < 5 ms per test |
| **Integration** | Minimal | Temp dirs | No | < 500 ms per test |
| **Server** | Build pipeline | Temp dirs | localhost HTTP | < 2 s per test |

Prefer unit tests. Write integration tests only when the function has real file I/O as its primary concern (e.g. `writeFileSafe`, effect output). Write server tests for HTTP route logic.

## What to Test

- **All pure functions** — deterministic input/output, no side effects
- **Template generators** — tagged template literals, verify escaping and structure
- **Markdoc schemas** — run through the full `parse → transform → render` pipeline
- **Markdoc helpers** — node traversal, slug generation, tag building
- **IO utilities** — file hashing, safe writes, path handling
- **HTTP routes** — status codes, content types, layout selection, `guardPath` behavior

## What NOT to Test

- Third-party library internals (`@markdoc/markdoc`, `shiki`, `@zeix/cause-effect`)
- TypeDoc output format (owned by `typedoc-plugin-markdown`)
- Playwright browser tests (those live in `examples/*.spec.ts`)

## File Conventions

```
server/tests/
├── helpers/
│   └── test-utils.ts          ← shared utilities, import from here
├── *.test.ts                  ← core module tests (io, config, markdoc-helpers, etc.)
├── schema/
│   └── *.test.ts              ← one file per Markdoc schema
├── templates/
│   └── *.test.ts              ← one file per template module
└── effects/
    └── *.test.ts              ← one file per build effect
```

Mirror the source structure exactly. The test for `server/schema/fence.markdoc.ts` lives at `server/tests/schema/fence.test.ts`.

## `test-utils.ts` Helper API

All tests import shared utilities from `server/tests/helpers/test-utils.ts`.

### Temporary Directories

```typescript
import { createTempDir, createTempFile, createTempStructure } from '../helpers/test-utils'

// Create a temp dir that auto-cleans up
const { path, cleanup } = createTempDir()
afterEach(cleanup)

// Create a file in a temp dir
const filePath = createTempFile(path, 'page.md', '# Hello')

// Create a directory tree
createTempStructure(path, {
    'page.md': '# Hello',
    'assets': {
        'main.css': 'body { color: red }',
    },
})
```

### Mock Data Generators

```typescript
import {
    mockMarkdown,
    mockHtml,
    mockFileInfo,
    mockRequestContext,
} from '../helpers/test-utils'

mockMarkdown({ title: 'Test', content: '## Body', frontmatter: { layout: 'page' } })
mockHtml({ title: 'Test', body: '<p>Hello</p>' })
mockFileInfo({ path: 'page.md', content: '# Hello' })
mockRequestContext({ url: '/getting-started', method: 'GET' })
```

### Assertions

```typescript
import {
    assertContains,
    assertNotContains,
    assertMatches,
    assertValidHtml,
} from '../helpers/test-utils'

assertContains(html, 'card-callout')
assertNotContains(html, '<script>')
assertMatches(html, /<h2 id="[\w-]+"/)
assertValidHtml(html)  // checks for balanced tags, no obvious malformation
```

### Normalization

```typescript
import { normalizeWhitespace, normalizeHtml } from '../helpers/test-utils'

expect(normalizeWhitespace(result)).toBe(normalizeWhitespace(expected))
```

Use `normalizeWhitespace` when comparing output that may differ in indentation or line endings.

## Markdoc Schema Test Pattern

```typescript
import { describe, expect, test } from 'bun:test'
import Markdoc from '@markdoc/markdoc'
import { markdocConfig } from '../../markdoc.config'

describe('callout schema', () => {
    test('renders with default class', () => {
        const ast = Markdoc.parse('{% callout %}\nContent\n{% /callout %}')
        const tree = Markdoc.transform(ast, markdocConfig)
        const html = Markdoc.renderers.html(tree)
        expect(html).toContain('card-callout')
        expect(html).toContain('Content')
    })

    test('validates class attribute', () => {
        const ast = Markdoc.parse('{% callout class="invalid" %}\n{% /callout %}')
        const errors = Markdoc.validate(ast, markdocConfig)
        expect(errors.length).toBeGreaterThan(0)
    })
})
```

## Template Test Pattern

```typescript
import { describe, expect, test } from 'bun:test'
import { menuItem, menu } from '../../templates/menu'

describe('menu template', () => {
    test('escapes special characters in labels', () => {
        const result = menuItem('<Script>', '/page')
        expect(result).not.toContain('<Script>')
        expect(result).toContain('&lt;Script&gt;')
    })
})
```

## Effect Test Pattern

Effects have side effects (file I/O, subprocess calls). Test the pure helper functions extracted from the effect, not the full reactive pipeline.

```typescript
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { createTempDir } from '../helpers/test-utils'
// Import the exported helper function, not the effect factory itself
import { generateApiIndexMarkdown } from '../../effects/api'

let tempDir: { path: string; cleanup: () => void }

beforeEach(() => { tempDir = createTempDir() })
afterEach(() => tempDir.cleanup())

describe('generateApiIndexMarkdown', () => {
    test('generates grouped index', () => {
        const result = generateApiIndexMarkdown([...])
        expect(result).toContain('{% listnav %}')
    })
})
```

Extract pure helper functions from effects and export them for testability. The effect factory itself (`createEffect` + `match` + `ready`) does not need a unit test — what matters is the transformation logic it delegates to.
