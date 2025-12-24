import type { Schema } from '@markdoc/markdoc'
import { CalloutClassAttribute } from '../attributes'
import { RICH_CHILDREN } from '../utils'

const callout: Schema = {
	render: 'card-callout',
	children: RICH_CHILDREN,
	attributes: {
		class: {
			type: CalloutClassAttribute,
			default: 'info',
		},
		title: {
			type: String,
		},
	},
}

export default callout
