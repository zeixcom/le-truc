### Type Alias: TrustedHTML

> **TrustedHTML** = `object`

Defined in: [src/bindings.ts:13](https://github.com/zeixcom/le-truc/blob/4745f51b23182fae3c5af6979d02c4ed2b72bcbb/src/bindings.ts#L13)

Structural shape of the DOM's `TrustedHTML` type (Trusted Types API).
Declared locally because `lib.dom.d.ts` does not yet ship this type in every
environment — structural typing means the real DOM `TrustedHTML` (e.g. from
`window.trustedTypes.createPolicy(...).createHTML(...)`, or a sanitizer
configured with `RETURN_TRUSTED_HTML: true`) satisfies it.

#### Methods

##### toJSON()

> **toJSON**(): `string`

Defined in: [src/bindings.ts:13](https://github.com/zeixcom/le-truc/blob/4745f51b23182fae3c5af6979d02c4ed2b72bcbb/src/bindings.ts#L13)

###### Returns

`string`
