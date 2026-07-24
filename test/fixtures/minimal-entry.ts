// Fixture for the bundle-size regression test: the smallest realistic
// consumer surface — `defineComponent` with no extensions. Proves that a
// consumer who never imports an extension (`formAssociated()`,
// `observedAttributes()`, ...) never bundles its module, since
// `component.ts` only references the generic `ComponentExtension` shape at
// the value level, never a concrete feature module. See ADR on the
// `ComponentExtension` mechanism.
export { defineComponent } from '../../src/component'
