### Function: safeSetAttribute()

> **safeSetAttribute**(`element`, `attr`, `value`): `void`

Defined in: [src/bindings.ts:112](https://github.com/zeixcom/le-truc/blob/62831a486b22055e2f0aae8a1bc13f5e79ffdffc/src/bindings.ts#L112)

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
