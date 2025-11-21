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
	ui => {
		const isCurrentDot = (target: HTMLElement) =>
			target.dataset.index === String(ui.component.index)
		const scrollToCurrentSlide = () => {
			ui.slides[ui.component.index].scrollIntoView({
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
									ui.component.index = ui.slides.findIndex(
										slide => slide === entry.target,
									)
									break
								}
							}
						},
						{
							root: ui.component,
							threshold: 0.5,
						},
					)
					ui.slides.forEach(slide => {
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
					const total = ui.slides.length
					const nextIndex = target.classList.contains('prev')
						? ui.component.index - 1
						: target.classList.contains('next')
							? ui.component.index + 1
							: parseInt(target.dataset.index || '0')
					ui.component.index = Number.isInteger(nextIndex)
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
						const total = ui.slides.length
						const nextIndex =
							key === 'Home'
								? 0
								: key === 'End'
									? total - 1
									: wrapAround(
											ui.component.index
												+ (key === 'ArrowLeft'
													? -1
													: 1),
											total,
										)
						ui.slides[nextIndex].focus()
						ui.component.index = nextIndex
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
					String(target.id === ui.slides[ui.component.index].id),
				),
			],
		}
	},
)
