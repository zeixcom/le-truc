import Markdoc, { type Node, type Schema } from '@markdoc/markdoc'
import {
	commonAttributes,
	richChildren,
	splitContentBySeparator,
	transformChildrenWithConfig,
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
				.map((child: Node) => extractRawContent(child))
				.join('\n')
		} else if (sections.length === 1) {
			// No separator found, treat all content as HTML preview
			previewContent = sections[0]
				.map((child: Node) => extractRawContent(child))
				.join('\n')
		}

		// Transform the markdown nodes after the separator
		const transformedMarkdown =
			transformChildrenWithConfig(markdownNodes).filter(Boolean)

		// Store raw HTML as attribute for post-processing, similar to module-codeblock
		return new Markdoc.Tag(
			'module-demo',
			{
				...node.attributes,
				'preview-html': previewContent,
			},
			transformedMarkdown,
		)
	},
}

function extractRawContent(node: Node): string {
	if (node.type === 'text') {
		const content = node.attributes.content || ''
		// Normalize whitespace: replace line breaks and multiple spaces with single spaces
		return content.replace(/\s+/g, ' ')
	}

	if (node.type === 'paragraph') {
		return node.children?.map(extractRawContent).join(' ') || ''
	}

	if (node.type === 'inline') {
		return node.children?.map(extractRawContent).join(' ') || ''
	}

	if (node.children && node.children.length > 0) {
		return node.children.map(extractRawContent).join(' ')
	}

	return node.attributes?.content || ''
}

export default demo
