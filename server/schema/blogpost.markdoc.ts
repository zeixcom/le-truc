import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
	Tag,
} from '@markdoc/markdoc'
import { standardChildren } from '../markdoc-constants'

const blogpost: Schema = {
	render: 'card-blogpost',
	children: standardChildren,
	attributes: {
		url: { type: String, required: true },
		emoji: { type: String },
	},
	transform(node: Node, config: Config) {
		const url = String(node.attributes['url'] ?? '')
		const emoji = String(node.attributes['emoji'] ?? '')

		const children: RenderableTreeNode[] = []

		for (const child of node.children) {
			const transformed = Markdoc.transform(child, config)
			if (!transformed) continue

			if (child.type === 'heading' && transformed instanceof Tag) {
				// Wrap heading children in <a href="url">
				children.push(
					new Tag(transformed.name, transformed.attributes, [
						new Tag(
							'a',
							{ href: url },
							emoji ? [emoji, ...transformed.children] : transformed.children,
						),
					]),
				)
			} else {
				children.push(transformed)
			}
		}

		return new Tag('card-blogpost', { url }, children)
	},
}

export default blogpost
