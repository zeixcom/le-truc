# Server Test Suite

This directory contains unit and integration tests for the Le Truc server and build system.

## Test Structure

```
__tests__/
├── helpers/
│   └── test-utils.ts          # Shared test utilities
├── schema/
│   └── fence.test.ts          # Markdoc schema tests
├── io.test.ts                 # IO utilities tests
└── templates/
    └── utils.test.ts          # Template utilities tests
```

## Running Tests

### All Tests
```bash
bun run test:server
```

### Unit Tests Only
```bash
bun run test:server:unit
```

### Integration Tests
```bash
bun run test:server:integration
```

### Watch Mode
```bash
bun run test:server:watch
```

## Test Coverage

### ✅ Implemented (P0 Priority)

#### `io.test.ts` — IO Utilities (39 tests)
- `calculateFileHash` - Hash generation for file content
- `getFilePath` - Path joining utilities
- `getRelativePath` - Relative path calculation
- `createFileInfo` - File information extraction
- `writeFileSafe` - Safe file writing with directory creation
- `getCompressedBuffer` - Compression (brotli/gzip)
- `isPlaywrightRunning` - Environment detection
- `fileExists` - File existence checking

**Coverage:** 100% of pure functions, integration tests for file operations

#### `templates/utils.test.ts` — Template Utilities (95 tests)
- Tagged template literals: `html`, `xml`, `css`, `js`
- Escaping functions: `escapeHtml`, `escapeXml`
- Slug generation: `generateSlug`
- Sorting utilities: `createOrderedSort`
- Validation functions: `validateHashString`, `validateRequiredString`, `validateArrayField`
- Helper functions: `safeRender`, `when`, `unless`, `mapSafe`, `fragment`, `indent`, `minify`
- HTML/XML validation: `validateHtml`, `validateXml`
- Resource utilities: `getResourceType`, `requiresCrossorigin`

**Coverage:** All exported utility functions with edge cases

#### `schema/fence.test.ts` — Fence Schema (28 tests)
- Code block transformation
- Language detection and parsing
- Filename extraction from language string
- Collapse functionality for long code
- Meta section generation
- Code placeholder with syntax highlighting markers
- Copy button generation
- Integration tests for complete structure

**Coverage:** Complete transformation pipeline from Markdoc Node to Tag

### 🚧 Pending Implementation

The following test files are planned but not yet implemented due to circular dependency issues or complexity:

- `markdoc-helpers.test.ts` - Node utilities, ID generation, tag helpers (requires refactoring of circular dependencies)
- `schema/heading.test.ts` - Heading schema tests (circular dependency with markdoc.config)
- `serve.test.ts` - HTTP server route tests (requires mock server setup)
- `file-signals.test.ts` - Signal pipeline tests (requires complex integration setup)
- `file-watcher.test.ts` - File watcher tests (requires fs watching mocks)

## Test Utilities

### `test-utils.ts`

Provides shared utilities for all tests:

#### Temporary Directories
```typescript
const { path, cleanup } = createTempDir()
// Use temp directory
cleanup() // Always cleanup after test
```

#### Mock Data Generators
```typescript
const markdown = mockMarkdown({
  title: 'Test Page',
  content: '# Hello',
  frontmatter: { date: '2024-01-01' }
})

const html = mockHtml({
  title: 'Test',
  body: '<p>Content</p>'
})

const fileInfo = mockFileInfo({
  path: '/test/file.md',
  content: 'test'
})
```

#### Assertion Helpers
```typescript
assertContains(html, 'expected text')
assertNotContains(html, 'unwanted text')
assertMatches(html, /pattern/)
assertValidHtml(html)
```

### Mock Request Context
```typescript
const context = mockRequestContext({
  path: '/api/test',
  method: 'GET',
  acceptsGzip: true
})
```

## Error Handling in Tests

When testing functions that intentionally throw errors (like `safeRender` or `mapSafe`), suppress `console.error` to avoid noisy test output:

```typescript
test('should handle errors gracefully', () => {
  // Suppress expected error logging
  const originalError = console.error
  console.error = () => {}

  // Test code that throws expected errors
  const result = functionThatThrows()
  expect(result).toBe('fallback')

  // Restore console.error
  console.error = originalError
})
```

This ensures test output is clean while still testing error handling behavior.

## Writing New Tests

### Test File Template

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTempDir } from './helpers/test-utils'
import { functionToTest } from '../module'

describe('module name - feature', () => {
  let tempDir: { path: string; cleanup: () => void }

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    tempDir.cleanup()
  })

  test('should do something', () => {
    // Arrange
    const input = 'test'
    
    // Act
    const result = functionToTest(input)
    
    // Assert
    expect(result).toBe('expected')
  })
})
```

### Guidelines

1. **Organize tests by feature/function** - Group related tests in `describe` blocks
2. **Use descriptive test names** - Should read like documentation
3. **Follow AAA pattern** - Arrange, Act, Assert
4. **Test edge cases** - Empty strings, null, undefined, very long inputs
5. **Use temp directories** - Always cleanup after file operations
6. **Avoid circular dependencies** - Import only what you need, avoid triggering schema imports

### Naming Conventions

- Test files: `module-name.test.ts`
- Test suites: `describe('ModuleName - feature', () => {})`
- Test cases: `test('should do specific thing', () => {})`

## Known Issues

### Circular Dependencies

The markdoc-helpers module has circular dependencies with schema files:
- `markdoc-helpers.ts` exports constants used by schemas
- Schemas import from `markdoc-helpers.ts`
- `markdoc.config.ts` imports all schemas
- Some modules import `markdoc.config.ts`

**Workaround:** Test schemas individually without importing the full config, or test helper functions in isolation.

### Environment Variables

Some tests may be affected by environment variables. Tests that check for Playwright detection restore the original environment after each test.

## Test Statistics

- **Total Tests:** 162
- **Total Assertions:** 256+
- **Average Test Time:** ~0.5ms per test
- **Total Suite Time:** ~76ms

## Next Steps

1. Resolve circular dependency in markdoc-helpers to enable full testing
2. Implement serve.ts route tests with mock HTTP server
3. Add file-signals integration tests with temporary file fixtures
4. Create file-watcher tests with fs mocking
5. Add build.ts orchestration tests
6. Implement effects/* tests for page generation

## References

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [TESTS.md](../TESTS.md) - Complete test plan and specifications
- [TASKS.md](../TASKS.md) - Implementation roadmap