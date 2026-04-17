#!/usr/bin/env node
/**
 * Syncs all modified/untracked files from the active worktree into main.
 * Run from the PROJECT ROOT: node scripts/apply-worktree.js <worktree-path>
 *
 * Usage:
 *   node scripts/apply-worktree.js .claude/worktrees/zealous-cerf-3718a5
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RED = "\x1b[41m\x1b[97m\x1b[1m";
const GREEN = "\x1b[42m\x1b[30m\x1b[1m";
const CYAN = "\x1b[36m\x1b[1m";
const RESET = "\x1b[0m";

const cwd = process.cwd();

if (cwd.includes("/.claude/worktrees/")) {
  console.error(`${RED} Run this from the project root, not from inside the worktree. ${RESET}`);
  process.exit(1);
}

const wtRelPath = process.argv[2];
if (!wtRelPath) {
  console.error(`${RED} Usage: node scripts/apply-worktree.js <relative-worktree-path> ${RESET}`);
  process.exit(1);
}

const wtPath = path.resolve(cwd, wtRelPath);
if (!fs.existsSync(wtPath)) {
  console.error(`${RED} Worktree not found: ${wtPath} ${RESET}`);
  process.exit(1);
}

// Get list of changed + untracked files in the worktree
const statusOutput = execSync("git status --porcelain", {
  cwd: wtPath,
  encoding: "utf8",
}).trim();

if (!statusOutput) {
  console.log(`${GREEN} No changes in worktree — nothing to apply. ${RESET}`);
  process.exit(0);
}

const files = statusOutput
  .split("\n")
  .map((line) => {
    // porcelain format: "XY filename" — XY is exactly 2 chars + 1 space
    // For renames: "XY old -> new" — take the last token after " -> "
    const raw = line.slice(3).trim();
    return raw.includes(" -> ") ? raw.split(" -> ").pop() : raw;
  })
  .filter((f) => f && !f.startsWith(".claude")); // never copy worktree metadata

console.log(`\n${CYAN}Applying ${files.length} file(s) from worktree to main:${RESET}`);

let copied = 0;
let failed = 0;

for (const file of files) {
  const src = path.join(wtPath, file);
  const dest = path.join(cwd, file);

  if (!fs.existsSync(src)) {
    console.log(`  SKIP (deleted in worktree): ${file}`);
    continue;
  }

  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`  ${GREEN}COPIED${RESET}: ${file}`);
    copied++;
  } catch (err) {
    console.log(`  ${RED}FAILED${RESET}: ${file} — ${err.message}`);
    failed++;
  }
}

console.log(`\n${copied} copied, ${failed} failed.\n`);

if (failed > 0) {
  console.log(`${RED} Some files failed to copy. Restart the dev server manually. ${RESET}`);
  process.exit(1);
}

console.log(`${GREEN} Done. Restart the dev server to pick up changes. ${RESET}`);
console.log(`${CYAN} npm run dev ${RESET}\n`);
