// Fixture for the bundle-size regression test: `defineComponent` plus the
// `formAssociatedCheckbox()` extension — verifies it tree-shakes
// independently of `formAssociated()`'s value-sync/reset code, even though
// both live in src/extensions/form.ts and share the host-contract table.
export { defineComponent } from '../../src/component'
export { formAssociatedCheckbox } from '../../src/extensions/form'
