# Update Server MD

## Required Reading
Read the relevant source files in `server/` and then read the current `server/SERVER.md` before making any changes.

## Process

### Step 1: Identify what changed

Determine which part of the server or build pipeline changed:

| Change type | Likely section(s) to update in SERVER.md |
|---|---|
| New or removed effect | Reactive Build Pipeline → Effects Table; Build Orchestration count |
| New file signal or watched directory | Reactive Build Pipeline → File Signals |
| New HTTP route or removed route | HTTP Server → Routes |
| New Markdoc tag or schema | Markdoc Content System → Registered Schemas |
| New HMR message type | HMR → Message Protocol |
| New config constant | Configuration → Directory Constants |
| New environment variable | Environment Variables |
| New test category or helper | Testing |

### Step 2: Read source and current SERVER.md

Read the source file(s) that changed (e.g. `server/effects/`, `server/build.ts`, `server/serve.ts`, `server/config.ts`). Then read the relevant section(s) of `server/SERVER.md`. Never update from memory.

### Step 3: Apply surgical edits

Update only what changed. Preserve the structure and tone — SERVER.md is a technical reference for developers, not a narrative document.

**Effects table:** Each row is `| effectName | input signals | output path(s) |`. Keep rows sorted by logical dependency order (file signals → processed → pageInfos → fullyProcessed). Update the effect count in Build Orchestration when rows are added or removed.

**Agent-Oriented Content Discovery:** This section covers `mdMirrorEffect`, the `<link rel="alternate">` injection in `pagesEffect`, and `llmsManifestEffect`. Update it when any of these three change.

**Markdoc tag table (`stripMarkdocTags()`):** Each row maps a source pattern to its Markdown output. Add rows for new tags; remove rows for deleted tags. Order: block → inline, most complex patterns first within each group.

**`Future Improvements` section:** Mark items ✅ when they ship. Do not delete them — they serve as a changelog for what was planned vs. delivered. Add new planned items when introduced.

### Step 4: Verify

Re-read the edited section against the source. Confirm:
- Effect count in Build Orchestration matches the number of rows in the Effects Table
- File paths in output columns match what the effect actually writes
- No section was accidentally left describing the old behavior

## Success Criteria
- Every table, count, and path in the edited section matches the current `server/` source
- The Future Improvements section correctly reflects shipped (✅) vs. planned items
- Surrounding accurate content is untouched
