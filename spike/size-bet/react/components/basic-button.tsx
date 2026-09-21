/**
 * React twin of the Le Truc `basic-button` corpus component (LT-266 size
 * bet) — same component split as the Le Truc side, same DOM shape. The
 * <basic-button> shell keeps the twin's tag so the served DOM matches.
 */
import type { MouseEvent } from 'react'

export type BasicButtonProps = {
	/** Visible label text of the button. */
	label: string
	/** Optional badge text displayed alongside the label. */
	badge?: string
	/** Whether the button is disabled. */
	disabled?: boolean
	/** Native button type. */
	type?: 'button' | 'submit'
	/** Variant classes carried on the native control. */
	variant?: string
	/** Accessible name when the visible label is a glyph. */
	ariaLabel?: string
	onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

/** A button that can be disabled, labelled, and badged via props. */
export function BasicButton({
	label,
	badge = '',
	disabled = false,
	type = 'button',
	variant = '',
	ariaLabel,
	onClick,
}: BasicButtonProps) {
	return (
		<basic-button>
			<button
				type={type}
				className={variant}
				disabled={disabled}
				aria-label={ariaLabel}
				onClick={onClick}
			>
				<span className="label">{label}</span>
				{badge ? <span className="badge">{badge}</span> : null}
			</button>
		</basic-button>
	)
}
