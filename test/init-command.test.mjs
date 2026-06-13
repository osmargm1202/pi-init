import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import initExtension from "../extensions/init.ts";

test("/orgm-init writes only CONTEXT.md and AGENTS.md", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-command-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test" } }, null, 2));
    const commands = new Map();
    let newSessionCalled = false;
    initExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-init").handler("", {
      cwd: dir,
      ui: { notify() {} },
      newSession: async () => {
        newSessionCalled = true;
        return { cancelled: false };
      }
    });
    assert.match(await readFile(join(dir, "CONTEXT.md"), "utf8"), /# Project Context/);
    assert.match(await readFile(join(dir, "AGENTS.md"), "utf8"), /# Agent Instructions/);
    assert.equal(existsSync(join(dir, "ORGMINIT_REVIEW_PROMPT.md")), false);
    assert.equal(newSessionCalled, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("/orgm-init updates marked sections without overwriting manual content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-manual-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test" } }, null, 2));
    await writeFile(join(dir, "CONTEXT.md"), "Manual top\n\n<!-- ORGM:BEGIN generated -->\nold\n<!-- ORGM:END generated -->\n\nManual bottom\n");
    await writeFile(join(dir, "AGENTS.md"), "Agent manual top\n\n<!-- ORGM:BEGIN generated -->\nold\n<!-- ORGM:END generated -->\n");
    const commands = new Map();
    initExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-init").handler("", {
      cwd: dir,
      ui: { notify() {} },
      newSession: async () => {
        throw new Error("/orgm-init must not start review sessions");
      }
    });
    const context = await readFile(join(dir, "CONTEXT.md"), "utf8");
    const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
    assert.match(context, /^Manual top/);
    assert.match(context, /Manual bottom/);
    assert.doesNotMatch(context, /old/);
    assert.match(context, /# Project Context/);
    assert.match(agents, /^Agent manual top/);
    assert.doesNotMatch(agents, /old/);
    assert.match(agents, /# Agent Instructions/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
