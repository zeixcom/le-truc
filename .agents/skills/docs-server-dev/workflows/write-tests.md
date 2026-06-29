# Write Tests Workflow

## Required Reading

1. references/testing.md — categories, conventions, test-utils API
2. references/source-map.md — locate the source file to test

## Process

### Step 1: Read the source

Read the file you're testing. Do not write tests from memory or assumptions about behavior. Understand:
- What the function takes and returns
- What invariants it must preserve
- What error cases exist

### Step 2: Locate or create the test file

Mirror the source structure:
- `server/effects/api.ts` → `server/tests/effects/api.test.ts`
- `server/schema/fence.markdoc.ts` → `server/tests/schema/fence.test.ts`
- `server/templates/menu.ts` → `server/tests/templates/menu.test.ts`
- `server/io.ts` → `server/tests/io.test.ts`

If the test file exists, read it before adding tests to understand existing coverage and patterns.

### Step 3: Set up the test file

```typescript
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
// Import only what you need — use named imports from the source
import { functionToTest } from '../../path/to/source'
// For tests needing temp dirs:
import { createTempDir } from '../helpers/test-utils'
```

### Step 4: Write tests by category

#### Pure function (unit test)

```typescript
describe('generateSlug', () => {
    test('lowercases and replaces spaces with hyphens', () => {
        expect(generateSlug('Hello World')).toBe('hello-world')
    })
    test('handles special characters', () => {
        expect(generateSlug('foo & bar')).toBe('foo-bar')
    })
    test('handles empty string', () => {
        expect(generateSlug('')).toBe('')
    })
})
```

#### Template function

```typescript
describe('menuItem', () => {
    test('escapes HTML in label', () => {
        const result = menuItem('<Script>', '/page')
        expect(result).not.toContain('<Script>')
        expect(result).toContain('&lt;Script&gt;')
    })
    test('includes href', () => {
        expect(menuItem('Home', '/index')).toContain('href="/index"')
    })
})
```

#### Markdoc schema

```typescript
import Markdoc from '@markdoc/markdoc'
import { markdocConfig } from '../../markdoc.config'

describe('callout schema', () => {
    test('renders card-callout', () => {
        const ast = Markdoc.parse('{% callout %}\nText\n{% /callout %}')
        const tree = Markdoc.transform(ast, markdocConfig)
        const html = Markdoc.renderers.html(tree)
        expect(html).toContain('card-callout')
    })

    test('rejects invalid class value', () => {
        const ast = Markdoc.parse('{% callout class="bad" %}{% /callout %}')
        const errors = Markdoc.validate(ast, markdocConfig)
        expect(errors.length).toBeGreaterThan(0)
    })
})
```

#### Effect helper function (integration)

Effects expose pure helper functions. Test those, not the reactive machinery.

```typescript
let tempDir: { path: string; cleanup: () => void }
beforeEach(() => { tempDir = createTempDir() })
afterEach(() => tempDir.cleanup())

describe('getMockOutputPath', () => {
    test('returns correct output path', () => {
        const result = getMockOutputPath('button', 'states.html', tempDir.path)
        expect(result).toContain('button/mocks/states.html')
    })
})
```

### Step 5: Cover the important cases

For each function, test:
1. **Happy path** — typical valid input
2. **Edge cases** — empty input, boundary values, missing optional fields
3. **Error/invalid input** — what the function rejects or sanitises

Do not test:
- Third-party behavior (Markdoc parsing, Shiki highlighting)
- Private implementation details (internal helper functions not exported)
- Every possible input permutation

### Step 6: Run and iterate

```sh
bun test server/tests/path/to/file.test.ts
```

Fix failures. When all pass, run the full suite:

```sh
bun test server/tests
```

Confirm no regressions.

## Success Criteria

- `bun test server/tests` passes with no regressions
- New tests cover happy path + edge cases for every new or changed function
- Test file mirrors source file structure (same directory, same name with `.test.ts`)
- No tests mock Markdoc internals or `@zeix/cause-effect` reactive primitives
