<process>
## Step 1: Read domain context

1. Read `CONTEXT.md` — understand the domain vocabulary and relationships
2. Read `ARCHITECTURE.md` — understand the current system structure
3. Check `adr/` directory for existing ADRs in the relevant area
4. Read `REQUIREMENTS.md` for any constraints that might affect refactoring

## Step 2: Explore the codebase with depth analysis

Use the `task` tool with `agent=explore` to walk the codebase organically. Apply these depth-first heuristics:

- **Deletion test**: For any module, imagine deleting it. If complexity vanishes → it was a pass-through (shallow). If complexity reappears across N callers → it was earning its keep (deep).
- **Interface vs Implementation**: Is the interface nearly as complex as what's behind it? High ratio = shallow.
- **Locality check**: Where do bugs actually hide? In the module, or in how it's called?
- **Seam identification**: Where do adapters satisfy interfaces? One adapter = hypothetical seam. Two+ adapters = real seam.
- **Coupling leaks**: Where do tightly-coupled modules bleed across their boundaries?

Note friction points:
- Understanding one concept requires bouncing between many small modules
- Modules that are shallow (interface ≈ implementation complexity)
- Pure functions extracted for testability, but real bugs in composition
- Tight coupling leaking across seams
- Untested or hard-to-test areas due to interface shape

## Step 3: Present deepening candidates

Present a numbered list of deepening opportunities. For each candidate:

```markdown
### Candidate N: Brief description
- **Files**: `path/to/module.ts`, `path/to/other.ts`
- **Problem**: Why current architecture causes friction (use depth/leverage/locality terms)
- **Solution**: Plain English description of what would change
- **Benefits**: Explained in terms of locality and leverage, plus testability improvements
- **ADR conflicts**: "Contradicts ADR-0007 — but worth reopening because..." (only if real friction)
```

**Language rules:**
- Use CONTEXT.md vocabulary for domain concepts
- Use architecture terms from the glossary below (Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality)
- Do NOT propose interfaces yet — ask user: "Which of these would you like to explore?"

## Step 4: Grilling loop

Once user picks a candidate, drop into a grilling conversation:

- Walk the design tree: constraints, dependencies, shape of the deepened module
- What sits behind the seam? What tests survive?

**Side effects (handle inline as decisions crystallize):**
- **New domain term?** → Add to CONTEXT.md immediately
- **Fuzzy term sharpened?** → Update CONTEXT.md right there
- **User rejects with load-bearing reason?** → Offer: "Want me to record this as an ADR so future reviews don't re-suggest it?"
- **Explore alternative interfaces?** → Reference INTERFACE-DESIGN.md patterns

## Step 5: Update documents

1. For significant decisions: use `adr-keeper` skill to create ADR
2. Update `ARCHITECTURE.md` with new structure and add to Key Decisions table
3. Write implementation tasks to `TODO.md` using LT-NNN format

## Glossary (use these terms exactly)

- **Module** — anything with an interface and an implementation (function, class, package, file)
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside the module
- **Depth** — leverage at the interface: a lot of behaviour behind a small interface. **Deep** = high leverage. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place
- **Adapter** — a concrete thing satisfying an interface at a seam
- **Leverage** — what callers get from depth
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place
</process>

<success_criteria>
- Candidates framed in CONTEXT.md domain vocabulary and architecture glossary terms
- Each candidate identifies real friction, not theoretical improvements
- ADR conflicts explicitly marked (not just omitted)
- User selects candidate before interface design begins
- Domain terms updated in CONTEXT.md inline during grilling
- Significant rejections recorded as ADRs
- ARCHITECTURE.md updated with new structure
- TODO.md has ordered, actionable implementation tasks
</success_criteria>
