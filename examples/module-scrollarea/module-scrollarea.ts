import {
	batchSignalWrites,
	defineComponent,
	on,
	State,
	toggleClass,
} from '../..'

const MIN_INTERSECTION_RATIO = 0
const MAX_INTERSECTION_RATIO = 0.99 // ignore rounding errors of fraction pixels

const observeOverflow =
	(
		content: Element,
		overflowCallback: () => void,
		noOverflowCallback: () => void,
	) =>
	(container: HTMLElement) => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (
					entry.intersectionRatio > MIN_INTERSECTION_RATIO
					&& entry.intersectionRatio < MAX_INTERSECTION_RATIO
				)
					overflowCallback()
				else batchSignalWrites(noOverflowCallback)
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

export default defineComponent(
	'module-scrollarea',
	undefined,
	undefined,
	({ host }) => {
		const child = host.firstElementChild
		if (!child) return {}

		const overflowStart = new State(false)
		const overflowEnd = new State(false)
		const hasOverflow = () => overflowStart.get() || overflowEnd.get()

		const scrollCallback =
			host.getAttribute('orientation') === 'horizontal'
				? () => {
						overflowStart.set(host.scrollLeft > 0)
						overflowEnd.set(
							host.scrollLeft < host.scrollWidth - host.offsetWidth,
						)
					}
				: () => {
						overflowStart.set(host.scrollTop > 0)
						overflowEnd.set(
							host.scrollTop < host.scrollHeight - host.offsetHeight,
						)
					}

		return {
			host: [
				toggleClass('overflow', hasOverflow),
				toggleClass('overflow-start', overflowStart),
				toggleClass('overflow-end', overflowEnd),
				observeOverflow(
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
					if (hasOverflow()) batchSignalWrites(scrollCallback)
				}),
			],
		}
	},
)
