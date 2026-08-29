/**
 * TSRX migration: form-inplace-edit — the hand-written version switches
 * between display and edit mode by imperatively creating/destroying a
 * `<form-textbox>` subtree on each toggle (`watch('editing', …)` in
 * form-inplace-edit.ts). `.tsrx`'s `@if` can't express that: its condition
 * must be server-known and fixed at render time (the DOM keeps whichever
 * branch was rendered; there is no reactive mount/unmount today). This
 * migration renders BOTH the display `<span>` and the composed
 * `<FormTextbox>` unconditionally and toggles `hidden` on each reactively
 * instead — behaviorally equivalent for forms/accessibility (a `hidden`
 * element is inert and out of the tab order) but a real, visible difference
 * from the original: the edit-mode `<form-textbox>` stays attached to the
 * DOM at all times rather than being removed on cancel/commit (the existing
 * `form-inplace-edit.spec.ts`'s `.not.toBeAttached()` assertions describe
 * the hand-written version's behavior, not this one).
 */
import { asBoolean, asString, bindProperty } from '@zeix/le-truc'
import { FormTextbox } from '../textbox/form-textbox.tsrx'

export const config = { formAssociated: true };

export type FormInplaceEditProps = {
	/** Whether the component is currently in edit mode. */
	editing: boolean
	/** The current text value. */
	value: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-inplace-edit': FormAssociatedElement & FormInplaceEditProps
	}
}

/**
 * An inline text field that switches between display and edit mode on click or double-click.
 * Use it for editable labels or inline content — provides ARIA-labelled toggle buttons,
 * keyboard interaction (Enter to confirm, Escape to cancel), and focus management. Form
 * participation is via ElementInternals (`formAssociated()`) with the managed form-control
 * convention — value sync, reset, and disabled propagation to the edit button are library-managed.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-inplace-edit} Interactive preview and usage examples
 **/
export function FormInplaceEdit(
	{
		name,
		value = '',
		editing: initialEditing = false,
	}:
		{
			name: string
			value?: string
			editing?: boolean
		},
)
@{
	const textEl = first('span', 'display text')
	expose({
		editing: asBoolean(false),
		// Children-are-data (LT-112): the initial value is harvested from
		// the owned .text span's text content (the hand-written twin's
		// contract); the host attribute remains a Parser-level override.
		// Optional chaining keeps the server-side ref shim safe.
		value: asString(textEl?.textContent ?? ''),
	});

	// Retired from `onFocusout`/`onKeydown` JSX attributes on `.edit` to bare
	// host-level statements (LT-070/LT-087, now that LT-069 widened the
	// client-only setup-statement gate and LT-087 widened it further to
	// composed-element `ref={}` names) — matches form-inplace-edit.ts's own
	// `on(host, 'focusout'/'keydown', …)` calls exactly, including reading
	// `textbox.value` (the composed `<FormTextbox>`'s `ref={}`, below).
	on(host, 'focusout', (e: FocusEvent) => {
		if (!host.editing) return;
		const related = e.relatedTarget as Element | null;
		if (related && host.contains(related)) return;
		host.editing = false;
	});
	on(host, 'keydown', (e: KeyboardEvent) => {
		if (!host.editing) return;
		if (e.key !== 'Escape' && e.key !== 'Enter') return;
		e.preventDefault();
		if (e.key === 'Enter') {
			host.value = textbox.value;
			host.editing = false;
		} else host.editing = false;
	});

	// The composed textbox owns its value Slot — pushing the display value
	// down via a getter-only truc:pass would make the textbox's own
	// `host.value = input.value` write throw "Signal is read-only" (the
	// LT-091 form-colorgraph finding, ratified as the host-profile pattern:
	// child-writable/parent-derived compositions use watch() + bindProperty()
	// + commit-on-change instead). The Enter/accept paths below commit by
	// reading textbox.value directly.
	watch(() => host.value, bindProperty(textbox, 'value'))

	// Reflect editing onto the host attribute — the twin did this and the
	// component's own CSS (&[editing]) and consumer specs key on it.
	watch(() => host.editing, editing => {
		host.toggleAttribute('editing', editing)
	})

	<>
		<form-inplace-edit {name} {value} editing={initialEditing}>
			<span
				class="text"
				hidden={() => host.editing}
				onDblclick={() => {
					if (host.disabled) return
					host.editing = true
					const editInput = textbox.querySelector('input')
					editInput?.focus()
					editInput?.select()
				}}
			>{() => host.value}</span>
			<div class="edit" hidden={() => !host.editing}>
				{/* name="" keeps the composed textbox OUT of FormData (the
				    colorgraph precedent) — the host alone submits `name` */}
				<FormTextbox name="" label="Edit" ref={textbox} />
			</div>
			<button
				type="button"
				disabled={() => host.disabled}
				aria-label={() => (host.editing ? 'Accept' : 'Edit')}
				onMousedown={(e: Event) => e.preventDefault()}
				onClick={(e: Event) => {
					e.stopPropagation()
					if (host.editing) {
						host.value = textbox.value;
						host.editing = false;
					} else {
						host.editing = true;
						const editInput = textbox.querySelector('input');
						editInput?.focus();
						editInput?.select();
					}
				}}
			>{() => (host.editing ? '✓' : '✎')}</button>
		</form-inplace-edit>

		<style>
		form-inplace-edit {
			display: flex;
			align-items: center;

			.text {
				flex: 1;
				line-height: var(--line-height-s);
			}

			.edit {
				flex: 1;
			}

			> button {
				flex: 0;
				height: var(--input-height);
				min-inline-size: var(--input-height);
				border-radius: var(--space-xs);
				line-height: var(--line-height-s);
				background: transparent;
				border: none;
				padding: var(--space-xs);
				color: var(--color-primary);

				&:hover {
					background-color: var(--color-overlay-hover);
					color: var(--color-primary-hover);
				}

				&:active {
					background-color: var(--color-overlay-active);
					color: var(--color-primary-active);
				}
			}

			&[editing] {
				> button {
					color: var(--color-primary-text);
					background-color: var(--color-primary);
					border-color: var(--color-primary-active);
					border-radius: 0 var(--space-xs) var(--space-xs) 0;

					&:hover {
						background-color: var(--color-primary-hover);
					}

					&:active {
						background-color: var(--color-primary-active);
					}
				}
			}
		}
		</style>
	</>
}
