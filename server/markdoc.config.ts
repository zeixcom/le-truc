import callout from './schema/callout.markdoc'
import carousel from './schema/carousel.markdoc'
import demo from './schema/demo.markdoc'
import fence from './schema/fence.markdoc'
import heading from './schema/heading.markdoc'
import hero from './schema/hero.markdoc'
import link from './schema/link.markdoc'
import listnav from './schema/listnav.markdoc'
import section from './schema/section.markdoc'
import slide from './schema/slide.markdoc'
import sources from './schema/sources.markdoc'
import table from './schema/table.markdoc'
import tabgroup from './schema/tabgroup.markdoc'

export const markdocConfig = {
	nodes: {
		fence,
		heading,
		link,
	},
	tags: {
		callout,
		carousel,
		demo,
		listnav,
		sources,
		slide,
		section,
		hero,
		table,
		tabgroup,
	},
}

export default markdocConfig
