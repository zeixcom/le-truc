<required_reading>
Use references/source-map.md to find the right document for the question topic, then read that document.
For signal behavior questions: read references/cause-effect-integration.md first.
For boundary questions ("should this be in le-truc or cause-effect?"): read references/library-boundaries.md.
</required_reading>

<process>
## Step 1: Route to the right source

Use this table to find the authoritative source for the question:

| If the question is about… | Read… |
|---|---|
| Component lifecycle (connectedCallback, attributeChangedCallback, disconnectedCallback) | `ARCHITECTURE.md` → "The Component Lifecycle" |
| Effect internals (updateElement, runEffects, reactive parameter) | `ARCHITECTURE.md` → "The Effect System"; `src/effects.ts` |
| Parser/Reader/MethodProducer type system | `ARCHITECTURE.md` → "The Parser System"; `src/parsers.ts` |
| UI query system (first, all, dependency resolution, selector type inference) | `ARCHITECTURE.md` → "The UI Query System"; `src/ui.ts` |
| Context protocol internals | `ARCHITECTURE.md` → "The Context Protocol"; `src/context.ts` |
| `pass()` internals | `ARCHITECTURE.md` → "pass() — inter-component binding"; `src/effects/pass.ts` |
| Security (setAttribute validation) | `ARCHITECTURE.md` → "Security"; `src/effects/attribute.ts` |
| Which signal type le-truc uses internally and why | `references/cause-effect-integration.md` |
| What belongs in le-truc vs. cause-effect | `references/library-boundaries.md` |
| Non-obvious behaviors | `CLAUDE.md`; `references/non-obvious.md` |
| Public API surface (what's exported) | `src/index.ts`; `types/` |

## Step 2: Read, then answer

Read the relevant file(s) before answering. Do not answer from memory when the source is available.

## Step 3: Cite the source

In the answer, reference the specific section or file. This helps the user verify and explore further.
</process>

<success_criteria>
- Answer derived from the authoritative source, not from memory
- Source cited in the response
- If the answer reveals a gap in references/non-obvious.md, add it there
</success_criteria>
