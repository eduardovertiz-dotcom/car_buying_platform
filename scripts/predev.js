#!/usr/bin/env node
/**
 * Pre-dev environment guard.
 * Runs before `next dev` via the "dev" npm script.
 * Hard-exits if the server would run from the wrong directory.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const cwd = process.cwd();
const RESET = "\x1b[0m";
const RED = "\x1b[41m\x1b[97m\x1b[1m";
const YELLOW = "\x1b[43m\x1b[30m\x1b[1m";
const GREEN = "\x1b[42m\x1b[30m\x1b[1m";
const CYAN = "\x1b[36m\x1b[1m";

function box(color, lines) {
  const width = Math.max(...lines.map((l) => l.length)) + 4;
  const bar = "─".repeat(width);
  console.log(`${color}┌${bar}┐${RESET}`);
  for (const l of lines) {
    const pad = " ".repeat(width - l.length - 2);
    console.log(`${color}│  ${l}${pad}  │${RESET}`);
  }
  console.log(`${color}└${bar}┘${RESET}`);
}

// ── Guard 1: block if running from inside a worktree ──────────────────────────
if (cwd.includes("/.claude/worktrees/")) {
  box(RED, [
    "ENVIRONMENT MISMATCH — HARD BLOCK",
    "",
    "You are starting the dev server from a Claude worktree:",
    cwd,
    "",
    "The dev server MUST run from the project root.",
    "cd to the project root and run `npm run dev` there.",
    "",
    "Fix: cd /Users/evertiz/Desktop/car_buying_platform",
  ]);
  process.exit(1);
}

// ── Guard 2: warn if any worktrees have uncommitted changes ───────────────────
let worktreeWarning = false;
try {
  const wtList = execSync("git worktree list --porcelain", { cwd, encoding: "utf8" });
  const wtPaths = wtList
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.replace("worktree ", "").trim())
    .filter((p) => p !== cwd && p.includes("/.claude/worktrees/"));

  for (const wtPath of wtPaths) {
    if (!fs.existsSync(wtPath)) continue;
    const status = execSync("git status --porcelain", {
      cwd: wtPath,
      encoding: "utf8",
    }).trim();
    if (status.length > 0) {
      worktreeWarning = true;
      const lines = status.split("\n").slice(0, 8);
      box(YELLOW, [
        "WARNING: WORKTREE HAS UNCOMMITTED CHANGES",
        "",
        `Worktree: ${wtPath}`,
        "",
        "These changes are NOT in the running server:",
        ...lines,
        ...(status.split("\n").length > 8 ? [`...and ${status.split("\n").length - 8} more`] : []),
        "",
        "If these are fixes you want to test, apply them to main first.",
        "Workflow: copy files → main, then restart this server.",
      ]);
    }
  }
} catch {
  // git not available or no worktrees — skip
}

// ── Guard 3: canary file check ────────────────────────────────────────────────
// lib/guards.ts only exists after the session-1 fixes were applied.
// If it's missing, the codebase is on the pre-fix baseline.
const CANARY = path.join(cwd, "lib/guards.ts");
if (!fs.existsSync(CANARY)) {
  box(RED, [
    "CODE MISMATCH — YOU ARE NOT RUNNING THE CURRENT IMPLEMENTATION",
    "",
    "lib/guards.ts is missing from this directory.",
    "This means the session fixes have NOT been applied here.",
    "",
    "Run: npm run apply-worktree   (or copy files manually from worktree)",
    "Then restart: npm run dev",
  ]);
  process.exit(1);
}

// ── All clear ─────────────────────────────────────────────────────────────────
if (!worktreeWarning) {
  box(GREEN, [
    "ENVIRONMENT OK",
    `Running from: ${cwd}`,
    "lib/guards.ts: PRESENT",
    "No uncommitted worktree changes detected.",
  ]);
} else {
  console.log(
    `${CYAN}⚠  Starting dev server anyway — see warnings above.${RESET}`
  );
}

console.log(`\n${CYAN}CWD: ${cwd}${RESET}\n`);
