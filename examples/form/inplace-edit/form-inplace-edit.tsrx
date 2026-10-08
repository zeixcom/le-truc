/**
 * TSRX migration: form-inplace-edit — display and edit mode are the two arms
 * of a reactive `@if (host.editing)` (ADR 0037, LT-390). The server renders
 * the winning arm live beside one inert `<template data-arms>` per arm; the
 * client adopts the live arm at connect and clones the other in on a flip,
 * so the edit-mode `<form-textbox>` exists only while editing — the
 * hand-written version's create/destroy behavior, recovered. Re-entry clones
 * a fresh textbox, which is why the textbox is addressed at event time and
 * pre-filled on every entry instead of through a setup-time `first()` (a
 * host-level `first()` into an arm is refused).
 */
import { asBoolean, asString } from '@zeix/le-truc'
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
	expose({
		editing: asBoolean(false),
		// Children-are-data (LT-112): the initial value is harvested from
		// the live display span when no `value` attribute is present; the
		// attribute remains a Parser-level override. The span is an arm
		// root, so it is read directly rather than through `first()`.
		value: asString(host.querySelector(':scope > .text')?.textContent ?? ''),
	});

	// The edit arm's textbox is cloned afresh on every entry. Setting
	// `host.editing` flips the arm synchronously, so the new textbox is in
	// the DOM by the time `editBox()` looks for it.
	const editBox = () => host.querySelector('form-textbox')
	const startEditing = () => {
		host.editing = true
		const textbox = editBox()
		if (!textbox) return
		textbox.value = host.value
		textbox.focusControl()
	}
	const stopEditing = (commit: boolean) => {
		const textbox = editBox()
		if (commit && textbox) host.value = textbox.value
		host.editing = false
	}

	// Host-level listeners (LT-070/LT-087): focus leaving the component
	// cancels, Enter commits, Escape cancels.
	on(host, 'focusout', (e: FocusEvent) => {
		if (!host.editing) return;
		const related = e.relatedTarget as Element | null;
		if (related && host.contains(related)) return;
		stopEditing(false)
	});
	on(host, 'keydown', (e: KeyboardEvent) => {
		if (!host.editing) return;
		if (e.key !== 'Escape' && e.key !== 'Enter') return;
		e.preventDefault();
		stopEditing(e.key === 'Enter')
	});

	// Reflect editing onto the host attribute — the component's own CSS
	// (&[editing]) and consumer specs key on it.
	watch(() => host.editing, editing => {
		host.toggleAttribute('editing', editing)
	})

	<form-inplace-edit {name} {value} editing={initialEditing}>
		@if (host.editing) {
			<div class="edit">
				{/* name="" keeps the composed textbox OUT of FormData (the
				    colorgraph precedent) — the host alone submits `name`.
				    `value` seeds a server-rendered edit arm; a user-driven
				    entry pre-fills from `host.value` (startEditing) */}
				<FormTextbox name="" label="Edit" {value} />
			</div>
		} @else {
			<span
				class="text"
				onDblclick={() => {
					if (!host.disabled) startEditing()
				}}
			>{() => host.value}</span>
		}
		<button
			type="button"
			disabled={() => host.disabled}
			aria-label={() => (host.editing ? 'Accept' : 'Edit')}
			onMousedown={(e: Event) => e.preventDefault()}
			onClick={(e: Event) => {
				e.stopPropagation()
				if (host.editing) stopEditing(true)
				else startEditing()
			}}
		>{() => (host.editing ? '✓' : '✎')}</button>

		<style>
		@scope to (form-textbox > *) {
			:where(:scope) {
				display: flex;
				align-items: center;
			}

			.text {
				flex: 1;
				line-height: var(--line-height-s);
			}

			button {
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

			:where(:scope)[editing] {
				.text {
					display: none;
				}

				button {
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
		}</style>
	</form-inplace-edit>
}
