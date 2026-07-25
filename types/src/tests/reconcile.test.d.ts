/**
 * Unit tests for reconcile() in src/helpers/reactive.ts
 *
 * No real DOM is available under `bun test`, so reconcile() is exercised
 * against a minimal fake element implementing exactly the DOM surface the
 * reconciler uses: `children`, `firstElementChild`, `nextElementSibling`,
 * `insertBefore`, `remove`, `cloneNode`, and the attribute methods —
 * mirroring the stub-DOM style used in component.test.ts and dom.test.ts.
 * The `<template>` is a stub exposing only `content.childElementCount` and
 * `content.firstElementChild`.
 */
export {};
