# Simplified Technical English (ASD-STE100)

Sentence-level writing rules adapted from ASD-STE100, applied to all documents this skill maintains **except the blog** (see references/tone-guide.md `<blog>` — blog posts keep a narrative, conversational register and are exempt from this file).

STE100 controls grammar and vocabulary so a technical sentence has exactly one reading. It does not conflict with a document's register (terse, tutorial, technical) — apply it within whatever register the target document already calls for.

## Sentence construction

- **One idea per sentence.** Do not join two claims with "and", "which", or a comma splice. Split them.
- **Maximum one subordinate clause.** If a sentence needs two conditions or two consequences, use a list instead.
- **20 words per sentence, as a ceiling, not a target.** Shorter is fine. A sentence that needs 30 words has more than one idea in it.
- **Five sentences per paragraph, as a ceiling.** If a paragraph runs longer, split it or convert it to a list.
- **Lists over compound sentences.** When a sentence would enumerate three or more items, conditions, or steps, use a bulleted or numbered list.

## Grammar

- **Active voice.** "The factory registers the element" not "The element is registered by the factory." Passive voice is acceptable only when the actor is unknown or irrelevant (rare in this codebase's docs).
- **Present tense for facts and behavior.** "`watch()` re-runs when the signal changes," not "will re-run" or "would re-run."
- **Imperative mood for instructions.** "Read the source before writing" not "You should read the source before writing."
- **No gerund nouns.** Write "to update the DOM" not "for updating the DOM." Write "when the signal changes" not "on signal change" or "signal changing."
- **Keep articles in Pages, README, ARCHITECTURE, and JSDoc.** Do not drop "a," "an," "the" for a telegraphic style in these documents. STE100 requires complete grammar; density comes from cutting words, not cutting grammar.
- **`AGENTS.md` and skill files may drop articles for brevity.** These are AI-inference-time documents (see references/tone-guide.md `<AGENTS.md>`), where token cost outweighs strict grammar. Dropping "a"/"an"/"the" is acceptable there; the rest of STE100 (one idea per sentence, active voice, one word per concept) still applies.
- **No stacked nouns.** Rewrite "component effect descriptor collection" as "the collection of effect descriptors for a component." Use prepositions to show the relationship instead of piling nouns together.

## Vocabulary

- **One word, one meaning.** Use the same word for the same concept everywhere. Do not vary vocabulary for style ("binding" one place, "connection" another, "link" a third) — pick the approved term and reuse it.
- **Domain terms are defined in `CONTEXT.md`.** Before writing about a concept — Module, Component, Custom Element, Factory, Factory Context, Effect Descriptor, Signal, Slot, Parser, Binding, Pass — read the entry in `CONTEXT.md` and use exactly that term. `CONTEXT.md` also lists the words to avoid for each concept; treat those as disallowed synonyms.
- **No idioms or figurative language.** "Solves a specific problem" not "hits the sweet spot." "Runs once" not "fires off." Say the literal thing.
- **Approved technical names pass through unchanged.** Standard web-platform and TypeScript terms — DOM, HTML, CSS, Shadow DOM, attribute, property, event, signal, TypeScript, Web Component — are technical names, not prose vocabulary. Use them as-is; do not paraphrase them into simpler words and do not invent alternate spellings.
- **Spell out on first use per document; abbreviate after.** If a document uses an abbreviation the reader may not know, expand it once, then use the short form consistently.

## What this changes in practice

- Long sentences with two or three subordinate clauses get split into two or three sentences, or converted to a list.
- Passive constructions ("is registered by," "can be shared between") become active ("registers," "shares").
- Gerund-form headings and phrases ("Updating a Component," "Handling Events") stay as headings (titles are exempt) but body prose uses the infinitive or present tense form.
- Inconsistent synonyms for the same domain concept get normalized to the `CONTEXT.md` term.

## Scope: current shape only

Describe the API as it is now. Do not describe what it was, why it changed, or what it may become — no "previously", "as of version X", "we changed this because", "will eventually". `CHANGELOG.md` (`changelog-keeper` skill) and ADRs (`adr-keeper` skill) are the only documents that record history and rationale; every other document this skill maintains states current truth only.

## What this does not change

- Document register (tutorial-friendly Pages, terse `AGENTS.md`, technical `ARCHITECTURE.md`) is set by references/tone-guide.md, not by this file. STE100 is a grammar and vocabulary layer on top of that register.
- Blog posts. See references/tone-guide.md `<blog>` for the narrative style that applies there instead.
- Code, code comments other than JSDoc, and Markdoc tag syntax.
