// Fixture for the bundle-size regression test: `defineComponent` plus the
// `formAssociated()` extension — the most common opt-in feature, and the
// heaviest bundled extension (ElementInternals support). A consumer who
// imports this pays for `extensions/form.ts`; one who doesn't (see
// minimal-entry.ts) does not.
export { defineComponent } from '../../src/component'
export { formAssociated } from '../../src/extensions/form'
