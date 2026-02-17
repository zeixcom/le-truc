import {
	asString,
	type Component,
<<<<<<< HEAD
=======
	createTask,
>>>>>>> main
	dangerouslySetInnerHTML,
	defineComponent,
	setText,
	show,
	Task,
	toggleClass,
} from '../..'
import { fetchWithCache, isRecursiveURL, isValidURL } from '../_common/fetch'

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
	{
		src: asString(),
	},
	({ first }) => ({
		callout: first(
			'card-callout',
			'Needed to display loading state and error messages.',
		),
		loading: first('.loading', 'Needed to display loading state.'),
		error: first('.error', 'Needed to display error messages.'),
		content: first('.content', 'Needed to display content.'),
	}),
	ui => {
		const { host } = ui
<<<<<<< HEAD
		const result = new Task<{
=======
		const result = createTask<{
>>>>>>> main
			ok: boolean
			value: string
			error: string
			pending: boolean
		}>(
			async (_prev, abort) => {
				const url = host.src
				const error = !url
					? 'No URL provided'
					: !isValidURL(url)
						? 'Invalid URL'
						: isRecursiveURL(url, host)
							? 'Recursive URL detected'
							: ''
				if (error) return { ok: false, value: '', error, pending: false }

				try {
					const { content } = await fetchWithCache(url, abort)
					return { ok: true, value: content, error: '', pending: false }
				} catch (error) {
					return {
						ok: false,
						value: '',
						error: `Failed to fetch content for "${url}": ${String(error)}`,
						pending: false,
					}
				}
			},
			{ value: { ok: false, value: '', error: '', pending: true } },
		)
		const hasError = () => !!result.get().error

		return {
			callout: [show(() => !result.get().ok), toggleClass('danger', hasError)],
			loading: show(() => !!result.get().pending),
			error: [show(hasError), setText(() => result.get().error ?? '')],
			content: [
				show(() => result.get().ok),
				dangerouslySetInnerHTML(() => result.get().value ?? '', {
					allowScripts: host.hasAttribute('allow-scripts'),
				}),
			],
		}
	},
)
