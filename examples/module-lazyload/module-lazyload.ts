import {
	type Component,
	createComputed,
	createState,
	dangerouslySetInnerHTML,
	defineComponent,
	setText,
	show,
	toggleClass,
	UNSET,
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
	({ host }) => {
		const error = createState('')
		const content = createComputed<string>(async (prev, abort) => {
			const url = host.src.value
			if (host.src.error || !url) {
				error.set(host.src.error ?? 'No URL provided')
				return prev
			}

			try {
				error.set('')
				const { content } = await fetchWithCache(url, abort)
				return content
			} catch (err) {
				error.set(err instanceof Error ? err.message : String(err))
				return prev
			}
		})

		return {
			callout: [
				show(() => !!error.get() || content.get() === UNSET),
				toggleClass('danger', () => !!error.get()),
			],
			loading: [show(() => content.get() === UNSET)],
			error: [show(() => !!error.get()), setText(error)],
			content: [
				show(() => !error.get() && content.get() !== UNSET),
				dangerouslySetInnerHTML(content),
			],
		}
	},
)
