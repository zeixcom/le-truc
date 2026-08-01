### Card Callout

A callout box with a colored border and icon, for notes, tips, warnings, and similar asides. It's CSS-only — every variant is selected purely through the `class` attribute, with no JavaScript behavior involved.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/card-callout.html" /%}
{% /demo %}

#### Classes

Use `class` attribute to get a different style for the callout.

{% table %}
- Class
- Description
---
- `info`
- For an informational message
---
- `tip`
- For a helpful tip
---
- `caution`
- For a warning message
---
- `danger`
- For a critical message
---
- `note`
- For a side note
{% /table %}
