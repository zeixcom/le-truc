import { batch, bindClass, createState, defineComponent } from '../../..'

const MIN_INTERSECTION_RATIO = 0
const MAX_INTERSECTION_RATIO = 0.99 // ignore rounding errors of fraction pixels

declare global {
	interface HTMLElementTagNameMap {
		'module-scrollarea': HTMLElement
	}
}

const observeOverflow =
	(
		content: Element,
		overflowCallback: () => void,
		noOverflowCallback: () => void,
	) =>
	(container: HTMLElement) => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry) return
				if (
					entry.intersectionRatio > MIN_INTERSECTION_RATIO &&
					entry.intersectionRatio < MAX_INTERSECTION_RATIO
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

export default defineComponent('module-scrollarea', ({ host, on, watch }) => {
	const child = host.firstElementChild
	if (!child) return []

	const overflowStart = createState(false)
	const overflowEnd = createState(false)
	const hasOverflow = () => overflowStart.get() || overflowEnd.get()

	const scrollCallback =
		host.getAttribute('orientation') === 'horizontal'
			? () => {
					overflowStart.set(host.scrollLeft > 0)
					overflowEnd.set(host.scrollLeft < host.scrollWidth - host.offsetWidth)
				}
			: () => {
					overflowStart.set(host.scrollTop > 0)
					overflowEnd.set(
						host.scrollTop < host.scrollHeight - host.offsetHeight,
					)
				}

	return [
		on(host, 'scroll', () => {
			if (hasOverflow()) batch(scrollCallback)
		}),

		watch(
			() => overflowStart.get() || overflowEnd.get(),
			bindClass(host, 'overflow'),
		),
		watch(overflowStart, bindClass(host, 'overflow-start')),
		watch(overflowEnd, bindClass(host, 'overflow-end')),
		() =>
			observeOverflow(
				child,
				() => {
					overflowEnd.set(true)
				},
				() => {
					overflowStart.set(false)
					overflowEnd.set(false)
				},
			)(host),
	]
})
