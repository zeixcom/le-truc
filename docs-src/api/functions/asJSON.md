### Function: asJSON()

> **asJSON**\<`T`\>(`fallback`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/parsers/json.ts:18](https://github.com/zeixcom/le-truc/blob/4098d5791c279825fcbaa4a549a14c3639e84375/src/parsers/json.ts#L18)

Parse a string as a JSON serialized object with a fallback

Reserved words (`__proto__`, `constructor`, …, see `RESERVED_WORDS`) are
dropped from the parsed result at every nesting level via a `JSON.parse`
reviver, so a crafted payload can't plant an own `__proto__`/`constructor`
property that later corrupts a host's prototype chain (defense-in-depth
alongside the runtime guard in `#initSignals`).

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### fallback

`T`

Fallback value

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`T`\>

Parser function

#### Since

0.11.0

#### Throws

If the value and fallback are both null or undefined

#### Throws

If value is not a valid JSON string
