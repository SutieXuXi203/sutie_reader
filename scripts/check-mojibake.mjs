import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_ROOT = path.join(ROOT, "src");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md"]);
const BAD_PATTERNS = [/Ã/u, /Â/u, /Æ/u, /Ä/u, /á»/u, /â€™/u, /â€œ/u, /â€/u, /\uFFFD/u];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function hasMojibake(line) {
  return BAD_PATTERNS.some((pattern) => pattern.test(line));
}

const files = walk(SCAN_ROOT);
const issues = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (hasMojibake(line)) {
      issues.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        snippet: line.trim().slice(0, 160),
      });
    }
  });
}

if (issues.length > 0) {
  console.error("Found potential mojibake in source files:");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} ${issue.snippet}`);
  }
  process.exit(1);
}

console.log("Mojibake check passed.");
