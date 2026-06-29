import type { Schema } from '@markdoc/markdoc'
import { commonAttributes, standardChildren } from '../markdoc-constants'

const section: Schema = {
	render: 'section',
	children: [...standardChildren, 'table'],
	attributes: commonAttributes,
}

export default section
