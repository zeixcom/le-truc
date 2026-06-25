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
2. **External contract unchanged.** `dangerouslyBindInnerHTML` still returns `SingleMatchHandlers<string>` and still accepts plain strings. Producing a `TrustedHTML` happens *inside* the hook, so the change is additive, not breaking.
3. **Honest JSDoc.** Document that without a `sanitize` hook, the assignment still throws on a Trusted-Types-enforced page — which is correct behavior: the consumer opted into the dangerous sink without sanitizing, and the browser's own enforcement is the appropriate backstop.
4. **DOMPurify is the canonical example.** A consumer configures DOMPurify with `RETURN_TRUSTED_HTML: true` and passes `DOMPurify.sanitize` as the hook; full Trusted Types compliance follows with no other configuration.

This refines ADR-0009's `dangerouslyBindInnerHTML` guidance: where ADR-0009 named only `escapeHTML` and `setTextPreservingComments` as the safe utilities for direct DOM manipulation, ADR-0010 establishes the `sanitize` hook as the supported chokepoint for the one HTML-injection sink the library owns.

## Alternatives Considered

- **Option A — A dedicated `trustedTypes` option (e.g. `{ policy, sanitize }`).** Rejected. It introduces a second security knob that partially overlaps `sanitize`, the classic "two ways to do it" that breeds confusion. It also implies the library should manage a `TrustedTypePolicy`, which edges toward owning sanitization policy — exactly the responsibility REQUIREMENTS §7 keeps off the library. The union return type achieves the same capability with one option and zero policy ownership.

- **Option B — Auto-wrap with a default library-owned `TrustedTypePolicy`.** Rejected. A library-default policy that silently creates `TrustedHTML` from unsanitized strings would *weaken* security: it converts the dangerous sink into one that bypasses the consumer's CSP enforcement without their explicit opt-in. Trusted Types' value is that trust is explicit and auditable; a hidden default policy defeats that.

- **Option C — Do nothing; document that TT-enforced pages require a per-app exemption.** Rejected. `require-trusted-types-for 'script'` is now a mainstream configuration, and Le Truc's only `innerHTML` sink is this one function. Leaving it un-addressable pushes every TT-enforced consumer toward blanket `'allow-duplicates'`/exemption workarounds, which degrade the very CSP the consumer adopted. The union-return fix is small and keeps the decision in the consumer's hands.

## Consequences

**Good:**
- Trusted-Types-enforced consumers gain full compliance through the same single hook they already use for sanitization — one mechanism, not two.
- The library owns no sanitizer and no `TrustedTypePolicy`, preserving the §7 boundary and the bundle-size target.
- The change is additive: existing `sanitize: (html) => string` callers are unaffected; the external `SingleMatchHandlers<string>` contract is stable.
- Sanitization and trust are co-located at the one chokepoint, making the security posture of any `dangerouslyBindInnerHTML` call site auditable at a glance.

**Bad / trade-offs:**
- Consumers who want Trusted Types compliance must bring a sanitizer that produces `TrustedHTML` (e.g. DOMPurify). The library provides no default — by design, but it is one more thing for the consumer to wire up.
- Without a `sanitize` hook, the function throws on TT-enforced pages. This is correct but must be clearly documented so it is not a surprise.
- `TrustedHTML` is a relatively new type in the TS DOM lib; consumers on older `lib.dom.d.ts` may need a lib upgrade or a local declaration to satisfy the union type.
- **Found in LT-015 review, tracked as LT-016:** the `sanitize` hook only covers the path where new HTML is supplied (`ok`). `dangerouslyBindInnerHTML`'s reset/clear path (`nil`, and the `!rawHtml` short-circuit in `ok`) assigns a raw string directly and never calls `sanitize`. Verified empirically (Chromium + WebKit): under enforcement, *any* plain-string `innerHTML` assignment throws, including the empty string — there is no spec carve-out — so this path throws unconditionally regardless of how `sanitize` is configured. The "one mechanism, not two" claim above does not yet hold for resets; the planned fix (LT-016) avoids the `innerHTML` sink for resets entirely (`replaceChildren`) rather than routing them through `sanitize`.

## Related

- Requirements: [M16](REQUIREMENTS.md#m16-security-validation-in-bindattribute), §4 (bundle size), §7 (Out of Scope — no templating/sanitizer)
- Architecture: Security, `bind*` helpers, Safety Utilities
- Audit: `AUDIT_REPORT.md` finding A5; `TODO.md` LT-005 (delivered), LT-015 (implements this decision, reviewed), LT-016 (closes the reset/clear-path gap found in LT-015 review)
- Partially supersedes: [ADR-0009](0009-security-validation-in-bindattribute.md) — only the `dangerouslyBindInnerHTML` / `innerHTML`-sink guidance; ADR-0009's `bindAttribute` / `safeSetAttribute` URL and `on*` validation stands unchanged.
