### Function: setTextPreservingComments()

> **setTextPreservingComments**(`element`, `text`): `void`

Defined in: [src/safety.ts:84](https://github.com/zeixcom/le-truc/blob/90149bb8885c2e678e7571c228e4005108709147/src/safety.ts#L84)

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

1.1
