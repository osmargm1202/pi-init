# pi-init

ORGM Pi initialization command package.

## Install

```bash
pi install git:github.com/osmargm1202/pi-init
```

## Owns

- `/orgm-init`: generate/update `CONTEXT.md`, `AGENTS.md`, and `ORGMINIT_REVIEW_PROMPT.md` for the current project.
- `/orgm-init --review`: generate files and open a fresh review session with the generated prompt when Pi supports session replacement messaging.
- `/orgm-config-init`: materialize full `~/.pi/agent/orgm.json` defaults.

## Development

```bash
npm install
npm test
npm run pack:check
```
