# ADR 0009: Security Validation in setAttribute

## Status

✅ Accepted

## Context

Need to prevent XSS (Cross-Site Scripting) via attribute injection. Malicious attribute values could execute JavaScript or use unsafe protocols that trigger script execution. This is especially important for a library that may be used in CMS contexts where attribute values could come from untrusted sources.

## Decision

`bindAttribute()` (and the underlying `safeSetAttribute()` utility) includes security validation that blocks dangerous attributes and validates URLs against an allowlist of safe protocols.

### Blocked attributes
- All `on*` event handler attributes (e.g., `onclick`, `onmouseover`, `onload`)

### URL protocol allowlist
- `http:`
- `https:`
- `ftp:`
- `mailto:`
- `tel:`

### Blocked protocols
- `javascript:` (prevents inline script execution)
- `data:` (prevents data URIs that could contain scripts)
- Any other protocol not in the allowlist

### Safety utilities
With built-in effects no longer wrapping DOM operations, safety features are available as importable utilities:
- `safeSetAttribute(element, name, value)` — validates URL protocols and blocks `on*` handlers before calling `setAttribute`
- `escapeHTML(text)` — escapes HTML special characters
- `setTextPreservingComments(element, text)` — safely sets text content

These are opt-in imports. Authors who use native DOM methods directly accept responsibility for validation.

## Alternatives Considered

- **No validation** — Trust the developer to handle security; risks XSS vulnerabilities in untrusted contexts
- **Validation at framework level** — Would miss direct DOM manipulation; less comprehensive
- **Different allowlist** — Could be more or less restrictive; current list balances security and utility
- **Sanitize rather than block** — More complex; could have edge cases; blocking is simpler and safer

## Consequences

**Good:**
- Prevents XSS via attribute injection by default
- Clear, explicit allowlist of safe protocols
- Safety utilities available for direct DOM manipulation
- Opt-in for advanced use cases (developers accept responsibility)

**Bad:**
- May block legitimate use cases (e.g., custom protocols)
- Developers must use safety utilities when bypassing built-in helpers
- Slight performance overhead for validation

## Related

- Requirements: [M16](REQUIREMENTS.md#m16-security-validation-in-setattribute)
- Architecture: [Security](ARCHITECTURE.md#security), [bind* helpers — DOM update handlers](ARCHITECTURE.md#bind-helpers--dom-update-handlers), [Safety Utilities](ARCHITECTURE.md#safety-utilities)
- Supersedes: None
