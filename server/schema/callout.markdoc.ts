import type { Schema } from '@markdoc/markdoc'
import {
	CalloutClassAttribute,
	richChildren,
	titleAttribute,
} from '../markdoc-helpers'

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
}

export default callout
