import { type Node, type Schema, Tag } from '@markdoc/markdoc'

const source: Schema = {
	render: 'details',
	selfClosing: true,
	attributes: {
		title: {
			type: String,
			required: true,
		},
		src: {
			type: String,
			required: true,
		},
	},
	transform(node: Node) {
		const { title, src } = node.attributes

		// Create the summary element
		const summary = new Tag('summary', {}, [title])

		// Create the module-lazyload structure
		const loadingCallout = new Tag('card-callout', {}, [
			new Tag(
				'p',
				{ class: 'loading', role: 'status', 'aria-live': 'polite' },
				['Loading...'],
			),
			new Tag(
				'p',
				{
					class: 'error',
					role: 'alert',
					'aria-live': 'assertive',
					hidden: true,
				},
				[],
			),
		])

		const contentDiv = new Tag('div', { class: 'content' }, [])

		const lazyload = new Tag('module-lazyload', { src }, [
			loadingCallout,
			contentDiv,
		])

		// Return the complete details structure
		return new Tag('details', node.attributes, [summary, lazyload])
	},
}

export default source
