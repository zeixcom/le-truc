import { clampChroma, formatCss, inGamut, type Oklch } from 'culori/fn'
import {
	batch,
	bindStyle,
	bindText,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
	each,
	throttle,
} from '../../..'
import { asOklch } from '../../_common/asOklch.ts'
import { getStepColor } from '../../_common/getStepColor.ts'

export type FormColorgraphAxis = 'l' | 'c' | 'h'

export type FormColorgraphProps = {
	color: Oklch
	readonly lightness: number
	readonly chroma: number
	readonly hue: number
	stepDown: (axis: FormColorgraphAxis, bigStep?: boolean) => void
	stepUp: (axis: FormColorgraphAxis, bigStep?: boolean) => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-colorgraph': HTMLElement & FormColorgraphProps
	}
}

const inP3Gamut = inGamut('p3')
const inRGBGamut = inGamut('rgb')
const fn2Digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
	.format
const fn4Digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })
	.format
const TRACK_OFFSET = 20 // pixels
const CONTRAST_THRESHOLD = 0.71 // lightness
const AXIS_MAX = { l: 1, c: 0.4, h: 360 }
const AXIS_STEP = { l: 0.0025, c: 0.001, h: 1 }
const AXIS_BIGSTEP = { l: 0.05, c: 0.02, h: 15 }
const getStep = (axis: FormColorgraphAxis, shiftKey: boolean) =>
	shiftKey ? AXIS_BIGSTEP[axis] : AXIS_STEP[axis]

export default defineComponent<FormColorgraphProps>(
	'form-colorgraph',
	({ all, expose, first, host, on, watch }) => {
		// Required elements
		const inputs = {
			l: first(
				'input[name="lightness"]',
				'Add an <input[name="lightness"]> element to control the lightness of the color.',
			),
			c: first(
				'input[name="chroma"]',
				'Add an <input[name="chroma"]> element to control the chroma of the color.',
			),
			h: first(
				'input[name="hue"]',
				'Add an <input[name="hue"]> element to control the hue of the color.',
			),
		}
		const graphEl = first(
			'.graph',
			'Add a <.graph> element as a container for the color graph.',
		)
		const canvas = first(
			'.graph canvas',
			'Add a <canvas> element inside the graph to display the lightness/chroma graph.',
		)
		const sliderEl = first(
			'.slider',
			'Add a <.slider> element as a container for track and thumb.',
		)
		const track = first(
			'.slider canvas',
			'Add a <canvas> element inside the slider to display the hue slider track.',
		) as HTMLCanvasElement
		const knob = first(
			'.knob',
			'Add a <.knob> element as a drag knob to control lightness and chroma.',
		)
		const thumb = first(
			'.thumb',
			'Add a <.thumb> element as a drag knob to control the hue.',
		)
		const allInputs = all('input')
		const allErrors = all('.error')
		const decrementBtns = all('button.decrement')
		const incrementBtns = all('button.increment')

		// Initialize
		for (const [key, input] of Object.entries(inputs)) {
			input.min = '0'
			input.max = key === 'l' ? '100' : key === 'c' ? '0.4' : '360'
			input.step = 'any'
		}
		sliderEl.setAttribute('aria-valuemin', '0')
		sliderEl.setAttribute('aria-valuemax', '360')

		// Internal states
		const canvasSize = createState(graphEl.getBoundingClientRect().width)
		const trackWidth = createMemo(() => canvasSize.get() - 2 * TRACK_OFFSET)
		const errors = {
			l: createState(''),
			c: createState(''),
			h: createState(''),
		}

		// Helper functions
		const formatNumber = (axis: FormColorgraphAxis, value: number) => {
			const v = axis === 'l' ? value * 100 : value
			return axis === 'c' ? fn4Digits(v) : fn2Digits(v)
		}
		const getAxis = (target: HTMLElement): FormColorgraphAxis | null => {
			if (target.closest('.lightness')) return 'l'
			if (target.closest('.chroma')) return 'c'
			if (target.closest('.hue')) return 'h'
			return null
		}
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
		const getHueFromPosition = (x: number): Oklch => {
			const newColor = { ...host.color, h: x * AXIS_MAX.h }
			if (inRGBGamut(newColor)) return newColor
			if (inP3Gamut(newColor)) newColor.alpha = 0.5
			else newColor.alpha = 0
			return newColor
		}
		const commit = (color: Oklch) => {
			batch(() => {
				host.color = color
				for (const key of ['l', 'c', 'h'])
					errors[key as keyof typeof errors].set('')
			})
		}
		const getValue = (axis: FormColorgraphAxis) =>
			axis === 'l' ? host.lightness : axis === 'c' ? host.chroma : host.hue
		const setToNearestStep = (axis: FormColorgraphAxis, value: number) => {
			const nearest = Math.round(value / AXIS_STEP[axis]) * AXIS_STEP[axis]
			if (nearest < 0 || nearest > AXIS_MAX[axis]) return
			const color = { ...host.color, [axis]: nearest }
			if (inP3Gamut(color)) {
				commit(color)
			} else {
				inputs[axis].setCustomValidity('Color out of gamut')
				errors[axis].set(inputs[axis].validationMessage)
			}
		}
		const moveKnob = throttle(
			(x: number, y: number, top: number, left: number, size: number) => {
				const color = {
					...host.color,
					c: Math.min(Math.max((x - left) / size, 0), 1) * AXIS_MAX.c,
					l: 1 - Math.min(Math.max((y - top) / size, 0), 1),
				}
				if (inP3Gamut(color)) commit(color)
			},
		)
		const moveThumb = throttle((x: number, left: number, width: number) => {
			const color = {
				...host.color,
				h: Math.min(Math.max((x - left) / width, 0), 1) * AXIS_MAX.h,
			}
			if (inP3Gamut(color)) commit(color)
		})

		expose({
			color: asOklch(),
			lightness: () => host.color.l,
			chroma: () => host.color.c,
			hue: () => host.color.h ?? 0,
			stepDown: defineMethod((axis: FormColorgraphAxis, bigStep = false) => {
				setToNearestStep(axis, getValue(axis) - getStep(axis, bigStep))
			}),
			stepUp: defineMethod((axis: FormColorgraphAxis, bigStep = false) => {
				setToNearestStep(axis, getValue(axis) + getStep(axis, bigStep))
			}),
		})

		const effects = [
			// ResizeObserver — runs once at connect, cleanup at disconnect
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
			),

			// Host CSS variable
			watch(() => formatCss(host.color), bindStyle(host, '--color-base')),

			// Input per-element effects
			each(allInputs, input => {
				const axis = getAxis(input)
				return [
					axis &&
						watch(errors[axis], error => {
							input.ariaInvalid = String(!!error)
							if (error && input.id)
								input.setAttribute('aria-errormessage', `${input.id}-error`)
							else input.removeAttribute('aria-errormessage')
						}),
					watch('color', color => {
						if (axis) input.value = formatNumber(axis, color[axis] ?? 0)
					}),
					on(input, 'change', () => {
						if (!axis) return
						const value = input.valueAsNumber
						const newColor = {
							...host.color,
							[axis]: axis === 'l' ? value / 100 : value,
						}
						if (inP3Gamut(newColor)) {
							commit(newColor)
						} else {
							input.setCustomValidity('Color out of gamut')
							errors[axis].set(input.validationMessage)
						}
					}),
				]
			}),

			// Error text per-element effects
			each(allErrors, errorEl => {
				const axis = getAxis(errorEl as HTMLElement)
				return [axis ? watch(errors[axis], bindText(errorEl)) : false]
			}),

			// Graph pointer interaction + canvas size CSS variable
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
			}),
			watch(() => `${canvasSize.get()}px`, bindStyle(graphEl, '--canvas-size')),

			// Graph canvas: redraw on hue or size change
			watch(
				() => ({ hue: host.hue, n: Math.round(canvasSize.get()) }),
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
			),

			// Knob position
			watch(
				() => ({
					l: host.lightness,
					c: host.chroma,
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
			),

			// Slider pointer interaction + ARIA + CSS variable
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
			}),
			watch(
				() => `${trackWidth.get()}px`,
				bindStyle(sliderEl, '--track-width'),
			),
			watch('hue', hue => {
				sliderEl.setAttribute('aria-valuenow', String(hue))
				sliderEl.setAttribute('aria-valuetext', `${formatNumber('h', hue)}°`)
			}),

			// Track canvas: redraw on color or track width change
			watch(
				() => ({ color: host.color, n: Math.round(trackWidth.get()) }),
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
			),

			// Thumb position
			watch(
				() => ({
					hue: host.hue,
					l: host.lightness,
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
			),

			// Decrement buttons
			each(decrementBtns, btn => {
				const axis = getAxis(btn)
				return [
					on(btn, 'click', event => {
						if (axis) host.stepDown(axis, (event as MouseEvent).shiftKey)
					}),
					watch('color', color => {
						if (!axis) {
							btn.disabled = true
							return
						}
						btn.disabled = (color[axis] ?? 0) <= 0
					}),
				]
			}),

			// Increment buttons
			each(incrementBtns, btn => {
				const axis = getAxis(btn)
				return [
					on(btn, 'click', event => {
						if (axis) host.stepUp(axis, (event as MouseEvent).shiftKey)
					}),
					watch('color', color => {
						if (!axis) {
							btn.disabled = true
							return
						}
						btn.disabled = (color[axis] ?? 0) >= AXIS_MAX[axis]
					}),
				]
			}),

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
			}),
		]

		for (let i = 1; i < 5; i++) {
			const li = first(`li.lighten${(5 - i) * 20}`)
			if (li)
				effects.push(
					watch(
						() => ({ color: host.color, size: canvasSize.get() }),
						({ color }) => {
							setStepPosition(li, getStepColor(color, 1 - i / 10))
						},
					),
				)
		}
		for (let i = 1; i < 5; i++) {
			const li = first(`li.darken${i * 20}`)
			if (li)
				effects.push(
					watch(
						() => ({ color: host.color, size: canvasSize.get() }),
						({ color }) => {
							setStepPosition(li, getStepColor(color, 1 - (i + 5) / 10))
						},
					),
				)
		}

		return effects
	},
)
