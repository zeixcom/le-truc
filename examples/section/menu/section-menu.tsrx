/**
 * The `.tsrx` spelling of `section-menu` (LT-469, ADR 0039) — the variant
 * twin of the served `section-menu.tsx`; the hand-written `.ts` stays as the
 * set's `.ts` twin (LT-111 ruling 5). Every member declares its own
 * `HTMLElementTagNameMap` entry (s4), each with its own identical
 * `SectionMenuProps` alias — a divergence between members is TS 2717.
 *
 * The component is behavior-only chrome: the nav content arrives as
 * page-authored children (`server/templates/menu.ts` and the example page
 * author it), so the template is the host passthrough plus one `<style>`
 * child — nothing else. No `.md`/gallery entry, before or after (same as
 * `section-hero`, `module-toc`).
 *
 * The authored shapes follow the LT-446 rulings, probe-verified on both
 * front ends:
 * - `expose({ open })` stays the live-State identifier form — `el.open = …`
 *   writes through the installed Slot, and an `on()` handler's
 *   `() => ({ open: … })` return updates it;
 * - the five name constants live in setup — module-scope names are not
 *   client-known (LTC005; module-scrollarea's deviation note is the
 *   precedent);
 * - the backdrop stays imperative: `ensureBackdrop()` finds or creates
 *   `:scope > .backdrop` and returns it, and its call IS the `on()`
 *   argument — no setup const ever holds a page-context value, so the
 *   component stays Folded;
 * - the external toggle is looked up inline as the `on()`/`bindAria()`
 *   call argument — both accept nullish targets, so the twin's
 *   `if (toggle)` guard is built into the runtime; the outside-click
 *   handler re-queries the toggle inside the descriptor body, holding no
 *   reference;
 * - document-level listeners ride the twin's
 *   `watch(() => true, descriptor)` idiom verbatim (module-listnav's
 *   compiled form is the corpus precedent).
 */
import { bindAria, bindClass, createState } from '@zeix/le-truc'

export type SectionMenuProps = {
	/** Whether the mobile off-canvas drawer is open. No effect above the 48em breakpoint. */
	open: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'section-menu': HTMLElement & SectionMenuProps
	}
}

/**
 * Persistent site navigation. Above the 48em breakpoint it renders as an
 * always-visible sticky sidebar; below it, an off-canvas drawer with a
 * backdrop, opened by an external toggle button (`#sidebar-toggle`, see
 * `TOGGLE_ID`) and closed on Escape, outside click, or link navigation.
 *
 * Progressive enhancement: without JS the element carries no `.js` class,
 * so it stays in normal document flow at every width — every link stays
 * reachable even with script disabled. The component adds the `.js`
 * class on connect, which is what lets CSS switch to the off-canvas drawer
 * below 48em.
 *
 * Structural chrome, not a showcased example — no `.md`/gallery entry (same
 * as `section-hero`, `module-toc`, etc.), so no `@demo` link here.
 **/
export function SectionMenu({ children = '' }: { children?: string })
	@{
		const JS_CLASS = 'js'
		const READY_CLASS = 'ready'
		const OPEN_CLASS = 'open'
		const BACKDROP_CLASS = 'backdrop'

		/**
		 * Toggle-button contract: the page's mobile nav toggle is a `<button>`
		 * living outside this component (in the slimmed-down page header), wired by
		 * id — `document.getElementById(TOGGLE_ID)` — rather than `first()`, since
		 * `first()` only searches descendants of the host. Matches LT-001's
		 * `docs-src/layouts/*.html` (`id="sidebar-toggle"`, `aria-controls="sidebar"`,
		 * `class="sidebar-toggle"`) and `server/templates/menu.ts` (`<section-menu
		 * id="sidebar">`).
		 */
		const TOGGLE_ID = 'sidebar-toggle'

		const open = createState(false)
		expose({ open })

		// Marks the host as JS-enhanced — CSS gates the off-canvas drawer
		// behavior on this class so the unenhanced state (no JS) stays a
		// normal, fully link-navigable block. One-time, not reactive.
		host.classList.add(JS_CLASS)

		// `.ready` gates the drawer's slide transition (CSS). Adding it a
		// frame later than `.js` means the very first layout — closed,
		// off-canvas — applies instantly instead of visibly animating in
		// from "open" on every page load (there's nothing to animate from;
		// the drawer was never open). Subsequent user-triggered opens/closes
		// transition normally once `.ready` is present.
		requestAnimationFrame(() => host.classList.add(READY_CLASS))

		// Backdrop is purely a JS-drawer affordance — created here rather
		// than expected in server markup, since it's meaningless without JS.
		// The existence check keeps the twin's tolerance of authored markup.
		const ensureBackdrop = () => {
			// An `as` cast, not a querySelector type argument: the generated
			// server module types `host` as `any` (the refStub), and an untyped
			// function call rejects type arguments (TS2347).
			let backdrop = host.querySelector(
				`:scope > .${BACKDROP_CLASS}`,
			) as HTMLElement | null
			if (!backdrop) {
				backdrop = document.createElement('div')
				backdrop.className = BACKDROP_CLASS
				// Prepend, not append — must sit behind the `<nav>` drawer panel
				// in paint order (CSS also pins this with explicit z-index, in
				// case markup ever adds the backdrop itself).
				host.prepend(backdrop)
			}
			return backdrop
		}

		watch(open, bindClass(host, OPEN_CLASS))

		// The toggle lives outside the host: looked up inline as the call
		// argument (a const holding it would read page context, LTC054).
		// `on()` no-ops on a nullish target; `bindAria` makes every handler
		// a no-op — the guard the twin wrote by hand is the runtime's.
		on(document.getElementById(TOGGLE_ID), 'click', () => ({
			open: !open.get(),
		}))
		watch(open, bindAria(document.getElementById(TOGGLE_ID), 'ariaExpanded'))

		on(ensureBackdrop(), 'click', () => ({ open: false }))

		// Document-level listeners for Escape, outside click, and
		// link-navigation close — none of these targets (document, the
		// external toggle) are descendants of host, so they can't be wired
		// through `on()`'s host-scoped collector; wrapped per the
		// hand-authored-descriptor convention (see module-listnav's compiled
		// form for prior art).
		watch(
			() => true,
			() => {
				const onKeydown = (e: KeyboardEvent) => {
					if (e.key === 'Escape' && open.get()) open.set(false)
				}
				const onClick = (e: MouseEvent) => {
					if (!open.get()) return
					const path = e.composedPath()
					const clickedLink = path.some(
						el => el instanceof HTMLAnchorElement && host.contains(el),
					)
					if (clickedLink) {
						open.set(false)
						return
					}
					const toggle = document.getElementById(TOGGLE_ID)
					const insideHostOrToggle =
						path.includes(host) || (!!toggle && path.includes(toggle))
					if (!insideHostOrToggle) open.set(false)
				}
				document.addEventListener('keydown', onKeydown)
				document.addEventListener('click', onClick)
				return () => {
					document.removeEventListener('keydown', onKeydown)
					document.removeEventListener('click', onClick)
				}
			},
		)

		<section-menu>
			{children}
			<style>
			/* Exception to the scoping rule (see module-dialog's
			   body.scroll-lock for prior art): .docs-body/.docs-main are
			   the two-column shell wrapper LT-001 added around
			   <section-menu> in docs-src/layouts/*.html — they're
			   siblings/ancestors of the component, not inside it, but the
			   sidebar-role layout only reads as a sidebar once these are a
			   flex row. Below 48em section-menu is off-canvas (see the
			   max-width query below), so the shell stays a single column
			   there — nothing to coordinate. The page-shell rules are top-level
			   rules outside the @scope block, so they apply page-wide
			   (ADR 0033 s1). */
			:root {
				--header-height: 3rem;
			}

			.docs-body {
				display: block;
			}

			.quicklinks {
				display: none;
			}

			@media screen and (min-width: 45em) {
				.docs-body {
					display: flex;
					align-items: flex-start;
				}

				.docs-main {
					flex: 1 1 auto;
					min-width: 0;
				}
			}

			@media screen and (max-width: 44.999em) {
				/* Toggle button contract: id="sidebar-toggle" (see TOGGLE_ID
				   in the component's setup). Stays above the drawer's fixed,
				   viewport-covering backdrop (z-index 100) so it remains
				   clickable to close while open. */
				#sidebar-toggle {
					z-index: 101;
					position: absolute;
					top: var(--space-m);
					left: 13rem;
					border: 1px solid var(--color-border);
					height: var(--input-height);
					width: var(--input-height);
					border-radius: var(--space-xs);
					background-color: var(--color-secondary);
					font-size: var(--font-size-s);
					line-height: var(--line-height-xs);

					&:hover {
						background-color: var(--color-secondary-hover);
					}

					.open {
						display: none;
					}

					.closed {
						display: block;
					}

					&[aria-expanded="true"] {
						.open {
							display: block;
						}

						.closed {
							display: none;
						}
					}
				}
			}

			@media screen and (min-width: 27em) {
				.docs-header-bar {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.quicklinks {
					display: flex;
					align-items: center;
					gap: var(--space-m);

					& a {
						text-decoration: none;

						&:hover {
							text-decoration: underline;
						}
					}

					& img {
						display: block;
					}
				}
			}

			@media screen and (min-width: 45em) {
				/* Toggle button contract: id="sidebar-toggle" (see TOGGLE_ID
				   in the component's setup). Hidden above the breakpoint
				   since the sidebar is always visible there and has nothing
				   to toggle. */
				#sidebar-toggle {
					display: none;
				}

				header {
					height: var(--header-height);
				}
			}

			@scope {
				:where(:scope) {
					/* Default (no JS, any width): normal in-flow block, all links
					   reachable without script — the drawer behavior below is
					   JS-enhanced only. */
					display: block;
				}

				ol,
				ul {
					display: block;
					list-style: none;
					margin: 0;
					padding: 0;
				}

				li {
					padding: 0;
					margin: 0;
				}

				li.group {
					margin-block-start: var(--space-s);
					padding: var(--space-xs) var(--space-m);
					font-size: var(--font-size-xs);
					font-weight: var(--font-weight-bold);
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: var(--color-text-soft);
				}

				li.group:first-child {
					margin-block-start: 0;
				}

				a {
					display: flex;
					align-items: center;
					gap: var(--space-s);
					padding: var(--space-xs) var(--space-m);
					color: var(--color-text);
					text-decoration: none;
					font-size: var(--font-size-s);
					line-height: var(--line-height-s);

					&:hover,
					&:focus {
						background-color: var(--color-secondary-hover);
					}

					&.active,
					&[aria-current="page"] {
						background-color: var(--color-background-alt);
						color: var(--color-primary);
					}

					.icon {
						display: flex;
						flex: none;
						align-items: center;
						justify-content: center;
						font-size: var(--font-size-m);
						width: var(--space-xl);
						height: var(--space-xl);
						border-radius: 50%;
						background-color: var(--color-background);
						border: 1px solid var(--color-border-soft);
					}

					strong {
						font-size: var(--font-size-m);
						font-weight: var(--font-weight-regular);
						line-height: var(--line-height-s);
						margin: 0;
					}

					&.active,
					&[aria-current="page"] {
						font-weight: var(--font-weight-bold);
					}
				}

				.backdrop {
					display: none;
				}

				/* Off-canvas drawer — only once JS has enhanced the component
				   (.js, added on connect). Without JS, section-menu stays in
				   normal flow at every width (the root rule above). */
				@media screen and (max-width: 44.999em) {
					:where(:scope).js {
						position: fixed;
						inset: 0;
						z-index: 100;
						/* No visibility/transition-delay hiding trick here: a
						   transition on a property that also changes the moment .js
						   is first added (going from the pre-JS default straight to
						   the closed state) delays that very first application too —
						   the drawer would sit visibly "open" for one full
						   --transition-short after every page load. transform +
						   pointer-events alone close it instantly; only the
						   *movement* of <nav> (below) animates. */
						pointer-events: none;

						& module-scrollarea {
							position: absolute;
							z-index: 1;
							inset-block: 0;
							inset-inline-start: 0;
							width: 16rem;
							max-width: 85vw;
							background-color: var(--color-background);
							border-inline-end: 1px solid var(--color-border-soft);
							pointer-events: auto;
							transform: translateX(-100%);
						}

						& .backdrop {
							display: block;
							position: absolute;
							z-index: 0;
							inset: 0;
							background-color: var(--color-shadow);
							opacity: var(--opacity-transparent);
						}
					}

					/* .ready (added a frame after .js) gates the transitions
					   themselves — the closed layout above still applies instantly
					   on connect either way, but without this gate the *first*
					   application of .js would itself be a transitionable change
					   (no .js → .js), animating the drawer sliding out on every
					   page load even though it was never open. */
					:where(:scope).js.ready {
						& module-scrollarea {
							transition: transform var(--transition-short) var(--easing-inout);
						}

						& .backdrop {
							transition: opacity var(--transition-short) var(--easing-inout);
						}
					}

					:where(:scope).js.open {
						pointer-events: auto;

						& module-scrollarea {
							transform: translateX(0);
						}

						& .backdrop {
							opacity: var(--opacity-dimmed);
							pointer-events: auto;
						}
					}
				}

				@media screen and (min-width: 45em) {
					:where(:scope) {
						/* Above the breakpoint the sidebar is always visible, sticky,
						   and independently scrollable — no toggle, no
						   off-canvas/backdrop. */
						position: sticky;
						top: 0;
						align-self: start;
						flex: 0 0 16rem;
						width: 16rem;
					}

					:where(:scope).js {
						visibility: visible;
						pointer-events: auto;
						transition: none;

						& module-scrollarea {
							position: static;
							inset: auto;
							width: auto;
							max-width: none;
							max-height: 100dvh;
							background-color: transparent;
							border-inline-end: none;
							transform: none;
						}

						& .backdrop {
							display: none;
						}
					}
				}
			}
			</style>
		</section-menu>
	}
