### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/bindings.ts:133](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/bindings.ts#L133)

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

1.1
