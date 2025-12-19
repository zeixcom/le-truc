import Markdoc, { type Node, type Schema, type Tag } from '@markdoc/markdoc'
import { html } from '../markdoc-helpers'

const fence: Schema = {
	render: 'module-codeblock',
	attributes: {
		...Markdoc.nodes.fence.attributes,
	},
	transform(node: Node) {
		// Use node attributes directly instead of transformAttributes
		const code = node.attributes.content || ''
		let language = node.attributes.language || 'text'
		let filename: string | undefined

		// Parse language and filename from info string (e.g., "html#filename.html")
		if (language.includes('#')) {
			const parts = language.split('#')
			language = parts[0]
			filename = parts[1]
		}

		// Determine if code should be collapsed (>10 lines)
		const collapsed = code.split('\n').length > 10

		return html`<module-codeblock
			language="${language}"
			${collapsed ? 'collapsed' : ''}
		>
			<p class="meta">
				${filename && html`<span class="file">${filename}</span>`}
				<span class="language">${language}</span>
			</p>
			<pre
				data-language="${language}"
			><code class="language-${language}">${code}</code></pre>
			<basic-button
				class="copy"
				copy-success="Copied!"
				copy-error="Error trying to copy to clipboard!"
			>
				<button type="button" class="secondary small">
					<span class="label">Copy</span>
				</button>
			</basic-button>
			${collapsed
			&& html`<button type="button" class="overlay" aria-expanded="false">
				Expand
			</button>`}
		</module-codeblock>`
	},
}

export default fence
