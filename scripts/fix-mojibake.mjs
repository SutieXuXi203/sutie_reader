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

function suspiciousCount(text) {
  return BAD_PATTERNS.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
}

function decodeMojibake(text) {
  return Buffer.from(text, "latin1").toString("utf8");
}

const files = walk(SCAN_ROOT);
const fixed = [];
const unresolved = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const before = suspiciousCount(text);
  if (before === 0) continue;

  const candidate = decodeMojibake(text);
  const after = suspiciousCount(candidate);

  if (after < before) {
    fs.writeFileSync(file, candidate, "utf8");
    fixed.push({ file: path.relative(ROOT, file), before, after });
  } else {
    unresolved.push({ file: path.relative(ROOT, file), before, after });
  }
}

if (fixed.length > 0) {
  console.log("Fixed files:");
  for (const item of fixed) {
    console.log(`- ${item.file} (${item.before} -> ${item.after})`);
  }
} else {
  console.log("No files needed automatic mojibake fixing.");
}

if (unresolved.length > 0) {
  console.error("Some files still look suspicious and need manual review:");
  for (const item of unresolved) {
    console.error(`- ${item.file} (${item.before} -> ${item.after})`);
  }
  process.exit(1);
}

