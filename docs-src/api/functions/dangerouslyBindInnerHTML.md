### Function: dangerouslyBindInnerHTML()

> **dangerouslyBindInnerHTML**(`element`, `options?`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/bindings.ts:336](https://github.com/zeixcom/le-truc/blob/b0a312070e75b8c347df329a83469bb95e181c8d/src/bindings.ts#L336)

Returns `SingleMatchHandlers<string>` that sets the inner HTML of an element,
with optional Shadow DOM, sanitization, and script re-execution support.

- `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
  if `sanitize` is provided, it is applied first. If `allowScripts` is true,
  `<script>` elements are re-executed after injection (inline `<script>` added
  via `innerHTML` does not run on its own).
- `nil` (or an empty/falsy `html`) → schedules a reset via
  `element.replaceChildren()` (or `shadowRoot.replaceChildren(document.createElement('slot'))`).
  Going through the same per-element `schedule()` dedup as the `ok` write
  above means whichever of the two fires last in a frame wins — a reset
  can't be clobbered by an earlier-scheduled, now-stale write, nor vice versa.
  The DOM-mutation approach (rather than `innerHTML = ''`) deliberately
  avoids the `innerHTML` sink: under a Trusted-Types-enforcing CSP, *any*
  string assignment to `innerHTML` throws — even `''` — so reset is
  unaffected by enforcement and needs no `sanitize` hook.

**Security — read carefully.** Assigning `innerHTML` is an XSS sink. It does
NOT execute inline `<script>`, but it DOES fire event-handler attributes on
other elements (e.g. `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe srcdoc>`).
Therefore:
- `allowScripts: false` (the default) does **not** make untrusted HTML safe.
  It only suppresses the explicit `<script>` re-execution step.
- All content passed here must be fully trusted or sanitized upstream. Pass a
  `sanitize` function (e.g. DOMPurify's `sanitize`) to apply that sanitation
  at the sink. Le Truc ships no built-in sanitizer.

**Trusted Types.** On a page that enforces
`Content-Security-Policy: require-trusted-types-for 'script'`, the
`innerHTML` assignment throws unless `html` is a `TrustedHTML` instance — a
`sanitize` hook that returns a plain `string` does not satisfy this, no
matter how thorough the sanitization. Return `TrustedHTML` from `sanitize`
(e.g. DOMPurify with `RETURN_TRUSTED_TYPE: true`) to support such pages.

#### Parameters

##### element

`Element`

Target element

##### options?

[`DangerouslyBindInnerHTMLOptions`](../type-aliases/DangerouslyBindInnerHTMLOptions.md) = `{}`

Shadow DOM mode, sanitizer, and script execution options

#### Returns

[`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Match handlers that schedule the innerHTML mutation

#### Since

2.0
