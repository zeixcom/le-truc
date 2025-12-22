import type { Schema } from '@markdoc/markdoc'
import { STANDARD_CHILDREN } from '../utils'

const slide: Schema = {
	render: 'div',
	children: STANDARD_CHILDREN,
	attributes: {
		title: {
			type: String,
			required: true,
		},
		style: {
			type: String,
		},
	},
}

export default slide
