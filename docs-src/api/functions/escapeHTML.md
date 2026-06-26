### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/bindings.ts:138](https://github.com/zeixcom/le-truc/blob/62831a486b22055e2f0aae8a1bc13f5e79ffdffc/src/bindings.ts#L138)

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
