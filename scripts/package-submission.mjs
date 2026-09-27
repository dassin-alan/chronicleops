import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const submissionId = "opencode-gpt56-terra-chronicleops";
const rootName = `chronicleops-${submissionId}`;
const delivery = "_delivery";
const staging = "_package-staging";
const packageRoot = join(staging, rootName);
const zip = join(delivery, `${rootName}.zip`);
const excluded = new Set(["node_modules", "dist", ".git", "test-results", "playwright-report", "_delivery", "_package-staging"]);

rmSync(staging, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(packageRoot, { recursive: true });
for (const entry of readdirSync(".", { withFileTypes: true })) if (!excluded.has(entry.name)) cpSync(entry.name, join(packageRoot, entry.name), { recursive: entry.isDirectory() });

const files = [];
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path); else if (entry.name !== "SHA256SUMS.txt") files.push(path);
  }
};
walk(packageRoot);
writeFileSync(join(packageRoot, "SHA256SUMS.txt"), files.map(path => `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${path.slice(packageRoot.length + 1).replaceAll("\\", "/")}`).join("\n") + "\n");
mkdirSync(delivery, { recursive: true });
execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${packageRoot}' -DestinationPath '${zip}' -Force`], { stdio: "inherit" });
const hash = createHash("sha256").update(readFileSync(zip)).digest("hex");
writeFileSync(`${zip}.sha256.txt`, `${hash}  ${zip.replaceAll("\\", "/")}\n`);
rmSync(staging, { recursive: true, force: true });
console.log(`${zip} ${hash}`);
