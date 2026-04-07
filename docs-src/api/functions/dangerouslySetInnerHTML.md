### Function: dangerouslySetInnerHTML()

> **dangerouslySetInnerHTML**(`element`, `options?`): [`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:193](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/helpers.ts#L193)

Returns `WatchHandlers<string>` that sets the inner HTML of an element,
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

[`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Watch handlers that set the element's inner HTML

#### Since

2.0
