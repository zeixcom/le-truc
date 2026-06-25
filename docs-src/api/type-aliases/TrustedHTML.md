### Type Alias: TrustedHTML

> **TrustedHTML** = `object`

Defined in: [src/bindings.ts:13](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/bindings.ts#L13)

Structural shape of the DOM's `TrustedHTML` type (Trusted Types API).
Declared locally because `lib.dom.d.ts` does not yet ship this type in every
environment — structural typing means the real DOM `TrustedHTML` (e.g. from
`window.trustedTypes.createPolicy(...).createHTML(...)`, or a sanitizer
configured with `RETURN_TRUSTED_HTML: true`) satisfies it.

#### Methods

##### toJSON()

> **toJSON**(): `string`

Defined in: [src/bindings.ts:13](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/bindings.ts#L13)

###### Returns

`string`
