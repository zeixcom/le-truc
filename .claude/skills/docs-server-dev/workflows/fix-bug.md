<required_reading>
1. references/source-map.md — locate the right files
2. references/architecture.md — understand data flow
</required_reading>

<process>
## Step 1: Check non-obvious behaviors first

Before tracing code, verify the bug isn't actually expected behavior. The most common sources of confusion:

**Two `html` tags:** Is `html` imported from `templates/utils.ts` or `markdoc-helpers.ts`? They produce completely different output. A schema `transform()` using the templates `html` gets a string where a `Tag` is expected — renders as `[object Object]`.

**Auto-escaping:** Seeing `&lt;` instead of `<` in output? A trusted HTML value was interpolated without `raw()`. Seeing unescaped HTML in output? `raw()` was used on untrusted content.

**`ready` never resolves:** An effect's `resolve?.()` call is missing from the `err` path or is inside the `try` instead of `finally`. Build hangs indefinitely.

**File not updated on change:** `writeFileSafe()` skips writes when content hash is unchanged. Either the content is genuinely the same, or the hash check is comparing the wrong thing.

**Route returns wrong file:** `guardPath()` rejected the path. Check the base directory constant — is it `OUTPUT_DIR` when it should be `EXAMPLES_DIR`, or vice versa?

**HMR not triggering:** `NODE_ENV` is not `development`, or `PLAYWRIGHT=1` is set. Check the environment.

**Effect not re-running:** The signal it depends on didn't change. Check `file-signals.ts` — does the signal watch the right directory and extension?

## Step 2: Reproduce

Identify the minimal case that reproduces the bug:
- For rendering bugs: what input Markdown or HTML triggers it?
- For build bugs: which file change triggers (or fails to trigger) the wrong behavior?
- For server bugs: which HTTP request returns the wrong response?

Read the failing test if one exists, or write a failing test before fixing.

## Step 3: Trace the data flow

Follow the data from source to output:

1. **File change** → `file-watcher.ts` → `List<FileInfo>` signal updates
2. **Signal change** → `createEffect` re-runs → `match([...signals], { ok })` called
3. **`ok` handler** → transformation logic → `writeFileSafe()` → output file
4. **HTTP request** → route handler in `serve.ts` → `handleStaticFile()` → response

Read the actual source files at each step — do not assume.

## Step 4: Fix

Make the minimal fix. Do not:
- Refactor surrounding code
- Add error handling for cases that can't happen
- Change indentation or formatting beyond the fix

## Step 5: Verify

Write a regression test if one doesn't already exist. Run `bun test server/tests` and confirm all tests pass.

If the fix touches a Markdoc schema, run the full pipeline:
```typescript
const ast = Markdoc.parse(source)
const tree = Markdoc.transform(ast, markdocConfig)
const html = Markdoc.renderers.html(tree)
```

If the fix touches HTTP routing, verify `guardPath()` still blocks traversal attempts.
</process>

<success_criteria>
- The specific bug no longer occurs
- A regression test covers the fixed case
- `bun test server/tests` passes with no new failures
- No unrelated code changed
</success_criteria>
