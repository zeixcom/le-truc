### Function: escapeHTML()

> **escapeHTML**(`text`): `string`

Defined in: [src/safety.ts:66](https://github.com/zeixcom/le-truc/blob/61224a1a87e995ff3784a4e2a215a09a403e4e85/src/safety.ts#L66)

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
