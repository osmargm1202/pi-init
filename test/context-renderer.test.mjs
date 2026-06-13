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
