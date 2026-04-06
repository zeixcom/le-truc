### Class: ContextRequestEvent\<T\>

Defined in: [src/context.ts:78](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/context.ts#L78)

Class for context-request events

An event fired by a context requester to signal it desires a named context.

A provider should inspect the `context` property of the event to determine if it has a value that can
satisfy the request, calling the `callback` with the requested value if so.

If the requested context event contains a truthy `subscribe` value, then a provider can call the callback
multiple times if the value is changed, if this is the case the provider should pass an `unsubscribe`
function to the callback which requesters can invoke to indicate they no longer wish to receive these updates.

 ContextRequestEvent

#### Extends

- `Event`

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](../type-aliases/UnknownContext.md)

#### Constructors

##### Constructor

> **new ContextRequestEvent**\<`T`\>(`context`, `callback`, `subscribe?`): `ContextRequestEvent`\<`T`\>

Defined in: [src/context.ts:83](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/context.ts#L83)

###### Parameters

##### context

`T`

##### callback

[`ContextCallback`](../type-aliases/ContextCallback.md)\<[`ContextType`](../type-aliases/ContextType.md)\<`T`\>\>

##### subscribe?

`boolean` = `false`

###### Returns

`ContextRequestEvent`\<`T`\>

###### Overrides

`Event.constructor`

#### Properties

##### AT\_TARGET

> `readonly` **AT\_TARGET**: `2`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14273

###### Inherited from

`Event.AT_TARGET`

***

##### bubbles

> `readonly` **bubbles**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14164

The **`bubbles`** read-only property of the Event interface indicates whether the event bubbles up through the DOM tree or not.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)

###### Inherited from

`ContextRequestEvent`.[`bubbles`](#bubbles)

***

##### BUBBLING\_PHASE

> `readonly` **BUBBLING\_PHASE**: `3`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14274

###### Inherited from

`Event.BUBBLING_PHASE`

***

##### callback

> `readonly` **callback**: [`ContextCallback`](../type-aliases/ContextCallback.md)\<[`ContextType`](../type-aliases/ContextType.md)\<`T`\>\>

Defined in: [src/context.ts:80](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/context.ts#L80)

callback function for value getter and unsubscribe function

***

##### cancelable

> `readonly` **cancelable**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14177

The **`cancelable`** read-only property of the Event interface indicates whether the event can be canceled, and therefore prevented as if the event never happened.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)

###### Inherited from

`ContextRequestEvent`.[`cancelable`](#cancelable)

***

##### ~~cancelBubble~~

> **cancelBubble**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14171

The **`cancelBubble`** property of the Event interface is deprecated. Use Event.stopPropagation() instead. Setting its value to true before returning from an event handler prevents propagation of the event. In later implementations, setting this to false does nothing. See Browser compatibility for details.

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)

###### Inherited from

`ContextRequestEvent`.[`cancelBubble`](#cancelbubble)

***

##### CAPTURING\_PHASE

> `readonly` **CAPTURING\_PHASE**: `1`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14272

###### Inherited from

`Event.CAPTURING_PHASE`

***

##### composed

> `readonly` **composed**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14183

The read-only **`composed`** property of the Event interface returns a boolean value which indicates whether or not the event will propagate across the shadow DOM boundary into the standard DOM.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)

###### Inherited from

`ContextRequestEvent`.[`composed`](#composed)

***

##### context

> `readonly` **context**: `T`

Defined in: [src/context.ts:79](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/context.ts#L79)

context key

***

##### currentTarget

> `readonly` **currentTarget**: `EventTarget` \| `null`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14189

The **`currentTarget`** read-only property of the Event interface identifies the element to which the event handler has been attached.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)

###### Inherited from

`ContextRequestEvent`.[`currentTarget`](#currenttarget)

***

##### defaultPrevented

> `readonly` **defaultPrevented**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14195

The **`defaultPrevented`** read-only property of the Event interface returns a boolean value indicating whether or not the call to Event.preventDefault() canceled the event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)

###### Inherited from

`ContextRequestEvent`.[`defaultPrevented`](#defaultprevented)

***

##### eventPhase

> `readonly` **eventPhase**: `number`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14201

The **`eventPhase`** read-only property of the Event interface indicates which phase of the event flow is currently being evaluated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)

###### Inherited from

`ContextRequestEvent`.[`eventPhase`](#eventphase)

***

##### isTrusted

> `readonly` **isTrusted**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14207

The **`isTrusted`** read-only property of the Event interface is a boolean value that is true when the event was generated by the user agent (including via user actions and programmatic methods such as HTMLElement.focus()), and false when the event was dispatched via EventTarget.dispatchEvent(). The only exception is the click event, which initializes the isTrusted property to false in user agents.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)

###### Inherited from

`ContextRequestEvent`.[`isTrusted`](#istrusted)

***

##### NONE

> `readonly` **NONE**: `0`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14271

###### Inherited from

`Event.NONE`

***

##### ~~returnValue~~

> **returnValue**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14214

The Event property **`returnValue`** indicates whether the default action for this event has been prevented or not.

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)

###### Inherited from

`ContextRequestEvent`.[`returnValue`](#returnvalue)

***

##### ~~srcElement~~

> `readonly` **srcElement**: `EventTarget` \| `null`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14221

The deprecated **`Event.srcElement`** is an alias for the Event.target property. Use Event.target instead.

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)

###### Inherited from

`ContextRequestEvent`.[`srcElement`](#srcelement)

***

##### subscribe

> `readonly` **subscribe**: `boolean`

Defined in: [src/context.ts:81](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/context.ts#L81)

whether to subscribe to context changes

***

##### target

> `readonly` **target**: `EventTarget` \| `null`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14227

The read-only **`target`** property of the Event interface is a reference to the object onto which the event was dispatched. It is different from Event.currentTarget when the event handler is called during the bubbling or capturing phase of the event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)

###### Inherited from

`ContextRequestEvent`.[`target`](#target)

***

##### timeStamp

> `readonly` **timeStamp**: `number`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14233

The **`timeStamp`** read-only property of the Event interface returns the time (in milliseconds) at which the event was created.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)

###### Inherited from

`ContextRequestEvent`.[`timeStamp`](#timestamp)

***

##### type

> `readonly` **type**: `string`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14239

The **`type`** read-only property of the Event interface returns a string containing the event's type. It is set when the event is constructed and is the name commonly used to refer to the specific event, such as click, load, or error.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)

###### Inherited from

`ContextRequestEvent`.[`type`](#type)

***

##### AT\_TARGET

> `readonly` `static` **AT\_TARGET**: `2`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14282

###### Inherited from

`Event.AT_TARGET`

***

##### BUBBLING\_PHASE

> `readonly` `static` **BUBBLING\_PHASE**: `3`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14283

###### Inherited from

`Event.BUBBLING_PHASE`

***

##### CAPTURING\_PHASE

> `readonly` `static` **CAPTURING\_PHASE**: `1`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14281

###### Inherited from

`Event.CAPTURING_PHASE`

***

##### NONE

> `readonly` `static` **NONE**: `0`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14280

###### Inherited from

`Event.NONE`

#### Methods

##### composedPath()

###### Call Signature

> **composedPath**(): `EventTarget`[]

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14245

The **`composedPath()`** method of the Event interface returns the event's path which is an array of the objects on which listeners will be invoked. This does not include nodes in shadow trees if the shadow root was created with its ShadowRoot.mode closed.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)

##### Returns

`EventTarget`[]

##### Inherited from

`Event.composedPath`

###### Call Signature

> **composedPath**(): \[`EventTarget`?\]

Defined in: node\_modules/bun-types/globals.d.ts:269

Returns an array containing the current EventTarget as the only entry or empty if the event is not being dispatched. This is not used in Node.js and is provided purely for completeness.

##### Returns

\[`EventTarget`?\]

##### Inherited from

`Event.composedPath`

***

##### ~~initEvent()~~

> **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14252

The **`Event.initEvent()`** method is used to initialize the value of an event created using Document.createEvent().

###### Parameters

##### type

`string`

##### bubbles?

`boolean`

##### cancelable?

`boolean`

###### Returns

`void`

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

###### Inherited from

`Event.initEvent`

***

##### preventDefault()

###### Call Signature

> **preventDefault**(): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14258

The **`preventDefault()`** method of the Event interface tells the user agent that the event is being explicitly handled, so its default action, such as page scrolling, link navigation, or pasting text, should not be taken.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

##### Returns

`void`

##### Inherited from

`Event.preventDefault`

###### Call Signature

> **preventDefault**(): `void`

Defined in: node\_modules/bun-types/globals.d.ts:279

Sets the `defaultPrevented` property to `true` if `cancelable` is `true`.

##### Returns

`void`

##### Inherited from

`Event.preventDefault`

***

##### stopImmediatePropagation()

###### Call Signature

> **stopImmediatePropagation**(): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14264

The **`stopImmediatePropagation()`** method of the Event interface prevents other listeners of the same event from being called.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

##### Returns

`void`

##### Inherited from

`Event.stopImmediatePropagation`

###### Call Signature

> **stopImmediatePropagation**(): `void`

Defined in: node\_modules/bun-types/globals.d.ts:285

Stops the invocation of event listeners after the current one completes.

##### Returns

`void`

##### Inherited from

`Event.stopImmediatePropagation`

***

##### stopPropagation()

###### Call Signature

> **stopPropagation**(): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:14270

The **`stopPropagation()`** method of the Event interface prevents further propagation of the current event in the capturing and bubbling phases. It does not, however, prevent any default behaviors from occurring; for instance, clicks on links are still processed. If you want to stop those behaviors, see the preventDefault() method. It also does not prevent propagation to other event-handlers of the current element. If you want to stop those, see stopImmediatePropagation().

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

##### Returns

`void`

##### Inherited from

`Event.stopPropagation`

###### Call Signature

> **stopPropagation**(): `void`

Defined in: node\_modules/bun-types/globals.d.ts:287

This is not used in Node.js and is provided purely for completeness.

##### Returns

`void`

##### Inherited from

`Event.stopPropagation`
