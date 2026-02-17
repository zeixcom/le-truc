import Markdoc, {
	type Config,
	type Node,
	type Schema,
	type Tag,
} from '@markdoc/markdoc'
import { createAccessibleHeading } from '../markdoc-helpers'

const heading: Schema = {
	...Markdoc.nodes.heading,
	transform(node: Node, config: Config) {
		if (!Markdoc.nodes.heading.transform) {
			throw new Error('Markdoc.nodes.heading.transform is not defined')
		}
		const base = Markdoc.nodes.heading.transform(node, config) as Tag

		const text =
			base.children?.filter(child => typeof child === 'string').join(' ') || ''
		return createAccessibleHeading(node.attributes.level, text)
	},
}

export default heading
