### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/bindings.ts:90](https://github.com/zeixcom/le-truc/blob/c0c7a519683b9de6742fb7ca8d71487ad2dadceb/src/bindings.ts#L90)

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
