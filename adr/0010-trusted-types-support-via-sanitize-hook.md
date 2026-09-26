# ADR 0010: Trusted Types Support via the sanitize Hook

## Status

✅ Accepted

Partially supersedes the `dangerouslyBindInnerHTML` portion of [ADR 0009](0009-security-validation-in-bindattribute.md). The `bindAttribute` / `safeSetAttribute` URL-protocol and `on*`-attribute validation in ADR 0009 remains fully in force and is untouched by this decision.

## Context

`dangerouslyBindInnerHTML` is Le Truc's only `innerHTML` assignment sink (it also writes `shadowRoot.innerHTML`). It is the supported escape hatch for injecting HTML into a component subtree, used alongside `escapeHTML` and a consumer-supplied sanitizer.

Two developments made the existing contract insufficient:

1. **An honest security contract.** `allowScripts: false` is not a safety lever for untrusted content: assigning `innerHTML` does not execute inline `<script>`, but it *does* fire event-handler attributes on other elements (`<img onerror>`, `<svg onload>`, `<iframe srcdoc>`). Sanitization needs a single, well-defined chokepoint: a `sanitize?: (html: string) => string` option.

2. **Trusted Types is Baseline.** The [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) is cross-browser Baseline as of 2026. On a page enforcing `Content-Security-Policy: require-trusted-types-for 'script'`, an `innerHTML` assignment throws a `TypeError` unless the value is a `TrustedHTML` instance. Because `dangerouslyBindInnerHTML` is Le Truc's only such sink, a Trusted-Types-enforced consumer could not use it at all without a per-application policy exemption.

Le Truc's hard constraints bear directly on the solution space:

- **No bundled sanitizer / no client-side templating** (REQUIREMENTS §7, "Out of Scope"). The library must not ship a sanitizer.
- **Backend-agnostic, progressive enhancement** (REQUIREMENTS §1, §6). Consumers run heterogeneous backends and CSPs; the library must not assume a particular security posture.

Relevant requirements: [M16](../REQUIREMENTS.md#m16-security-validation-in-setattribute) (security validation), the bundle-size and no-templating constraints in §4/§5.

## Decision

Make Trusted Types compliance a **property of how the consumer sanitizes**, expressed through the single `sanitize` hook — not a separate option.

1. **Widen the `sanitize` return type** on `DangerouslyBindInnerHTMLOptions` from `(html: string) => string` to `(html: string) => string | TrustedHTML`. The result is assigned directly to `innerHTML`; the DOM sink accepts both, so no runtime branching is needed.

2. **`TrustedHTML` is a module-private placeholder typed as plain `object`.** TypeScript's `lib.dom.d.ts` does not yet define `TrustedHTML`, so Le Truc supplies it. It is deliberately not a structural mirror: the real `TrustedHTML` is a nominal class with no public members, designed to prevent structural impersonation, so any mirror would reject genuine values from DOMPurify or a native policy. `object` is the loosest type that accepts them without claiming a shape Le Truc cannot verify. The type is **not exported**: producing a genuine `TrustedHTML` already requires the consumer's own typing for `window.trustedTypes`, which satisfies the `sanitize` union structurally, and the public `.d.ts` inlines the placeholder.

3. **External contract unchanged.** `dangerouslyBindInnerHTML` still returns `SingleMatchHandlers<string>` and still accepts plain strings. Producing a `TrustedHTML` happens *inside* the hook, so the change is additive.

4. **Honest documentation.** Without a `sanitize` hook the assignment still throws on a Trusted-Types-enforced page. That is correct: the consumer opted into the dangerous sink without sanitizing, and the browser's enforcement is the appropriate backstop.

5. **DOMPurify is the canonical example.** A consumer configures DOMPurify with `RETURN_TRUSTED_TYPE: true` and passes `DOMPurify.sanitize` as the hook; full Trusted Types compliance follows with no other configuration. The integration is exercised against the real package under enforcement, so a DOMPurify change breaks the test suite rather than going stale in the docs.

6. **`configureHtmlSanitizer(sanitize)` registers a module-level default** that `dangerouslyBindInnerHTML()` falls back to when a call site omits its own `sanitize`. Precedence: call-site `sanitize` > configured default > raw passthrough (the unconfigured behavior, unchanged). The default is resolved on every update, not captured at bind time, so configuring it after elements are bound still reaches them. It gives call sites that have no options object at all — such as the compiler-generated `truc:html={() => …}` binding (ADR 0024) — one app-wide place to wire up a sanitizer.

7. **Resets never touch the `innerHTML` sink.** Clearing content (`nil`, or empty HTML) uses `replaceChildren()`, so it neither calls `sanitize` nor throws under Trusted Types.

This refines ADR 0009's guidance: where ADR 0009 named only `escapeHTML` and `setTextPreservingComments` as the safe utilities for direct DOM manipulation, the `sanitize` hook is the supported chokepoint for the one HTML-injection sink the library owns. The API contract lives in the JSDoc of `src/bindings.ts`.

## Alternatives Considered

- **A dedicated `trustedTypes` option (e.g. `{ policy, sanitize }`)**: a second security knob overlapping `sanitize` — two ways to do one thing — and it implies the library manages a `TrustedTypePolicy`, edging toward owning sanitization policy, which §7 keeps off the library. The union return type gives the same capability with one option and no policy ownership.

- **Auto-wrap with a default library-owned `TrustedTypePolicy`**: a default policy that silently turns unsanitized strings into `TrustedHTML` *weakens* security, bypassing the consumer's CSP without explicit opt-in; Trusted Types' value is that trust is explicit and auditable. `configureHtmlSanitizer()` is not this option revisited: it ships no sanitizer and does nothing until the consumer calls it.

- **Do nothing; document a per-app exemption**: `require-trusted-types-for 'script'` is mainstream, and pushing every enforced consumer toward exemption workarounds degrades the CSP they adopted. The union-return fix is small and keeps the decision in the consumer's hands.

For sourcing the `TrustedHTML` type (sub-design 2):

- **Depend on `trusted-types`** (the WICG reference polyfill, which DOMPurify's `.d.ts` imports from): the published package ships no type declarations, so the import does not resolve.

- **Depend on `@types/trusted-types`**: it works, but would have to be a runtime `dependency` for consumers' `.d.ts` resolution, for a one-line shape that expires once `lib.dom.d.ts` ships Trusted Types natively.

- **Export the local placeholder as public API**: no consumer benefit (a consumer's own `trustedTypes` typing already satisfies the union) for one more public name to maintain and later deprecate.

## Consequences

**Good:**
- Trusted-Types-enforced consumers gain full compliance through the same single hook they already use for sanitization — one mechanism, not two.
- The library owns no sanitizer and no `TrustedTypePolicy`, preserving the §7 boundary and the bundle-size target.
- The change is additive: existing `sanitize: (html) => string` callers are unaffected; the `SingleMatchHandlers<string>` contract is stable.
- Sanitization and trust are co-located at the one chokepoint, making the security posture of any `dangerouslyBindInnerHTML` call site auditable at a glance.
- `configureHtmlSanitizer()` gives every call site, hand-written or compiler-generated, one app-wide place to wire up a sanitizer once.

**Bad / accepted tradeoffs:**
- Consumers who want Trusted Types compliance must bring a sanitizer that produces `TrustedHTML` (e.g. DOMPurify). The library provides no default — by design, but it is one more thing to wire up.
- Without a `sanitize` hook the function throws on Trusted-Types-enforced pages. This is correct but must be clearly documented so it is not a surprise.
- Type-level reasoning alone cannot prove the canonical DOMPurify pattern: its option name and the assignability of its nominal `TrustedHTML` are only confirmed by exercising the real package under enforcement, which is why that test is part of the suite.

## Related

- Requirements: [M16](../REQUIREMENTS.md#m16-security-validation-in-setattribute), §4 (bundle size), §7 (Out of Scope — no templating/sanitizer)
- Architecture: Security, `bind*` helpers, Safety Utilities
- Partially supersedes: [ADR 0009](0009-security-validation-in-bindattribute.md) — only the `dangerouslyBindInnerHTML` / `innerHTML`-sink guidance.
- Server counterpart: `server/compiler/runtime.ts` has a same-named `configureHtmlSanitizer` / `sanitizeHtml` pair for the compiler's server-rendered `truc:html` path (ADR 0024) — a separate mechanism with a deliberately different unconfigured default: the server escapes markup (safe but inert), the client passes it through raw; each preserves its own prior behavior.
- Source: `src/bindings.ts` (`dangerouslyBindInnerHTML`, `configureHtmlSanitizer`, `Sanitizer`).
