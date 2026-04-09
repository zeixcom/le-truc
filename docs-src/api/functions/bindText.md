### Function: bindText()

> **bindText**(`element`, `preserveComments?`): (`value`) => `void`

Defined in: [src/helpers.ts:19](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/helpers.ts#L19)

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

Function that sets the text content

(`value`) => `void`

#### Since

2.0
