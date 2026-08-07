import { clampChroma, formatCss, inGamut, type Oklch } from 'culori/fn'
import {
	asString,
	batch,
	bindStyle,
	bindText,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
	type FormAssociatedElement,
	formAssociated,
	throttle,
} from '../../..'
import { asOklch } from '../../_common/asOklch'
import { getStepColor } from '../../_common/getStepColor.ts'

export type FormColorgraphAxis = 'l' | 'c' | 'h'

export type FormColorgraphProps = {
	/** Current color as a CSS string (e.g. `oklch(0.48 0.23 263)`). Form value. */
	value: string
	readonly lightness: number
	readonly chroma: number
	readonly hue: number
	stepDown: (axis: FormColorgraphAxis, big?: boolean) => void
	stepUp: (axis: FormColorgraphAxis, big?: boolean) => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-colorgraph': FormAssociatedElement & FormColorgraphProps
	}
}

const parseOklch = asOklch()

const inP3Gamut = inGamut('p3')
const inRGBGamut = inGamut('rgb')
const fn2Digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
	.format
const TRACK_OFFSET = 20 // pixels
const CONTRAST_THRESHOLD = 0.71 // lightness
const AXIS_MAX = { l: 1, c: 0.4, h: 360 }
// Raw-value → axis-spinbutton-display-unit conversion. Only lightness has a
// non-1 scale (displayed as a percentage); min/max/step/big-step for each
// axis live solely on the corresponding form-spinbutton's attributes in the
// HTML — bounds validation and step rounding aren't duplicated here.
const AXIS_SCALE = { l: 100, c: 1, h: 1 }
const AXIS_DECIMALS = { l: 2, c: 4, h: 2 }
const toDisplay = (axis: FormColorgraphAxis, raw: number) => {
	const factor = 10 ** AXIS_DECIMALS[axis]
	return Math.round(raw * AXIS_SCALE[axis] * factor) / factor
}
const fromDisplay = (axis: FormColorgraphAxis, display: number) =>
	display / AXIS_SCALE[axis]

/**
 * An interactive Oklch color editor with sliders for lightness, chroma, and hue.
 * Use it for exploring color spaces — keyboard accessible via Arrow keys on each
 * slider axis, with live preview of the resulting color and out-of-gamut warnings.
 * Out-of-gamut colors should be handled with a fallback, as display coverage varies.
 * Chroma values must stay within the Oklch gamut; extreme values are clamped automatically.
 * Form participation submits one serialized CSS color value via ElementInternals.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-colorgraph} Interactive preview and usage examples
 **/
export default defineComponent<FormColorgraphProps>(
	'form-colorgraph',
	({ expose, first, host, on, watch }) => {
		// Internal Oklch memo derived from the string value (the form value).
		// `value` is the source of truth; `color` is the parsed representation
		// the UI derives from. Interactions write serialized strings back to value.
		const color = createMemo<Oklch>(() => parseOklch(host.value))

		// Commit writes a serialized CSS color string to host.value (the form value).
		const commit = (c: Oklch) => {
			batch(() => {
				host.value = formatCss(c)
				host.setCustomValidity('')
			})
		}
		// Each axis's own <form-spinbutton> already owns bounds validation and
		// step rounding for its (display-scaled) value via its `min`/`max`/
		// `step`/`big-step` attributes (set in the HTML per axis) — stepping
		// an axis just delegates to it and lets the shared 'change' listener
		// below (gamut check + commit) react, instead of reimplementing
		// clamp-and-round here against a second, hand-kept copy of the bounds.
		const axisSpinbuttons = {
			l: first(
				'form-spinbutton.lightness',
				'Add an <form-spinbutton class="lightness"> element to control the lightness of the color.',
			),
			c: first(
				'form-spinbutton.chroma',
				'Add an <form-spinbutton class="chroma"> element to control the chroma of the color.',
			),
			h: first(
				'form-spinbutton.hue',
				'Add an <form-spinbutton class="hue"> element to control the hue of the color.',
			),
		}

		expose({
			value: asString('oklch(0.48 0.23 263)'),
			lightness: () => color.get().l,
			chroma: () => color.get().c,
			hue: () => color.get().h ?? 0,
			stepDown: defineMethod((axis: FormColorgraphAxis, bigStep = false) => {
				axisSpinbuttons[axis].stepDown(bigStep)
			}),
			stepUp: defineMethod((axis: FormColorgraphAxis, bigStep = false) => {
				axisSpinbuttons[axis].stepUp(bigStep)
			}),
		})

		// Host CSS variable
		watch(() => formatCss(color.get()), bindStyle(host, '--color-base'))

		// Synchronize axis spinbuttons with color memo
		for (const axis of ['l', 'c', 'h'] as const) {
			const el = axisSpinbuttons[axis]
			watch(color, c => {
				el.value = toDisplay(axis, c[axis] ?? 0)
			})
			on(el, 'change', () => {
				if (!el.validity.valid) return
				const c = { ...color.get(), [axis]: fromDisplay(axis, el.value) }
				if (inP3Gamut(c)) commit(c)
				else host.setCustomValidity('Color out of gamut')
			})
		}

		// ResizeObserver — runs once at connect, cleanup at disconnect
		const graphEl = first(
			'.graph',
			'Add a <.graph> element as a container for the color graph.',
		)
		const canvasSize = createState(graphEl.getBoundingClientRect().width)

		watch(
			() => graphEl,
			() => {
				const setCanvasSize = throttle((w: number) => {
					canvasSize.set(w)
				})
				const resizeObserver = new ResizeObserver(() => {
					setCanvasSize(graphEl.clientWidth)
				})
				resizeObserver.observe(graphEl)
				return () => {
					resizeObserver.disconnect()
					setCanvasSize.cancel()
				}
			},
		)

		// Graph pointer interaction + canvas size CSS variable
		const canvas = first(
			'.graph canvas',
			'Add a <canvas> element inside the graph to display the lightness/chroma graph.',
		)
		const knob = first(
			'.knob',
			'Add a <.knob> element as a drag knob to control lightness and chroma.',
		)

		const moveKnob = throttle(
			(x: number, y: number, top: number, left: number, size: number) => {
				const c = {
					...color.get(),
					c: Math.min(Math.max((x - left) / size, 0), 1) * AXIS_MAX.c,
					l: 1 - Math.min(Math.max((y - top) / size, 0), 1),
				}
				if (inP3Gamut(c)) commit(c)
			},
		)
		const getColorFromPosition = (
			x: number,
			y: number,
			h: number,
			alpha: number = 1,
		): string =>
			formatCss({
				mode: 'oklch',
				l: 1 - y,
				c: x * AXIS_MAX.c,
				h,
				alpha,
			})

		on(graphEl, 'pointerdown', event => {
			const { top, left } = canvas.getBoundingClientRect()
			const size = canvasSize.get()
			knob.ariaPressed = 'true'
			graphEl.setPointerCapture(event.pointerId)
			const handleMove = (e: PointerEvent) => {
				const last = (e.getCoalescedEvents?.() || []).pop() || e
				moveKnob(last.clientX, last.clientY, top, left, size)
			}
			const handleUp = () => {
				graphEl.removeEventListener('pointermove', handleMove)
				graphEl.removeEventListener('pointerup', handleUp)
				moveKnob.cancel()
				knob.ariaPressed = 'false'
			}
			graphEl.addEventListener('pointermove', handleMove, { passive: true })
			graphEl.addEventListener('pointerup', handleUp)
		})
		watch(() => `${canvasSize.get()}px`, bindStyle(graphEl, '--canvas-size'))

		// Graph canvas: redraw on hue or size change
		watch(
			() => ({ hue: color.get().h ?? 0, n: Math.round(canvasSize.get()) }),
			({ hue, n }) => {
				canvas.width = n
				canvas.height = n
				const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' })
				if (!ctx) return
				const maxChroma = (l: number, gamut: 'rgb' | 'p3' = 'rgb') =>
					clampChroma(
						{ mode: 'oklch', l, c: AXIS_MAX.c, h: hue },
						'oklch',
						gamut,
					).c / AXIS_MAX.c
				const gradientStops = (
					minX: number,
					maxX: number,
					y: number,
					alpha: number = 1,
				): [string, string] => [
					getColorFromPosition(minX, y, hue, alpha),
					getColorFromPosition(maxX, y, hue, alpha),
				]
				const drawGradient = (
					minX: number,
					y: number,
					gamut: 'rgb' | 'p3' = 'rgb',
				): [number, string] => {
					const maxX = maxChroma(1 - y / n, gamut) * n
					const gradient = ctx.createLinearGradient(minX, 0, maxX, 0)
					const stops = gradientStops(
						minX / n,
						maxX / n,
						y / n,
						gamut === 'p3' ? 0.5 : 1,
					)
					gradient.addColorStop(0, stops[0])
					gradient.addColorStop(1, stops[1])
					ctx.fillStyle = gradient
					ctx.fillRect(minX, y, maxX - minX, 1)
					return [maxX, stops[1]]
				}
				ctx.clearRect(0, 0, n, n)
				for (let y = 0; y < n; y++) {
					const [maxRgbX, maxRgbColor] = drawGradient(0, y)
					if (inP3Gamut(maxRgbColor)) drawGradient(maxRgbX, y, 'p3')
				}
			},
		)

		// Knob position
		watch(
			() => ({
				l: color.get().l,
				c: color.get().c,
				size: canvasSize.get(),
			}),
			({ l, c, size }) => {
				knob.style.setProperty('top', `${Math.round((1 - l) * size)}px`)
				knob.style.setProperty(
					'left',
					`${Math.round((c * size) / AXIS_MAX.c)}px`,
				)
				knob.style.setProperty(
					'--color-border',
					l > CONTRAST_THRESHOLD ? 'black' : 'white',
				)
			},
		)

		// Hue slider pointer interaction + ARIA + CSS variable
		const trackWidth = createMemo(() => canvasSize.get() - 2 * TRACK_OFFSET)
		const sliderEl = first(
			'.slider',
			'Add a <.slider> element as a container for track and thumb.',
		)
		const track = first(
			'.slider canvas',
			'Add a <canvas> element inside the slider to display the hue slider track.',
		)
		const thumb = first(
			'.thumb',
			'Add a <.thumb> element as a drag knob to control the hue.',
		)
		sliderEl.setAttribute('aria-valuemin', '0')
		sliderEl.setAttribute('aria-valuemax', '360')

		const moveThumb = throttle((x: number, left: number, width: number) => {
			const c = {
				...color.get(),
				h: Math.min(Math.max((x - left) / width, 0), 1) * AXIS_MAX.h,
			}
			if (inP3Gamut(c)) commit(c)
		})
		const getHueFromPosition = (x: number): Oklch => {
			const newColor = { ...color.get(), h: x * AXIS_MAX.h }
			if (inRGBGamut(newColor)) return newColor
			if (inP3Gamut(newColor)) newColor.alpha = 0.5
			else newColor.alpha = 0
			return newColor
		}
		const getAxis = (target: HTMLElement): FormColorgraphAxis | null => {
			if (target.closest('.lightness')) return 'l'
			if (target.closest('.chroma')) return 'c'
			if (target.closest('.hue')) return 'h'
			return null
		}

		on(sliderEl, 'pointerdown', event => {
			const left = track.getBoundingClientRect().left
			const width = trackWidth.get()
			thumb.ariaPressed = 'true'
			sliderEl.setPointerCapture(event.pointerId)
			const handleMove = (e: PointerEvent) => {
				const last = (e.getCoalescedEvents?.() || []).pop() || e
				moveThumb(last.clientX, left, width)
			}
			const handleUp = () => {
				sliderEl.removeEventListener('pointermove', handleMove)
				sliderEl.removeEventListener('pointerup', handleUp)
				moveThumb.cancel()
				thumb.ariaPressed = 'false'
			}
			sliderEl.addEventListener('pointermove', handleMove, { passive: true })
			sliderEl.addEventListener('pointerup', handleUp)
		})
		watch(() => `${trackWidth.get()}px`, bindStyle(sliderEl, '--track-width'))
		watch(color, c => {
			const hue = c.h ?? 0
			sliderEl.setAttribute('aria-valuenow', String(hue))
			sliderEl.setAttribute('aria-valuetext', `${fn2Digits(hue)}°`)
		})

		// Track canvas: redraw on color or track width change
		watch(
			() => ({ c: color.get(), n: Math.round(trackWidth.get()) }),
			({ n }) => {
				track.width = n
				const ctx = track.getContext('2d', { colorSpace: 'display-p3' })
				if (!ctx) return
				ctx.clearRect(0, 0, n, 1)
				for (let x = 0; x < n; x++) {
					ctx.fillStyle = formatCss(getHueFromPosition(x / n))
					ctx.fillRect(x, 0, 1, 1)
				}
			},
		)

		// Thumb position
		watch(
			() => ({
				hue: color.get().h ?? 0,
				l: color.get().l,
				tw: trackWidth.get(),
			}),
			({ hue, l, tw }) => {
				thumb.style.setProperty(
					'left',
					`${Math.round((hue * tw) / AXIS_MAX.h) + TRACK_OFFSET}px`,
				)
				thumb.style.setProperty(
					'--color-border',
					l > CONTRAST_THRESHOLD ? 'black' : 'white',
				)
			},
		)

		// Keyboard navigation
		on(host, 'keydown', event => {
			const { key, shiftKey } = event as KeyboardEvent
			const target = (event as KeyboardEvent).target as HTMLElement | null
			if (
				!target ||
				(target.localName === 'input' &&
					(key === 'ArrowLeft' || key === 'ArrowRight'))
			)
				return
			if (key.substring(0, 5) === 'Arrow' || ['+', '-'].includes(key)) {
				event.preventDefault()
				event.stopPropagation()
				const axis = getAxis(target)
				if (axis) {
					if (key === 'ArrowLeft' || key === 'ArrowDown' || key === '-')
						host.stepDown(axis, shiftKey)
					else if (key === 'ArrowRight' || key === 'ArrowUp' || key === '+')
						host.stepUp(axis, shiftKey)
				} else if (target.role === 'slider') {
					if (key === 'ArrowLeft' || key === 'ArrowDown' || key === '-')
						host.stepDown('h', shiftKey)
					else if (key === 'ArrowRight' || key === 'ArrowUp' || key === '+')
						host.stepUp('h', shiftKey)
				} else {
					switch (key) {
						case 'ArrowDown':
							host.stepDown('l', shiftKey)
							break
						case 'ArrowUp':
							host.stepUp('l', shiftKey)
							break
						case 'ArrowLeft':
							host.stepDown('c', shiftKey)
							break
						case 'ArrowRight':
							host.stepUp('c', shiftKey)
							break
						case '-':
							host.stepDown('h')
							break
						case '+':
							host.stepUp('h')
							break
					}
				}
			}
		})

		const setStepPosition = (target: HTMLLIElement, color: Oklch): void => {
			const size = canvasSize.get()
			const x = Math.round((color.c * size) / AXIS_MAX.c)
			const y = Math.round((1 - color.l) * size)
			target.style.setProperty('background-color', formatCss(color))
			target.style.setProperty(
				'border-color',
				color.l > CONTRAST_THRESHOLD ? 'black' : 'white',
			)
			target.style.setProperty('left', `${x}px`)
			target.style.setProperty('top', `${y}px`)
		}

		for (let i = 1; i < 5; i++) {
			const li = first(`li.lighten${(5 - i) * 20}`)
			if (li)
				watch(
					() => ({ c: color.get(), size: canvasSize.get() }),
					({ c }) => {
						setStepPosition(li, getStepColor(c, 1 - i / 10))
					},
				)
		}
		for (let i = 1; i < 5; i++) {
			const li = first(`li.darken${i * 20}`)
			if (li)
				watch(
					() => ({ c: color.get(), size: canvasSize.get() }),
					({ c }) => {
						setStepPosition(li, getStepColor(c, 1 - (i + 5) / 10))
					},
				)
		}

		// Error text — one shared .error element watches the reactive
		// validationMessage prop directly for the joint gamut constraint.
		const errorEl = first('.error')
		if (errorEl) watch('validationMessage', bindText(errorEl))
	},
	[formAssociated()],
)
