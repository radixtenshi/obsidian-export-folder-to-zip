import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

assert.match(manifest.id, /^[a-z0-9-]+$/, "Plugin ID must use lowercase letters, digits, and hyphens.");
assert.ok(!manifest.id.includes("obsidian"), "Plugin ID must not contain 'obsidian'.");
assert.ok(!/development|dev\b/i.test(manifest.name), "Release manifest must not use a development name.");
assert.equal(packageJson.version, manifest.version, "package.json and manifest.json versions must match.");
assert.equal(lock.version, manifest.version, "package-lock.json root version must match manifest.json.");
assert.equal(lock.packages?.[""]?.version, manifest.version, "package-lock.json package version must match manifest.json.");
assert.equal(versions[manifest.version], manifest.minAppVersion, "versions.json must map the release to its minimum Obsidian version.");
for (const asset of ["main.js", "manifest.json", "styles.css"]) {
  assert.ok(existsSync(asset), `Required Obsidian release asset is missing: ${asset}`);
}

console.log(`Release metadata and assets are valid for ${manifest.id} ${manifest.version}.`);
