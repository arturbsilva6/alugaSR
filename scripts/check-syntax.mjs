import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function* jsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(path);
    else if (/\.(js|mjs)$/.test(entry.name)) yield path;
  }
}
let checked = 0;
for (const file of [...jsFiles("backend"), ...jsFiles("frontend"), ...jsFiles("tests"), ...jsFiles("scripts")]) {
  const check = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (check.status !== 0) process.exit(1);
  checked++;
}
console.info("Sintaxe validada:", checked, "arquivos");
