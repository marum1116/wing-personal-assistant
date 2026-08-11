interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  message?: {
    type: string;
    text?: string;
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

async function replyTextMessage(replyToken: string, text: string, accessToken: string): Promise<void> {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });

  if (!response.ok) {
    console.error("LINE reply API request failed", { status: response.status });
  }
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
    if (event.type !== "message") {
      continue;
    }
    if (!event.replyToken) {
      continue;
    }
    if (!event.message || event.message.type !== "text" || typeof event.message.text !== "string") {
      continue;
    }

    tasks.push(
      replyTextMessage(
        event.replyToken,
        `受け取りました：${event.message.text}`,
        env.LINE_CHANNEL_ACCESS_TOKEN
      )
    );
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
