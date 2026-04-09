### Function: safeSetAttribute()

> **safeSetAttribute**(`element`, `attr`, `value`): `void`

Defined in: [src/safety.ts:31](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/safety.ts#L31)

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
