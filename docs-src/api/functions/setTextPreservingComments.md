### Function: setTextPreservingComments()

> **setTextPreservingComments**(`element`, `text`): `void`

Defined in: [src/bindings.ts:157](https://github.com/zeixcom/le-truc/blob/a00a78f0ec81c853d59278f25a4fb2f3f3684691/src/bindings.ts#L157)

Set the text content of an element while preserving comment nodes.

Removes all child nodes except comments, then appends a new text node.
Useful when HTML comments are used as markers or server-rendered annotations.

#### Parameters

##### element

`Element`

Target element

##### text

`string`

Text content to set

#### Returns

`void`

#### Since

2.0
