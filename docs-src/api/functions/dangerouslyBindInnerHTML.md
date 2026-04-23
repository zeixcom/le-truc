### Function: dangerouslyBindInnerHTML()

> **dangerouslyBindInnerHTML**(`element`, `options?`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:175](https://github.com/zeixcom/le-truc/blob/61224a1a87e995ff3784a4e2a215a09a403e4e85/src/helpers.ts#L175)

Returns `SingleMatchHandlers<string>` that sets the inner HTML of an element,
with optional Shadow DOM and script re-execution support.

- `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
  if `allowScripts` is true, re-executes `<script>` elements after injection.
- `nil` → resets `innerHTML = ''` (or `<slot></slot>` in shadow root).

**Security note:** Only use with trusted or sanitized content. Pass `allowScripts: true`
only when the content source is trusted upstream.

#### Parameters

##### element

`Element`

Target element

##### options?

[`DangerouslySetInnerHTMLOptions`](../type-aliases/DangerouslySetInnerHTMLOptions.md) = `{}`

Shadow DOM mode and script execution options

#### Returns

[`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Match handlers that schedule the innerHTML mutation

#### Since

2.0
