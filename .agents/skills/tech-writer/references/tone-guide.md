# Tone Guide

Writing tone, register, and conciseness rules for each document this skill maintains. Violating the tone is as wrong as a factual error — each document has a distinct primary reader and serves a distinct purpose.

## Shared Rules
These rules apply to every document without exception:

- **Concise over comprehensive.** Every sentence must add information the reader needs. Cut throat-clearing, transitional padding, and restatements of what the code already shows.
- **Technically accurate over reassuring.** Do not soften edge cases, paper over constraints, or omit behavior that is surprising but correct.
- **Describe only the current API shape.** Documents state current truth: what the API is, not what it was, why it changed, or what it may become. Never write "previously", "as of version X", "we changed", "now supports", "will eventually", or "the reason for this is…". The only exceptions are `CHANGELOG.md` (kept by the `changelog-keeper` skill) and ADRs (kept by the `adr-keeper` skill) — both exist specifically to record history and rationale.
- **No meta-commentary.** Do not write "This section explains…" or "See below for…". Say the thing directly.
- **Backtick all code.** Every API name, file name, type name, option key, tag name, and shell command is wrapped in backticks, even mid-sentence.
- **Surgical edits only.** Update what changed. Do not rewrite accurate sections.
- **Simplified Technical English (ASD-STE100).** Every document below except Blog follows the sentence and vocabulary rules in references/ste100-style.md: short single-idea sentences, active voice, present tense, one word per concept using the `CONTEXT.md` domain vocabulary. This applies within each document's register — it doesn't override the register.

## Pages
**Primary audience varies by page** (see references/document-map.md), but the shared register across all pages is:

**Register:** Approachable, tutorial-style, conversational without being casual. Direct address ("Le Truc lets you…", "Use `all()` when…"). Present tense. Active voice.

**Markdoc structure rules:**
- Use `{% callout .tip title="…" %}` for non-obvious constraints or important caveats that the reader is likely to miss. Do not overuse — one callout per major section at most.
- Use `{% demo %}` blocks only when the full HTML markup adds genuine understanding; do not add demos for trivial snippets.
- Code blocks in pages use the `#filename` annotation when the file context matters (e.g., ` ```js#module-catalog.ts `).
- Code examples are realistic — they show actual patterns from the examples directory, not toy snippets. When possible, reference the real component source with `{% sources /%}`.
- Callout `.tip` is for helpful guidance. Use `.warning` or `.info` if the project adds those variants.

**What to cut in pages:**
- Motivational framing ("This is useful when you need to…")
- Repetition of content already visible in the code example
- Explanations of standard JavaScript/TypeScript/CSS concepts the audience already knows

## README
**Primary audience:** Developers encountering the library on GitHub or npm for the first time.

**Register:** Brief and factual. Gets to "what it is" and "how to install" without selling. Links to the documentation site for everything deeper.

**Structure rules:**
- No section should require scrolling to see — README.md is a doorway, not a manual.
- The quick-start example is minimal: one complete, working component that demonstrates the essential pattern.

**What to cut:**
- Comparison prose — let the docs site handle positioning
- Options tables or API details — those live in docs
- Anything already in the docs site that the README would just duplicate

## ARCHITECTURE
**Primary audience:** Contributors and AI agents that need to understand internals.

**Register:** Technical and precise. Third person, present tense. Implementation details are expected and welcome. Internal function names, type names, flag names, and field names are used freely without definition — this document assumes the reader has the source open.

**Structure rules:**
- Describe mechanisms, not intentions. Not "this enables efficient updates" but "when `watch(source, handler)` re-runs, the handler receives the new value and applies it to the DOM directly."
- File maps, dependency graphs, and lifecycle diagrams are appropriate. Match actual source structure exactly.

**What to cut:**
- Motivational framing ("The design optimizes for…")
- Public API description — that belongs in docs pages
- Any sentence replaceable by reading the source directly

## AGENTS.md
**Primary audience:** AI agents at inference time. Every token has a cost.

**Register:** Terse, declarative, maximally dense. No hand-holding. No transitions. Bold key terms. Bullet lists over prose. Code examples only when the correct pattern is non-obvious from the statement.

**Non-obvious behavior entry structure:**
1. **Bold statement** of the behavior — one sentence, declarative, specific.
2. Implication or consequence — one or two sentences maximum.
3. Code example — only if the correct pattern cannot be inferred from the statement.

**The bar for "non-obvious":** A competent Le Truc developer would not predict this behavior from reading the public API. If they would, it does not belong here.

**What to cut:**
- Any sentence that restates what the bold statement already said
- Explanations of standard reactive concepts
- "Note that…", "Keep in mind…", "Be aware that…" — state it directly

## Blog
**Exempt from references/ste100-style.md.** The blog keeps the narrative, conversational register below, including contractions and figurative language where they read naturally. Do not apply STE100 sentence-length or vocabulary rules here — apply the jargon table instead (see workflows/write-blog-post.md).

**Primary audience:** Developers who have found their way to the blog — curious about the project's history, design decisions, or how it compares to alternatives. They are technically capable but not necessarily Le Truc users yet.

**Register:** Plain, direct, conversational. Write the way a knowledgeable colleague explains something over coffee — not a sales deck, not a whitepaper. First person plural ("we") is fine for posts about the team's experience. Present tense for general claims; past tense for things that happened.

**Core rules:**

- **No business jargon.** Do not write: "greenfield", "ergonomic", "paradigm shift", "first-class concern", "translation point", "profile matches", "incidental to", "optimise for", "separation of concerns". Say the plain thing instead.
- **No corporate phrasing.** Avoid: "occupies a niche", "the insight was", "the question is whether", "the friction appears", "the gap", "what each got right". These sound like a strategy document, not a person talking.
- **No motivational framing.** Cut throat-clearing like "This post covers…", "The goal is to…", "This is an enormous improvement." Say the thing. Let the reader decide if it is an improvement.
- **Short sentences over long ones.** If a sentence has more than two clauses, split it. If a paragraph is longer than five sentences, look for what to cut.
- **Technical terms are fine where needed.** "Reactive", "signal graph", "Shadow DOM", "hydration", "SSR", "prop drilling" — these have precise meanings that matter. Do not replace them with vague paraphrases.
- **Contractions are fine.** "It is" can be "it's". "Do not" can be "don't". Match the natural rhythm of spoken explanation.

**What to cut:**
- Sentences that restate what the previous sentence already said
- Transitions that exist only to move between paragraphs ("We have now described…", "That brings us to…")
- Any sentence the reader could have written themselves after reading the previous one

## JSDoc
Follows references/ste100-style.md: one short sentence per summary line, active voice, present tense, `CONTEXT.md` domain terms.

**Primary audience:** Developers reading function signatures in an IDE or in the TypeDoc-generated API pages.

**Register:** Brief, typed, precise. One-line summaries. No narrative. Fragments are acceptable if they read naturally as a tooltip.

**Structure rules:**
- Summary line: one sentence. Describes what the function does. "Sets text content of an element by replacing child nodes." not "A factory for text-setting effects."
- `@param` tags: one line each. Describe semantics and constraints, not the TypeScript type.
- `@returns`: one line.
- `@since`: required on all exported functions; use the version the function was introduced.
- `@throws`: only for errors that occur in correct, non-erroneous usage. Do not document programmer-error throws.
- `@example`: only if usage is non-obvious enough that a developer would misuse the function without one.

**What to cut:**
- `@param type` annotations — TypeScript already shows the type
- JSDoc that restates the TypeScript signature in prose
- Multi-paragraph descriptions
