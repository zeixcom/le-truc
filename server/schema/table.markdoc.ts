import { type Node, type Schema, Tag } from '@markdoc/markdoc'

const table: Schema = {
	children: ['table'],
	transform(node: Node, config) {
		const children = node.transformChildren(config)
		return new Tag('module-scrollarea', { orientation: 'horizontal' }, children)
	},
}

export default table
