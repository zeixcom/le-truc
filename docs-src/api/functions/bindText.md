### Function: bindText()

> **bindText**(`element`, `preserveComments?`): (`value`) => `void`

Defined in: [src/bindings.ts:172](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/bindings.ts#L172)

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
