import Markdoc, { type Node, type Schema, Tag } from '@markdoc/markdoc'

const link: Schema = {
	...Markdoc.nodes.link,
	transform(node: Node, config) {
		const children = node.transformChildren(config)
		let href = node.attributes.href as string | undefined
		const title = node.attributes.title as string | undefined

		if (
			typeof href === 'string'
			&& href.endsWith('.md')
			&& !href.includes('://')
		) {
			href = href.replace(/\.md$/, '.html')
		}

		const attrs: Record<string, unknown> = {}
		if (href) attrs.href = href
		if (title) attrs.title = title

		return new Tag('a', attrs, children)
	},
}

export default link
