# pi-init

ORGM Pi initialization command package.

## Install

```bash
pi install git:github.com/osmargm1202/pi-init
```

## Owns

- `/orgm-init`: generate/update `CONTEXT.md`, `AGENTS.md`, and `ORGMINIT_REVIEW_PROMPT.md`, then open a fresh agent review session with the generated prompt.
- `/orgm-init --scan-only`: generate/update files without starting the agent review session.
- `/orgm-config-init`: materialize full `~/.pi/agent/orgm.json` defaults.

## Development

```bash
npm install
npm test
npm run pack:check
```
