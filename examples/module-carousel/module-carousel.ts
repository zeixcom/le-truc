import {
	asInteger,
	type Component,
	createEffect,
	defineComponent,
	type Memo,
	on,
	setProperty,
	show,
} from '../..'

export type ModuleCarouselProps = {
	index: number
}

type ModuleCarouselUI = {
	dots: Memo<HTMLButtonElement[]>
	slides: Memo<HTMLElement[]>
	buttons: Memo<HTMLElement[]>
	prev: HTMLButtonElement
	next: HTMLButtonElement
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': Component<ModuleCarouselProps>
	}
}

const clamp = (index: number, total: number) =>
	Math.max(0, Math.min(index, total - 1))

export default defineComponent<ModuleCarouselProps, ModuleCarouselUI>(
	'module-carousel',
	{
		index: asInteger(ui =>
			Math.max(
				ui.slides.get().findIndex(slide => slide.ariaCurrent === 'true'),
				0,
			),
		),
	},
	({ all, first }) => ({
		dots: all('button[role="tab"]'),
		slides: all('[role="tabpanel"]'),
		buttons: all('nav button'),
		prev: first('button.prev', 'Add a previous button'),
		next: first('button.next', 'Add a next button'),
	}),
	({ host, slides, prev, next, dots }) => {
		let isNavigating = false
		let lastScrolled = host.index

		return {
			host: [
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
						if (lastScrolled !== idx) {
							lastScrolled = idx
							isNavigating = true
							slides.get()[idx]!.scrollIntoView({
								behavior: 'smooth',
								block: 'nearest',
							})
						}
					}),
			],

			// Prev button: hide on first slide; move focus to next when hidden
			prev: [
				show(() => host.index !== 0),
				on('click', () => {
					const newIndex = clamp(host.index - 1, slides.get().length)
					host.index = newIndex
					if (newIndex === 0) next.focus()
				}),
			],

			// Next button: hide on last slide; move focus to prev when hidden
			next: [
				show(() => host.index !== slides.get().length - 1),
				on('click', () => {
					const newIndex = clamp(host.index + 1, slides.get().length)
					host.index = newIndex
					if (newIndex === slides.get().length - 1) prev.focus()
				}),
			],

			// Dot navigation
			dots: [
				on('click', ({ target }) => {
					if (target instanceof HTMLElement)
						host.index = parseInt(target.dataset.index || '0')
				}),
				setProperty('ariaSelected', target =>
					String(target.dataset.index === String(host.index)),
				),
				setProperty('tabIndex', target =>
					target.dataset.index === String(host.index) ? 0 : -1,
				),
			],

			// Keyboard navigation for all nav buttons (prev, next, dots)
			buttons: on('keyup', e => {
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
			slides: setProperty('ariaCurrent', target =>
				String(target.id === slides.get()[host.index]!.id),
			),
		}
	},
)
