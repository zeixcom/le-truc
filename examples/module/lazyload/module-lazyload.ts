import {
	asString,
	type Component,
	createTask,
	dangerouslySetInnerHTML,
	defineComponent,
	setText,
	show,
	toggleClass,
} from '../../..'
import {
	fetchWithCache,
	isRecursiveURL,
	isValidURL,
} from '../../_common/fetchWithCache'

export type ModuleLazyloadProps = {
	src: string
}

type ModuleLazyloadUI = Record<
	'callout' | 'loading' | 'error' | 'content',
	HTMLElement
>

declare global {
	interface HTMLElementTagNameMap {
		'module-lazyload': Component<ModuleLazyloadProps>
	}
}

export default defineComponent<ModuleLazyloadProps, ModuleLazyloadUI>(
	'module-lazyload',
	({ first, host }) => {
		const callout = first(
			'card-callout',
			'Needed to display loading state and error messages.',
		)
		const loading = first('.loading', 'Needed to display loading state.')
		const error = first('.error', 'Needed to display error messages.')
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
					const { content } = await fetchWithCache(url, abort)
					return { ok: true, value: content, error: '', pending: false }
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
		const hasError = () => !!result.get().error

		return {
			ui: { callout, loading, error, content },
			props: { src: asString() },
			effects: {
				callout: [show(() => !result.get().ok), toggleClass('danger', hasError)],
				loading: show(() => !!result.get().pending),
				error: [show(hasError), setText(() => result.get().error ?? '')],
				content: [
					show(() => result.get().ok),
					dangerouslySetInnerHTML(() => result.get().value ?? '', {
						allowScripts: host.hasAttribute('allow-scripts'),
					}),
				],
			},
		}
	},
)
