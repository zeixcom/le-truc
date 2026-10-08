/**
 * The `.tsx` spelling of `module-list.tsrx` (ADR 0046 s4, LT-425): the
 * reactive list is the keyed `map` over a declared `createList`,
 * `items.map((item, k) => …)`. The callback receives the item's signal,
 * read in an arrow (`{() => item.get()}`), and its stable key, which the
 * per-item remove handler uses (`items.remove(k)`).
 *
 * Lives beside its `.tsrx` twin as a variant set (ADR 0039) and is the
 * served surface. Every member declares its own `HTMLElementTagNameMap`
 * entry (s4). The submit button is a composed `BasicButton` (LT-463) with
 * the existing `disabled` pass; the remove buttons stay raw — the
 * `tertiary destructive small` class triple is not expressible through
 * BasicButton's props (LT-489).
 */
import { createList } from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'
import { BasicButton } from '../../basic/button/basic-button.tsrx'
import { FormTextbox } from '../../form/textbox/form-textbox.tsrx'

declare global {
	interface HTMLElementTagNameMap {
		'module-list': HTMLElement
	}
}

// biome-ignore lint/correctness/noEmptyPattern: the component takes no server args, and the compiler's params contract requires an (empty) destructured object pattern.
export function ModuleList({}: {}) {
	const textbox = first('form-textbox', 'the new-item textbox')

	const items = createList<string>([], {
		keyConfig: 'item',
	})

	return (
		<module-list>
			<form
				action="#"
				onSubmit={(e: SubmitEvent) => {
					e.preventDefault()
					const value = textbox.value.trim()
					if (!value) return
					items.add(value)
					textbox.clear()
				}}
			>
				<FormTextbox name="new-item" label="New item" clearable />
				<BasicButton
					class="submit"
					type="submit"
					variant="constructive"
					label="Add"
					truc:pass={{ disabled: () => !textbox.length }}
				/>
			</form>
			<ul data-container>
				{items.map((item, k) => (
					<li>
						<span>{() => item.get()}</span>
						{/* Raw, not composed (LT-463): the `tertiary destructive small`
						    class triple is not expressible through BasicButton's props —
						    the modifier shape is ruled in LT-489. */}
						<basic-button class="remove">
							<button
								type="button"
								class="tertiary destructive small"
								onClick={() => items.remove(k)}
							>
								Remove
							</button>
						</basic-button>
					</li>
				))}
			</ul>

			<style>{css`
			@scope {
				:where(:scope) {
					display: flex;
					flex-direction: column;
					gap: var(--space-l);
				}

				> form {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: var(--space-m);
					justify-content: space-between;
				}

				ul {
					display: flex;
					flex-direction: column;
					gap: var(--space-m);
					list-style: none;
					margin: 0;
					padding: 0;

					&:empty {
						display: none;
					}

					& li {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: var(--space-m);
						margin: 0;
						padding: 0;
					}
				}

				@container (width > 27rem) {
					form {
						flex-direction: row;
						align-items: flex-end;
					}
				}
			}`}</style>
		</module-list>
	)
}
