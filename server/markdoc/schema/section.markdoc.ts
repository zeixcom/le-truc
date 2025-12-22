import type { Schema } from '@markdoc/markdoc'
import { COMMON_ATTRIBUTES } from '../attributes'
import { STANDARD_CHILDREN } from '../utils'

const section: Schema = {
	render: 'section',
	children: STANDARD_CHILDREN,
	attributes: COMMON_ATTRIBUTES,
}

export default section
