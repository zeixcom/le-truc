import type { Node, Schema } from '@markdoc/markdoc'
import { COMMON_ATTRIBUTES } from '../attributes'
import { h, RICH_CHILDREN, renderChildren } from '../utils'

const demo: Schema = {
	render: 'module-demo',
	children: [...RICH_CHILDREN, 'document', 'sources'],
	attributes: COMMON_ATTRIBUTES,
	transform(node: Node) {
		const children = node.children || []
		let previewContent: string = ''
		let markdownNodes: Node[] = []

		// Find the first fence node with HTML content for preview
		const htmlFenceIndex = children.findIndex(
			child =>
				child.type === 'fence'
				&& (child.attributes.language === 'html' || !child.attributes.language),
		)

		if (htmlFenceIndex !== -1) {
			// Use raw content from fence node
			const fenceNode = children[htmlFenceIndex]
			previewContent = fenceNode.attributes.content || ''

			// All other nodes become markdown content
			markdownNodes = children.filter((_, index) => index !== htmlFenceIndex)
		}

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
