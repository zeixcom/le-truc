### Function: setTextPreservingComments()

> **setTextPreservingComments**(`element`, `text`): `void`

Defined in: [src/safety.ts:75](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/safety.ts#L75)

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
