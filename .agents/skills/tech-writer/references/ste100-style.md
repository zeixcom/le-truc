# Simplified Technical English (ASD-STE100)

ASD-STE100 governs maintenance manuals in aerospace. There, a sentence with two readings can cost a wing, so the standard forces sentences so uniform that misreading is nearly impossible. That is exactly the right tool for reference material. It is exactly wrong for teaching, where uniformity reads as a hum.

This file defines sentence discipline at three strengths. references/tone-guide.md assigns each document — and each section of a mixed page — its strength, and defines the voice techniques that take over where discipline relaxes.

## Strengths and Scope

| Strength | What applies | Where |
|---|---|---|
| **Full** | Every rule in this file | JSDoc; `AGENTS.md`; skill files; `ARCHITECTURE.md`; `api.md`, `examples.md`, `blog.md`; `about.md`; `server/SERVER.md` |
| **Working** | Vocabulary rules throughout. Sentence rules on instructions, steps, warnings, and callouts. Connective prose may run to ~30 words and vary its rhythm. | Pages prose (tutorials, how-to guides, explanations); `README.md` |
| **Off** | Vocabulary consistency (`CONTEXT.md` terms) only | Landing copy (`index.md` hero and carousel); blog posts |

## Sentence Construction (Full strength)

- **One idea per sentence.** Do not join two claims with "and", "which", or a comma splice. Split them.
- **Maximum one subordinate clause.** If a sentence needs two conditions or two consequences, use a list instead.
- **20 words per sentence, as a ceiling, not a target.** Shorter is fine. A sentence that needs 30 words has more than one idea in it.
- **Five sentences per paragraph, as a ceiling.** If a paragraph runs longer, split it or convert it to a list.
- **Lists over compound sentences.** When a sentence would enumerate three or more items, conditions, or steps, use a bulleted or numbered list.

At Working strength, these apply to actionable text only. A connective sentence may run longer when the rhythm needs it — but it still carries one idea.

## Grammar (Full and Working strength)

- **Active voice.** "The factory registers the element" not "The element is registered by the factory." Passive voice is acceptable only when the actor is unknown or irrelevant (rare in this codebase's docs).
- **Present tense for facts and behavior.** "`watch()` re-runs when the signal changes," not "will re-run" or "would re-run."
- **Imperative mood for instructions.** "Read the source before writing" not "You should read the source before writing."
- **No gerund nouns.** Write "to update the DOM" not "for updating the DOM." Write "when the signal changes" not "on signal change" or "signal changing."
- **Keep articles in Pages, README, ARCHITECTURE, and code comments.** Do not drop "a," "an," "the" for a telegraphic style in these documents. STE100 requires complete grammar; density comes from cutting words, not cutting grammar.
- **`AGENTS.md` and skill files may drop articles for brevity.** These are AI-inference-time documents (see references/tone-guide.md `<AGENTS.md>`), where token cost outweighs strict grammar. Dropping "a"/"an"/"the" is acceptable there; the rest of STE100 still applies.
- **No stacked nouns.** Rewrite "component effect descriptor collection" as "the collection of effect descriptors for a component." Use prepositions to show the relationship instead of piling nouns together.

## Vocabulary (all strengths)

- **One word, one meaning.** Use the same word for the same concept everywhere. Do not vary vocabulary for style ("binding" one place, "connection" another, "link" a third) — pick the approved term and reuse it.
- **Domain terms are defined in `CONTEXT.md`.** Before writing about a concept — Module, Component, Custom Element, Factory, Factory Context, Effect Descriptor, Signal, Slot, Parser, Binding, Pass — read the entry in `CONTEXT.md` and use exactly that term. `CONTEXT.md` also lists the words to avoid for each concept; treat those as disallowed synonyms.
- **Approved technical names pass through unchanged.** Standard web-platform and TypeScript terms — DOM, HTML, CSS, Shadow DOM, attribute, property, event, signal, TypeScript, Web Component — are technical names, not prose vocabulary. Use them as-is; do not paraphrase them into simpler words and do not invent alternate spellings.
- **Spell out on first use per document; abbreviate after.** If a document uses an abbreviation the reader may not know, expand it once, then use the short form consistently.
- **No decorative idioms.** At Full strength, no idioms or figurative language at all — "solves a specific problem" not "hits the sweet spot." At Working strength, figurative language is allowed when it carries understanding: an analogy that maps, a metaphor the reader can extend. Cut it when it decorates.

## Scope: Current Shape Only

Describe the API as it is now. Do not describe what it was, why it changed, or what it may become — no "previously", "as of version X", "we changed this because", "will eventually". `CHANGELOG.md` (`changelog-keeper` skill) and ADRs (`adr-keeper` skill) are the only documents that record history; every other document this skill maintains states current truth only. Timeless rationale ("why it is designed this way") is allowed where the tone guide permits it — explanations, `ARCHITECTURE.md`, blog.

## What This Changes in Practice

- Long sentences with two or three subordinate clauses get split into two or three sentences, or converted to a list — at Full strength, always; at Working strength, in actionable text.
- Passive constructions ("is registered by," "can be shared between") become active ("registers," "shares").
- Gerund-form headings and phrases ("Updating a Component," "Handling Events") stay as headings (titles are exempt) but body prose uses the infinitive or present tense form.
- Inconsistent synonyms for the same domain concept get normalized to the `CONTEXT.md` term — at every strength.

## What This Does Not Change

- Document register (tutorial-friendly pages, terse `AGENTS.md`, technical `ARCHITECTURE.md`) is set by references/tone-guide.md, not by this file. STE100 is a grammar and vocabulary layer on top of that register.
- Voice techniques (journey, rhythm, opinion) come from references/tone-guide.md and apply where the text type calls for them.
- Code, and Markdoc tag syntax.
