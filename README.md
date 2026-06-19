# pi-init

ORGM Pi initialization command package.

## Install

```bash
pi install git:github.com/osmargm1202/pi-init
```

## Owns

- `/init`: inspect the current repository in the style of Claude Code `/init`, then generate/update `CONTEXT.md` and `AGENTS.md` while preserving manual content outside ORGM managed sections.
  - Reads repository tree, git state, package scripts/manifests, existing instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, Copilot instructions), README/key docs, child git projects, and local `.pi/skills/*/SKILL.md` metadata.
  - Does not create review-prompt files and does not open a new session.
- `/config-init`: materialize full `~/.pi/agent/orgm.json` defaults.

## Development

```bash
npm install
npm test
npm run pack:check
```
