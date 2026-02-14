import {
	asInteger,
	type Component,
	createEffect,
	defineComponent,
	type ElementChanges,
	type Memo,
	on,
	setProperty,
} from '../..'

export type ModuleCarouselProps = {
	index: number
}

type ModuleCarouselUI = {
	dots: Memo<ElementChanges<HTMLElement>>
	slides: Memo<ElementChanges<HTMLElement>>
	buttons: Memo<ElementChanges<HTMLElement>>
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': Component<ModuleCarouselProps>
	}
}

const wrapAround = (index: number, total: number) => (index + total) % total

export default defineComponent<ModuleCarouselProps, ModuleCarouselUI>(
	'module-carousel',
	{
		index: asInteger(ui =>
			Math.max(
				Array.from(ui.slides.get().current).findIndex(
					slide => slide.ariaCurrent === 'true',
				),
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
		let isNavigating = false
		let isScrolling = false

		const scrollToSlide = (index: number) => {
			const slide = Array.from(slides.get().current)[index]
			if (!slide) return

			isNavigating = true
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
								const slideIndex = Array.from(slides.get().current).findIndex(
									slide => slide === entry.target,
								)

								if (isNavigating) {
									if (slideIndex === host.index) isNavigating = false
								} else if (slideIndex !== host.index && slideIndex >= 0) {
									isScrolling = true
									host.index = slideIndex
									isScrolling = false
								}
								break
							}
						}
					}, config)

					const slideSet = slides.get().current
					for (const slide of slideSet) observer.observe(slide)
					return () => {
						observer.disconnect()
					}
				},
				() => {
					let prevIndex = host.index
					return createEffect(() => {
						if (prevIndex === host.index) return
						const newIndex = host.index
						prevIndex = newIndex

						// Only scroll if this change wasn't from user scroll
						if (!isScrolling) {
							scrollToSlide(newIndex)
						}
					})
				},
			],

			// Handle navigation button click and keyup events
			buttons: [
				on('click', ({ target }) => {
					if (!(target instanceof HTMLElement)) return

					const slidesLength = slides.get().current.size
					const total = slidesLength
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

						const slidesLength = slides.get().current.size
						const total = slidesLength
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
				String(target.id === Array.from(slides.get().current)[host.index].id),
			),
		}
	},
)
