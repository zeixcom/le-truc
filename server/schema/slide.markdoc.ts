import type { Schema } from '@markdoc/markdoc'
import {
	requiredTitleAttribute,
	standardChildren,
	styleAttribute,
} from '../markdoc-helpers'

const slide: Schema = {
	render: 'div',
	children: standardChildren,
	attributes: {
		title: requiredTitleAttribute,
		style: styleAttribute,
	},
}

export default slide
