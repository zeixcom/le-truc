/**
 * The ICU MessageFormat 1 evaluator (ADR 0030 s4, LT-250) — ONE
 * implementation, ours, for both sides of a message.
 *
 * The server fold calls it through the generated `i18n` module's `t`, and
 * LT-218 inlines a narrowed copy of it into the client preamble. Owning it
 * is the point: a server-rendered string and the client's recomputation run
 * the same walk over the same AST, so they cannot disagree.
 * `@messageformat/core` is a test oracle only (`icu.test.ts` differentially
 * checks this walk against it).
 *
 * Constraints, so LT-218 can inline it:
 * - **No imports.** Not from the compiler, not from a package. The locale
 *   work is `Intl.PluralRules` / `NumberFormat` / `DateTimeFormat`.
 * - **Emitter-agnostic.** A pure function of `(message, args, env)`; no
 *   caches keyed on module state, no DOM.
 * - **Data, not code.** The AST (`Message`) is JSON: build-time resolution
 *   in `parse.ts` has already turned every skeleton and named style into
 *   plain `Intl` options, so nothing here parses anything.
 */

/* === Types === */

/**
 * One node of a parsed message. A bare string is literal text, already
 * unescaped (the parser consumed MF1's apostrophe quoting).
 */
export type MessageNode =
	| string
	/** `{name}` — the argument's value, stringified. */
	| { t: 'arg'; a: string }
	/**
	 * `{n, number[, style]}` — `o` is the resolved `Intl.NumberFormat`
	 * options, `s` a multiplier (`::percent`/`::scale/…` skeletons: ICU
	 * formats `25` as `25%`, `Intl` wants `0.25`). A `currency` style with no
	 * explicit code takes the record's `currency`.
	 */
	| {
			t: 'num'
			a: string
			o?: Intl.NumberFormatOptions
			s?: number
			l?: string
	  }
	/**
	 * `{d, date|time[, style]}` — `o` is the resolved `Intl.DateTimeFormat`
	 * options; the record's `timeZone` applies unless `o` names one.
	 */
	| { t: 'date'; a: string; o: Intl.DateTimeFormatOptions; l?: string }
	/**
	 * `{n, plural|selectordinal, …}` — `c` maps each case key (`=0`, `one`,
	 * `other`, …) to its body; `o` marks ordinal rules, `off` the offset.
	 */
	| {
			t: 'plural'
			a: string
			c: Record<string, Message>
			o?: 1
			off?: number
			l?: string
	  }
	/** `{x, select, …}` — `c` maps each case key to its body. */
	| { t: 'select'; a: string; c: Record<string, Message> }
	/**
	 * `#` inside a plural — the enclosing plural's argument minus its
	 * offset, locale-formatted. The parser resolves which plural it belongs
	 * to, so the node carries the argument name and offset itself.
	 */
	| { t: '#'; a: string; off?: number; l?: string }

/*
 * `l` on a formatting node (`num`, `date`, `plural`, `#`) is the locale it
 * formats in, overriding `env.lang`. The parser never writes it;
 * `bakeMessageEnv` does, for the client channel (LT-218).
 */

/** A parsed message: a sequence of nodes. */
export type Message = MessageNode[]

/** The argument record a message with arguments is called with. */
export type MessageArgs = Readonly<Record<string, unknown>>

/** The locale facts a message formats against — the `i18n` record's. */
export type MessageEnv = {
	lang: string
	timeZone?: string
	currency?: string
}

/* === Internal Functions === */

/**
 * The case body for `key`, own keys only — a select value of
 * `'constructor'` must fall to `other`, not reach `Object.prototype`.
 */
const caseOf = (
	cases: Record<string, Message>,
	key: string,
): Message | undefined => (Object.hasOwn(cases, key) ? cases[key] : undefined)

/* === Exported Functions === */

/**
 * Format `message` with `args` under `env`.
 *
 * Plural selection follows ICU: an exact `=N` case wins over the category,
 * the category is chosen after subtracting the offset, and a category the
 * message does not spell falls to `other` (the parser guarantees `other`
 * exists).
 */
export const formatMessage = (
	message: Message,
	args: MessageArgs,
	env: MessageEnv,
): string => {
	let out = ''
	for (const node of message) {
		if (typeof node === 'string') {
			out += node
			continue
		}
		const value = args[node.a]
		switch (node.t) {
			case 'arg':
				out += String(value)
				break
			case 'num': {
				const options =
					node.o?.style === 'currency' && !node.o.currency
						? { ...node.o, currency: env.currency }
						: node.o
				out += new Intl.NumberFormat(node.l ?? env.lang, options).format(
					Number(value) * (node.s ?? 1),
				)
				break
			}
			case 'date':
				out += new Intl.DateTimeFormat(
					node.l ?? env.lang,
					node.o.timeZone || !env.timeZone
						? node.o
						: { ...node.o, timeZone: env.timeZone },
				).format(new Date(value as number | Date))
				break
			case 'plural': {
				const n = Number(value)
				const body =
					caseOf(node.c, `=${n}`) ??
					caseOf(
						node.c,
						new Intl.PluralRules(node.l ?? env.lang, {
							type: node.o ? 'ordinal' : 'cardinal',
						}).select(n - (node.off ?? 0)),
					) ??
					node.c.other
				if (body) out += formatMessage(body, args, env)
				break
			}
			case 'select': {
				const body = caseOf(node.c, String(value)) ?? node.c.other
				if (body) out += formatMessage(body, args, env)
				break
			}
			case '#':
				out += new Intl.NumberFormat(node.l ?? env.lang).format(
					Number(value) - (node.off ?? 0),
				)
				break
		}
	}
	return out
}

/**
 * The node kinds (`arg`, `num`, `plural`, …) `messages` use, case bodies
 * included — what the client channel's inlined evaluator carries (LT-218):
 * `emit-client.ts` narrows it to the union over a component's
 * client-referenced source messages.
 */
export const carriedKinds = (messages: Iterable<Message>): Set<string> => {
	const kinds = new Set<string>()
	const collect = (message: Message): void => {
		for (const node of message) {
			if (typeof node === 'string') continue
			kinds.add(node.t)
			if (node.t === 'plural' || node.t === 'select')
				for (const body of Object.values(node.c)) collect(body)
		}
	}
	for (const message of messages) collect(message)
	return kinds
}

/**
 * Whether the client channel renders `source` instead of `translation`
 * (LT-350): a translation with arguments where the source has none (the
 * argument-less accessor serves the source), or one using a node kind the
 * narrowed evaluator does not carry. An argument-less translation always
 * renders. Both arguments are compiled catalog entries: literal text or a
 * parsed message.
 */
export const clientFallsBack = (
	source: string | Message,
	translation: string | Message,
	carried: ReadonlySet<string>,
): boolean => {
	if (typeof translation === 'string') return false
	if (typeof source === 'string') return true
	return [...carriedKinds([translation])].some(kind => !carried.has(kind))
}

/**
 * `message` with its record folded in (LT-218): the locale onto every
 * formatting node (`l`), and `timeZone`/`currency` into the nodes that read
 * them. The client channel serializes messages per render call, but the
 * client never sees the record, and the host's `lang` is only there when
 * the component renders it — so the facts travel inside the AST, and a
 * translated message always formats in the locale it was translated for.
 * The result formats identically under {@link formatMessage} whatever
 * `env` it is later given.
 */
export const bakeMessageEnv = (message: Message, env: MessageEnv): Message =>
	message.map(node => {
		if (typeof node === 'string') return node
		switch (node.t) {
			case 'num':
				return {
					...node,
					l: env.lang,
					...(node.o?.style === 'currency' && !node.o.currency && env.currency
						? { o: { ...node.o, currency: env.currency } }
						: {}),
				}
			case 'date':
				return {
					...node,
					l: env.lang,
					o:
						node.o.timeZone || !env.timeZone
							? node.o
							: { ...node.o, timeZone: env.timeZone },
				}
			case '#':
				return { ...node, l: env.lang }
			case 'plural':
			case 'select': {
				const c: Record<string, Message> = {}
				for (const [key, body] of Object.entries(node.c))
					c[key] = bakeMessageEnv(body, env)
				return node.t === 'plural'
					? { ...node, c, l: env.lang }
					: { ...node, c }
			}
			default:
				return node
		}
	})
