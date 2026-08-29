/**
 * Second browser bundle entry (LT-091): the compiled `.tsrx` components'
 * generated clients, for the real-browser specs.
 *
 * The docs site proper keeps mounting the hand-written implementations
 * (examples/main.ts) until each component's own cutover lands — a tag
 * defined by BOTH entries in one document would throw on the second
 * `customElements.define` — so this bundle is never loaded by site pages.
 * form-colorgraph.spec.ts route-intercepts its test URL and serves the
 * component's generated server HTML with this bundle attached, exercising
 * the compiled client (and everything it transitively registers — e.g.
 * the composed form-spinbutton) in a real browser against real generated
 * markup: the exact surface where LT-090's dropped compose-site class was
 * invisible to the unit suite.
 *
 * The generated modules are written by the tsrx build effect, which build.ts
 * sequences ahead of this bundle (phase 1), so the imports below always
 * resolve — including on a fresh checkout.
 */
import '../server/generated/tsrx/form-colorgraph.client.ts'
