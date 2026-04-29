# Agent-Oriented Design Tasks

- [ ] LT-101: Create md-mirror.ts effect for Clean Markdown generation
  **Skill:** docs-server-dev
  **Context:** Implement new effect that transforms processed Markdoc AST back to clean Markdown. Strip custom tags ({% tabs %}, {% tab %}, {% callout %}, {% hero %}, {% section %}, {% carousel %}, {% slide %}, {% demo %}). Transform tabs into ### headings, callouts into blockquotes (> Info: ...). Output to docs/ alongside HTML files. Use existing file-signals.ts pattern.

- [ ] LT-102: Modify pages.ts to inject alternate link in head
  **Skill:** docs-server-dev
  **Context:** In applyTemplate() function, add `<link rel="alternate" type="text/markdown" title="Agent-readable content" href="./{relativePath}.md">` to the generated HTML head. The relativePath already exists in processedFile. Need to inject before `{{ content }}` replacement or modify layouts to include it.

- [ ] LT-103: Create llms-manifest.ts effect for root discovery
  **Skill:** docs-server-dev
  **Context:** New effect that generates docs/llms.txt with markdown links to all documentation pages. Use the same pageInfo data from docsMarkdown.pageInfos that menuEffect uses. Format: # title, > description, ## sections with bullet lists of [text](path) links. Reference AGENT-ORIENTED_DESIGN.md for exact format.

- [ ] LT-104: Register new effects in build.ts
  **Skill:** docs-server-dev
  **Context:** Import and initialize mdMirrorEffect, linkDiscovery already handled in pages.ts, and llmsManifestEffect in build.ts. Add them to the effects array with proper dependency ordering (mdMirror should run after docsMarkdown.fullyProcessed, llmsManifest after menuEffect or pageInfos).

- [ ] LT-105: Create test for md-mirror transformation
  **Skill:** docs-server-dev
  **Context:** Test in server/tests/effects/md-mirror.test.ts. Verify custom tags are stripped, tabs converted to headings, callouts to blockquotes, and output files are created alongside HTML files.

- [ ] LT-106: Create test for llms.txt generation
  **Skill:** docs-server-dev
  **Context:** Test in server/tests/effects/llms-manifest.test.ts. Verify docs/llms.txt is generated with correct format, all pages are listed, paths are correct.

- [ ] LT-107: Verify static hosting compatibility
  **Skill:** docs-server-dev
  **Context:** Run `bun run build:docs` and verify: (1) docs/*.md files exist alongside *.html, (2) each HTML file has the alternate link tag, (3) docs/llms.txt exists and is valid markdown, (4) all paths in llms.txt are relative and correct.

- [ ] LT-108: Document agent-oriented design in SERVER.md
  **Skill:** tech-writer
  **Context:** Add new section to server/SERVER.md describing the agent-oriented design implementation: md-mirror effect, link discovery, llms.txt manifest. Include diagram of the enhanced build pipeline. Reference AGENT-ORIENTED_DESIGN.md for requirements.
