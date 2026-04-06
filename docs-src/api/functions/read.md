### ~~Function: read()~~

> **read**\<`T`, `U`\>(`reader`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

Defined in: [src/parsers.ts:150](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/parsers.ts#L150)

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

#### Deprecated

Use a closure capturing the queried DOM element directly inside the v1.1 factory,
e.g. `value: asInteger()({} as any, input.value)` or a Reader `() => parseInt(input.value, 10)`.

#### Since

0.15.0
