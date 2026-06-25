/**
 * Unit tests for src/component.ts
 *
 * No real DOM in bun:test, and `class Truc extends HTMLElement` /
 * `customElements.define/get` need those globals to exist at all. Both are
 * minimal stand-ins installed in beforeEach, scoped to this file (no other
 * file references `HTMLElement`/`customElements` as runtime values).
 *
 * `connectedCallback`/`disconnectedCallback` are invoked directly on the
 * instance rather than via real DOM insertion — they're ordinary prototype
 * methods, not browser magic, so this is a legitimate way to drive the
 * lifecycle without a document.
 */
export {};
