import {
	asString,
	createTask,
	dangerouslyBindInnerHTML,
	defineComponent,
	schedule,
} from '../../..'
import {
	fetchWithCache,
	isRecursiveURL,
	isValidURL,
} from '../../_common/fetchWithCache'

export type ModuleLazyloadProps = {
	src: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-lazyload': HTMLElement & ModuleLazyloadProps
	}
}

export default defineComponent<ModuleLazyloadProps>(
	'module-lazyload',
	({ expose, first, host, watch }) => {
		const callout = first(
			'card-callout',
			'Needed to display loading state and error messages.',
		)
		const loading = first('.loading', 'Needed to display loading state.')
		const errorEl = first('.error', 'Needed to display error messages.')
		const contentEl = first('.content', 'Needed to display content.')

		const content = createTask<string>(async (_prev, abort) => {
			const url = host.src
			if (!url) throw new Error('No URL provided')
			if (!isValidURL(url)) throw new Error('Invalid URL')
			if (isRecursiveURL(url, host)) throw new Error('Recursive URL detected')
			try {
				const { content: fetched } = await fetchWithCache(url, abort)
				return fetched
			} catch (e) {
				throw new Error(`Failed to fetch content for "${url}": ${String(e)}`)
			}
		})

		const { ok: setHTML } = dangerouslyBindInnerHTML(contentEl, {
			allowScripts: host.hasAttribute('allow-scripts'),
		})

		expose({ src: asString() })

		// Skip the scroll-to-heading on the very first load, so the page
		// doesn't jump on initial mount — only on subsequent src changes.
		let hasLoaded = false
		// Distinct key from `contentEl` (used by dangerouslyBindInnerHTML above)
		// so this scroll task doesn't clobber the pending innerHTML write.
		const scrollTask = {}

		return [
			watch(content, {
				ok: content => {
					callout.hidden = true
					loading.hidden = true
					contentEl.hidden = false
					setHTML(content)

					if (hasLoaded) {
						schedule(scrollTask, () => {
							contentEl
								.querySelector('h1, h2, h3, h4, h5, h6')
								?.scrollIntoView({ behavior: 'smooth', block: 'start' })
						})
					}
					hasLoaded = true
				},
				nil: () => {
					callout.hidden = false
					loading.hidden = false
					contentEl.hidden = true
				},
				stale: () => {
					contentEl.style.setProperty('opacity', 'var(--opacity-dimmed)')
					return () => {
						contentEl.style.removeProperty('opacity')
					}
				},
				err: error => {
					callout.hidden = false
					callout.classList.add('danger')
					loading.hidden = true
					errorEl.hidden = false
					errorEl.textContent = error.message
					contentEl.hidden = true
					return () => {
						callout.classList.remove('danger')
						errorEl.hidden = true
						errorEl.textContent = ''
					}
				},
			}),
		]
	},
)
