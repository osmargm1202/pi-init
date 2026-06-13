import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import initExtension from "../extensions/init.ts";

test("/orgm-init writes CONTEXT.md and AGENTS.md", async () => {
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
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
