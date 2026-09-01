import {
	bindAria,
	bindClass,
	createState,
	defineComponent,
} from '../../../index'

export type SectionMenuProps = {
	/** Whether the mobile off-canvas drawer is open. No effect above the 48em breakpoint. */
	open: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'section-menu': HTMLElement & SectionMenuProps
	}
}

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

/**
 * Persistent site navigation. Above the 48em breakpoint it renders as an
 * always-visible sticky sidebar; below it, an off-canvas drawer with a
 * backdrop, opened by an external toggle button (`#sidebar-toggle`, see
 * `TOGGLE_ID`) and closed on Escape, outside click, or link navigation.
 *
 * Progressive enhancement: without JS the element carries no `.js` class,
 * so it stays in normal document flow at every width — every link stays
 * reachable even with script disabled. `defineComponent` adds the `.js`
 * class on connect, which is what lets CSS switch to the off-canvas drawer
 * below 48em.
 *
 * Structural chrome, not a showcased example — no `.md`/gallery entry (same
 * as `section-hero`, `module-toc`, etc.), so no `@demo` link here.
 **/
export default defineComponent<SectionMenuProps>(
	'section-menu',
	({ expose, host, on, watch }) => {
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
		let backdrop = host.querySelector<HTMLElement>(
			`:scope > .${BACKDROP_CLASS}`,
		)
		if (!backdrop) {
			backdrop = document.createElement('div')
			backdrop.className = BACKDROP_CLASS
			// Prepend, not append — must sit behind the `<nav>` drawer panel
			// in paint order (CSS also pins this with explicit z-index, in
			// case markup ever adds the backdrop itself).
			host.prepend(backdrop)
		}

		watch(open, bindClass(host, OPEN_CLASS))

		const toggle = document.getElementById(TOGGLE_ID)
		if (toggle) {
			watch(open, bindAria(toggle, 'ariaExpanded'))
			on(toggle, 'click', () => ({ open: !open.get() }))
		}

		on(backdrop, 'click', () => ({ open: false }))

		// Document-level listeners for Escape, outside click, and
		// link-navigation close — none of these targets (document, the
		// external toggle already handled above) are descendants of host,
		// so they can't be wired through `on()`'s host-scoped collector in
		// the same way; wrapped per the hand-authored-descriptor convention
		// (see module-listnav's hashchange listener for prior art).
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
	},
)
