### Function: safeSetAttribute()

> **safeSetAttribute**(`element`, `attr`, `value`): `void`

Defined in: [src/safety.ts:40](https://github.com/zeixcom/le-truc/blob/90149bb8885c2e678e7571c228e4005108709147/src/safety.ts#L40)

Set an attribute on an element with security validation.

Blocks `on*` event handler attributes and validates URL-like values against
a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`).
Violations throw a descriptive error — they are never silent.

#### Parameters

##### element

`Element`

Target element

##### attr

`string`

Attribute name to set

##### value

`string`

Attribute value to set

#### Returns

`void`

#### Since

1.1
