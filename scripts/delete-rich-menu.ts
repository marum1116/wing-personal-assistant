/**
 * Delete a rich menu by ID (cleanup helper).
 * Usage: npx.cmd tsx scripts/delete-rich-menu.ts <richMenuId>
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadAccessToken(): string | null {
  const fromEnv = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const devVarsPath = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(devVarsPath)) {
    return null;
  }
  const content = readFileSync(devVarsPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "LINE_CHANNEL_ACCESS_TOKEN") continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.trim() || null;
  }
  return null;
}

async function main(): Promise<void> {
  const richMenuId = process.argv[2]?.trim();
  if (!richMenuId) {
    throw new Error("Usage: npx.cmd tsx scripts/delete-rich-menu.ts <richMenuId>");
  }
  const token = loadAccessToken();
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN not found");
  }
  const res = await fetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`delete failed: ${res.status} ${text}`);
  }
  console.log(JSON.stringify({ ok: true, deleted: richMenuId }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
