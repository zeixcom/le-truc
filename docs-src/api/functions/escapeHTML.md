### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/safety.ts:66](https://github.com/zeixcom/le-truc/blob/7a98a8d7ad80e12df149892b5920ff3839211b70/src/safety.ts#L66)

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
