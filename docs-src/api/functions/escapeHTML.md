### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/safety.ts:57](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/safety.ts#L57)

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
