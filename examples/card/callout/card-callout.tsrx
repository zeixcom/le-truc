export function CardCallout({ kind, children }: {
	kind?: 'info' | 'tip' | 'caution' | 'danger' | 'note'
	children?: string
})
	@{
		<card-callout class={kind}>{children}

			<style>
			@scope {
				:where(:scope) {
					display: block;
					position: relative;
					padding: var(--space-s) var(--space-s) var(--space-s) var(--space-xl);
					margin: 0 0 var(--space-l);
					font-size: var(--font-size-m);
					line-height: var(--line-height-l);
					background: light-dark(var(--color-blue-20), var(--color-blue-80));
					border-left: var(--space-xxs) solid var(--color-blue-50);
					border-radius: var(--space-s);

					&::before {
						position: absolute;
						content: "ℹ️";
						left: var(--space-s);
					}
				}

				> p {
					margin-block-end: var(--space-s);
				}

				> *:last-child {
					margin-block-end: 0;
				}

				:where(:scope).tip {
					background: light-dark(var(--color-green-20), var(--color-green-80));
					border-color: var(--color-green-50);

					&::before {
						content: "💡";
					}
				}

				:where(:scope).note {
					background: light-dark(var(--color-neutral-20), var(--color-neutral-80));
					border-color: var(--color-neutral-50);

					&::before {
						content: "💬";
					}
				}

				:where(:scope).caution {
					background: light-dark(var(--color-orange-20), var(--color-orange-80));
					border-color: var(--color-orange-50);

					&::before {
						content: "⚠️";
					}
				}

				:where(:scope).danger {
					background: light-dark(var(--color-pink-20), var(--color-pink-80));
					border-color: var(--color-pink-50);

					&::before {
						content: "🚨";
					}
				}
			}</style>
		</card-callout>
	}
