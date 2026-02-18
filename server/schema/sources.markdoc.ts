import Markdoc, { type Node, type Schema } from '@markdoc/markdoc'

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
		const summary = new Markdoc.Tag('summary', {}, [title])

		// Create the module-lazyload structure
		const loadingCallout = new Markdoc.Tag('card-callout', {}, [
			new Markdoc.Tag(
				'p',
				{ class: 'loading', role: 'status', 'aria-live': 'polite' },
				['Loading...'],
			),
			new Markdoc.Tag(
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

		const contentDiv = new Markdoc.Tag('div', { class: 'content' }, [])

		const lazyload = new Markdoc.Tag('module-lazyload', { src }, [
			loadingCallout,
			contentDiv,
		])

		// Return the complete details structure
		return new Markdoc.Tag('details', node.attributes, [summary, lazyload])
	},
}

export default source
