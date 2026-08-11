interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  STATE: KVNamespace;
}

type SourceId = "wing" | "parents_r8" | "first_grade" | "tange";

const SOURCE_OPTIONS: Array<{ id: SourceId; label: string; data: string }> = [
  { id: "wing", label: "羽魂練習会", data: "source=wing" },
  { id: "parents_r8", label: "R8年度保護者会", data: "source=parents_r8" },
  { id: "first_grade", label: "1年生ウィング保護者会", data: "source=first_grade" },
  { id: "tange", label: "丹下さん", data: "source=tange" }
];

const MENU_TRIGGERS = new Set(["情報源", "メニュー", "開始"]);

type LineReplyMessage = {
  type: "text";
  text: string;
  quickReply?: {
    items: Array<{
      type: "action";
      action: {
        type: "postback";
        label: string;
        data: string;
        displayText: string;
      };
    }>;
  };
};

type LineWebhookEvent = {
  type: "message" | "postback" | string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type: string;
    text?: string;
  };
  postback?: {
    data?: string;
  };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyLineSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = toBase64(mac);
  return constantTimeEqual(computed, signature);
}

function sourceIdToLabel(sourceId: SourceId): string {
  const source = SOURCE_OPTIONS.find((option) => option.id === sourceId);
  return source ? source.label : "";
}

function parseSourceIdFromPostback(data: string): SourceId | null {
  const source = SOURCE_OPTIONS.find((option) => option.data === data);
  return source ? source.id : null;
}

function isSourceId(value: string): value is SourceId {
  return SOURCE_OPTIONS.some((option) => option.id === value);
}

function buildSourceQuickReply(text: string): LineReplyMessage {
  return {
    type: "text",
    text,
    quickReply: {
      items: SOURCE_OPTIONS.map((option) => ({
        type: "action",
        action: {
          type: "postback",
          label: option.label,
          data: option.data,
          displayText: option.label
        }
      }))
    }
  };
}

function selectedSourceKey(userId: string): string {
  return `selected_source:${userId}`;
}

async function replyMessages(
  replyToken: string,
  messages: LineReplyMessage[],
  accessToken: string
): Promise<void> {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });

  if (!response.ok) {
    console.error("LINE reply API request failed", { status: response.status });
  }
}

async function handlePostbackEvent(event: LineWebhookEvent, env: Env): Promise<void> {
  if (!event.replyToken) {
    return;
  }

  const postbackData = event.postback?.data ?? "";
  const sourceId = parseSourceIdFromPostback(postbackData);
  if (!sourceId) {
    await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("先に情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  const userId = event.source?.userId;
  if (!userId) {
    await replyMessages(
      event.replyToken,
      [{ type: "text", text: "先に情報源を選んでください。" }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  await env.STATE.put(selectedSourceKey(userId), sourceId);
  const sourceLabel = sourceIdToLabel(sourceId);
  await replyMessages(
    event.replyToken,
    [{ type: "text", text: `${sourceLabel}として受け付けます。\n記録したいメッセージを送ってください。` }],
    env.LINE_CHANNEL_ACCESS_TOKEN
  );
}

async function handleTextMessageEvent(event: LineWebhookEvent, env: Env): Promise<void> {
  if (!event.replyToken) {
    return;
  }
  if (!event.message || event.message.type !== "text" || typeof event.message.text !== "string") {
    return;
  }

  const inputText = event.message.text;
  if (MENU_TRIGGERS.has(inputText)) {
    await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  const userId = event.source?.userId;
  if (!userId) {
    await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("先に情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  const selectedSourceId = await env.STATE.get(selectedSourceKey(userId));
  if (!selectedSourceId || !isSourceId(selectedSourceId)) {
    await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("先に情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  const sourceLabel = sourceIdToLabel(selectedSourceId);
  await replyMessages(
    event.replyToken,
    [{ type: "text", text: `情報源：${sourceLabel}\n\n受け取りました：\n${inputText}` }],
    env.LINE_CHANNEL_ACCESS_TOKEN
  );
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get("x-line-signature");
  if (!signature) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rawBody = await request.text();
  const isValid = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const events = body.events ?? [];
  if (events.length === 0) {
    return new Response("OK", { status: 200 });
  }

  const tasks: Promise<void>[] = [];
  for (const event of events) {
    if (event.type === "postback") {
      tasks.push(handlePostbackEvent(event, env));
      continue;
    }
    if (event.type === "message") {
      tasks.push(handleTextMessageEvent(event, env));
    }
  }

  await Promise.all(tasks);
  return new Response("OK", { status: 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("wing-personal-assistant is running", {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" }
      });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      return handleWebhook(request, env);
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  }
};
