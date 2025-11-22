import { asInteger, type Component, component, on, setProperty } from '../..'

type ModuleCarouselProps = {
	index: number
}

type ModuleCarouselUI = {
	dots: HTMLElement[]
	slides: HTMLElement[]
	buttons: HTMLElement[]
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': Component<ModuleCarouselProps>
	}
}

const wrapAround = (index: number, total: number) => (index + total) % total

export default component<ModuleCarouselProps, ModuleCarouselUI>(
	'module-carousel',
	{
		index: asInteger(ui =>
			Math.max(
				ui.slides.findIndex(slide => slide.ariaCurrent === 'true'),
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
		const isCurrentDot = (target: HTMLElement) =>
			target.dataset.index === String(host.index)
		const scrollToCurrentSlide = () => {
			slides[host.index].scrollIntoView({
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
									host.index = slides.findIndex(
										slide => slide === entry.target,
									)
									break
								}
							}
						},
						{
							root: host,
							threshold: 0.5,
						},
					)
					slides.forEach(slide => {
						observer.observe(slide)
					})
					return () => {
						observer.disconnect()
					}
				},
			],

			// Handle navigation button click and keyup events
			buttons: [
				on('click', ({ target }) => {
					const total = slides.length
					const nextIndex = target.classList.contains('prev')
						? host.index - 1
						: target.classList.contains('next')
							? host.index + 1
							: parseInt(target.dataset.index || '0')
					host.index = Number.isInteger(nextIndex)
						? wrapAround(nextIndex, total)
						: 0
					scrollToCurrentSlide()
				}),
				on('keyup', ({ event }) => {
					const key = event.key
					if (
						['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
					) {
						event.preventDefault()
						event.stopPropagation()
						const total = slides.length
						const nextIndex =
							key === 'Home'
								? 0
								: key === 'End'
									? total - 1
									: wrapAround(
											host.index
												+ (key === 'ArrowLeft'
													? -1
													: 1),
											total,
										)
						slides[nextIndex].focus()
						host.index = nextIndex
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
					String(target.id === ui.slides[host.index].id),
				),
			],
		}
	},
)
