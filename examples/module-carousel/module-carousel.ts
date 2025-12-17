import {
	asInteger,
	type Collection,
	type Component,
	createEffect,
	defineComponent,
	on,
	setProperty,
} from '../..'

export type ModuleCarouselProps = {
	index: number
}

type ModuleCarouselUI = {
	dots: Collection<HTMLElement>
	slides: Collection<HTMLElement>
	buttons: Collection<HTMLElement>
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': Component<ModuleCarouselProps>
	}
}

const SCROLL_TIMEOUT = 500

const wrapAround = (index: number, total: number) => (index + total) % total

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
	({ all }) => ({
		dots: all('[role="tab"]'),
		slides: all('[role="tabpanel"]'),
		buttons: all('nav button'),
	}),
	({ host, slides }) => {
		let isNavigating: ReturnType<typeof setTimeout> | null = null
		let isScrolling = false

		const scrollToSlide = (index: number) => {
			const slide = slides[index]
			if (!slide) return

			host.index = index
			if (isNavigating) clearTimeout(isNavigating)
			isNavigating = setTimeout(() => {
				isNavigating = null
			}, SCROLL_TIMEOUT)
			slide.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			})
		}

		const isCurrentDot = (target: HTMLElement) =>
			target.dataset.index === String(host.index)

		return {
			host: [
				() => {
					const config = {
						root: host,
						threshold: 0.5,
					}
					const observer = new IntersectionObserver(entries => {
						for (const entry of entries) {
							if (entry.intersectionRatio > config.threshold) {
								const slideIndex = slides
									.get()
									.findIndex(slide => slide === entry.target)
								if (isNavigating) {
									// Determine if we arrived at the destination of programmatic navigation
									if (slideIndex === host.index) {
										clearTimeout(isNavigating)
										isNavigating = null
									}
								} else {
									// Set the index to current slide after user scroll
									isScrolling = true
									host.index = slideIndex
									isScrolling = false
								}
								break
							}
						}
					}, config)
					for (const slide of slides) observer.observe(slide)
					return () => {
						observer.disconnect()
					}
				},
				() => {
					let prevIndex = host.index
					return createEffect(() => {
						if (prevIndex === host.index) return
						prevIndex = host.index
						if (!isScrolling) scrollToSlide(host.index)
					})
				},
			],

			// Handle navigation button click and keyup events
			buttons: [
				on('click', ({ target }) => {
					if (!(target instanceof HTMLElement)) return
					const total = slides.length
					const nextIndex = target.classList.contains('prev')
						? host.index - 1
						: target.classList.contains('next')
							? host.index + 1
							: parseInt(target.dataset.index || '0')
					host.index = Number.isInteger(nextIndex)
						? wrapAround(nextIndex, total)
						: 0
				}),
				on('keyup', e => {
					const { key } = e
					if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
						e.preventDefault()
						e.stopPropagation()
						const total = slides.length
						const nextIndex =
							key === 'Home'
								? 0
								: key === 'End'
									? total - 1
									: wrapAround(
											host.index + (key === 'ArrowLeft' ? -1 : 1),
											total,
										)
						host.index = nextIndex
					}
				}),
			],

			// Set the active slide in the navigation
			dots: [
				setProperty('ariaSelected', target => String(isCurrentDot(target))),
				setProperty('tabIndex', target => (isCurrentDot(target) ? 0 : -1)),
			],

			// Set the active slide in the slides
			slides: setProperty('ariaCurrent', target =>
				String(target.id === slides[host.index].id),
			),
		}
	},
)
