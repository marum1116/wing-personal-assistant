interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  OPENAI_API_KEY: string;
  STATE: KVNamespace;
  PAIRING: DurableObjectNamespace;
}

type SourceId = "wing" | "parents_r8" | "first_grade" | "tange";

const SOURCE_OPTIONS: Array<{ id: SourceId; label: string; data: string }> = [
  { id: "wing", label: "羽魂練習会", data: "source=wing" },
  { id: "parents_r8", label: "R8年度保護者会", data: "source=parents_r8" },
  { id: "first_grade", label: "1年生ウィング保護者会", data: "source=first_grade" },
  { id: "tange", label: "丹下さん", data: "source=tange" }
];

const MENU_TRIGGERS = new Set(["情報源", "メニュー", "開始"]);
const OPENAI_MODEL = "gpt-5.6-luna";
const PAIR_WINDOW_MS = 5000;
const PAIR_WAIT_MS = 1200;

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
  timestamp?: number;
  source?: {
    type?: string;
    userId?: string;
  };
  message?: {
    type: string;
    id?: string;
    text?: string;
  };
  postback?: {
    data?: string;
  };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

type Attendance = "参加" | "不参加" | "不明";
type TransportType = "車" | "バス" | "自力" | "個別" | "不明";
type PaymentType = "参加費" | "車同乗代" | "バス引率代" | "見守り代" | "志村さん車代" | "その他";

type ParsedTransport = {
  type: TransportType;
  person: string | null;
};

type ParsedPayment = {
  type: PaymentType;
  amount: number | null;
  payee: string | null;
  due_date: string | null;
};

type StructuredLineResult = {
  practice_date: string | null;
  attendance: Attendance;
  outbound_transport: ParsedTransport;
  return_transport: ParsedTransport;
  bus_guide: string | null;
  payments: ParsedPayment[];
  notes: string | null;
  needs_confirmation: boolean;
  uncertain_points: string[];
};

type PairingCandidate = {
  messageId: string;
  timestamp: number;
};

const STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    practice_date: { type: ["string", "null"] },
    attendance: { type: "string", enum: ["参加", "不参加", "不明"] },
    outbound_transport: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["車", "バス", "自力", "個別", "不明"] },
        person: { type: ["string", "null"] }
      },
      required: ["type", "person"]
    },
    return_transport: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["車", "バス", "自力", "個別", "不明"] },
        person: { type: ["string", "null"] }
      },
      required: ["type", "person"]
    },
    bus_guide: { type: ["string", "null"] },
    payments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["参加費", "車同乗代", "バス引率代", "見守り代", "志村さん車代", "その他"] },
          amount: { type: ["number", "null"] },
          payee: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] }
        },
        required: ["type", "amount", "payee", "due_date"]
      }
    },
    notes: { type: ["string", "null"] },
    needs_confirmation: { type: "boolean" },
    uncertain_points: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "practice_date",
    "attendance",
    "outbound_transport",
    "return_transport",
    "bus_guide",
    "payments",
    "notes",
    "needs_confirmation",
    "uncertain_points"
  ]
} as const;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveImageCandidateToPairing(
  env: Env,
  userId: string,
  candidate: PairingCandidate
): Promise<void> {
  const stub = env.PAIRING.getByName(userId);
  await stub.fetch("https://pairing/save-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(candidate)
  });
}

async function takeNearestImageCandidateFromPairing(
  env: Env,
  userId: string,
  textTimestamp: number
): Promise<PairingCandidate | null> {
  const stub = env.PAIRING.getByName(userId);
  const response = await stub.fetch("https://pairing/take-nearest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      timestamp: textTimestamp,
      maxDiffMs: PAIR_WINDOW_MS
    })
  });
  if (!response.ok) {
    return null;
  }
  const result = (await response.json()) as { found: boolean; messageId?: string; timestamp?: number };
  if (!result.found || typeof result.messageId !== "string" || typeof result.timestamp !== "number") {
    return null;
  }
  return { messageId: result.messageId, timestamp: result.timestamp };
}

async function fetchLineImageDataUrl(messageId: string, env: Env): Promise<string | null> {
  console.log({ stage: "line_image_fetch_start" });
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    console.error("LINE image fetch failed", { status: response.status });
    return null;
  }
  if (!contentType.startsWith("image/")) {
    console.error("LINE image content type invalid", { contentType });
    return null;
  }

  const imageBuffer = await response.arrayBuffer();
  const base64 = toBase64(imageBuffer);
  console.log({ stage: "line_image_fetch_success", status: response.status, contentType });
  return `data:${contentType};base64,${base64}`;
}

function extractResponseText(apiResponse: unknown): string | null {
  if (typeof apiResponse !== "object" || apiResponse === null) {
    return null;
  }
  const record = apiResponse as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  const output = record.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const c of content) {
      if (typeof c !== "object" || c === null) {
        continue;
      }
      const text = (c as Record<string, unknown>).text;
      if (typeof text === "string" && text.length > 0) {
        return text;
      }
    }
  }
  return null;
}

function transportToLineLabel(transport: ParsedTransport): string {
  if (transport.type === "不明") {
    return "不明";
  }
  if (transport.person) {
    if (transport.type === "車") {
      return `${transport.person}の車`;
    }
    return `${transport.type}（${transport.person}）`;
  }
  return transport.type;
}

function formatPaymentLine(payment: ParsedPayment): string {
  const details: string[] = [];
  if (typeof payment.amount === "number") {
    details.push(`${payment.amount}円`);
  }
  if (payment.payee) {
    details.push(`支払先：${payment.payee}`);
  }
  if (payment.due_date) {
    details.push(`期限：${payment.due_date}`);
  }
  if (details.length === 0) {
    return `・${payment.type}`;
  }
  return `・${payment.type}（${details.join("、")}）`;
}

function formatStructuredResultForLine(sourceLabel: string, result: StructuredLineResult): string {
  const lines: string[] = [];

  lines.push("読み取り結果", "", `情報源：${sourceLabel}`);
  if (result.practice_date) {
    lines.push(`対象日：${result.practice_date}`);
  }
  lines.push(`参加：${result.attendance}`);
  lines.push(`行き：${transportToLineLabel(result.outbound_transport)}`);
  lines.push(`帰り：${transportToLineLabel(result.return_transport)}`);
  if (result.bus_guide) {
    lines.push(`バス引率：${result.bus_guide}`);
  }
  lines.push("");

  if (result.payments.length === 0) {
    lines.push("支払い：なし");
  } else {
    lines.push("支払い：");
    for (const payment of result.payments) {
      lines.push(formatPaymentLine(payment));
    }
  }

  if (result.notes) {
    lines.push("", "補足：", result.notes);
  }

  if (result.needs_confirmation || result.uncertain_points.length > 0) {
    lines.push("", "確認が必要：");
    if (result.uncertain_points.length === 0) {
      lines.push("・本文から確定できない項目があります。");
    } else {
      for (const point of result.uncertain_points) {
        lines.push(`・${point}`);
      }
    }
  }

  return lines.join("\n");
}

async function callOpenAIForStructuredResult(
  inputText: string,
  sourceLabel: string,
  receivedAtIso: string,
  imageDataUrl: string | null,
  env: Env
): Promise<StructuredLineResult> {
  console.log({ stage: "openai_request_start" });
  if (imageDataUrl) {
    console.log({ stage: "openai_multimodal_request_start" });
  }

  const nowIso = new Date().toISOString();
  const systemPrompt =
    "あなたはLINE本文の情報抽出器です。必ずJSON Schemaに従って厳密なJSONのみを返してください。" +
    "本文に書かれていない内容は推測しないでください。不明はnullまたは不明を使ってください。" +
    "一般ルールで金額を補完しないでください。相対日付は合理的に確定できる場合のみYYYY-MM-DDへ変換し、" +
    "不確定ならdue_dateをnullにしてuncertain_pointsへ理由を入れてください。" +
    "同一本文の複数支払いはすべてpaymentsへ含めてください。" +
    "渡辺塁/塁/塁くん/ルイくんは同一人物です。無関係情報しかない場合はneeds_confirmation=trueにしてください。" +
    "変更・訂正を示す文言がある場合はnotesまたはuncertain_pointsで変更情報だと分かるようにしてください。" +
    "『〜の場合』『必要になった場合』『〜なら』『利用する人は〜』などの条件付き・一般案内は、" +
    "渡辺塁本人の確定情報として扱わないでください。" +
    "attendance/outbound_transport/return_transportは、渡辺塁本人について明示または文脈上の確定情報がある場合のみ設定し、" +
    "判断できなければ必ず不明にしてください。" +
    "バス引率者の案内のみを根拠にreturn_transport.typeをバスに確定しないでください。" +
    "配車表などで『○○号』は『○○さんの車』として扱い、渡辺塁本人の割当が『渡辺→丹下号』のように明示される場合は" +
    "return_transport.type='車'、return_transport.person='丹下さん'のようにpersonまで必ず設定してください。" +
    "同様に山田号→山田さん、佐藤号→佐藤さんのように扱ってください。" +
    "本人の帰りが車などでバスを使わないことが確定している場合、条件付きの一般案内を根拠にbus_guideを設定せず、bus_guideはnullにしてください。" +
    "そのような全体向け条件情報は必要ならnotesへ記載し、本人に適用されない条件付き支払い・引率に関する不明点をuncertain_pointsへ追加しないでください。";

  const userPrompt = JSON.stringify(
    {
      source_name: sourceLabel,
      current_datetime: nowIso,
      message_received_datetime: receivedAtIso,
      text: inputText
    },
    null,
    2
  );

  const userContent: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> = [
    { type: "input_text", text: userPrompt }
  ];
  if (imageDataUrl) {
    userContent.push({
      type: "input_image",
      image_url: imageDataUrl
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "none" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: userContent
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "line_structured_result",
          strict: true,
          schema: STRUCTURED_OUTPUT_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    let errorType = "unknown";
    try {
      const errorJson = (await response.json()) as { error?: { type?: string } };
      errorType = errorJson.error?.type ?? errorType;
    } catch {
      errorType = "unknown";
    }
    console.error("OpenAI Responses API failed", { status: response.status, errorType });
    throw new Error("openai_api_error");
  }

  console.log({ stage: "openai_request_success", status: response.status });

  const apiResponse = (await response.json()) as unknown;
  const outputText = extractResponseText(apiResponse);
  if (!outputText) {
    console.error("OpenAI structured output missing");
    throw new Error("openai_output_missing");
  }

  try {
    const parsed = JSON.parse(outputText) as StructuredLineResult;
    console.log({ stage: "openai_output_parsed" });
    return parsed;
  } catch {
    console.error("OpenAI structured output parse failed");
    throw new Error("openai_output_parse_error");
  }
}

async function replyMessages(
  replyToken: string,
  messages: LineReplyMessage[],
  accessToken: string
): Promise<number | undefined> {
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
    return undefined;
  }

  return response.status;
}

async function handlePostbackEvent(event: LineWebhookEvent, env: Env): Promise<void> {
  if (!event.replyToken) {
    return;
  }

  const postbackData = event.postback?.data ?? "";
  const sourceId = parseSourceIdFromPostback(postbackData);
  if (!sourceId) {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("先に情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  const userId = event.source?.userId;
  if (!userId) {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: "先に情報源を選んでください。" }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  await env.STATE.put(selectedSourceKey(userId), sourceId);
  const sourceLabel = sourceIdToLabel(sourceId);
  console.log({ stage: "line_reply_start" });
  const lineStatus = await replyMessages(
    event.replyToken,
    [{ type: "text", text: `${sourceLabel}として受け付けます。\n記録したいメッセージを送ってください。` }],
    env.LINE_CHANNEL_ACCESS_TOKEN
  );
  if (typeof lineStatus === "number") {
    console.log({ stage: "line_reply_success", status: lineStatus });
    console.log({ stage: "background_processing_complete" });
  }
}

async function handleTextMessageEvent(event: LineWebhookEvent, env: Env): Promise<void> {
  if (!event.replyToken) {
    return;
  }
  if (!event.message || event.message.type !== "text" || typeof event.message.text !== "string") {
    return;
  }

  console.log({ stage: "text_received" });

  const inputText = event.message.text;
  if (MENU_TRIGGERS.has(inputText)) {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
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

  await sleep(PAIR_WAIT_MS);
  console.log({ stage: "pair_lookup_start" });
  let imageDataUrl: string | null = null;
  const textTimestamp = event.timestamp ?? Date.now();
  const pairedImage = await takeNearestImageCandidateFromPairing(env, userId, textTimestamp);
  if (pairedImage) {
    console.log({ stage: "paired_image_found" });
    try {
      imageDataUrl = await fetchLineImageDataUrl(pairedImage.messageId, env);
    } catch {
      imageDataUrl = null;
    }
  } else {
    console.log({ stage: "paired_image_not_found" });
  }

  const selectedSourceId = await env.STATE.get(selectedSourceKey(userId));
  console.log({
    stage: "source_loaded",
    hasSelectedSource: typeof selectedSourceId === "string" && selectedSourceId.length > 0
  });

  if (!selectedSourceId || !isSourceId(selectedSourceId)) {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [buildSourceQuickReply("先に情報源を選んでください。")],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  const sourceLabel = sourceIdToLabel(selectedSourceId);
  try {
    const receivedAtIso = new Date(event.timestamp ?? Date.now()).toISOString();
    const structured = await callOpenAIForStructuredResult(
      inputText,
      sourceLabel,
      receivedAtIso,
      imageDataUrl,
      env
    );
    const formatted = formatStructuredResultForLine(sourceLabel, structured);
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: formatted }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  } catch {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: "解析できませんでした。もう一度送ってください。" }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

}

async function handleImageMessageEvent(event: LineWebhookEvent, env: Env): Promise<void> {
  console.log({ stage: "pair_image_received" });
  const userId = event.source?.userId;
  const messageId = event.message?.id;
  const timestamp = event.timestamp;
  if (!userId || !messageId || typeof timestamp !== "number") {
    return;
  }

  await saveImageCandidateToPairing(env, userId, {
    messageId,
    timestamp
  });
  console.log({ stage: "pair_image_saved" });
}

async function processEventInBackground(event: LineWebhookEvent, env: Env): Promise<void> {
  console.log({ stage: "background_processing_start" });
  if (event.type === "postback") {
    await handlePostbackEvent(event, env);
    return;
  }
  if (event.type === "message") {
    if (event.message?.type === "image") {
      await handleImageMessageEvent(event, env);
      return;
    }
    await handleTextMessageEvent(event, env);
  }
}

async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

  for (const event of events) {
    console.log({
      eventType: event.type,
      messageType: event.message?.type,
      sourceType: event.source?.type,
      hasUserId: typeof event.source?.userId === "string" && event.source.userId.length > 0,
      hasMessageId: typeof event.message?.id === "string" && event.message.id.length > 0
    });

    if (event.type === "postback" || event.type === "message") {
      ctx.waitUntil(
        processEventInBackground(event, env).catch((error) => {
          const errorType = error instanceof Error ? error.name : "unknown";
          console.error("Background event processing failed", { eventType: event.type, errorType });
        })
      );
      console.log({ stage: "webhook_ack_scheduled" });
    }
  }

  return new Response("OK", { status: 200 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("wing-personal-assistant is running", {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" }
      });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      return handleWebhook(request, env, ctx);
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  }
};

export class PairingSession implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.pathname === "/save-image") {
      const payload = (await request.json()) as PairingCandidate;
      if (typeof payload.messageId !== "string" || typeof payload.timestamp !== "number") {
        return new Response("Bad Request", { status: 400 });
      }
      await this.state.storage.put("latest_image", payload);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/take-nearest") {
      const payload = (await request.json()) as { timestamp?: number; maxDiffMs?: number };
      if (typeof payload.timestamp !== "number" || typeof payload.maxDiffMs !== "number") {
        return new Response("Bad Request", { status: 400 });
      }

      const latest = await this.state.storage.get<PairingCandidate>("latest_image");
      if (!latest) {
        return Response.json({ found: false });
      }

      const diff = Math.abs(latest.timestamp - payload.timestamp);
      if (diff <= payload.maxDiffMs) {
        await this.state.storage.delete("latest_image");
        return Response.json({
          found: true,
          messageId: latest.messageId,
          timestamp: latest.timestamp
        });
      }

      if (latest.timestamp <= payload.timestamp || diff > payload.maxDiffMs) {
        await this.state.storage.delete("latest_image");
      }
      return Response.json({ found: false });
    }

    return new Response("Not Found", { status: 404 });
  }
}
