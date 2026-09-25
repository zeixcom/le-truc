### Basic Blogmeta

Displays a blog post's byline — author, publication date, optional modification date, and estimated read time. The markup carries schema.org `BlogPosting` metadata for search engines and other structured-data consumers, and shows a placeholder avatar automatically when none is provided.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-blogmeta.html" /%}
{% /demo %}

#### Tag Name

`basic-blogmeta`

#### Attributes

The byline renders from these attributes when the page is built; the component adds no other content.

{% table %}
- Name
- Description
---
- `author`
- The author's display name. Omit it for a date-only byline
---
- `avatar`
- URL of the author's avatar image. Without it, a placeholder avatar renders
---
- `published`
- Publication date, `YYYY-MM-DD`. Formatted in the page's locale; an invalid date shows "unknown date"
---
- `modified`
- Last modification date, `YYYY-MM-DD`. Omitted when absent or invalid
---
- `reading-time`
- Reading time in minutes, rendered with a schema.org `timeRequired`
---
- `lang`
- The occurrence's locale, where the page has none of its own
{% /table %}
