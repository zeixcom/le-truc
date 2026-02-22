### Context Media

A context provider that exposes live media query state to descendant components via the W3C Context Protocol. Demonstrates using initializer functions that return a `createState()` signal (rather than a static value or parser) to wire `MediaQueryList` change events into reactive properties, reading `host` attributes inside a property initializer to configure breakpoints before any effects run, and using `provideContexts()` as the sole effect to broadcast all four properties (`MEDIA_MOTION`, `MEDIA_THEME`, `MEDIA_VIEWPORT`, `MEDIA_ORIENTATION`) as typed `Context` tokens that consumers can request with `requestContext()`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Context Media source code" src="./sources/context-media.html" /%}
{% sources title="Card Mediaqueries source code" src="./sources/card-mediaqueries.html" /%}
{% /demo %}

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `motion`
* `'no-preference' | 'reduce'`
* `'no-preference'`
* Motion preference for `prefers-reduced-motion`
---
* `theme`
* `'light' | 'dark'`
* `'light'`
* Theme preference for `prefers-color-scheme`
---
* `viewport`
* `'xs' | 'sm' | 'md' | 'lg' | 'xl'`
* `'xs'`
* Media query for `min-width` according to viewport definitions from attributes
---
* `orientation`
* `'portrait' | 'landscape'`
* `'portrait'`
* Media query for `orientation`
{% /table %}

#### Attributes

The following attributes are parsed to define `min-width`s of viewport sizes:

| Name | Default          | Description |
| ---  | ---              | ---         |
| `sm` | `32em` (512px)   | Small       |
| `md` | `48em` (768px)   | Medium      |
| `lg` | `72em` (1152px)  | Large       |
| `xl` | `104em` (1664px) | Extra large |

#### Provided Contexts

{% table %}
* Name
* Type
* Default
* Description
---
* `MEDIA_MOTION`
* `'no-preference' | 'reduce'`
* `'no-preference'`
* Motion preference for `prefers-reduced-motion`
---
* `MEDIA_THEME`
* `'light' | 'dark'`
* `'light'`
* Theme preference for `prefers-color-scheme`
---
* `MEDIA_VIEWPORT`
* `'xs' | 'sm' | 'md' | 'lg' | 'xl'`
* `'xs'`
* Media query for `min-width` according to viewport definitions from attributes
---
* `MEDIA_ORIENTATION`
* `'portrait' | 'landscape'`
* `'portrait'`
* Media query for `orientation`
{% /table %}

#### Descendant Elements

Arbitrary HTML with one or many context consumers.
