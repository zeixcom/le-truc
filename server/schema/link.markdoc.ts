import Markdoc, { type Node, type Schema, Tag } from '@markdoc/markdoc'

const link: Schema = {
	...Markdoc.nodes.link,
	transform(node: Node, config) {
		const base = Markdoc.nodes.link.transform?.(node, config) as Tag
		if (!base || base.name !== 'a') return base

		// Get the href attribute
		const href = base.attributes?.href

		if (typeof href === 'string' && href.endsWith('.md')) {
			// Convert .md to .html for internal links
			return new Tag(
				'a',
				{
					...base.attributes,
					href: href.replace(/\.md$/, '.html'),
				},
				base.children,
			)
		}

		return base
	},
}

export default link
