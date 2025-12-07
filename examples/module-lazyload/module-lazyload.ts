import {
	type Component,
	createComputed,
	dangerouslySetInnerHTML,
	defineComponent,
	resolve,
	setText,
	show,
	toggleClass,
} from '../..'
import { asURL, fetchWithCache } from '../_common/fetch'

type ModuleLazyloadProps = {
	src: { value: string; error: string }
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
		src: asURL(),
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
		const response = createComputed<string>(async (_prev, abort) => {
			const url = host.src.value
			if (host.src.error || !url)
				throw new Error(host.src.error ?? 'No URL provided')
			const { content } = await fetchWithCache(url, abort)
			return content
		})
		const result = createComputed(() => resolve({ response }))
		const hasError = () => !!result.get().errors

		return {
			callout: [
				show(() => !result.get().ok),
				toggleClass('danger', hasError),
			],
			loading: [show(() => !!result.get().pending)],
			error: [
				show(hasError),
				setText(() => result.get().errors?.[0].message ?? ''),
			],
			content: [
				show(() => result.get().ok),
				dangerouslySetInnerHTML(
					() => result.get().values?.response ?? '',
					{ allowScripts: host.hasAttribute('allow-scripts') },
				),
			],
		}
	},
)
