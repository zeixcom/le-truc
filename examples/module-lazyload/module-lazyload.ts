import {
	type Component,
	component,
	computed,
	dangerouslySetInnerHTML,
	setText,
	show,
	state,
	toggleClass,
	UNSET,
} from '../..'
import { asURL, fetchWithCache } from '../_common/fetch'

type ModuleLazyloadProps = {
	readonly ui: Record<
		'callout' | 'loading' | 'error' | 'content',
		HTMLElement
	>
	src: { value: string; error: string }
}

declare global {
	interface HTMLElementTagNameMap {
		'module-lazyload': Component<ModuleLazyloadProps>
	}
}

export default component<ModuleLazyloadProps>(
	'module-lazyload',
	{
		ui: ({ first }) => ({
			callout: first(
				'card-callout',
				'Needed to display loading state and error messages.',
			),
			loading: first('.loading', 'Needed to display loading state.'),
			error: first('.error', 'Needed to display error messages.'),
			content: first('.content', 'Needed to display content.'),
		}),
		src: asURL,
	},
	el => {
		const error = state('')
		const content = computed(async abort => {
			const url = el.src.value
			if (el.src.error || !url) {
				error.set(el.src.error ?? 'No URL provided')
				return ''
			}

			try {
				error.set('')
				const { content } = await fetchWithCache(url, abort)
				return content
			} catch (err) {
				error.set(err instanceof Error ? err.message : String(err))
				return ''
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
