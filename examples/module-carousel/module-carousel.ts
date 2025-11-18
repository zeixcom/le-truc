import { asInteger, type Component, component, on, setProperty } from '../..'

type ModuleCarouselProps = {
	readonly slides: HTMLElement[]
	index: number
}

type ModuleCarouselUI = {
	dots: HTMLElement[]
	slides: HTMLElement[]
	buttons: HTMLElement[]
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': Component<ModuleCarouselProps, ModuleCarouselUI>
	}
}

const wrapAround = (index: number, total: number) => (index + total) % total

export default component<ModuleCarouselProps, ModuleCarouselUI>(
	'module-carousel',
	({ all, first }) => ({
		dots: all('[role="tab"]'),
		slides: all('[role="tabpanel"]'),
		buttons: all('button'),
	}),
	{
		index: asInteger((el: Element) =>
			Math.max(
				el.ui.slides.findIndex(slide => slide.ariaCurrent === 'true'),
				0,
			),
		),
	},
	el => {
		const isCurrentDot = (target: HTMLElement) =>
			target.dataset.index === String(el.index)
		const scrollToCurrentSlide = () => {
			el.slides[el.index].scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			})
		}

		return {
			// Register IntersectionObserver to update index based on scroll position
			component: [
				() => {
					const observer = new IntersectionObserver(
						entries => {
							for (const entry of entries) {
								if (entry.isIntersecting) {
									el.index = el.slides.findIndex(
										slide => slide === entry.target,
									)
									break
								}
							}
						},
						{
							root: el,
							threshold: 0.5,
						},
					)
					el.slides.forEach(slide => {
						observer.observe(slide)
					})
					return () => {
						observer.disconnect()
					}
				},
			],

			// Handle navigation button click and keyup events
			buttons: [
				on('click', ({ host, target }) => {
					const total = host.slides.length
					const nextIndex = target.classList.contains('prev')
						? el.index - 1
						: target.classList.contains('next')
							? el.index + 1
							: parseInt(target.dataset.index || '0')
					el.index = Number.isInteger(nextIndex)
						? wrapAround(nextIndex, total)
						: 0
					scrollToCurrentSlide()
				}),
				on('keyup', ({ event, host }) => {
					const key = event.key
					if (
						['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
					) {
						event.preventDefault()
						event.stopPropagation()
						const total = host.slides.length
						const nextIndex =
							key === 'Home'
								? 0
								: key === 'End'
									? total - 1
									: wrapAround(
											el.index
												+ (key === 'ArrowLeft'
													? -1
													: 1),
											total,
										)
						host.slides[nextIndex].focus()
						el.index = nextIndex
						scrollToCurrentSlide()
					}
				}),
			],

			// Set the active slide in the navigation
			dots: [
				setProperty('ariaSelected', target =>
					String(isCurrentDot(target)),
				),
				setProperty('tabIndex', target =>
					isCurrentDot(target) ? 0 : -1,
				),
			],

			// Set the active slide in the slides
			slides: [
				setProperty('ariaCurrent', target =>
					String(target.id === el.slides[el.index].id),
				),
			],
		}
	},
)
