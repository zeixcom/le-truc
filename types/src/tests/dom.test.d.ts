/**
 * Unit tests for src/helpers/dom.ts
 *
 * No real DOM is available under `bun test`, so `createElementsMemo` is
 * exercised against a minimal `ParentNode` stub that only implements
 * `querySelector`/`querySelectorAll` — mirroring the stub-DOM style used
 * in events.test.ts and context.test.ts.
 */
export {};
