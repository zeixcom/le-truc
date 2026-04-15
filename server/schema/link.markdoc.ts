import Markdoc, { type Node, type Schema, Tag } from '@markdoc/markdoc'

const link: Schema = {
	...Markdoc.nodes.link,
	transform(node: Node, config) {
		const children = node.transformChildren(config)
		let href = node.attributes.href as string | undefined
		const title = node.attributes.title as string | undefined

		if (
			typeof href === 'string'
			&& !href.includes('://')
			&& !href.startsWith('//')
		) {
			const basePath = config.variables?.['basePath'] as string | undefined

			if (href.endsWith('.md')) {
				href = href.slice(0, -3) + '.html'
			}

			if (basePath && href.startsWith('/') && !href.endsWith('/')) {
				href = basePath + href.slice(1)
			}
		}

		const attrs: Record<string, unknown> = {}
		if (href) attrs.href = href
		if (title) attrs.title = title

		return new Tag('a', attrs, children)
	},
}

export default link
