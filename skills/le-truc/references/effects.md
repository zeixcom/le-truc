<overview>
Which Le Truc effect to use for each DOM update pattern.
All effects are imported from `@zeix/le-truc`.
</overview>

## Choosing an effect

| Goal | Effect |
|---|---|
| Set text content of an element | `setText` |
| Set a DOM property (`.value`, `.checked`, `.disabled`, …) | `setProperty` |
| Show or hide an element | `show` |
| Set an HTML attribute (with security validation) | `setAttribute` |
| Toggle a boolean attribute (present/absent) | `toggleAttribute` |
| Add or remove a CSS class | `toggleClass` |
| Set an inline style property | `setStyle` |
| Attach an event listener | `on` |
| Bind a Le Truc child component's prop to a parent signal | `pass` |
| Set innerHTML (use sparingly) | `dangerouslySetInnerHTML` |

## Effect reference

### `setText(reactive?)`

Replaces the non-comment child nodes of an element with a text node.

```typescript
// defaults to reading host.label
label: setText('label')

// explicit reactive: a signal
label: setText(mySignal)

// explicit reactive: a reader function
label: setText(el => el.dataset.value ?? 'fallback')
```

### `setProperty(key, reactive?)`

Sets a DOM property directly (bypasses attribute reflection). Use for `.disabled`, `.checked`, `.value`, `.hidden`, and any other IDL attribute.

```typescript
// reads host.disabled
button: setProperty('disabled')

// different property name from prop name
input: setProperty('value', 'inputText')
```

### `show(reactive?)`

Shorthand for `setProperty('hidden', ...)` with inverted logic. When the reactive value is truthy the element is visible (`hidden = false`).

```typescript
// shows the spinner when host.loading is true
spinner: show('loading')
```

### `setAttribute(name, reactive?)`

Sets an attribute with security validation. Blocks `on*` event-handler attributes. Validates URL values against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`).

```typescript
// reads host.href
link: setAttribute('href')

// different prop name
link: setAttribute('href', 'url')
```

### `toggleAttribute(name, reactive?)`

Adds the attribute when truthy, removes it when falsy. Default reactive is the attribute name.

```typescript
// adds/removes the `disabled` attribute based on host.disabled
button: toggleAttribute('disabled')

// adds/removes `aria-expanded` based on host.open
trigger: toggleAttribute('aria-expanded', 'open')
```

### `toggleClass(token, reactive?)`

Adds `token` to the element's class list when truthy, removes it when falsy. Default reactive is the token name.

```typescript
// adds/removes class "active" based on host.active
item: toggleClass('active')

// adds/removes class "is-open" based on host.open
panel: toggleClass('is-open', 'open')
```

### `setStyle(property, reactive?)`

Sets an inline CSS property. Pass `null` to remove the property. Default reactive is the property name.

```typescript
// sets style.opacity based on host.opacity
overlay: setStyle('opacity')

// custom property
card: setStyle('--highlight-color', 'accentColor')
```

### `on(type, handler, options?)`

Attaches an event listener to the target element. The handler receives the DOM event.

Two handler return modes:

```typescript
// Side-effect only — always valid
button: on('click', (e) => {
  analytics.track('clicked')
})

// Property update shortcut — applied in a single batch()
button: on('click', () => ({ count: host.count + 1 }))

// Passive events (scroll, resize, touch, wheel) are deferred via rAF automatically
container: on('scroll', (e) => { /* handle */ })
```

The return-object shortcut is equivalent to:
```typescript
on('click', () => { batch(() => { host.count = host.count + 1 }) })
```

Options passed to `addEventListener`. `passive` is set automatically for high-frequency events.

### `pass(props)`

Le Truc-to-Le Truc only. Replaces the backing signal of a descendant component's prop with a signal from the parent. Zero overhead — no intermediate effect or property assignment.

```typescript
// in parent setup
({ host }) => ({
  'child-component': pass({ disabled: host_signal }),
})
```

**Use `setProperty()` instead for non-Le-Truc elements** (Lit, Stencil, plain custom elements).

### `dangerouslySetInnerHTML(reactive, options?)`

Sets `innerHTML`. Never use on untrusted or user-generated content.

```typescript
codeBlock: dangerouslySetInnerHTML('highlightedHtml')
```

## Reactive parameter forms

Every `updateElement`-based effect accepts a `reactive` parameter in three forms:

| Form | Example | Behavior |
|---|---|---|
| `keyof Props` string | `'label'` | Reads `host.label`; registers signal dependency |
| Signal | `myMemo` | Calls `signal.get()`; registers dependency |
| Reader function | `el => el.dataset.val` | Calls function with target element; not tracked unless it reads a signal |

The second argument may be omitted when the prop name matches the attribute/property/class name being updated.

## Multiple effects on one element

Return an array:

```typescript
input: [
  setProperty('value'),
  toggleAttribute('disabled'),
  toggleClass('error', 'hasError'),
]
```
