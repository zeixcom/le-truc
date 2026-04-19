### Function: bindText()

> **bindText**(`element`, `preserveComments?`): (`value`) => `void`

Defined in: [src/helpers.ts:40](https://github.com/zeixcom/le-truc/blob/1fbe7a16df53520ae334ded40a50f57cafc83af1/src/helpers.ts#L40)

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
