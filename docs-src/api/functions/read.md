### Function: read()

> **read**\<`T`, `U`\>(`reader`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

Defined in: [src/parsers.ts:148](https://github.com/zeixcom/le-truc/blob/c76fdd788c0b9a613a5dd883bb02ba2aa0c3b1ba/src/parsers.ts#L148)

Compose a loose reader with a parser or fallback to produce a typed `Reader<T>`.

Used to initialise a reactive property from the current DOM state rather than
from an attribute. Example: `read(ui => ui.input.value, asInteger())` reads the
input's text value, parses it as an integer, and falls back to `0` if missing.

- If the reader returns a `string` and `fallback` is a Parser, the string is parsed.
- Otherwise, the reader's return value is used directly, falling back to `getFallback`.

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### reader

[`LooseReader`](../type-aliases/LooseReader.md)\<`T`, `U`\>

Reads a raw value from the UI object (`T | string | null | undefined`)

##### fallback

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Parser used when the reader returns a string, or static/reader fallback

#### Returns

[`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

A typed reader that always returns `T`

#### Since

0.15.0
