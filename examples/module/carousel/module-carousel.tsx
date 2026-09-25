/**
 * Wave-4 migration (LT-108) of the hand-written module-carousel.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what the `carousel` Markdoc schema authors
 * (`server/schema/carousel.markdoc.ts`): a visually hidden heading, one
 * tabpanel per slide (an `h3` title plus a `.slide-content` body), and a nav
 * of prev/next buttons and one dot per slide. The schema's page occurrences
 * never pass through this render; the client binds to either markup.
 *
 * Both loops render static seeds only (the first slide current, its dot
 * selected), exactly as the schema does, and setup keeps the twin's two
 * `each()` blocks. Per-item reactive attributes cannot replace them: the
 * slide predicate reads the tabpanel collection, which a loop body cannot
 * (LTC005), and a dot thunk over `host.index` would fold `index`'s
 * initializer, a DOM harvest the server cannot evaluate (LTC046). The rest
 * of setup is the twin's too —
 * the observer effect with its cleanup (the LT-103 idiom), the `index`
 * watcher, and the click and key handlers — except:
 * - `isNavigating`/`lastScrolled` become fields of one const record (a `let`
 *   is outside the setup subset, LTC005);
 * - `clamp` moves into setup (module-scope names are not client-known);
 * - the `slides` collection is named `panels`: `slides` is the server arg.
 */

import {
	bindProperty,
	bindVisible,
	each,
	type FactoryContext,
} from '@zeix/le-truc'

export type ModuleCarouselProps = {
	/** Zero-based index of the currently visible slide. */
	index: number
}

/** One slide: its title (the `h3` and the dot's label) and body markup. */
export type ModuleCarouselSlide = {
	title: string
	/**
	 * Markup for the slide's `.slide-content` body, rendered through
	 * `truc:html`: escaped until the host configures a sanitizer
	 * (`configureHtmlSanitizer`, ADR 0010).
	 */
	content?: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-carousel': HTMLElement & ModuleCarouselProps
	}
}

/**
 * An accessible image carousel with dot navigation, prev/next buttons, and scroll-snap support.
 * Use it for image galleries or feature showcases — provides ARIA tabpanel semantics,
 * keyboard navigation (Arrow keys to move between slides), and focus management.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-carousel} Interactive preview and usage examples
 **/
export function ModuleCarousel(
	{
		carouselId = 'carousel',
		label = 'Slides',
		slides: slideList,
	}: {
		/**
		 * Prefix of every slide's `id` (and each dot's `aria-controls`). Unique
		 * per DOCUMENT, so it belongs to whoever places the component (LTC042).
		 */
		carouselId?: string
		/** The visually hidden heading above the slides. */
		label?: string
		slides: ModuleCarouselSlide[]
	},
	{ all, expose, first, host, on, watch }: FactoryContext<ModuleCarouselProps>,
) {
	const clamp = (index: number, total: number) =>
		Math.max(0, Math.min(index, total - 1))

	const panels = all('[role="tabpanel"]')

	expose({
		// `all()` inline, not the `panels` const: the server module drops a
		// const that reads a client-only primitive, so an `expose()` reading
		// it asks for a value no tier can produce (LTC046).
		index: Math.max(
			all('[role="tabpanel"]')
				.get()
				.findIndex(slide => slide.ariaCurrent === 'true'),
			0,
		),
	})

	const scroll = { isNavigating: false, lastScrolled: -1 }

	// Set up IntersectionObserver to detect scroll-based navigation.
	// No signal dependency — watch(() => true, …) runs the setup once on
	// connect and its returned cleanup disconnects the observer on disconnect.
	watch(
		() => true,
		() => {
			const observer = new IntersectionObserver(
				entries => {
					for (const entry of entries) {
						if (entry.intersectionRatio > 0.5) {
							const slideIndex = panels
								.get()
								.indexOf(entry.target as HTMLElement)
							if (scroll.isNavigating) {
								if (slideIndex === host.index) scroll.isNavigating = false
							} else if (slideIndex !== host.index && slideIndex >= 0) {
								scroll.lastScrolled = slideIndex
								host.index = slideIndex
							}
							break
						}
					}
				},
				{ root: host, threshold: 0.5 },
			)
			for (const slide of panels.get()) observer.observe(slide)
			return () => observer.disconnect()
		},
	)

	// Scroll to slide when index changes (skip if IO already scrolled there)
	watch('index', idx => {
		if (scroll.lastScrolled < 0) {
			scroll.lastScrolled = idx
			return
		}
		if (scroll.lastScrolled !== idx) {
			scroll.lastScrolled = idx
			scroll.isNavigating = true
			panels
				.get()
				[idx]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		}
	})

	const prev = first('button.prev', 'Add a previous button')
	const next = first('button.next', 'Add a next button')

	// Prev button: move focus to next when hidden
	on(prev, 'click', () => {
		const newIndex = clamp(host.index - 1, panels.get().length)
		host.index = newIndex
		if (newIndex === 0) next.focus()
	})

	// Next button: move focus to prev when hidden
	on(next, 'click', () => {
		const newIndex = clamp(host.index + 1, panels.get().length)
		host.index = newIndex
		if (newIndex === panels.get().length - 1) prev.focus()
	})

	// Dot navigation
	const dots = all('button[role="tab"]')
	on(dots, 'click', (_e, target) => {
		host.index = parseInt(target.dataset.index || '0')
	})

	// Keyboard navigation for all nav buttons (prev, next, dots)
	const buttons = all('nav button')
	on(buttons, 'keyup', e => {
		const { key } = e
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
		e.preventDefault()
		e.stopPropagation()

		const length = panels.get().length
		const newIndex =
			key === 'Home'
				? 0
				: key === 'End'
					? length - 1
					: clamp(host.index + (key === 'ArrowLeft' ? -1 : 1), length)
		host.index = newIndex
		if (newIndex === 0 && document.activeElement === prev) {
			next.focus()
		} else if (newIndex === length - 1 && document.activeElement === next) {
			prev.focus()
		} else if (document.activeElement) {
			const dotElements = dots.get()
			if (dotElements.includes(document.activeElement as HTMLButtonElement))
				dotElements[newIndex]!.focus()
		}
	})

	// Effects for slides
	each(panels, slide =>
		watch(
			() => String(slide.id === panels.get()[host.index]?.id),
			bindProperty(slide, 'ariaCurrent'),
		),
	)

	// Effects for dot navigation
	each(dots, dot =>
		watch(
			() => dot.dataset.index === String(host.index),
			selected => {
				dot.ariaSelected = String(selected)
				dot.tabIndex = selected ? 0 : -1
			},
		),
	)

	// Effects for prev/next navigation
	watch(() => host.index > 0, bindVisible(prev))
	watch(() => host.index < panels.get().length - 1, bindVisible(next))

	return (
		<>
			<module-carousel>
				<h2 class="visually-hidden">{label}</h2>
				<div class="slides" tabindex={0}>
					{slideList.map((slide, i) => {
						const slideId = `${carouselId}-slide${i + 1}`
						const body = slide.content ?? ''
						return (
							<div
								id={slideId}
								role="tabpanel"
								aria-current={i === 0 ? 'true' : 'false'}
							>
								<h3>{slide.title}</h3>
								<div class="slide-content" truc:html={body} />
							</div>
						)
					})}
				</div>
				<nav aria-label="Carousel Navigation">
					<button type="button" class="prev" aria-label="Previous">
						❮
					</button>
					<button type="button" class="next" aria-label="Next">
						❯
					</button>
					<div role="tablist" aria-label="Carousel Slides">
						{slideList.map((slide, i) => {
							const dotIndex = String(i)
							return (
								<button
									type="button"
									role="tab"
									aria-controls={`${carouselId}-slide${i + 1}`}
									aria-label={slide.title}
									data-index={dotIndex}
									aria-selected={i === 0 ? 'true' : 'false'}
									tabindex={i === 0 ? 0 : -1}
								>
									●
								</button>
							)
						})}
					</div>
				</nav>
			</module-carousel>
			<style>{css`
module-carousel {
	display: flex;
	position: relative;
	overflow: hidden;
	margin-block-end: var(--space-l);
	border-radius: var(--space-s);
	container: carousel / inline-size;

	.slides {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: calc(100cqi / (16 / 9));
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-behavior: smooth;
		overscroll-behavior-x: none;
	}

	[role="tabpanel"] {
		width: 100%;
		height: calc(100% - var(--input-height));
		padding-bottom: var(--input-height);
		text-align: center;
		scroll-snap-align: start;
		flex: 0 0 100%;

		&.blue {
			background-color: light-dark(var(--color-blue-20), var(--color-blue-80));
			--color-text: light-dark(var(--color-blue-90), var(--color-blue-10));
			--color-text-soft: light-dark(var(--color-blue-80), var(--color-blue-20));
		}

		&.purple {
			background-color: light-dark(
				var(--color-purple-20),
				var(--color-purple-80)
			);
			--color-text: light-dark(var(--color-purple-90), var(--color-purple-10));
			--color-text-soft: light-dark(
				var(--color-purple-80),
				var(--color-purple-20)
			);
		}

		&.pink {
			background-color: light-dark(var(--color-pink-20), var(--color-pink-80));
			--color-text: light-dark(var(--color-pink-90), var(--color-pink-10));
			--color-text-soft: light-dark(var(--color-pink-80), var(--color-pink-20));
		}

		&.orange {
			background-color: light-dark(
				var(--color-orange-20),
				var(--color-orange-80)
			);
			--color-text: light-dark(var(--color-orange-90), var(--color-orange-10));
			--color-text-soft: light-dark(
				var(--color-orange-80),
				var(--color-orange-20)
			);
		}

		&.green {
			background-color: light-dark(
				var(--color-green-20),
				var(--color-green-80)
			);
			--color-text: light-dark(var(--color-green-90), var(--color-green-10));
			--color-text-soft: light-dark(
				var(--color-green-80),
				var(--color-green-20)
			);
		}

		& h3 {
			display: block;
		}

		& a[href].anchor {
			justify-content: center;
			padding: 0;
		}

		.slide-content {
			width: 80%;
			margin: 0 auto 0;
			padding-bottom: var(--space-xl);
			text-align: left;
		}
	}

	> nav {
		> button {
			position: absolute;
			top: 2%;
			height: 96%;
			border: 0;
			border-radius: var(--space-xs);
			background: transparent;
			padding: var(--space-m);
			font-size: var(--font-size-xl);
			color: var(--color-text);
			opacity: var(--opacity-dimmed);
			transition: opacity var(--transition-short) var(--easing-inout);
			cursor: pointer;

			&:hover,
			&:active,
			&:focus {
				opacity: var(--opacity-solid);
			}

			&:hover {
				background-color: var(--color-overlay-hover);
			}

			&:active {
				background-color: var(--color-overlay-active);
			}

			&.prev {
				left: 1%;
			}

			&.next {
				right: 1%;
			}
		}

		[role="tablist"] {
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			display: flex;
			justify-content: center;
			margin-block: var(--space-m);

			[role="tab"] {
				width: var(--space-l);
				height: var(--space-l);
				border: 0;
				padding: 0;
				font-size: var(--font-size-l);
				line-height: var(--line-height-xs);
				border-radius: 50%;
				color: var(--color-text);
				background-color: transparent;
				opacity: var(--opacity-translucent);
				transition: opacity var(--transition-short) var(--easing-inout);
				cursor: pointer;

				&:hover {
					opacity: var(--opacity-dimmed);
				}

				&[aria-selected="true"] {
					opacity: var(--opacity-solid);
				}
			}
		}
	}
}
`}</style>
		</>
	)
}
