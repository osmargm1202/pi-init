import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package ships orgm init command", () => {
  assert.equal(pkg.name, "pi-init");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/init.ts"]);
  assert.ok(pkg.peerDependencies["@earendil-works/pi-coding-agent"]);
  assert.ok(existsSync("extensions/init.ts"));
  const source = readFileSync("extensions/init.ts", "utf8");
  assert.match(source, /registerCommand\("orgm-init"/);
  assert.doesNotMatch(source, /registerCommand\("(?!orgm-)/);
});
