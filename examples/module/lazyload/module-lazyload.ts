import {
	asString,
	createTask,
	dangerouslyBindInnerHTML,
	defineComponent,
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
		const content = first('.content', 'Needed to display content.')

		const result = createTask<{
			ok: boolean
			value: string
			error: string
			pending: boolean
		}>(
			async (_prev, abort) => {
				const url = host.src
				const err = !url
					? 'No URL provided'
					: !isValidURL(url)
						? 'Invalid URL'
						: isRecursiveURL(url, host)
							? 'Recursive URL detected'
							: ''
				if (err) return { ok: false, value: '', error: err, pending: false }

				try {
					const { content: fetched } = await fetchWithCache(url, abort)
					return { ok: true, value: fetched, error: '', pending: false }
				} catch (err) {
					return {
						ok: false,
						value: '',
						error: `Failed to fetch content for "${url}": ${String(err)}`,
						pending: false,
					}
				}
			},
			{ value: { ok: false, value: '', error: '', pending: true } },
		)

		expose({
			src: asString(),
		})

		return [
			watch(result, ({ ok, pending, error }) => {
				callout.hidden = ok
				callout.classList.toggle('danger', !!error)
				loading.hidden = !pending
				errorEl.hidden = !error
				errorEl.textContent = error ?? ''
				content.hidden = !ok
			}),
			watch(
				() => result.get().value ?? '',
				dangerouslyBindInnerHTML(content, {
					allowScripts: host.hasAttribute('allow-scripts'),
				}),
			),
		]
	},
)
