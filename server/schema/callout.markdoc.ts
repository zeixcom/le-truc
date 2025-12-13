import type { Schema } from '@markdoc/markdoc'
import { richChildren, titleAttribute } from '../markdoc-helpers'

const callout: Schema = {
	render: 'card-callout',
	children: richChildren,
	attributes: {
		class: {
			type: String,
			default: 'info',
			matches: ['info', 'tip', 'danger', 'note', 'caution'],
		},
		title: titleAttribute,
	},
}

export default callout
