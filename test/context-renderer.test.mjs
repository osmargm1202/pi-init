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

const claudeLikeScan = {
  ...scan,
  git: { isRepo: false, root: "", branch: "", status: [], error: "not a git repository" },
  instructionFiles: ["AGENTS.md"],
  keyFiles: [
    { path: "AGENTS.md", excerpt: "# AGENTS\n\nUse .pi/skills/climatizacion/SKILL.md before HVAC work." },
    { path: "README.md", excerpt: "# Renovacion\n\nSelf-contained Pi skill." }
  ],
  nestedProjects: [
    {
      path: "cli_aa",
      importantFiles: ["AGENTS.md"],
      packageName: "cli_aa",
      stack: ["Python"],
      keyFiles: [{ path: "cli_aa/AGENTS.md", excerpt: "Use --output-dir <ruta>. Never create .venv inside the skill." }],
      localSkills: [{ name: "climatizacion", path: "cli_aa/.pi/skills/climatizacion", description: "Use for thermal loads and HVAC memorias.", files: ["cli_aa/.pi/skills/climatizacion/SKILL.md", "cli_aa/.pi/skills/climatizacion/pyproject.toml"] }]
    },
    {
      path: "renovacion",
      importantFiles: ["AGENTS.md", "README.md"],
      packageName: "renovacion",
      stack: ["Python"],
      keyFiles: [{ path: "renovacion/AGENTS.md", excerpt: "developer_mode = true. Must follow RED → GREEN → REFACTOR." }],
      localSkills: [{ name: "renovacion", path: "renovacion/.pi/skills/renovacion", description: "Use for ventilation and airflow memorias.", files: ["renovacion/.pi/skills/renovacion/SKILL.md"] }]
    }
  ],
  localSkills: [
    { name: "climatizacion", path: ".pi/skills/climatizacion", description: "Use for HVAC loads.", files: [".pi/skills/climatizacion/SKILL.md", ".pi/skills/climatizacion/pyproject.toml"] }
  ]
};

test("renderContextMarkdown includes Claude-like repository evidence", () => {
  const text = renderContextMarkdown(claudeLikeScan);
  assert.match(text, /## Git State/);
  assert.match(text, /not a git repository/);
  assert.match(text, /## Existing Instructions and Docs/);
  assert.match(text, /AGENTS\.md/);
  assert.match(text, /Use \.pi\/skills\/climatizacion\/SKILL\.md/);
  assert.match(text, /## Nested Projects/);
  assert.match(text, /cli_aa/);
  assert.match(text, /renovacion/);
  assert.match(text, /## Local Pi Skills/);
  assert.match(text, /climatizacion/);
  assert.match(text, /Use for HVAC loads/);
});

test("renderAgentsMarkdown tells future agents to honor detected local instructions and skills", () => {
  const text = renderAgentsMarkdown(claudeLikeScan);
  assert.match(text, /Read detected instruction files first/);
  assert.match(text, /AGENTS\.md/);
  assert.match(text, /Load local skill instructions when task matches/);
  assert.match(text, /\.pi\/skills\/climatizacion\/SKILL\.md/);
  assert.match(text, /Nested git projects detected/);
});

test("renderContextMarkdown synthesizes child repo skill workflows", () => {
  const text = renderContextMarkdown(claudeLikeScan);
  assert.match(text, /### `cli_aa`/);
  assert.match(text, /climatizacion/);
  assert.match(text, /Use for thermal loads and HVAC memorias/);
  assert.match(text, /--output-dir <ruta>/);
  assert.match(text, /Never create \.venv inside the skill/);
  assert.match(text, /### `renovacion`/);
  assert.match(text, /developer_mode = true/);
  assert.match(text, /RED → GREEN → REFACTOR/);
  assert.match(text, /Use for ventilation and airflow memorias/);
});
