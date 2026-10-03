# Tone Guide

Style rules for each document this skill maintains. Violating the tone is as wrong as a factual error — each document has a distinct primary reader and serves a distinct purpose.

Style runs on two dials. **Precision** governs how strictly sentences are controlled. **Voice** governs how much journey, rhythm, and opinion the text carries. The dials move in opposite directions: reference material runs full precision and no rhetorical voice; narrative runs loose precision and full voice. Most pages mix types section by section — a tutorial page can hold a persuasive hero, reference tables, and hands-on steps. Set the dials per section, not per file.

## The Three Style Layers

Every document is written in all of Layer 1, plus the Layer 2 and Layer 3 strengths its text type calls for.

1. **Plain English — everywhere, including the blog.** Active voice. Present tense for behavior. Plain words ("use", not "utilize"; "fix", not "remediate"). One word per concept, using the `CONTEXT.md` domain vocabulary. All code in backticks. No corporate phrasing — the jargon table in workflows/write-blog-post.md is the enforcement list in every document, not just posts.
2. **Sentence discipline — scaled by text type.** The rules in references/ste100-style.md: one idea per sentence, short sentences, lists over compound sentences. Full strength where a misread costs the reader — instructions, steps, warnings, callouts, reference entries. Relaxed for connective prose in explanations, landing pages, `README.md`, and blog.
3. **Voice — scaled by text type, inverse to discipline.** Journey, rhythm, and opinion, defined in Voice Techniques below. Reference entries carry none. Explanations and narratives carry a lot.

## Text Types

Classify the section before writing or editing it. The type sets the dials.

| Type | Job | Where | Discipline | Voice |
|---|---|---|---|---|
| Landing | Convince | `index.md` hero and carousel; `README.md` "Why use Le Truc" | Low | High — claims, rhythm, opinions |
| Tutorial | Teach by doing | `getting-started.md`; hands-on fragments of `components.md` | High on steps and warnings, relaxed between them | Low — the sequence is the story; opinions in callouts |
| How-to | Guide a task or decision | `styling.md` | High on instructions | Medium — trade-off opinions |
| Explanation | Build understanding | Concept sections of `components.md`, `data-flow.md` | Medium | High — journey, rhythm, opinions |
| Reference | Answer a lookup | `api.md`, `examples.md`, JSDoc, `ARCHITECTURE.md`, `server/SERVER.md` | Full | None — except trade-off notes in `ARCHITECTURE.md` |
| AI-optimized | Feed a model | `AGENTS.md`, skill files, `TODO.md`, `NOTES.md` | Full (articles may drop) | Directives only — no rhythm, no journey |
| Narrative | Tell what happened and why | Blog posts | Low | High |
| Community | Orient and invite | `about.md`, `blog.md` | Full | None |

When one page holds several types, each section keeps its own dials. The signal-types table in `components.md` is reference: full discipline, no voice. The prose around it is explanation: journey, rhythm, opinion.

## Voice Techniques

Voice is a toolkit, not a license. Each technique has a job and a failure mode.

### Journey

Give explanations and narratives an arc: a situation the reader recognizes, a complication, and the resolution the concept provides.

- Open explanation sections from the reader's problem, not from the API. `data-flow.md` opens with a product catalog and three components that must coordinate — then follows that one scenario end to end. That is the model.
- Let the sequence carry tutorials. Each section hands the reader to the next: "The `<basic-hello>` HTML above is already on the page. Now add the component definition that makes it reactive."
- Story-frame code examples. Real component names and realistic data — `form-spinbutton`, a shopping-cart badge — never `foo`, `bar`, `test1`. A bare example teaches syntax; a framed one teaches usage.
- End sections with somewhere to go: the next section, a runnable example, an API page.
- The journey is the reader's, not the project's. The no-history rule below still holds — never narrate the project's own past outside the blog, `CHANGELOG.md`, and ADRs.

### Rhythm

Vary sentence length on purpose. A short sentence after two long ones lands the point.

- If three consecutive sentences share the same length and shape, rewrite one.
- The two-beat pattern works at every strength but Full: a statement, then a short sentence that draws the conclusion. In-house exemplars:
  - "Neither choice is good when the backend is a CMS. Neither choice is good when the initial HTML is already correct." (`README.md`) — parallel build, flat close.
  - "No custom events are needed. State flows naturally." (`data-flow.md`)
  - "Each argument runs at a different time. That's the key." (blog)
- Rhythm lives in landing, explanation, and narrative. Steps, reference entries, and `AGENTS.md` stay uniform — there, sameness reads as reliability.

### Opinions

Dare to recommend. "Always use `defineMethod()`, never a plain function." "Avoid reaching inside sub-components." A document that only describes is a catalog; the reader came for judgment.

- Every opinion carries a reason the reader can check: "Styling its inner elements creates tight coupling."
- Commit or cut. "This may be considered somewhat complex" is a hedge. Either say "That's a lot to hold in your head" and back it, or delete it.
- The `styling.md` "Best when / Avoid if" callout pattern is the in-house exemplar for trade-off opinions.
- Opinions belong wherever guidance belongs: `AGENTS.md` directives, `ARCHITECTURE.md` trade-off notes, callouts, how-tos, explanations, landing, `README.md`, blog. They are banned only in neutral lookup material — JSDoc summaries and navigation pages state both forms of everything and rank nothing.

## Shared Rules

These apply to every document without exception:

- **Concise over comprehensive.** Every sentence must add information the reader needs. Cut throat-clearing, transitional padding, and restatements of what the code already shows.
- **Technically accurate over reassuring.** Do not soften edge cases, paper over constraints, or omit behavior that is surprising but correct.
- **Current shape, timeless rationale.** Documents state current truth: what the API is, not what it was. Never write "previously", "as of version X", "we changed", "now supports", or "will eventually". Timeless rationale — why the design is the way it is — is content in explanations, `ARCHITECTURE.md`, and blog; it is noise in reference entries and JSDoc. No ticket, issue, or task IDs (e.g. `LT-123`) — they reset every sprint and mean nothing to a future reader; a stable identifier like an ADR number is fine where the rationale genuinely lives in that ADR. `CHANGELOG.md` (`changelog-keeper` skill) and ADRs (`adr-keeper` skill) own the timeline; their entry and section registers are defined in those skills.
- **No meta-commentary.** Do not write "This section explains…" or "See below for…". Say the thing directly.
- **Backtick all code.** Every API name, file name, type name, option key, tag name, and shell command is wrapped in backticks, even mid-sentence.
- **Surgical edits only.** Update what changed. Do not rewrite accurate sections, and do not add commentary about what was updated.
- **Vocabulary is always disciplined.** One word per concept, defined in `CONTEXT.md` — in every text type, including landing and blog.

## Pages

**Primary audience varies by page** (see references/document-map.md). Classify each section's text type (see Text Types above) and set the dials accordingly.

**Register:** Approachable, direct address ("Le Truc lets you…", "Use `all()` when…"). Present tense. Active voice. Conversational without being casual.

**Markdoc structure rules:**
- The hero lead is one bold claim sentence plus at most two plain sentences. It states what the page teaches, not what it covers — "**Declare reactive properties with `expose()`.**", not "This page covers properties."
- A page needs at least two `{% section %}` blocks with H2 headings — the in-page table of contents renders only for two or more H2s.
- Use `{% callout .tip title="…" %}` for non-obvious constraints or important caveats that the reader is likely to miss. Do not overuse — one callout per major section at most.
- Use `{% demo %}` blocks only when the full HTML markup adds genuine understanding; do not add demos for trivial snippets.
- Code blocks in pages use the `#filename` annotation when the file context matters (e.g., ` ```js#module-catalog.ts `).
- Code examples are realistic — they show actual patterns from the examples directory, not toy snippets. When possible, reference the real component source with `{% sources /%}`.
- Callout `.tip` is for helpful guidance. Use `.warning` or `.info` if the project adds those variants.

**What to cut in pages:**
- Decorative framing ("This powerful feature lets you…"). Naming the reader's actual situation ("When a catalog must sum ten spinbuttons…") is different — that is how an explanation section opens; keep it.
- Repetition of content already visible in the code example
- Explanations of standard JavaScript/TypeScript/CSS concepts the audience already knows

## README

**Primary audience:** Developers encountering the library on GitHub or npm for the first time.

**Register:** A doorway, not a manual. The "Why use Le Truc" section is Landing type — rhythm and one committed opinion are welcome there. Installation and quick-start are precision-leaning Tutorial. Everything deeper links to the documentation site.

**Structure rules:**
- No section should require scrolling to see — README.md is a doorway, not a manual.
- The quick-start example is minimal: one complete, working component that demonstrates the essential pattern.

**What to cut:**
- Comparison prose beyond the Why section — let the docs site handle positioning
- Options tables or API details — those live in docs
- Anything already in the docs site that the README would just duplicate

## ARCHITECTURE

**Primary audience:** Contributors and AI agents that need to understand internals.

**Register:** Reference type, full discipline. Technical and precise. Third person, present tense. Implementation details are expected and welcome. Internal function names, type names, flag names, and field names are used freely without definition — this document assumes the reader has the source open.

**Structure rules:**
- Describe mechanisms, not intentions. Not "this enables efficient updates" but "when `watch(source, handler)` re-runs, the handler receives the new value and applies it to the DOM directly."
- File maps, dependency graphs, and lifecycle diagrams are appropriate. Match actual source structure exactly.
- Trade-off rationale lives in the Key Decisions table and ADRs, not in mechanism prose.

**What to cut:**
- Motivational framing ("The design optimizes for…")
- Public API description — that belongs in docs pages
- Any sentence replaceable by reading the source directly

## AGENTS.md

**Primary audience:** AI agents at inference time. Every token has a cost.

**Register:** AI-optimized type. Terse, declarative, maximally dense. No hand-holding. No transitions. Bold key terms. Bullet lists over prose. Code examples only when the correct pattern is non-obvious from the statement. Directives are opinions — "removing a provider is an anti-pattern" is the right register — but no rhythm and no journey.

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

**Narrative type.** Layer 2's sentence rules do not apply; Layer 1 (plain English, `CONTEXT.md` terms) does. Journey, rhythm, and committed opinions are not an exemption here — they are the assignment. See Voice Techniques.

**Primary audience:** Developers who have found their way to the blog — curious about the project's history, design decisions, or how it compares to alternatives. They are technically capable but not necessarily Le Truc users yet.

**Register:** Plain, direct, conversational. Write the way a knowledgeable colleague explains something over coffee — not a sales deck, not a whitepaper. First person plural ("we") is fine for posts about the team's experience. Present tense for general claims; past tense for things that happened.

**Core rules:**

- **No business jargon.** Do not write: "greenfield", "ergonomic", "paradigm shift", "first-class concern", "translation point", "profile matches", "incidental to", "optimise for", "separation of concerns". Say the plain thing instead.
- **No corporate phrasing.** Avoid: "occupies a niche", "the insight was", "the question is whether", "the friction appears", "the gap", "what each got right". These sound like a strategy document, not a person talking.
- **No motivational framing.** Cut throat-clearing like "This post covers…", "The goal is to…", "This is an enormous improvement." Say the thing. Let the reader decide if it is an improvement.
- **Build an arc.** A post has a question, a turn, and a payoff. "Four Arguments for Four Guarantees" builds suspense through the constraints and lands the factory form as the resolution — that is the model.
- **Technical terms are fine where needed.** "Reactive", "signal graph", "Shadow DOM", "hydration", "SSR", "prop drilling" — these have precise meanings that matter. Do not replace them with vague paraphrases.
- **Contractions are fine.** "It is" can be "it's". "Do not" can be "don't". Match the natural rhythm of spoken explanation.

**What to cut:**
- Sentences that restate what the previous sentence already said
- Transitions that exist only to move between paragraphs ("We have now described…", "That brings us to…")
- Any sentence the reader could have written themselves after reading the previous one

## JSDoc

**Reference type, full discipline.** Follows references/ste100-style.md at Full strength: one short sentence per summary line, active voice, present tense, `CONTEXT.md` domain terms.

**Primary audience:** Developers reading function signatures in an IDE or in the TypeDoc-generated API pages.

**Register:** Brief, typed, precise. One-line summaries. No narrative. Fragments are acceptable if they read naturally as a tooltip. No opinions — JSDoc states behavior, not preference.

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
