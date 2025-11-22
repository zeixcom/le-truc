import { batch, component, on, state, toggleClass } from '../..'

const MIN_INTERSECTION_RATIO = 0
const MAX_INTERSECTION_RATIO = 0.999 // ignore rounding errors of fraction pixels

const observeOverflow = (
	container: HTMLElement,
	content: Element,
	overflowCallback: () => void,
	noOverflowCallback: () => void,
) => {
	const observer = new IntersectionObserver(
		([entry]) => {
			if (
				entry.intersectionRatio > MIN_INTERSECTION_RATIO
				&& entry.intersectionRatio < MAX_INTERSECTION_RATIO
			)
				overflowCallback()
			else batch(noOverflowCallback)
		},
		{
			root: container,
			threshold: [MIN_INTERSECTION_RATIO, MAX_INTERSECTION_RATIO],
		},
	)
	observer.observe(content)
	return () => {
		observer.disconnect()
	}
}

export default component(
	'module-scrollarea',
	undefined,
	undefined,
	({ host }) => {
		const child = host.firstElementChild
		if (!child) return {}

		const overflowStart = state(false)
		const overflowEnd = state(false)
		const hasOverflow = () => overflowStart.get() || overflowEnd.get()

		const scrollCallback =
			host.getAttribute('orientation') === 'horizontal'
				? () => {
						overflowStart.set(host.scrollLeft > 0)
						overflowEnd.set(
							host.scrollLeft
								< host.scrollWidth - host.offsetWidth,
						)
					}
				: () => {
						overflowStart.set(host.scrollTop > 0)
						overflowEnd.set(
							host.scrollTop
								< host.scrollHeight - host.offsetHeight,
						)
					}

		let scrolling: number | null = null

		return {
			host: [
				toggleClass('overflow', hasOverflow),
				toggleClass('overflow-start', overflowStart),
				toggleClass('overflow-end', overflowEnd),
				() =>
					observeOverflow(
						host,
						child,
						() => {
							overflowEnd.set(true)
						},
						() => {
							overflowStart.set(false)
							overflowEnd.set(false)
						},
					),
				on('scroll', () => {
					if (!hasOverflow()) return
					if (scrolling) cancelAnimationFrame(scrolling)
					scrolling = requestAnimationFrame(() => {
						scrolling = null
						batch(scrollCallback)
					})
				}),
			],
		}
	},
)
