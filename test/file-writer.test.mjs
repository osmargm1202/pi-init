import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeManagedMarkdown } from "../extensions/lib/file-writer.ts";

test("writeManagedMarkdown creates a new generated file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "CONTEXT.md");
  try {
    await writeManagedMarkdown(file, "# Context\n\nGenerated body\n");
    const text = await readFile(file, "utf8");
    assert.match(text, /<!-- ORGM:BEGIN generated -->/);
    assert.match(text, /Generated body/);
    assert.match(text, /<!-- ORGM:END generated -->/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeManagedMarkdown replaces only managed section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "AGENTS.md");
  try {
    await writeFile(file, "Manual top\n\n<!-- ORGM:BEGIN generated -->\nold\n<!-- ORGM:END generated -->\n\nManual bottom\n");
    await writeManagedMarkdown(file, "new body\n");
    const text = await readFile(file, "utf8");
    assert.match(text, /^Manual top/);
    assert.match(text, /new body/);
    assert.doesNotMatch(text, /old/);
    assert.match(text, /Manual bottom/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeManagedMarkdown appends managed section to manual file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "CONTEXT.md");
  try {
    await writeFile(file, "Manual notes\n");
    await writeManagedMarkdown(file, "generated\n");
    const text = await readFile(file, "utf8");
    assert.match(text, /^Manual notes/);
    assert.match(text, /generated/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeManagedMarkdown preserves dangling begin marker content before appended managed section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "AGENTS.md");
  try {
    await writeFile(file, "<!-- ORGM:BEGIN generated -->\nManual note that is not managed\n");

    await writeManagedMarkdown(file, "first generated\n");
    await writeManagedMarkdown(file, "second generated\n");

    const text = await readFile(file, "utf8");
    assert.match(text, /Manual note that is not managed/);
    assert.match(text, /second generated/);
    assert.doesNotMatch(text, /first generated/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
