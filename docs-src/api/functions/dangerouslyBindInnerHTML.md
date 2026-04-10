### Function: dangerouslyBindInnerHTML()

> **dangerouslyBindInnerHTML**(`element`, `options?`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:177](https://github.com/zeixcom/le-truc/blob/90149bb8885c2e678e7571c228e4005108709147/src/helpers.ts#L177)

Returns `SingleMatchHandlers<string>` that sets the inner HTML of an element,
with optional Shadow DOM and script re-execution support.

- `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
  if `allowScripts` is true, re-executes `<script>` elements after injection.
- `nil` → sets `innerHTML = ''` (or restores `<slot></slot>` in shadow root).

**Security note:** Setting innerHTML bypasses XSS protections. Only use with
trusted or sanitized content. Pass `allowScripts: true` only when the content
source is trusted upstream.

#### Parameters

##### element

`Element`

Target element

##### options?

[`DangerouslySetInnerHTMLOptions`](../type-aliases/DangerouslySetInnerHTMLOptions.md) = `{}`

Shadow DOM mode and script execution options

#### Returns

[`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Watch handlers that set the element's inner HTML

#### Since

2.0
