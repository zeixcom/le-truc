/**
 * Unit tests for ElementInternals support (form association, custom states).
 *
 * Tests the **managed form-control convention**: a form-associated component
 * exposes a reactive `value` property, and the library owns form value sync
 * (value → setFormValue), formResetCallback (restore default), state restore,
 * formDisabledCallback (managed disabled signal), and the native-parity host
 * contract. The `internals` escape hatch is tested for typed validity flags
 * and custom :state() pseudo-classes.
 *
 * Uses the same FakeHTMLElement / fake customElements pattern as component.test.ts.
 */
export {};
