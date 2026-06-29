### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/bindings.ts:139](https://github.com/zeixcom/le-truc/blob/f973c77449aa2054ba6f6324004d6f4dfb8706d1/src/bindings.ts#L139)

Escape HTML entities to prevent XSS when inserting user-supplied text as HTML.

Escapes `&`, `<`, `>`, `"`, and `'`.

#### Parameters

##### text

`string`

Plain text to escape

#### Returns

`string`

HTML-safe string

#### Since

2.0
