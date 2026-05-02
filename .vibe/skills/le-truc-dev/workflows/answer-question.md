# Answer Question

## Required Reading
Use references/source-map.md to find the right document for the question topic, then read that document.
For signal behavior questions: read references/cause-effect-integration.md first.
For boundary questions ("should this be in le-truc or cause-effect?"): read references/library-boundaries.md.

## Process

### Step 1: Route to the Right Source

Use this table to find the authoritative source for the question:

| If the question is about... | Read... |
|---|---|
| Component lifecycle (connectedCallback, #initSignals, disconnectedCallback) | `ARCHITECTURE.md`; `src/component.ts` |
| Effect internals (watch, on, pass, each, EffectDescriptor) | `ARCHITECTURE.md`; `src/effects.ts`, `src/events.ts` |
| DOM helper internals (bind*, dangerouslyBindInnerHTML) | `ARCHITECTURE.md`; `src/bindings.ts` |
| Parser/MethodProducer type system | `ARCHITECTURE.md`; `CONTEXT.md`; `src/component.ts` |
| UI query system (first, all, dependency resolution, selector type inference) | `ARCHITECTURE.md`; `src/ui.ts` |
| Context protocol internals | `ARCHITECTURE.md`; `src/context.ts` |
| `pass()` internals | `ARCHITECTURE.md`; `src/effects.ts` (`makePass`) |
| Security (safeSetAttribute validation) | `ARCHITECTURE.md`; `src/bindings.ts` |
| Which signal type le-truc uses internally and why | `references/cause-effect-integration.md` |
| What belongs in le-truc vs. cause-effect | `references/library-boundaries.md` |
| Non-obvious behaviors | `references/non-obvious.md`, `AGENTS.md` |
| Public API surface (what's exported) | `types/index.d.ts`; `types/` |
| Domain vocabulary | `CONTEXT.md` |

### Step 2: Read, Then Answer

Read the relevant file(s) before answering. Do not answer from memory when the source is available.

### Step 3: Cite the Source

In the answer, reference the specific section or file. This helps the user verify and explore further.

## Success Criteria
- Answer derived from the authoritative source, not from memory
- Source cited in the response
- If the answer reveals a gap in references/non-obvious.md, add it there
