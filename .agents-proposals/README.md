# `.agents-proposals/`

The sandbox write-denies `.agents/**`. Agents propose changes to those files here, and the owner reviews and copies them in.

- **Mirror the path.** `.agents/skills/writer/SKILL.md` is proposed as `.agents-proposals/skills/writer/SKILL.md`.
- **Write the full file**, not a diff, so the owner can compare and copy it.
- **State the reason** in the task handoff, or in `NOTES.md` when there is no task.
- **Never stage `.agents/` paths.**
- After the copy-in, the owner deletes the proposal.

Only `.agents/` goes through here. Raise issues with `.claude/settings*.json` or `.claude/hooks` in `NOTES.md`. `skills/` (the user-facing skills that ship in the npm package) is writable, so edit it in place.
