import { type Config, type Node, type Schema, Tag } from '@markdoc/markdoc'
import {
	CalloutClassAttribute,
	richChildren,
	titleAttribute,
} from '../markdoc-constants'
import { transformChildrenWithConfig } from '../markdoc-helpers'

const classAttr = new CalloutClassAttribute()

const callout: Schema = {
	render: 'card-callout',
	children: richChildren,
	attributes: {
		class: {
			type: CalloutClassAttribute,
			default: 'info',
		},
		title: titleAttribute,
	},
	transform(node: Node, config: Config) {
		const cls = classAttr.transform(node.attributes.class)
		const title = node.attributes.title as string | undefined
		const children = transformChildrenWithConfig(node.children ?? [], config)
		if (title)
			children.unshift(new Tag('p', {}, [new Tag('strong', {}, [title])]))
		return new Tag('card-callout', { class: cls }, children)
	},
}

export default callout
