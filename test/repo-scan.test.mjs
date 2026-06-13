import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { scanRepository } from "../extensions/lib/repo-scan.ts";

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
