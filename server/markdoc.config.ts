import blogmeta from './schema/blogmeta.markdoc'
import blogpost from './schema/blogpost.markdoc'
import callout from './schema/callout.markdoc'
import carousel from './schema/carousel.markdoc'
import cemList from './schema/cem-list.markdoc'
import collapsible from './schema/collapsible.markdoc'
import demo from './schema/demo.markdoc'
import fence from './schema/fence.markdoc'
import heading from './schema/heading.markdoc'
import hero from './schema/hero.markdoc'
import link from './schema/link.markdoc'
import listnav from './schema/listnav.markdoc'
import section from './schema/section.markdoc'
import slide from './schema/slide.markdoc'
import sources from './schema/sources.markdoc'
import tabgroup from './schema/tabgroup.markdoc'
import table from './schema/table.markdoc'

export const markdocConfig = {
	nodes: {
		fence,
		heading,
		link,
	},
	tags: {
		callout,
		carousel,
		'cem-list': cemList,
		collapsible,
		demo,
		listnav,
		sources,
		slide,
		section,
		hero,
		table,
		tabgroup,
		blogmeta,
		blogpost,
	},
}

export default markdocConfig
