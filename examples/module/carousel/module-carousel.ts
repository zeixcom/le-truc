import { asInteger, createEffect, defineComponent, each } from '../../..'

export type ModuleCarouselProps = {
	index: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': HTMLElement & ModuleCarouselProps
	}
}

const clamp = (index: number, total: number) =>
	Math.max(0, Math.min(index, total - 1))

export default defineComponent<ModuleCarouselProps>(
	'module-carousel',
	({ all, expose, first, host, on, watch }) => {
		const dots = all('button[role="tab"]')
		const slides = all('[role="tabpanel"]')
		const buttons = all('nav button')
		const prev = first('button.prev', 'Add a previous button')
		const next = first('button.next', 'Add a next button')

		let isNavigating = false
		let lastScrolled = -1

		expose({
			index: asInteger(
				Math.max(
					slides.get().findIndex(slide => slide.ariaCurrent === 'true'),
					0,
				),
			),
		})

		return [
			// Set up IntersectionObserver to detect scroll-based navigation
			() => {
				const observer = new IntersectionObserver(
					entries => {
						for (const entry of entries) {
							if (entry.intersectionRatio > 0.5) {
								const slideIndex = slides
									.get()
									.findIndex(slide => slide === entry.target)
								if (isNavigating) {
									if (slideIndex === host.index) isNavigating = false
								} else if (slideIndex !== host.index && slideIndex >= 0) {
									lastScrolled = slideIndex
									host.index = slideIndex
								}
								break
							}
						}
					},
					{ root: host, threshold: 0.5 },
				)
				for (const slide of slides.get()) observer.observe(slide)
				return () => observer.disconnect()
			},

			// Scroll to slide when index changes (skip if IO already scrolled there)
			() =>
				createEffect(() => {
					const idx = host.index
					if (lastScrolled < 0) {
						lastScrolled = idx
						return
					}
					if (lastScrolled !== idx) {
						lastScrolled = idx
						isNavigating = true
						slides.get()[idx]!.scrollIntoView({
							behavior: 'smooth',
							block: 'nearest',
						})
					}
				}),

			// Prev button: hide on first slide; move focus to next when hidden
			watch('index', () => {
				prev.hidden = host.index === 0
			}),
			on(prev, 'click', () => {
				const newIndex = clamp(host.index - 1, slides.get().length)
				host.index = newIndex
				if (newIndex === 0) next.focus()
			}),

			// Next button: hide on last slide; move focus to prev when hidden
			watch('index', () => {
				next.hidden = host.index === slides.get().length - 1
			}),
			on(next, 'click', () => {
				const newIndex = clamp(host.index + 1, slides.get().length)
				host.index = newIndex
				if (newIndex === slides.get().length - 1) prev.focus()
			}),

			// Dot navigation
			on(dots, 'click', (_e, target) => {
				host.index = parseInt(target.dataset.index || '0')
			}),
			each(dots, dot =>
				watch('index', () => {
					dot.ariaSelected = String(dot.dataset.index === String(host.index))
					dot.tabIndex = dot.dataset.index === String(host.index) ? 0 : -1
				}),
			),

			// Keyboard navigation for all nav buttons (prev, next, dots)
			on(buttons, 'keyup', e => {
				const { key } = e
				if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
				e.preventDefault()
				e.stopPropagation()

				const length = slides.get().length
				const newIndex =
					key === 'Home'
						? 0
						: key === 'End'
							? length - 1
							: clamp(host.index + (key === 'ArrowLeft' ? -1 : 1), length)
				host.index = newIndex
				if (newIndex === 0 && document.activeElement === prev) {
					next.focus()
				} else if (newIndex === length - 1 && document.activeElement === next) {
					prev.focus()
				} else if (document.activeElement) {
					const dotElements = dots.get()
					if (dotElements.includes(document.activeElement as HTMLButtonElement))
						dotElements[newIndex]!.focus()
				}
			}),

			// Active slide indicator
			each(slides, slide =>
				watch('index', () => {
					slide.ariaCurrent = String(slide.id === slides.get()[host.index]!.id)
				}),
			),
		]
	},
)
