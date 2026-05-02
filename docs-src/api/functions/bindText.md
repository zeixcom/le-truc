### Function: bindText()

> **bindText**(`element`, `preserveComments?`): (`value`) => `void`

Defined in: [src/bindings.ts:129](https://github.com/zeixcom/le-truc/blob/c0c7a519683b9de6742fb7ca8d71487ad2dadceb/src/bindings.ts#L129)

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
