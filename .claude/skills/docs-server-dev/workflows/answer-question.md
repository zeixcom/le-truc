<required_reading>
references/source-map.md — lists which authoritative document answers which question
</required_reading>

<process>
## Step 1: Route the question

| Question topic | Go to |
|---------------|-------|
| How the system is structured, what each layer does | `server/SERVER.md` → Architecture Overview |
| Data flow from file change to HTML output | `references/architecture.md` → Reactive Build Pipeline |
| How to add/change an effect, `ready` contract | `references/effect-pattern.md` |
| How to add a Markdoc tag, attribute system | `references/markdoc-schema.md` |
| How template escaping works, `raw()` rules | `references/template-system.md` |
| The two `html` tags confusion | `references/template-system.md` → The Two `html` Tags |
| Test categories, test-utils API, what to test | `references/testing.md` |
| Where a specific source file is, what it exports | `references/source-map.md` |
| Open tasks, prior design decisions | `server/TASKS.md` |
| HTTP routes, layout selection, `guardPath` | `server/SERVER.md` → HTTP Server section |
| HMR: how it works, message protocol | `server/SERVER.md` → Hot Module Replacement |
| File signals: which signal watches what | `server/SERVER.md` → File Signals table |
| Configuration constants, path layout | `server/SERVER.md` → Configuration |
| Test plan, what the test suite covers | `server/TESTS.md` |

## Step 2: Read the authoritative document

Read only the relevant section — do not read entire files when a section lookup suffices.

## Step 3: Answer

- State the answer directly, citing the source
- Include relevant code examples from the source if they make the answer clearer
- If the question crosses multiple concerns (e.g. "how does a file change become a page HTML"), trace the full pipeline step by step using the data flow described in `references/architecture.md`

## For questions about a specific source file

Read the file directly. Then answer based on what the code actually does — not documentation that may be stale.
</process>
