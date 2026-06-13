import assert from "node:assert/strict";
import test from "node:test";
import { renderAgentsMarkdown, renderContextMarkdown } from "../extensions/lib/context-renderer.ts";

const scan = {
  root: "/repo/sample",
  packageName: "sample-app",
  scripts: { test: "node --test", build: "tsc" },
  stack: ["Node.js", "TypeScript"],
  importantFiles: ["package.json", "README.md"],
  tree: ["package.json", "README.md", "src/", "src/index.ts"],
  warnings: []
};

test("renderContextMarkdown includes stable project sections", () => {
  const text = renderContextMarkdown(scan);
  assert.match(text, /# Project Context/);
  assert.match(text, /## Overview/);
  assert.match(text, /sample-app/);
  assert.match(text, /## Current Stack/);
  assert.match(text, /TypeScript/);
  assert.match(text, /## Commands/);
  assert.match(text, /npm run test/);
  assert.match(text, /## Do Not Rediscover/);
});

test("renderAgentsMarkdown includes actionable agent instructions", () => {
  const text = renderAgentsMarkdown(scan);
  assert.match(text, /# Agent Instructions/);
  assert.match(text, /## Development Workflow/);
  assert.match(text, /## Verification Matrix/);
  assert.match(text, /npm run test/);
  assert.match(text, /CONTEXT.md/);
  assert.match(text, /RESUME.md/);
});

const unsafeScan = {
  root: "/repo/with `tick`\n- injected root",
  packageName: "unsafe `pkg`\n- injected package",
  scripts: {
    "te`st\n- injected script": "node --test `all`\n- injected command"
  },
  stack: ["Node.js\n- injected stack"],
  importantFiles: ["package.json\n- injected important"],
  tree: ["src/index.ts\n- injected tree"],
  warnings: ["warning with `tick`\n- injected warning"]
};

test("renderContextMarkdown normalizes unsafe scan values before writing list items", () => {
  const text = renderContextMarkdown(unsafeScan);
  assert.doesNotMatch(text, /\n- injected/);
  assert.match(text, /unsafe pkg - injected package/);
  assert.match(text, /repo\/with tick - injected root/);
  assert.match(text, /Node\.js - injected stack/);
  assert.match(text, /package\.json - injected important/);
  assert.match(text, /src\/index\.ts - injected tree/);
  assert.match(text, /warning with tick - injected warning/);
});

test("renderAgentsMarkdown normalizes unsafe script names and commands onto one list line", () => {
  const text = renderAgentsMarkdown(unsafeScan);
  assert.doesNotMatch(text, /\n- injected/);
  assert.match(text, /npm run test - injected script/);
  assert.match(text, /node --test all - injected command/);
});
