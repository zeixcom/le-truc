# Update README

## Required Reading
1. references/document-map.md → `<README_md>`
2. references/tone-guide.md → `<README>` section

## Process

### Step 1: Read `README.md` and the relevant source

Read the full `README.md` before making any changes. Read `index.ts` to verify current exports and the quick-start example.

### Step 2: Identify what is outdated

Compare against the change that triggered this update. Common cases:
- Package name or install command changed → update Installation section
- Quick-start example uses a changed API → update the example
- A major new capability worth surfacing → add a brief mention with a link to the docs

### Step 3: Edit surgically

`README.md` is a doorway — it does not duplicate the documentation site. Keep it short. The quick-start example should be the minimal working pattern, not a comprehensive feature demo.

### Step 4: Verify

- Install command is `npm install @zeix/le-truc` (or equivalent current command)
- Quick-start example imports from `@zeix/le-truc` and uses current API names
- Any links to the docs site resolve to real pages

## Success Criteria
- Install command is current
- Quick-start example compiles against current exports
- No content duplicated from the docs site — links instead
