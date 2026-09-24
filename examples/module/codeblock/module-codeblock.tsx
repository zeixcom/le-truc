/**
 * Wave-4 migration (LT-096) of the hand-written module-codeblock.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what the docs' fence schema and tab-panel fragment
 * author by hand: a `.meta` line, the highlighted code inside a horizontal
 * `module-scrollarea`, a composed copy button, and — only when collapsed —
 * the expand overlay. `children` is the code's highlighted markup.
 *
 * The copy effect is a raw `EffectDescriptor`, so it registers through
 * `watch(() => true, …)` (AGENTS.md): called bare, as the twin did before
 * LT-096, the descriptor is created and discarded and the copy-click
 * listener never attaches.
 */

import { asBoolean, bindAttribute, type FactoryContext } from '@zeix/le-truc'
import { BasicButton } from '../../basic/button/basic-button.tsrx'
import { copyToClipboard } from '../../basic/button/copyToClipboard'

export type ModuleCodeblockProps = {
	/** Whether the code block is collapsed (truncated). Read from the `collapsed` attribute at connect time. */
	collapsed: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-codeblock': HTMLElement & ModuleCodeblockProps
	}
}

/**
 * A syntax-highlighted code block with collapsible truncation and a copy-to-clipboard button.
 * Use it for displaying code samples — provides a keyboard-accessible expand/copy
 * button and should be used when long code listings need graceful truncation.
 * The `collapsed` attribute should be set to avoid overwhelming the page with long code.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-codeblock} Interactive preview and usage examples
 **/
export function ModuleCodeblock(
	{
		id,
		language = 'text',
		file,
		collapsed = false,
		children = '',
	}: {
		id?: string
		language?: string
		file?: string
		collapsed?: boolean
		children?: string
	},
	{ host, first, expose, on, watch }: FactoryContext<ModuleCodeblockProps>,
) {
	const code = first('code', 'Needed as source container to copy from.')
	const copy = first('basic-button.copy')
	const overlay = first('button.overlay')

	expose({ collapsed: asBoolean() })

	// Bound here rather than as the overlay's `onClick`: the selector the
	// compiler synthesizes for a template handler is proven unique against
	// THIS template only, so it would be a bare `button` — which matches the
	// composed basic-button's own <button> first (NOTES.md, LT-096).
	on(overlay, 'click', () => ({ collapsed: false }))

	// The copy button is optional (a page may author none), so the guard
	// is part of the effect — a no-op descriptor when it is absent. An `if`
	// statement is outside the setup subset (LTC005), and `watch()` from a
	// deferred callback has no collector (LTC045).
	watch(
		() => true,
		copy
			? copyToClipboard(code, copy, {
					success: copy.getAttribute('copy-success') || 'Copied!',
					error:
						copy.getAttribute('copy-error') ||
						'Error trying to copy to clipboard!',
				})
			: () => {},
	)

	watch('collapsed', bindAttribute(host, 'collapsed'))

	return (
		<>
			<module-codeblock id={id} collapsed={collapsed} language={language}>
				<p class="meta">
					{file && <span class="file">{file}</span>}
					<span class="language">{language}</span>
				</p>
				<module-scrollarea orientation="horizontal">
					<pre>
						<code class={`language-${language}`}>{children}</code>
					</pre>
				</module-scrollarea>
				<BasicButton class="copy" label="Copy" size="small" />
				{collapsed && (
					<button
						type="button"
						class="overlay"
						aria-expanded="false"
						aria-controls={id}
					>
						Expand
					</button>
				)}
			</module-codeblock>

			<style>{css`
			module-codeblock {
				--module-codeblock-color-background: #272822;
				/* Shadow with reduced transparency for dark background used in code blocks */
				--color-shadow: rgb(0 0 0 / 0.4);

				position: relative;
				display: block;
				margin: 0 0 var(--space-l);
				background: var(--module-codeblock-color-background);
				border-radius: var(--space-s);

				.meta {
					display: flex;
					margin-bottom: 0;
					padding: var(--space-xs) var(--space-s) 0;
					font-size: var(--font-size-s);
					color: var(--color-neutral-20);
				}

				.language {
					margin-left: auto;
					text-transform: uppercase;
				}

				& pre {
					font-size: var(--font-size-s);
					padding-block: var(--space-s);
					border-radius: var(--space-s);
				}

				& code {
					padding-inline: var(--space-s);
					display: block;
					line-height: var(--line-height-l);
				}

				.copy {
					position: absolute;
					right: var(--space-s);
					bottom: var(--space-s);
				}

				.overlay {
					display: none;
				}

				&[collapsed] {
					max-height: 12rem;
					overflow: hidden;
					border-radius: var(--space-s) var(--space-s) 0 0;

					&::after {
						content: "";
						display: block;
						position: absolute;
						bottom: 0;
						width: 100%;
						height: var(--space-m);
						background:
							linear-gradient(-135deg, var(--color-secondary) 0.5rem, transparent 0) 0
							0.5rem,
							linear-gradient(
								135deg,
								var(--color-secondary) 0.5rem,
								var(--color-input) 0
							)
							0 0.5rem;
						background-size: var(--space-m) var(--space-m);
						background-position: bottom;
					}

					.copy {
						display: none;
					}

					.overlay {
						display: flex;
						flex-direction: column-reverse;
						align-items: center;
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 6rem;
						color: var(--color-text);
						background: linear-gradient(transparent, var(--color-secondary));
						border: 0;
						cursor: pointer;
						padding: var(--space-xs) var(--space-s);
						margin-bottom: var(--space-m);
						font-size: var(--font-size-s);
						transition: background-color var(--transition-short) var(--easing-inout);
						text-shadow: var(--color-input) 1px 0 var(--space-xs);

						&:hover,
						&:active {
							text-shadow: var(--color-text-inverted) var(--space-xs) 0 var(--space-s);
						}
					}
				}
			}
			`}</style>
		</>
	)
}
