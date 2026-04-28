### Form Colorgraph

An interactive OKLCH color picker combining a 2D lightness/chroma graph, a hue slider, and numeric inputs. Demonstrates `defineMethod()` for the `stepDown`/`stepUp` API, `createState()` and `createMemo()` for internal canvas sizing, `each()` for per-element effects on decrement/increment buttons and error messages, `throttle()` for pointer move handlers, a `ResizeObserver` managed inside `watch()` with a cleanup return value, and `bindStyle()` for CSS variable bindings. All pointer and keyboard interactions update `host.color` via a shared `commit()` helper that batch-clears errors.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-colorgraph.html" /%}
{% /demo %}

#### Tag Name

`form-colorgraph`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `color`
- `Oklch`
- `asOklch()` — parsed from `color` attribute
- The selected color in OKLCH space
---
- `lightness`
- `number` (readonly)
- Derived from `color.l`
- Lightness component (0–1)
---
- `chroma`
- `number` (readonly)
- Derived from `color.c`
- Chroma component (0–0.4)
---
- `hue`
- `number` (readonly)
- Derived from `color.h`
- Hue angle in degrees (0–360)
{% /table %}

#### Methods

{% table %}
- Name
- Type
- Description
---
- `stepDown`
- `(axis: 'l' \| 'c' \| 'h', bigStep?: boolean) => void`
- Decrements the given axis by one step (or a large step when `bigStep` is `true` or Shift is held)
---
- `stepUp`
- `(axis: 'l' \| 'c' \| 'h', bigStep?: boolean) => void`
- Increments the given axis by one step (or a large step when `bigStep` is `true` or Shift is held)
{% /table %}

#### Keyboard Interaction

Arrow keys navigate the focused axis. When the graph area is focused: `ArrowUp`/`ArrowDown` adjust lightness, `ArrowLeft`/`ArrowRight` adjust chroma. On the hue slider: `ArrowLeft`/`ArrowRight` adjust hue. `+`/`-` adjust hue from anywhere. Hold Shift for large steps.

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('.graph')`
- `HTMLElement`
- **required**
- Container for the lightness/chroma canvas; observed by `ResizeObserver`
---
- `first('.graph canvas')`
- `HTMLCanvasElement`
- **required**
- Renders the 2D lightness/chroma color gamut; redrawn on hue or size change
---
- `first('.slider')`
- `HTMLElement`
- **required**
- Hue slider container; acts as ARIA `role="slider"`
---
- `first('.slider canvas')`
- `HTMLCanvasElement`
- **required**
- Renders the hue track gradient
---
- `first('.knob')`
- `HTMLElement`
- **required**
- Draggable knob controlling lightness and chroma
---
- `first('.thumb')`
- `HTMLElement`
- **required**
- Draggable thumb controlling hue
---
- `first('input[name="lightness"]')`
- `HTMLInputElement`
- **required**
- Numeric input for lightness (0–100)
---
- `first('input[name="chroma"]')`
- `HTMLInputElement`
- **required**
- Numeric input for chroma (0–0.4)
---
- `first('input[name="hue"]')`
- `HTMLInputElement`
- **required**
- Numeric input for hue angle (0–360)
---
- `all('button.decrement')`
- `HTMLButtonElement[]`
- optional
- Decrement buttons; nearest `.lightness`/`.chroma`/`.hue` ancestor determines axis
---
- `all('button.increment')`
- `HTMLButtonElement[]`
- optional
- Increment buttons; nearest `.lightness`/`.chroma`/`.hue` ancestor determines axis
---
- `all('.error')`
- `HTMLElement[]`
- optional
- Validation error targets; nearest axis ancestor determines which error state they display
{% /table %}
