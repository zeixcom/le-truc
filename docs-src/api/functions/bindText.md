### Function: bindText()

> **bindText**(`element`, `preserveComments?`): (`value`) => `void`

Defined in: [src/helpers.ts:40](https://github.com/zeixcom/le-truc/blob/c5ac50af47ae40f80c1a0a08f969acee81e2622e/src/helpers.ts#L40)

Returns a function that sets the text content of an element.

When `preserveComments` is `true`, uses `setTextPreservingComments` to retain
HTML comment nodes. When `false` (default), sets `el.textContent` directly.
Numbers are coerced to strings via `String()`.

#### Parameters

##### element

`Element`

Target element

##### preserveComments?

`boolean` = `false`

Whether to preserve HTML comment nodes

#### Returns

Function that sets a text content

(`value`) => `void`

#### Since

2.0
