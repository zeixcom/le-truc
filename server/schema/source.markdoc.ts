import { type Node, type Schema } from '@markdoc/markdoc'
import { html } from '../markdoc-helpers'

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

		// Return the complete details structure
		return html`<details>
			<summary>${title}</summary>
			<module-lazyload src="${src}">
				<card-callout>
					<p class="loading" role="status" aria-live="polite">Loading...</p>
					<p class="error" role="alert" aria-live="assertive" hidden></p>
				</card-callout>
				<div class="content"></div>
			</module-lazyload>
		</details>`
	},
}

export default source
