/**
 * React twin of the Le Truc `form-inplace-edit` corpus component (LT-266
 * size bet) — a value shown as text, edited in place through a textbox.
 * The parent owns the value and receives commits; the editing toggle is
 * component-local, as in the twin.
 */
import { useState } from 'react'

export type FormInplaceEditProps = {
	/** The current value, owned by the parent. */
	value: string
	/** Called with the committed value when the user accepts the edit. */
	onCommit: (value: string) => void
}

/** A value shown as text, edited in place through a textbox. */
export function FormInplaceEdit({ value, onCommit }: FormInplaceEditProps) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(value)

	const startEditing = () => {
		setDraft(value)
		setEditing(true)
	}

	const accept = () => {
		const trimmed = draft.trim()
		if (trimmed) onCommit(trimmed)
		setEditing(false)
	}

	if (editing) {
		return (
			<form-inplace-edit editing>
				<span className="text" hidden>
					{value}
				</span>
				<div className="edit">
					<form-textbox>
						<div className="input">
							<input
								type="text"
								value={draft}
								autoComplete="off"
								aria-label="Edit"
								onChange={event => setDraft(event.target.value)}
								onKeyDown={event => {
									if (event.key === 'Enter') accept()
									if (event.key === 'Escape') setEditing(false)
								}}
							/>
						</div>
					</form-textbox>
					<button
						type="button"
						aria-label="Accept"
						onClick={accept}
					>
						✓
					</button>
				</div>
			</form-inplace-edit>
		)
	}
	return (
		<form-inplace-edit>
			<span className="text">{value}</span>
			<div className="edit" hidden>
				<form-textbox>
					<div className="input">
						<input type="text" aria-label="Edit" readOnly />
					</div>
				</form-textbox>
			</div>
			<button type="button" aria-label="Edit" onClick={startEditing}>
				✎
			</button>
		</form-inplace-edit>
	)
}
