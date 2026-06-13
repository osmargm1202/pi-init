import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import initExtension from "../extensions/init.ts";

test("/orgm-init writes CONTEXT.md, AGENTS.md, and review prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-command-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test" } }, null, 2));
    const commands = new Map();
    initExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-init").handler("", {
      cwd: dir,
      ui: { notify() {} }
    });
    assert.match(await readFile(join(dir, "CONTEXT.md"), "utf8"), /# Project Context/);
    assert.match(await readFile(join(dir, "AGENTS.md"), "utf8"), /# Agent Instructions/);
    const prompt = await readFile(join(dir, "ORGMINIT_REVIEW_PROMPT.md"), "utf8");
    assert.match(prompt, /Review this repository/);
    assert.match(prompt, /CONTEXT\.md/);
    assert.match(prompt, /AGENTS\.md/);
    assert.match(prompt, /fixture/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("/orgm-init --review starts a review session with generated prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-review-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test" } }, null, 2));
    const commands = new Map();
    const messages = [];
    initExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-init").handler("--review", {
      cwd: dir,
      ui: { notify() {} },
      newSession: async (options) => {
        await options.withSession({
          sendUserMessage: async (content) => messages.push(content),
          ui: { notify() {} }
        });
        return { cancelled: false };
      }
    });
    assert.equal(messages.length, 1);
    assert.match(messages[0], /Review this repository/);
    assert.match(messages[0], /CONTEXT\.md/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
