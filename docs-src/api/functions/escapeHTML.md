### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/safety.ts:57](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/safety.ts#L57)

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
