import type { Schema } from '@markdoc/markdoc'
import { commonAttributes, standardChildren } from '../markdoc-constants'

const section: Schema = {
	render: 'section',
	children: standardChildren,
	attributes: commonAttributes,
}

export default section
