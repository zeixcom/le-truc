import { type Node, type Schema } from '@markdoc/markdoc'
import { commonAttributes, html, renderChildren } from '../markdoc-helpers'

const carousel: Schema = {
	render: 'module-carousel',
	children: ['slide', 'tag'],
	attributes: commonAttributes,
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
			const { title, style } = slideNode.attributes || {}

			if (!title) {
				throw new Error('Slide must have a title attribute')
			}

			// Create slide div with proper attributes
			const slideId = `slide${index + 1}`

			return {
				slide: html`<div
					id="${slideId}"
					role="tabpanel"
					aria-current="${String(index === 0)}"
					${style && `style="${style}"`}
				>
					<h3>${title}</h3>
					<div class="slide-content">
						${renderChildren(slideNode.children || [])}
					</div>
				</div>`,
				title,
				id: slideId,
			}
		})

		return html`<module-carousel>
			<h2 class="visually-hidden">Slides</h2>
			<div class="slides">${slides.map(s => s.slide)}</div>
			<nav aria-label="Carousel Navigation">
				<button type="button" class="prev" aria-label="Previous slide">
					❮
				</button>
				<button type="button" class="next" aria-label="Next slide">❯</button>
				<div role="tablist">
					${slides.map((slide, index) => {
						const isSelected = index === 0
						return html`<button
							role="tab"
							id="${slide.id}"
							aria-controls="${slide.id}"
							aria-label="${slide.title}"
							aria-selected="${String(isSelected)}"
							data-index="${String(index)}"
							tabindex="${isSelected ? '0' : '-1'}"
						>
							●
						</button>`
					})}
				</div>
			</nav>
		</module-carousel>`
	},
}

export default carousel
