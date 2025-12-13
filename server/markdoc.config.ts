import callout from './schema/callout.markdoc'
import carousel from './schema/carousel.markdoc'
import demo from './schema/demo.markdoc'
import fence from './schema/fence.markdoc'
import heading from './schema/heading.markdoc'
import hero from './schema/hero.markdoc'
import section from './schema/section.markdoc'
import slide from './schema/slide.markdoc'
import source from './schema/source.markdoc'
import tabgroup from './schema/tabgroup.markdoc'

export const markdocConfig = {
	nodes: {
		fence,
		heading,
	},
	tags: {
		callout,
		carousel,
		demo,
		source,
		slide,
		section,
		hero,
		tabgroup,
	},
}

export default markdocConfig
