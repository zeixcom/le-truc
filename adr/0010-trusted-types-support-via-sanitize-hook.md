# ADR 0010: Trusted Types Support via the sanitize Hook

## Status

✅ Accepted

Partially supersedes the `dangerouslyBindInnerHTML` portion of [ADR-0009](0009-security-validation-in-bindattribute.md). The `bindAttribute` / `safeSetAttribute` URL-protocol and `on*`-attribute validation in ADR-0009 remains fully in force and is untouched by this decision.

## Context

`dangerouslyBindInnerHTML` is Le Truc's only `innerHTML` assignment sink (it also writes `shadowRoot.innerHTML`). It is the supported escape hatch for injecting HTML into a component subtree, used alongside `escapeHTML` and a consumer-supplied sanitizer.

Two developments made the existing contract insufficient:

1. **Audit finding.** The JSDoc implied `allowScripts: false` was the safety lever for untrusted content. It is not — assigning `innerHTML` does not execute inline `<script>`, but it *does* fire event-handler attributes on other elements (`<img onerror>`, `<svg onload>`, `<iframe srcdoc>`). The audit demanded an honest security contract and a single, well-defined chokepoint for sanitization. This was delivered as a `sanitize?: (html: string) => string` option.

2. **Trusted Types is now Baseline.** The [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) reached cross-browser Baseline status in 2026 (Chrome/Edge since v83, May 2020; Safari followed; Firefox completed it in early 2026). On a page enforcing `Content-Security-Policy: require-trusted-types-for 'script'`, an `innerHTML` assignment throws a `TypeError` unless the value is a `TrustedHTML` instance. Because `dangerouslyBindInnerHTML` is Le Truc's only such sink, a Trusted-Types-enforced consumer cannot use it at all today without a per-application policy exemption — a real and growing compatibility gap, not a hypothetical.

Le Truc's hard constraints bear directly on the solution space:

- **No bundled sanitizer / no client-side templating** (REQUIREMENTS §7, "Out of Scope"). The library must not ship a sanitizer; bundle size must stay ≤10 kB gzipped (target), hard ceiling 14 kB.
- **Backend-agnostic, progressive enhancement** (REQUIREMENTS §1, §6). Consumers run heterogeneous backends and CSPs; the library must not assume a particular security posture.

Relevant requirements: [M16](REQUIREMENTS.md#m16-security-validation-in-bindattribute) (security validation), the bundle-size and no-templating constraints in §4/§5.

## Decision

Make Trusted Types compliance a **property of how the consumer sanitizes**, expressed through the single `sanitize` hook — not a separate option.

Concretely:

1. **Widen the `sanitize` return type** on `DangerouslyBindInnerHTMLOptions` from `(html: string) => string` to `(html: string) => string | TrustedHTML`. The sanitized result is assigned directly to `target.innerHTML`; the DOM sink accepts both `string` and `TrustedHTML`, so no runtime branching is needed.

2. **`TrustedHTML` is a hand-rolled, module-private type.** TypeScript's bundled `lib.dom.d.ts` does not define `TrustedHTML` as an actual type (verified against TypeScript 6.0.2 — it appears only in JSDoc prose on `Document.write()`), so something has to supply it for the union above to type-check. Declared locally in `src/bindings.ts` as plain `object` — deliberately *not* a structural mirror like `{ toJSON(): string }`. The real `TrustedHTML`, as resolved by DOMPurify's own `.d.ts` via the `@types/trusted-types` package, is `class TrustedHTML { private constructor(); private brand: true }` — a nominal type with no public members, by design, specifically to prevent structural impersonation. A structural mirror would reject genuine `TrustedHTML` values produced by DOMPurify or a native `trustedTypes` policy; `object` is the loosest type that accepts both without claiming a shape Le Truc cannot verify.

   The type is **not exported** from `src/bindings.ts` or re-exported from `index.ts`. Producing a genuine `TrustedHTML` value always requires the consumer to already have their own typing for `window.trustedTypes` (which `lib.dom.d.ts` also doesn't expose) — whatever supplies that type already satisfies Le Truc's `sanitize` union structurally, with or without an exported `TrustedHTML` name from Le Truc. Verified empirically: `tsc --declaration --emitDeclarationOnly` inlines the unexported type cleanly into the public `.d.ts` for `DangerouslyBindInnerHTMLOptions['sanitize']` with zero errors — consumers keep full structural type-checking, they just can't `import type { TrustedHTML } from '@zeix/le-truc'`.

3. **External contract unchanged.** `dangerouslyBindInnerHTML` still returns `SingleMatchHandlers<string>` and still accepts plain strings. Producing a `TrustedHTML` happens *inside* the hook, so the change is additive, not breaking.

4. **Honest JSDoc.** Document that without a `sanitize` hook, the assignment still throws on a Trusted-Types-enforced page — which is correct behavior: the consumer opted into the dangerous sink without sanitizing, and the browser's own enforcement is the appropriate backstop.

5. **DOMPurify is the canonical example.** A consumer configures DOMPurify with `RETURN_TRUSTED_TYPE: true` and passes `DOMPurify.sanitize` as the hook; full Trusted Types compliance follows with no other configuration. Verified for real — not just documented — in `examples/test/audit/test-sanitize-tt.spec.ts` (`audit-dompurify` component), which installs `dompurify` as a devDependency (test-only, not bundled) and exercises this exact integration under Trusted-Types-enforcing CSP, in both Chromium and WebKit.

This refines ADR-0009's `dangerouslyBindInnerHTML` guidance: where ADR-0009 named only `escapeHTML` and `setTextPreservingComments` as the safe utilities for direct DOM manipulation, ADR-0010 establishes the `sanitize` hook as the supported chokepoint for the one HTML-injection sink the library owns.

## Alternatives Considered

- **Option A — A dedicated `trustedTypes` option (e.g. `{ policy, sanitize }`).** Rejected. It introduces a second security knob that partially overlaps `sanitize`, the classic "two ways to do it" that breeds confusion. It also implies the library should manage a `TrustedTypePolicy`, which edges toward owning sanitization policy — exactly the responsibility REQUIREMENTS §7 keeps off the library. The union return type achieves the same capability with one option and zero policy ownership.

- **Option B — Auto-wrap with a default library-owned `TrustedTypePolicy`.** Rejected. A library-default policy that silently creates `TrustedHTML` from unsanitized strings would *weaken* security: it converts the dangerous sink into one that bypasses the consumer's CSP enforcement without their explicit opt-in. Trusted Types' value is that trust is explicit and auditable; a hidden default policy defeats that.

- **Option C — Do nothing; document that TT-enforced pages require a per-app exemption.** Rejected. `require-trusted-types-for 'script'` is now a mainstream configuration, and Le Truc's only `innerHTML` sink is this one function. Leaving it un-addressable pushes every TT-enforced consumer toward blanket `'allow-duplicates'`/exemption workarounds, which degrade the very CSP the consumer adopted. The union-return fix is small and keeps the decision in the consumer's hands.

For sourcing the `TrustedHTML` type itself (Decision point 2):

- **Option D — Depend on `trusted-types`** (the W3C/WICG reference polyfill; DOMPurify's own `.d.ts` imports `TrustedHTML` from `trusted-types/lib/index.js`). Rejected: the published `trusted-types@2.0.0` package ships no `.d.ts` files and has no `lib/` directory — that import path does not resolve. Even DOMPurify's own canonical type source for this doesn't work today.

- **Option E — Depend on `@types/trusted-types`** (DefinitelyTyped) directly. Rejected: would work — it's what supplies the real type via DOMPurify's own `optionalDependencies` already — but taking it as a direct dependency would need to be a real `dependency` (not dev-only) for consumers' `.d.ts` resolution, for a one-line shape with a built-in expiry once `lib.dom.d.ts` ships Trusted Types natively (it reached Baseline in 2026, per Context above).

- **Option F — Export the hand-rolled local copy as public API.** Rejected: no consumer benefit (see Decision point 2 — whatever types a consumer's `window.trustedTypes` already satisfies the `sanitize` union structurally) for one more name in Le Truc's public surface to maintain and eventually deprecate once `lib.dom.d.ts` catches up natively.

## Consequences

**Good:**
- Trusted-Types-enforced consumers gain full compliance through the same single hook they already use for sanitization — one mechanism, not two.
- The library owns no sanitizer and no `TrustedTypePolicy`, preserving the §7 boundary and the bundle-size target.
- The change is additive: existing `sanitize: (html) => string` callers are unaffected; the external `SingleMatchHandlers<string>` contract is stable.
- Sanitization and trust are co-located at the one chokepoint, making the security posture of any `dangerouslyBindInnerHTML` call site auditable at a glance.

**Bad / trade-offs:**
- Consumers who want Trusted Types compliance must bring a sanitizer that produces `TrustedHTML` (e.g. DOMPurify). The library provides no default — by design, but it is one more thing for the consumer to wire up.
- Without a `sanitize` hook, the function throws on TT-enforced pages. This is correct but must be clearly documented so it is not a surprise.
- The `sanitize` hook only covers the path where new HTML is supplied (`ok`). `dangerouslyBindInnerHTML`'s reset/clear path (`nil`, and the `!rawHtml` short-circuit in `ok`) assigns a raw string directly and never calls `sanitize`. We avoid the `innerHTML` sink for resets entirely (`replaceChildren`) rather than routing them through `sanitize`.
- **The "canonical" DOMPurify pattern needed a real test to be trustworthy.** Type-level reasoning alone (Decision point 2) was not enough to catch two factual errors in that pattern: DOMPurify's option is `RETURN_TRUSTED_TYPE`, not `RETURN_TRUSTED_HTML` (no such option exists in any released version), and an earlier structural-mirror design for `TrustedHTML` (`{ toJSON(): string }`, since corrected to `object`) was never actually assignable from what DOMPurify returns, because its real `TrustedHTML` is a nominal class with no public members. Both were caught only once `audit-dompurify` (`examples/test/audit/test-sanitize-tt.spec.ts`) exercised the real `dompurify` package end to end under enforcement — which is why that test exists: a future DOMPurify release that renames or changes the option fails the test suite instead of going stale in the docs.

## Related

- Requirements: [M16](REQUIREMENTS.md#m16-security-validation-in-bindattribute), §4 (bundle size), §7 (Out of Scope — no templating/sanitizer)
- Architecture: Security, `bind*` helpers, Safety Utilities
- Partially supersedes: [ADR-0009](0009-security-validation-in-bindattribute.md) — only the `dangerouslyBindInnerHTML` / `innerHTML`-sink guidance; ADR-0009's `bindAttribute` / `safeSetAttribute` URL and `on*` validation stands unchanged.
- CHANGELOG: 2.1.0 entry documents `TrustedHTML`'s module-private `object` type and the `RETURN_TRUSTED_TYPE` option.
- Tests: `examples/test/audit/test-audit.ts` (`audit-trusted-html`, `audit-dompurify`), `examples/test/audit/test-sanitize-tt.spec.ts` — real DOMPurify exercised under Trusted-Types enforcement. `dompurify` added as a devDependency for this purpose only (not bundled; the library still ships no sanitizer).
