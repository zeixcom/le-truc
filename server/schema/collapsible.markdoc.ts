import { type Config, type Node, type Schema, Tag } from '@markdoc/markdoc'
import { requiredTitleAttribute, richChildren } from '../markdoc-constants'
import { transformChildrenWithConfig } from '../markdoc-helpers'

const collapsible: Schema = {
	render: 'card-collapsible',
	children: [...richChildren, 'table'],
	attributes: {
		title: requiredTitleAttribute,
	},
	transform(node: Node, config: Config) {
		const { title } = node.attributes
		const children = transformChildrenWithConfig(node.children ?? [], config)
		return new Tag('card-collapsible', {}, [
			new Tag('details', {}, [
				new Tag('summary', {}, [
					new Tag('span', { class: 'description' }, [title]),
				]),
				new Tag('div', { class: 'content' }, children),
			]),
		])
	},
}

export default collapsible
