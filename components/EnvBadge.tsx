import { existsSync } from "fs";
import path from "path";

// Server component — runs at request time, never ships env details to client bundles.
// Only renders in development. Zero cost in production.
export default function EnvBadge() {
  if (process.env.NODE_ENV !== "development") return null;

  const cwd = process.cwd();
  const isWorktree = cwd.includes("/.claude/worktrees/");
  const hasGuards = existsSync(path.join(cwd, "lib/guards.ts"));
  const label = isWorktree ? "WORKTREE" : "MAIN";
  const shortPath = cwd.replace(/.*\/car_buying_platform/, "…/car_buying_platform");

  const mismatch = isWorktree || !hasGuards;

  const bg = mismatch ? "#dc2626" : "#16a34a";
  const icon = mismatch ? "⚠" : "✓";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: bg,
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 11,
        fontWeight: 700,
        padding: "6px 10px",
        borderRadius: 4,
        lineHeight: 1.5,
        pointerEvents: "none",
        maxWidth: 420,
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}
    >
      <div>
        {icon} DEV ENV: {label}
      </div>
      <div style={{ fontWeight: 400, opacity: 0.85 }}>{shortPath}</div>
      {!hasGuards && (
        <div style={{ marginTop: 4, color: "#fde68a" }}>
          CODE MISMATCH — lib/guards.ts missing
        </div>
      )}
    </div>
  );
}
