import Markdoc, {
	type Config,
	type Node,
	type Schema,
	type Tag,
} from '@markdoc/markdoc'
import {
	createAccessibleHeading,
	extractTextFromNode,
} from '../markdoc-helpers'

const heading: Schema = {
	...Markdoc.nodes.heading,
	transform(node: Node, config: Config) {
		// Extract text from the original node's children before transformation
		const text = extractTextFromNode(node)
		return createAccessibleHeading(node.attributes.level, text)
	},
}

export default heading
