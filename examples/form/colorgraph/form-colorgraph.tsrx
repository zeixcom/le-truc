/**
 * TSRX migration: form-colorgraph — the LT-070 acceptance case for LT-069's
 * widened client-only setup-statement gate, blocked twice more along the way
 * (LT-087: a composed element's own `ref={}` wasn't visible to a bare setup
 * statement; LT-089: `ref={}`/`pass={{ }}` on more than one same-source
 * composed element — the three `<FormSpinbutton>` axes — was unconditionally
 * rejected). All three landed; this is the component that needed all of
 * them at once.
 *
 * `color` is NOT a derived signal: the hand-written original caches
 * `parseOklch(host.value)` in a `createMemo`, but a signal declaration is
 * re-emitted verbatim into the SERVER module too (ADR 0023 sub-design 12),
 * and `host` doesn't exist there — the same wall `hostPropOf`/
 * `hostDerivedFold` exist to work around for simple mirrors, but this thunk
 * (an object-valued parse of an arbitrary string) doesn't fit that shape.
 * Every use of `color` is `parseOklch(host.value)` inline instead — the same
 * trade `card-colorscale.tsrx` already made ("plain functions... recompute
 * per key, no caching, but no dummy DOM either"). For the same reason,
 * `commit`/`moveKnob`/`moveThumb` (all close over `host` to write the
 * committed color back) are never top-level plain setup consts — those are
 * ALSO emitted verbatim into both modules — but nested locals inside the one
 * bare client-only statement that uses each of them, never shared.
 *
 * `style={() => ({ … })}` (LT-028/LT-029) requires the arrow's body to be a
 * literal object expression — `style={() => stepStyle(...)}` (a function
 * call) does not qualify and would silently misclassify as a plain reactive
 * attribute expecting a string. The 8 step swatches and the knob/thumb
 * therefore inline their `background-color`/`border-color`/`left`/`top`
 * object literals directly rather than sharing a `stepStyle()` helper call.
 *
 * The three axis spinbuttons are addressed via composed `ref={}` (LT-087/
 * LT-089): the parent pushes the display-scaled value down with
 * `watch(() => toDisplay(…), bindProperty(el, 'value'))` and reads
 * committed changes back via a per-axis `on(<ref>, 'change', …)` — the
 * exact shape the hand-written original uses, now that a composed ref
 * is a real client-side reference to the child element
 * (`FormSpinbuttonProps`' own `stepDown`/`stepUp`/`value`/`validity`).
 * Deliberately NOT `truc:pass`: a pass replaces the child's `value` Slot
 * for the life of the connection, so the child's own writes — its step
 * methods, the typed-input harvest, and the library's built-in
 * formResetCallback baseline restore — all route through the parent's
 * setter; the reset case then re-commits the child's 0 baseline over the
 * freshly restored host color (both found by form-colorgraph.spec.ts's
 * first real-DOM run, LT-091; the getter-only pass additionally made every
 * child write throw ReadonlySignalError).
 * `name=""` on each: they are presentational sub-controls (only
 * `form-colorgraph` itself submits, under its own `name`) — an empty `name`
 * attribute is excluded from `FormData` by the HTML spec, the same as an
 * unnamed native `<input>`.
 */
import { asString, batch, bindProperty, createState, defineMethod, throttle } from '@zeix/le-truc'
import { clampChroma, formatCss, inGamut, type Oklch } from 'culori/fn'
import { asOklch } from '../../_common/asOklch.ts'
import { getStepColor } from '../../_common/getStepColor.ts'
import { FormSpinbutton } from '../spinbutton/form-spinbutton.tsrx'

export const config = { formAssociated: true }

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
export function FormColorgraph(
	{
		name,
		value = 'oklch(0.48 0.23 263)',
	}:
		{
			name: string
			value?: string
		},
)
@{
	const parseOklch = asOklch()
	const inP3Gamut = inGamut('p3')
	const inRGBGamut = inGamut('rgb')
	const fn2Digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format
	const TRACK_OFFSET = 20 // pixels
	const CONTRAST_THRESHOLD = 0.71 // lightness
	const AXIS_MAX = { l: 1, c: 0.4, h: 360 }
	const AXIS_SCALE = { l: 100, c: 1, h: 1 }
	const AXIS_DECIMALS = { l: 2, c: 4, h: 2 }
	const toDisplay = (axis: FormColorgraphAxis, raw: number) => {
		const factor = 10 ** AXIS_DECIMALS[axis]
		return Math.round(raw * AXIS_SCALE[axis] * factor) / factor
	}
	const fromDisplay = (axis: FormColorgraphAxis, display: number) => display / AXIS_SCALE[axis]

	const graphEl = first('.graph', 'Add a <div class="graph"> element as a container for the color graph.')
	const canvas = first('canvas.graph-canvas', 'Add a <canvas> element inside the graph to display the lightness/chroma graph.')
	const knob = first('.knob', 'Add a <.knob> element as a drag knob to control lightness and chroma.')
	const sliderEl = first('.slider', 'Add a <.slider> element as a container for track and thumb.')
	const track = first('canvas.hue-track', 'Add a <canvas> element inside the slider to display the hue slider track.')
	const canvasSize = createState(400)

	expose({
		value: asString('oklch(0.48 0.23 263)'),
		lightness: { get: () => parseOklch(host.value).l },
		chroma: { get: () => parseOklch(host.value).c },
		hue: { get: () => parseOklch(host.value).h ?? 0 },
		stepDown: defineMethod((axis: FormColorgraphAxis, big: boolean = false) => {
			(axis === 'l' ? lightnessEl : axis === 'c' ? chromaEl : hueEl).stepDown(big);
		}),
		stepUp: defineMethod((axis: FormColorgraphAxis, big: boolean = false) => {
			(axis === 'l' ? lightnessEl : axis === 'c' ? chromaEl : hueEl).stepUp(big);
		}),
	});

	// ResizeObserver — runs once at connect, cleanup at disconnect
	watch(
		() => graphEl,
		() => {
			const setCanvasSize = throttle((w: number) => {
				canvasSize.set(w);
			});
			const resizeObserver = new ResizeObserver(() => {
				setCanvasSize(graphEl.clientWidth);
			});
			resizeObserver.observe(graphEl);
			return () => {
				resizeObserver.disconnect();
				setCanvasSize.cancel();
			};
		},
	);

	// Graph pointer interaction (knob drag)
	on(graphEl, 'pointerdown', (event: PointerEvent) => {
		const { top, left } = canvas.getBoundingClientRect();
		const size = canvasSize.get();
		knob.ariaPressed = 'true';
		graphEl.setPointerCapture(event.pointerId);
		const moveKnob = throttle((x: number, y: number) => {
			const c = {
				...parseOklch(host.value),
				c: Math.min(Math.max((x - left) / size, 0), 1) * AXIS_MAX.c,
				l: 1 - Math.min(Math.max((y - top) / size, 0), 1),
			};
			if (inP3Gamut(c)) batch(() => {
				host.value = formatCss(c);
				host.setCustomValidity('');
			});
		});
		const handleMove = (e: PointerEvent) => {
			const last = (e.getCoalescedEvents?.() || []).pop() || e;
			moveKnob(last.clientX, last.clientY);
		};
		const handleUp = () => {
			graphEl.removeEventListener('pointermove', handleMove);
			graphEl.removeEventListener('pointerup', handleUp);
			graphEl.removeEventListener('pointercancel', handleUp);
			moveKnob.cancel();
			knob.ariaPressed = 'false';
		};
		graphEl.addEventListener('pointermove', handleMove, { passive: true });
		graphEl.addEventListener('pointerup', handleUp);
		graphEl.addEventListener('pointercancel', handleUp);
	});

	// Graph canvas: redraw on hue or size change
	watch(
		() => ({ hue: parseOklch(host.value).h ?? 0, n: Math.round(canvasSize.get()) }),
		({ hue, n }: { hue: number; n: number }) => {
			canvas.width = n;
			canvas.height = n;
			const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
			if (!ctx) return;
			const getColorFromPosition = (x: number, y: number, alpha: number = 1): string =>
				formatCss({ mode: 'oklch', l: 1 - y, c: x * AXIS_MAX.c, h: hue, alpha });
			const maxChroma = (l: number, gamut: 'rgb' | 'p3' = 'rgb') =>
				clampChroma({ mode: 'oklch', l, c: AXIS_MAX.c, h: hue }, 'oklch', gamut).c / AXIS_MAX.c;
			const gradientStops = (
				minX: number,
				maxX: number,
				y: number,
				alpha: number = 1,
			): [string, string] => [
				getColorFromPosition(minX / n, y / n, alpha),
				getColorFromPosition(maxX / n, y / n, alpha),
			];
			const drawGradient = (
				minX: number,
				y: number,
				gamut: 'rgb' | 'p3' = 'rgb',
			): [number, string] => {
				const maxX = maxChroma(1 - y / n, gamut) * n;
				const gradient = ctx.createLinearGradient(minX, 0, maxX, 0);
				const stops = gradientStops(minX, maxX, y, gamut === 'p3' ? 0.5 : 1);
				gradient.addColorStop(0, stops[0]);
				gradient.addColorStop(1, stops[1]);
				ctx.fillStyle = gradient;
				ctx.fillRect(minX, y, maxX - minX, 1);
				return [maxX, stops[1]];
			};
			ctx.clearRect(0, 0, n, n);
			for (let y = 0; y < n; y++) {
				const [maxRgbX, maxRgbColor] = drawGradient(0, y);
				if (inP3Gamut(maxRgbColor)) drawGradient(maxRgbX, y, 'p3');
			}
		},
	);

	// Hue slider pointer interaction
	on(sliderEl, 'pointerdown', (event: PointerEvent) => {
		const left = track.getBoundingClientRect().left;
		const width = canvasSize.get() - 2 * TRACK_OFFSET;
		sliderEl.setPointerCapture(event.pointerId);
		const moveThumb = throttle((x: number) => {
			const c = {
				...parseOklch(host.value),
				h: Math.min(Math.max((x - left) / width, 0), 1) * AXIS_MAX.h,
			};
			if (inP3Gamut(c)) batch(() => {
				host.value = formatCss(c);
				host.setCustomValidity('');
			});
		});
		const handleMove = (e: PointerEvent) => {
			const last = (e.getCoalescedEvents?.() || []).pop() || e;
			moveThumb(last.clientX);
		};
		const handleUp = () => {
			sliderEl.removeEventListener('pointermove', handleMove);
			sliderEl.removeEventListener('pointerup', handleUp);
			sliderEl.removeEventListener('pointercancel', handleUp);
			moveThumb.cancel();
		};
		sliderEl.addEventListener('pointermove', handleMove, { passive: true });
		sliderEl.addEventListener('pointerup', handleUp);
		sliderEl.addEventListener('pointercancel', handleUp);
	});

	// Track canvas: redraw on color or track width change
	watch(
		() => ({ c: parseOklch(host.value), n: Math.round((canvasSize.get() - 2 * TRACK_OFFSET)) }),
		({ n }: { c: Oklch; n: number }) => {
			track.width = n;
			const ctx = track.getContext('2d', { colorSpace: 'display-p3' });
			if (!ctx) return;
			ctx.clearRect(0, 0, n, 1);
			for (let x = 0; x < n; x++) {
				const candidate = { ...parseOklch(host.value), h: (x / n) * AXIS_MAX.h };
				const finalColor = inRGBGamut(candidate)
					? candidate
					: inP3Gamut(candidate)
						? { ...candidate, alpha: 0.5 }
						: { ...candidate, alpha: 0 };
				ctx.fillStyle = formatCss(finalColor);
				ctx.fillRect(x, 0, 1, 1);
			}
		},
	);

	// Keyboard navigation
	on(host, 'keydown', (event: KeyboardEvent) => {
		const { key, shiftKey, target } = event;
		if (
			!(target instanceof HTMLElement)
			|| (target.localName === 'input'
				&& (key === 'ArrowLeft' || key === 'ArrowRight'))
		)
			return;
		if (key.substring(0, 5) === 'Arrow' || ['+', '-'].includes(key)) {
			event.preventDefault();
			event.stopPropagation();
			const getAxis = (el: HTMLElement): FormColorgraphAxis | null => {
				if (el.closest('.lightness')) return 'l';
				if (el.closest('.chroma')) return 'c';
				if (el.closest('.hue')) return 'h';
				return null;
			};
			const axis = getAxis(target);
			if (axis) {
				if (key === 'ArrowLeft' || key === 'ArrowDown' || key === '-')
					host.stepDown(axis, shiftKey);
				else if (key === 'ArrowRight' || key === 'ArrowUp' || key === '+')
					host.stepUp(axis, shiftKey);
			} else if (target.role === 'slider') {
				if (key === 'ArrowLeft' || key === 'ArrowDown' || key === '-')
					host.stepDown('h', shiftKey);
				else if (key === 'ArrowRight' || key === 'ArrowUp' || key === '+')
					host.stepUp('h', shiftKey);
			} else {
				switch (key) {
					case 'ArrowDown':
						host.stepDown('l', shiftKey);
						break;
					case 'ArrowUp':
						host.stepUp('l', shiftKey);
						break;
					case 'ArrowLeft':
						host.stepDown('c', shiftKey);
						break;
					case 'ArrowRight':
						host.stepUp('c', shiftKey);
						break;
					case '-':
						host.stepDown('h');
						break;
					case '+':
						host.stepUp('h');
						break;
				}
			}
		}
	});

	// Axis spinbuttons: push the display-scaled value down, read committed
	// changes back (write side is the child's own step methods / typed input
	// harvest, committed to host.value by the change handlers above/below).
	//
	// The push is `watch` + `bindProperty`, NOT `truc:pass`: a pass REPLACES
	// the child's `value` Slot for the life of the connection, so the child's
	// own writes route through the parent's setter — including the library's
	// built-in formResetCallback baseline restore, which then re-commits the
	// child's 0 baseline over the freshly reset host color (found by
	// form-colorgraph.spec.ts's first real-DOM run, LT-091). With the child
	// owning its value and the parent pushing, form reset restores the host
	// attribute and the push re-syncs the displays from it.
	watch(() => toDisplay('l', host.lightness), bindProperty(lightnessEl, 'value'));
	watch(() => toDisplay('c', host.chroma), bindProperty(chromaEl, 'value'));
	watch(() => toDisplay('h', host.hue), bindProperty(hueEl, 'value'));

	on(lightnessEl, 'change', () => {
		if (!lightnessEl.validity.valid) return;
		const c = { ...parseOklch(host.value), l: fromDisplay('l', lightnessEl.value) };
		if (inP3Gamut(c)) batch(() => {
			host.value = formatCss(c);
			host.setCustomValidity('');
		});
		else host.setCustomValidity('Color out of gamut');
	});
	on(chromaEl, 'change', () => {
		if (!chromaEl.validity.valid) return;
		const c = { ...parseOklch(host.value), c: fromDisplay('c', chromaEl.value) };
		if (inP3Gamut(c)) batch(() => {
			host.value = formatCss(c);
			host.setCustomValidity('');
		});
		else host.setCustomValidity('Color out of gamut');
	});
	on(hueEl, 'change', () => {
		if (!hueEl.validity.valid) return;
		const c = { ...parseOklch(host.value), h: fromDisplay('h', hueEl.value) };
		if (inP3Gamut(c)) batch(() => {
			host.value = formatCss(c);
			host.setCustomValidity('');
		});
		else host.setCustomValidity('Color out of gamut');
	});

	<>
		<form-colorgraph
			{name}
			{value}
			style={() => ({ '--color-base': formatCss(parseOklch(host.value)) })}
		>
			<div class="graph" style={() => ({ '--canvas-size': `${canvasSize.get()}px` })}>
				<canvas class="graph-canvas" width="400" height="400"></canvas>
				<button
					type="button"
					class="knob"
					style={() => ({
						top: `${Math.round((1 - parseOklch(host.value).l) * canvasSize.get())}px`,
						left: `${Math.round((parseOklch(host.value).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						'--color-border': parseOklch(host.value).l > CONTRAST_THRESHOLD ? 'black' : 'white',
					})}
				>
					<span class="visually-hidden">Drag</span>
				</button>
				<ol role="presentation">
					<li class="lighten80" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.9)),
						'border-color': getStepColor(parseOklch(host.value), 0.9).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.9).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.9).l) * canvasSize.get())}px`,
					})}></li>
					<li class="lighten60" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.8)),
						'border-color': getStepColor(parseOklch(host.value), 0.8).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.8).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.8).l) * canvasSize.get())}px`,
					})}></li>
					<li class="lighten40" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.7)),
						'border-color': getStepColor(parseOklch(host.value), 0.7).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.7).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.7).l) * canvasSize.get())}px`,
					})}></li>
					<li class="lighten20" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.6)),
						'border-color': getStepColor(parseOklch(host.value), 0.6).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.6).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.6).l) * canvasSize.get())}px`,
					})}></li>
					<li class="darken20" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.4)),
						'border-color': getStepColor(parseOklch(host.value), 0.4).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.4).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.4).l) * canvasSize.get())}px`,
					})}></li>
					<li class="darken40" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.3)),
						'border-color': getStepColor(parseOklch(host.value), 0.3).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.3).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.3).l) * canvasSize.get())}px`,
					})}></li>
					<li class="darken60" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.2)),
						'border-color': getStepColor(parseOklch(host.value), 0.2).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.2).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.2).l) * canvasSize.get())}px`,
					})}></li>
					<li class="darken80" style={() => ({
						'background-color': formatCss(getStepColor(parseOklch(host.value), 0.1)),
						'border-color': getStepColor(parseOklch(host.value), 0.1).l > CONTRAST_THRESHOLD ? 'black' : 'white',
						left: `${Math.round((getStepColor(parseOklch(host.value), 0.1).c * canvasSize.get()) / AXIS_MAX.c)}px`,
						top: `${Math.round((1 - getStepColor(parseOklch(host.value), 0.1).l) * canvasSize.get())}px`,
					})}></li>
				</ol>
			</div>
			<div
				class="slider"
				role="slider"
				tabindex="0"
				aria-valuemin="0"
				aria-valuemax="360"
				aria-controls="hue"
				aria-labelledby="hue-label"
				aria-valuenow={() => String(parseOklch(host.value).h ?? 0)}
				aria-valuetext={() => `${fn2Digits(parseOklch(host.value).h ?? 0)}°`}
				style={() => ({ '--track-width': `${(canvasSize.get() - 2 * TRACK_OFFSET)}px` })}
			>
				<canvas class="hue-track" width="360" height="1"></canvas>
				<span
					class="thumb"
					style={() => ({
						left: `${Math.round(((parseOklch(host.value).h ?? 0) * (canvasSize.get() - 2 * TRACK_OFFSET)) / AXIS_MAX.h) + TRACK_OFFSET}px`,
						'--color-border': parseOklch(host.value).l > CONTRAST_THRESHOLD ? 'black' : 'white',
					})}
				></span>
			</div>
			<p class="error" aria-live="assertive" id="color-error">{host.validationMessage}</p>
			<FormSpinbutton
				class="lightness"
				ref={lightnessEl}
				name=""
				label="Lightness"
				unit="%"
				min={0}
				max={100}
				step={0.25}
				bigStep={5}
			/>
			<FormSpinbutton
				class="chroma"
				ref={chromaEl}
				name=""
				label="Chroma"
				min={0}
				max={0.4}
				step={0.001}
				bigStep={0.02}
			/>
			<FormSpinbutton
				class="hue"
				ref={hueEl}
				name=""
				label="Hue"
				unit="°"
				min={0}
				max={360}
				step={0.01}
				bigStep={15}
			/>
		</form-colorgraph>

		<style>
		form-colorgraph {
			--color-base: transparent;
			--step-size: 1.25rem;

			display: flex;
			flex-direction: column;
			gap: var(--space-s);
			margin: var(--space-m) 0;

			.graph {
				--canvas-size: 400px;

				position: relative;
				width: 100%;
				display: block;
				user-select: none;
				transition: opacity var(--transition-medium) var(--easing-inout);

				& canvas {
					width: var(--canvas-size);
					height: var(--canvas-size);
					aspect-ratio: 1;
					user-select: none;
				}

				.knob {
					position: absolute;
					top: 0;
					left: 0;
					width: var(--input-height);
					height: var(--input-height);
					border-radius: 50%;
					background-color: var(--color-base);
					border: 1px solid var(--color-border);
					box-shadow: 0 0 var(--space-xxs) 2px var(--color-shadow);
					cursor: move;
					user-select: none;
					touch-action: none;
					transform: translate(
						calc(var(--input-height) / -2),
						calc(var(--input-height) / -2)
					);

					&:focus-visible {
						box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
					}
				}

				& ol {
					list-style: none;
					margin: 0;
					padding: 0;
					user-select: none;
				}

				& li {
					position: absolute;
					box-sizing: border-box;
					top: 0;
					left: 0;
					width: var(--step-size);
					height: var(--step-size);
					transform: translate(
						calc(var(--step-size) / -2),
						calc(var(--step-size) / -2)
					);
					border-radius: 100%;
					background-color: transparent;
					border: 1px solid black;
					opacity: var(--opacity-dimmed);
					user-select: none;
				}

				.lighten80 {
					background: var(--color-lighten80);
				}
				.lighten60 {
					background: var(--color-lighten60);
				}
				.lighten40 {
					background: var(--color-lighten40);
				}
				.lighten20 {
					background: var(--color-lighten20);
				}
				.darken20 {
					background: var(--color-darken20);
				}
				.darken40 {
					background: var(--color-darken40);
				}
				.darken60 {
					background: var(--color-darken60);
				}
				.darken80 {
					background: var(--color-darken80);
				}
			}

			> .error {
				grid-area: error;
				margin: var(--space-xs) 0 0;
				font-size: var(--font-size-xs);
				line-height: var(--line-height-s);
				color: color-mix(in srgb, var(--color-text) 50%, var(--color-error));

				&:empty {
					display: none;
				}
			}

			.slider {
				--slider-width: 400px;
				--slider-height: 40px;
				--track-width: 360px;
				--track-height: 8px;
				--track-offset: 20px;

				position: relative;
				display: inline-block;
				height: var(--slider-height);
				user-select: none;
				transition: opacity var(--transition-medium) var(--easing-inout);

				& canvas {
					width: calc(100% - 2 * var(--track-offset));
					height: var(--track-height);
					margin: calc(var(--track-offset) - var(--track-height) / 2)
						var(--track-offset);
					user-select: none;
				}
			}

			.thumb {
				position: absolute;
				top: calc(var(--slider-height) / 2);
				left: var(--track-offset);
				width: var(--input-height);
				height: var(--input-height);
				background-color: var(--color-base);
				box-sizing: border-box;
				border: 1px solid var(--color-border);
				border-radius: 50%;
				box-shadow: 0 0 var(--space-xxs) 2px var(--color-shadow);
				cursor: ew-resize;
				user-select: none;
				touch-action: none;
				opacity: var(--opacity-dimmed);
				transform: translate(
					calc(var(--input-height) / -2),
					calc(var(--input-height) / -2)
				);
			}
		}

		@container (width > 27rem) {
			form-colorgraph {
				display: grid;
				grid-template-areas:
					"graph graph graph"
					"slider slider slider"
					"lightness chroma hue";
				grid-template-columns: 1fr 1fr 1fr;
				gap: var(--space-s) var(--space-m);
				align-items: start;

				.graph {
					grid-area: graph;
				}
				.slider {
					grid-area: slider;
				}
				.lightness {
					grid-area: lightness;
				}
				.chroma {
					grid-area: chroma;
				}
				.hue {
					grid-area: hue;
				}
			}
		}
		</style>
	</>
}
