/**
 * Unit tests for src/bindings.ts
 *
 * `safeSetAttribute`/`escapeHTML` are pure-logic, tested against plain stub
 * elements. The `bind*` helpers and `setTextPreservingComments` need a few
 * real DOM globals (`Node.COMMENT_NODE`, `document.createTextNode`,
 * `document.createElement`) that bun:test doesn't provide — `installFakeDom`
 * installs a minimal stand-in, scoped to this file via beforeEach/afterEach.
 */
export {};
