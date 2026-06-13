import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { scanRepository } from "../extensions/lib/repo-scan.ts";

const execFileAsync = promisify(execFile);

test("scanRepository reads manifests scripts and ignores generated directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-scan-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({
      name: "sample-app",
      scripts: { test: "node --test", build: "tsc" },
      dependencies: { react: "latest" },
      devDependencies: { typescript: "latest" }
    }, null, 2));
    await writeFile(join(dir, "README.md"), "# Sample App\n\nA test app.\n");
    await mkdir(join(dir, "src"));
    await writeFile(join(dir, "src", "index.ts"), "export const value = 1;\n");
    await mkdir(join(dir, "node_modules", "ignored"), { recursive: true });
    await writeFile(join(dir, "node_modules", "ignored", "package.json"), "{}");

    const scan = await scanRepository(dir);
    assert.equal(scan.packageName, "sample-app");
    assert.equal(scan.scripts.test, "node --test");
    assert(scan.stack.includes("TypeScript"));
    assert(scan.stack.includes("React"));
    assert(scan.importantFiles.includes("package.json"));
    assert(scan.importantFiles.includes("README.md"));
    assert(scan.tree.some((entry) => entry.includes("src/index.ts")));
    assert(!scan.tree.some((entry) => entry.includes("node_modules")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanRepository omits invalid package script entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-scan-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({
      name: "script-sample",
      scripts: {
        test: "node --test",
        build: "tsc",
        "": "echo empty-key",
        empty: "",
        numeric: 42,
        object: { command: "node index.js" }
      }
    }, null, 2));

    const scan = await scanRepository(dir);
    assert.deepEqual(scan.scripts, {
      test: "node --test",
      build: "tsc"
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanRepository captures git status, existing instructions, and local skills", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-claude-like-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
    await writeFile(join(dir, "README.md"), "# Renovacion\n\nSelf-contained Pi skill.\n");
    await writeFile(join(dir, "AGENTS.md"), "# Agent Rules\n\nUse the local skill and ask one question at a time.\n");
    await mkdir(join(dir, ".pi", "skills", "climatizacion"), { recursive: true });
    await writeFile(join(dir, ".pi", "skills", "climatizacion", "SKILL.md"), "---\nname: climatizacion\ndescription: Use for HVAC loads.\n---\n\n# climatizacion\n\nWorkflow details.\n");
    await writeFile(join(dir, ".pi", "skills", "climatizacion", "pyproject.toml"), "[project]\nname = \"cli-aa\"\n");
    await writeFile(join(dir, "dirty.txt"), "changed\n");

    const scan = await scanRepository(dir);
    assert.equal(scan.git.isRepo, true);
    assert(scan.git.status.some((line) => line.includes("AGENTS.md")));
    assert(scan.instructionFiles.includes("AGENTS.md"));
    assert(scan.keyFiles.some((file) => file.path === "README.md" && file.excerpt.includes("Self-contained Pi skill")));
    assert(scan.keyFiles.some((file) => file.path === "AGENTS.md" && file.excerpt.includes("ask one question")));
    assert.deepEqual(scan.localSkills.map((skill) => skill.name), ["climatizacion"]);
    assert.equal(scan.localSkills[0].description, "Use for HVAC loads.");
    assert(scan.localSkills[0].files.includes(".pi/skills/climatizacion/pyproject.toml"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanRepository detects child git projects when current directory is not a git repo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-parent-"));
  try {
    await mkdir(join(dir, "cli_aa", ".git"), { recursive: true });
    await mkdir(join(dir, "renovacion", ".git"), { recursive: true });
    await writeFile(join(dir, "cli_aa", "AGENTS.md"), "# AGENTS\n\nClimatizacion workflow.\n");
    await writeFile(join(dir, "renovacion", "README.md"), "# Renovacion\n");

    const scan = await scanRepository(dir);
    assert.equal(scan.git.isRepo, false);
    assert.deepEqual(scan.nestedProjects.map((project) => project.path), ["cli_aa", "renovacion"]);
    assert.deepEqual(scan.nestedProjects[0].importantFiles, ["AGENTS.md"]);
    assert.deepEqual(scan.nestedProjects[1].importantFiles, ["README.md"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
