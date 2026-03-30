import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const electronMainPath = path.join(__dirname, "..", "electron", "main.cjs");

test("Electron main disables renderer sandbox so preload can read runtime config", async () => {
  const source = await readFile(electronMainPath, "utf8");
  assert.match(source, /sandbox:\s*false/);
});
