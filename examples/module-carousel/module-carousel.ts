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
		let activeScrollPromise: Promise<void> | null = null
		let isScrolling = false

		const scrollToSlide = async (index: number): Promise<void> => {
			const slide = slides[index]
			if (!slide) return

			// Wait for any existing scroll to complete
			if (activeScrollPromise) {
				await activeScrollPromise
			}

			// Create new scroll promise
			activeScrollPromise = new Promise<void>(resolve => {
				// Set the target index immediately
				host.index = index

				// Use instant scroll for reliability
				slide.scrollIntoView({
					behavior: 'instant',
					block: 'nearest',
				})

				// Use requestAnimationFrame to ensure DOM update completes
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						activeScrollPromise = null
						resolve()
					})
				})
			})

			return activeScrollPromise
		}

		const isCurrentDot = (target: HTMLElement) =>
			target.dataset.index === String(host.index)

		return {
			host: [
				() => {
					const config = {
						root: host,
						threshold: 0.7,
					}
					const observer = new IntersectionObserver(entries => {
						// Don't interfere during programmatic scrolling
						if (activeScrollPromise) return

						for (const entry of entries) {
							if (entry.intersectionRatio > config.threshold) {
								const slideIndex = slides
									.get()
									.findIndex(slide => slide === entry.target)

								// Only update for user scroll if it's a different slide
								if (slideIndex !== host.index && slideIndex >= 0) {
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
