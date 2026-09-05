/**
 * One-time LINE rich menu setup for 羽魂メモ.
 *
 * Does NOT run on Worker deploy. Invoke manually:
 *   npx.cmd tsx scripts/setup-rich-menu.ts
 *
 * Token resolution order:
 * 1. env LINE_CHANNEL_ACCESS_TOKEN
 * 2. .dev.vars LINE_CHANNEL_ACCESS_TOKEN=...
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXCEL_URL =
  process.env.EXCEL_URL ??
  "https://1drv.ms/x/c/9bd7af7f5c25ad41/IQAoLXgc3XNZRIWLZqFtLG1wAWcDwuWjaLfUjLdPrZ1h2zc?e=sfvpfA";

const IMAGE_PATH = resolve(process.cwd(), "assets/rich-menu-wing.png");
const WIDTH = 2500;
const HEIGHT = 1686;
const COL = Math.floor(WIDTH / 3);
const ROW = Math.floor(HEIGHT / 2);

type Area = {
  bounds: { x: number; y: number; width: number; height: number };
  action:
    | { type: "uri"; label: string; uri: string }
    | { type: "message"; label: string; text: string };
};

function cell(col: number, row: number): { x: number; y: number; width: number; height: number } {
  const x = col * COL;
  const y = row * ROW;
  const width = col === 2 ? WIDTH - x : COL;
  const height = row === 1 ? HEIGHT - y : ROW;
  return { x, y, width, height };
}

const AREAS: Area[] = [
  {
    bounds: cell(0, 0),
    action: { type: "uri", label: "Excel", uri: EXCEL_URL }
  },
  {
    bounds: cell(1, 0),
    action: { type: "message", label: "通常調整さん", text: "通常調整さん" }
  },
  {
    bounds: cell(2, 0),
    action: { type: "message", label: "個人調整さん", text: "個人調整さん" }
  },
  {
    bounds: cell(0, 1),
    action: { type: "message", label: "引率チェック", text: "引率チェック" }
  },
  {
    bounds: cell(1, 1),
    action: { type: "message", label: "未払い", text: "未払い" }
  },
  {
    bounds: cell(2, 1),
    action: { type: "message", label: "塁に連絡", text: "塁に連絡" }
  }
];

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
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key !== "LINE_CHANNEL_ACCESS_TOKEN") {
      continue;
    }
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

async function lineFetch(path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`https://api.line.me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
}

async function main(): Promise<void> {
  const token = loadAccessToken();
  if (!token) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN not found. Set env or add it to .dev.vars (gitignored)."
    );
  }

  const image = readFileSync(IMAGE_PATH);
  if (image.byteLength === 0) {
    throw new Error(`Rich menu image is empty: ${IMAGE_PATH}`);
  }
  if (image.byteLength >= 1024 * 1024) {
    throw new Error(`Rich menu image must be <1MB (got ${image.byteLength} bytes)`);
  }

  const createBody = {
    size: { width: WIDTH, height: HEIGHT },
    selected: true,
    name: "羽魂メニュー",
    chatBarText: "羽魂メニュー",
    areas: AREAS
  };

  console.log("Creating rich menu...");
  const createRes = await lineFetch(
    "/v2/bot/richmenu",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody)
    },
    token
  );
  const createText = await createRes.text();
  if (!createRes.ok) {
    throw new Error(`create rich menu failed: ${createRes.status} ${createText}`);
  }
  const created = JSON.parse(createText) as { richMenuId: string };
  const richMenuId = created.richMenuId;
  console.log(`Created richMenuId=${richMenuId}`);

  console.log("Uploading image...");
  const uploadRes = await lineFetch(
    `/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: image
    },
    token
  );
  const uploadText = await uploadRes.text();
  if (!uploadRes.ok) {
    throw new Error(`upload image failed: ${uploadRes.status} ${uploadText}`);
  }
  console.log("Image uploaded");

  console.log("Setting as default rich menu...");
  const defaultRes = await lineFetch(`/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST"
  }, token);
  const defaultText = await defaultRes.text();
  if (!defaultRes.ok) {
    throw new Error(`set default failed: ${defaultRes.status} ${defaultText}`);
  }
  console.log("Default rich menu set");
  console.log(JSON.stringify({ ok: true, richMenuId, imageBytes: image.byteLength }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
