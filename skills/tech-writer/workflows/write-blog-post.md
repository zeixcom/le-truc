<required_reading>
1. references/tone-guide.md → `<blog>` section — read before writing a single word
2. references/markdoc-tags.md — frontmatter format and `{% section %}` tag
3. references/document-map.md → `<pages_blog>` section
</required_reading>

<process>
## Step 1: Clarify scope

Before writing, confirm:
- What is the post about? (release, design decision, comparison, lessons learned)
- Is there a specific angle or argument the post should make?
- Are there existing posts to read for context or continuity?

Read any referenced posts before continuing.

## Step 2: Read existing posts for style calibration

Read at least one recent post in `docs-src/pages/blog/` before drafting. This grounds you in the current voice and prevents drift.

## Step 3: Gather facts

If the post covers an API, a design decision, or a comparison — read the relevant source first. Do not write from memory.

- For API descriptions: read `src/` and cross-check against `index.ts`
- For design decisions: check `ARCHITECTURE.md` for the Key Decisions table
- For comparisons: read `docs-src/pages/index.md` for how Le Truc positions itself

## Step 4: Draft the post

### Frontmatter

```yaml
---
title: Short Direct Title
description: One sentence in plain English describing what the post covers.
emoji: 🎉
layout: blog
date: YYYY-MM-DD
author: Full Name
tags: tag1, tag2
---
```

- Title: no punctuation at the end; no "Introducing", "Announcing", or similar opener unless it genuinely fits
- Description: plain English, not a teaser — say what it covers

### Structure

Wrap all content in `{% section %}` … `{% /section %}`.

Use `## H2` headings to break up sections. Keep sections focused — one idea per section. Short sections are fine.

Open with the point, not the framing. Do not start with "In this post we will cover…" or "Before we dive in…".

### Tone checklist while drafting

Apply these actively, not as a final pass:

- **Would a colleague say this out loud?** If it sounds like a press release, rewrite it.
- **Is the sentence doing work?** If removing it would not change the meaning, cut it.
- **Is there a simpler word?** "Use" beats "utilize". "Fix" beats "remediate". "Change" beats "paradigm shift".
- **Are transitions earned?** Only add a transition sentence if the jump between paragraphs is genuinely confusing without it.

### Jargon to avoid

These phrases appear often in technical writing and should be replaced:

| Avoid | Say instead |
|---|---|
| greenfield project | new project / project you build from scratch |
| ergonomic | easy to use / comfortable to work with |
| paradigm shift | big change / fundamental change |
| first-class concern | built-in / central to how it works |
| translation point / bridge layer | a layer in between / something in the middle |
| profile matches your project | fits your situation |
| separation of concerns | keeping things separate / keeping X and Y apart |
| incidental / central to | small part of / core to |
| optimise for | aim for / built around |
| occupies a niche | good for a specific thing |
| the insight was | (cut it — just state the insight) |
| went back to first principles | went back to basics |
| accidental complexity | unnecessary complexity |
| non-starter | deal-breaker / not an option |
| the question is whether | (cut it — just ask the question) |

## Step 5: Self-review before finishing

Read the full draft once and check:

1. Does the opening sentence tell you what the post is about without throat-clearing?
2. Is every section heading a plain description of what follows — not a clever label?
3. Are all technical claims accurate? Cross-check API names and behavior against source.
4. Are there any jargon phrases from the table above still in the draft?
5. Is any sentence saying the same thing as the sentence before it?
6. Does the post end with something concrete — a call to action, a takeaway, a next step — rather than just trailing off?

## Step 6: Verify frontmatter and Markdoc

- Frontmatter is complete (all six fields present)
- `{% section %}` opens and `{% /section %}` closes the content
- No other Markdoc tags used unless the page genuinely needs them (callouts, demos)
- Date matches the intended publish date
</process>

<success_criteria>
- Post is factually accurate for the version it describes
- No jargon or corporate buzzwords (see tone-guide.md `<blog>`)
- Plain English throughout — reads like a person explaining something, not a product announcement
- Frontmatter is complete and valid YAML
- Markdoc structure is correct (`{% section %}` wrapping all content)
- Opens with the point; ends with something concrete
</success_criteria>
