import { type Node, type Schema, Tag } from '@markdoc/markdoc'
import {
	commonAttributes,
	createNavigationButton,
	createTabButton,
	createVisuallyHiddenHeading,
	transformChildrenWithConfig,
} from '../markdoc-helpers'

const carousel: Schema = {
	render: 'module-carousel',
	children: ['slide', 'tag'],
	attributes: {
		...commonAttributes,
		'auto-play': {
			type: Boolean,
			default: false,
		},
		interval: {
			type: Number,
			default: 5000,
		},
	},
	transform(node: Node) {
		// Extract slides from children
		const slideNodes =
			node.children?.filter(
				child => child.type === 'tag' && child.tag === 'slide',
			) || []

		if (slideNodes.length === 0) {
			throw new Error('Carousel must contain at least one slide')
		}

		// Transform each slide
		const slides = slideNodes.map((slideNode, index) => {
			const title = slideNode.attributes?.title
			const style = slideNode.attributes?.style

			if (!title) {
				throw new Error('Slide must have a title attribute')
			}

			// Transform slide content
			const slideContent = transformChildrenWithConfig(slideNode.children || [])

			// Create slide title as h3
			const slideTitle = new Tag('h3', {}, [title])

			// Wrap content in slide-content div
			const slideContentDiv = new Tag(
				'div',
				{ class: 'slide-content' },
				slideContent,
			)

			// Create slide div with proper attributes
			const slideId = `slide${index + 1}`
			const slideAttributes: Record<string, string> = {
				id: slideId,
				role: 'tabpanel',
				'aria-current': index === 0 ? 'true' : 'false',
			}

			if (style) {
				slideAttributes.style = style
			}

			return {
				slide: new Tag('div', slideAttributes, [slideTitle, slideContentDiv]),
				title,
				id: slideId,
			}
		})

		// Create slides container
		const slidesContainer = new Tag(
			'div',
			{ class: 'slides' },
			slides.map(s => s.slide),
		)

		// Create navigation buttons
		const prevButton = createNavigationButton('prev')
		const nextButton = createNavigationButton('next')

		// Create tab buttons for navigation
		const tabButtons = slides.map((slide, index) => {
			return createTabButton({
				id: `tab_${slide.id}`,
				label: slide.title,
				controls: slide.id,
				selected: index === 0,
				index,
			})
		})

		const tablist = new Tag('div', { role: 'tablist' }, tabButtons)

		// Create navigation container
		const navigation = new Tag('nav', { 'aria-label': 'Carousel Navigation' }, [
			prevButton,
			nextButton,
			tablist,
		])

		// Add visually hidden heading for accessibility
		const hiddenHeading = createVisuallyHiddenHeading('Slides')

		return new Tag('module-carousel', node.attributes, [
			hiddenHeading,
			slidesContainer,
			navigation,
		])
	},
}

export default carousel
