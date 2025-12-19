import { type Node, type Schema } from '@markdoc/markdoc'
import {
	commonAttributes,
	h,
	richChildren,
	splitContentBySeparator,
	renderChildren,
	extractTextFromNode,
} from '../markdoc-helpers'

const demo: Schema = {
	render: 'module-demo',
	children: [...richChildren, 'document', 'source'],
	attributes: commonAttributes,
	transform(node: Node) {
		// Split content by HR separator
		const sections = splitContentBySeparator(node.children || [])

		let previewContent: string = ''
		let markdownNodes: Node[] = []

		if (sections.length >= 2) {
			// First section is HTML preview, remaining sections are Markdown
			const previewSection = sections[0]
			markdownNodes = sections.slice(1).flat()

			// Extract raw HTML from preview section
			previewContent = previewSection
				.map((child: Node) => extractTextFromNode(child))
				.join('\n')
		} else if (sections.length === 1) {
			// No separator found, treat all content as HTML preview
			previewContent = sections[0]
				.map((child: Node) => extractTextFromNode(child))
				.join('\n')
		}

		// Store raw HTML as attribute for post-processing, similar to module-codeblock
		return h(
			'module-demo',
			{
				...node.attributes,
				'preview-html': previewContent,
			},
			renderChildren(markdownNodes).filter(Boolean),
		)
	},
}

export default demo
