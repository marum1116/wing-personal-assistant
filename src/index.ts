interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  OPENAI_API_KEY: string;
  DB: D1Database;
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
const UNPAID_COMMANDS = new Set(["未払い", "未払い一覧", "支払い"]);
const CONTACT_RUI_COMMAND = "塁に連絡";
const OPENAI_MODEL = "gpt-5.6-luna";
const PAIR_WINDOW_MS = 5000;
const PAIR_WAIT_MS = 1200;
const RECENT_CONTEXT_TTL_SECONDS = 30 * 60;
const MAX_UNPAID_DISPLAY_COUNT = 10;
const MAX_REMINDER_DISPLAY_COUNT = 20;
const MAX_REMINDER_QUICK_REPLY_COUNT = 10;

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
type PaymentType =
  | "参加費"
  | "車同乗代"
  | "バス引率代"
  | "見守り代"
  | "志村さん車代"
  | "個人練習代"
  | "個人練習差額"
  | "その他";
type MessageKind =
  | "schedule"
  | "dispatch_candidate"
  | "dispatch_confirmed"
  | "same_day_change"
  | "accounting_notice"
  | "general_rule"
  | "other";
type PracticeType = "通常練習" | "個人練習" | "不明";
type PracticeTypeExtractionBasis = "explicit" | "inferred" | "unknown";
type MonthlyType = "regular_training_total" | "shimura_car_fee";
type PaymentMethod = "PayPay" | "現金" | "楽天Pay" | "その他" | "不明";

type ParsedTransport = {
  type: TransportType;
  person: string | null;
};

type ParsedPayment = {
  type: PaymentType;
  amount: number | null;
  payee: string | null;
  due_date: string | null;
  payment_method: string | null;
};

type MonthlyCharge = {
  billing_month: string;
  monthly_type: MonthlyType;
  amount: number;
  payee: string | null;
  due_date: string | null;
  payment_method: PaymentMethod;
  breakdown_text: string | null;
};

type BillingScope = "event" | "monthly" | "other";
type PaymentDirection = "outbound" | "return" | "none";

type PaymentForStorage = ParsedPayment & {
  billing_scope: BillingScope;
  direction: PaymentDirection;
};

type PaymentStatus = "unpaid" | "paid";

type UnpaidPaymentRow = {
  id: number;
  practice_date: string;
  payment_type: string;
  amount: number | null;
  payee: string | null;
  due_date: string | null;
  payment_method: string | null;
  status: PaymentStatus;
};

type UnifiedUnpaidItem =
  | {
      payment_kind: "event";
      id: number;
      practice_date: string;
      payment_type: string;
      amount: number | null;
      payee: string | null;
      due_date: string | null;
      payment_method: string | null;
      sort_date: string;
    }
  | {
      payment_kind: "monthly";
      id: number;
      billing_month: string;
      monthly_type: MonthlyType;
      amount: number;
      payee: string | null;
      due_date: string | null;
      payment_method: PaymentMethod | null;
      breakdown_text: string | null;
      sort_date: string;
    };

type ReminderPaymentRow = {
  id: number;
  practice_date: string;
  payment_type: string;
  amount: number | null;
  payee: string | null;
  due_date: string | null;
  payment_method: string | null;
  status: PaymentStatus;
  reminder_sent_on: string | null;
};

type StoredPracticeTypeBasis =
  | "explicit"
  | "d1_same_date"
  | "kv_recent_context"
  | "weekday_default"
  | "ai_inferred"
  | "unknown";

type ResolvedContextBasis =
  | "explicit_message"
  | "message_pair"
  | "d1_same_date"
  | "d1_personal_fee_unique"
  | "kv_recent_context"
  | "weekday_default"
  | "ai_inferred"
  | "unknown";

type RecentPracticeContext = {
  practice_date: string;
  practice_type: PracticeType;
  timestamp_ms: number;
};

type PracticeRow = {
  practice_date: string;
  attendance: Attendance;
  outbound_type: TransportType;
  outbound_person: string | null;
  return_type: TransportType;
  return_person: string | null;
  bus_guide: string | null;
  meeting_time: string | null;
  meeting_place: string | null;
  outbound_companions: string | null;
  return_dropoff_place: string | null;
  return_release_place: string | null;
  source: string;
  notes: string | null;
  practice_type: PracticeType | null;
  practice_type_basis: StoredPracticeTypeBasis | null;
  practice_type_priority: number | null;
  attendance_priority: number | null;
  outbound_priority: number | null;
  return_priority: number | null;
  bus_guide_priority: number | null;
  meeting_time_priority: number | null;
  meeting_place_priority: number | null;
  outbound_companions_priority: number | null;
  return_dropoff_place_priority: number | null;
  return_release_place_priority: number | null;
  last_message_kind: MessageKind | null;
};

type RuiContactCommandParseResult = {
  dates: string[];
  labels: string[];
};

type SaveStructuredResultOutcome = {
  practiceSaved: boolean;
  paymentCount: number;
  reviewWarnings: string[];
  savedMonthlyCharges: Array<{
    billing_month: string;
    monthly_type: MonthlyType;
    amount: number;
    payee: string | null;
    due_date: string | null;
    payment_method: PaymentMethod | null;
    breakdown_text: string | null;
  }>;
};

type StructuredLineResult = {
  message_kind: MessageKind;
  practice_type: PracticeType;
  practice_type_basis: PracticeTypeExtractionBasis;
  practice_type_evidence: string | null;
  monthly_charges: MonthlyCharge[];
  practice_date: string | null;
  attendance: Attendance;
  outbound_transport: ParsedTransport;
  return_transport: ParsedTransport;
  bus_guide: string | null;
  meeting_time: string | null;
  meeting_place: string | null;
  outbound_companions: string | null;
  return_dropoff_place: string | null;
  return_release_place: string | null;
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
    message_kind: {
      type: "string",
      enum: [
        "schedule",
        "dispatch_candidate",
        "dispatch_confirmed",
        "same_day_change",
        "accounting_notice",
        "general_rule",
        "other"
      ]
    },
    practice_type: { type: "string", enum: ["通常練習", "個人練習", "不明"] },
    practice_type_basis: { type: "string", enum: ["explicit", "inferred", "unknown"] },
    practice_type_evidence: { type: ["string", "null"] },
    monthly_charges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          billing_month: { type: "string" },
          monthly_type: { type: "string", enum: ["regular_training_total", "shimura_car_fee"] },
          amount: { type: "number" },
          payee: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] },
          payment_method: { type: "string", enum: ["PayPay", "現金", "楽天Pay", "その他", "不明"] },
          breakdown_text: { type: ["string", "null"] }
        },
        required: [
          "billing_month",
          "monthly_type",
          "amount",
          "payee",
          "due_date",
          "payment_method",
          "breakdown_text"
        ]
      }
    },
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
    meeting_time: { type: ["string", "null"] },
    meeting_place: { type: ["string", "null"] },
    outbound_companions: { type: ["string", "null"] },
    return_dropoff_place: { type: ["string", "null"] },
    return_release_place: { type: ["string", "null"] },
    payments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["参加費", "車同乗代", "バス引率代", "見守り代", "志村さん車代", "個人練習代", "個人練習差額", "その他"]
          },
          amount: { type: ["number", "null"] },
          payee: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] },
          payment_method: { type: ["string", "null"] }
        },
        required: ["type", "amount", "payee", "due_date", "payment_method"]
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
    "message_kind",
    "practice_type",
    "practice_type_basis",
    "practice_type_evidence",
    "monthly_charges",
    "practice_date",
    "attendance",
    "outbound_transport",
    "return_transport",
    "bus_guide",
    "meeting_time",
    "meeting_place",
    "outbound_companions",
    "return_dropoff_place",
    "return_release_place",
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

function recentContextKey(userId: string, sourceId: SourceId): string {
  return `recent_context:${userId}:${sourceId}`;
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
  let response: Response;
  try {
    response = await stub.fetch("https://pairing/take-nearest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timestamp: textTimestamp,
        maxDiffMs: PAIR_WINDOW_MS
      })
    });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "unknown";
    const errorMessage = error instanceof Error ? error.message : "unknown";
    console.error("Pairing stub fetch failed", {
      stage: "pair_stub_fetch_error",
      errorType,
      errorMessage
    });
    throw error;
  }
  if (!response.ok) {
    return null;
  }
  let result: { found: boolean; messageId?: string; timestamp?: number };
  try {
    result = (await response.json()) as { found: boolean; messageId?: string; timestamp?: number };
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "unknown";
    const errorMessage = error instanceof Error ? error.message : "unknown";
    console.error("Pairing response parse failed", {
      stage: "pair_response_parse_error",
      errorType,
      errorMessage
    });
    throw error;
  }
  if (!result.found || typeof result.messageId !== "string" || typeof result.timestamp !== "number") {
    return null;
  }
  return { messageId: result.messageId, timestamp: result.timestamp };
}

async function resolvePairedImageDataUrlForTextEvent(
  env: Env,
  userId: string,
  textTimestamp: number,
  deps?: {
    takeNearest?: (
      env: Env,
      userId: string,
      textTimestamp: number
    ) => Promise<PairingCandidate | null>;
    fetchImageDataUrl?: (messageId: string, env: Env) => Promise<string | null>;
  }
): Promise<string | null> {
  const takeNearest = deps?.takeNearest ?? takeNearestImageCandidateFromPairing;
  const fetchImageDataUrl = deps?.fetchImageDataUrl ?? fetchLineImageDataUrl;

  let pairedImage: PairingCandidate | null = null;
  try {
    pairedImage = await takeNearest(env, userId, textTimestamp);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "unknown";
    const errorMessage = error instanceof Error ? error.message : "unknown";
    console.error("Pair lookup failed", { stage: "pair_lookup_error", errorType, errorMessage });
    console.log({ stage: "paired_image_not_found" });
    return null;
  }

  if (!pairedImage) {
    console.log({ stage: "paired_image_not_found" });
    return null;
  }

  console.log({ stage: "paired_image_found" });
  try {
    return await fetchImageDataUrl(pairedImage.messageId, env);
  } catch {
    return null;
  }
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

async function loadRecentPracticeContext(
  env: Env,
  userId: string,
  sourceId: SourceId,
  nowMs: number
): Promise<RecentPracticeContext | null> {
  const raw = await env.STATE.get(recentContextKey(userId, sourceId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as RecentPracticeContext;
    if (
      typeof parsed.practice_date !== "string" ||
      (parsed.practice_type !== "通常練習" && parsed.practice_type !== "個人練習") ||
      typeof parsed.timestamp_ms !== "number"
    ) {
      return null;
    }
    const ageMs = nowMs - parsed.timestamp_ms;
    if (ageMs < 0 || ageMs > RECENT_CONTEXT_TTL_SECONDS * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveRecentPracticeContext(
  env: Env,
  userId: string,
  sourceId: SourceId,
  practiceDate: string,
  practiceType: PracticeType,
  nowMs: number
): Promise<void> {
  if (practiceType === "不明") {
    return;
  }
  const payload: RecentPracticeContext = {
    practice_date: practiceDate,
    practice_type: practiceType,
    timestamp_ms: nowMs
  };
  await env.STATE.put(recentContextKey(userId, sourceId), JSON.stringify(payload), {
    expirationTtl: RECENT_CONTEXT_TTL_SECONDS
  });
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
  if (payment.payment_method) {
    details.push(`支払方法：${payment.payment_method}`);
  }
  if (details.length === 0) {
    return `・${payment.type}`;
  }
  return `・${payment.type}（${details.join("、")}）`;
}

function paymentIdentityKey(payment: Pick<ParsedPayment, "type" | "amount" | "payee">): string {
  const amount = payment.amount === null ? "null" : String(payment.amount);
  const payee = payment.payee ?? "null";
  return `${payment.type}|${amount}|${payee}`;
}

function parseYmdAsUtcDate(ymd: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!matched) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function inferPracticeTypeByWeekday(practiceDate: string | null): PracticeType {
  if (!practiceDate) {
    return "不明";
  }
  const parsed = parseYmdAsUtcDate(practiceDate);
  if (!parsed) {
    return "不明";
  }
  const weekday = parsed.getUTCDay();
  if (weekday === 1 || weekday === 2 || weekday === 4) {
    return "通常練習";
  }
  if (weekday === 5 || weekday === 6 || weekday === 0) {
    return "個人練習";
  }
  return "不明";
}

function resolvePracticeType(result: StructuredLineResult): {
  practiceType: PracticeType;
  basis: StoredPracticeTypeBasis;
  priority: number;
} {
  if (result.practice_type !== "不明" && result.practice_type_basis === "explicit") {
    return {
      practiceType: result.practice_type,
      basis: "explicit",
      priority: 1000
    };
  }
  if (result.practice_type !== "不明" && result.practice_type_basis === "inferred") {
    return {
      practiceType: result.practice_type,
      basis: "ai_inferred",
      priority: 600
    };
  }
  const inferred = inferPracticeTypeByWeekday(result.practice_date);
  if (inferred !== "不明") {
    return {
      practiceType: inferred,
      basis: "weekday_default",
      priority: 700
    };
  }
  if (result.practice_type !== "不明") {
    return {
      practiceType: result.practice_type,
      basis: "ai_inferred",
      priority: 600
    };
  }
  return {
    practiceType: "不明",
    basis: "unknown",
    priority: 0
  };
}

async function resolvePracticeContext(
  env: Env,
  sourceId: SourceId,
  userId: string,
  result: StructuredLineResult,
  nowMs: number
): Promise<{
  resolvedPracticeDate: string | null;
  resolvedPracticeType: PracticeType;
  dateBasis: ResolvedContextBasis;
  typeBasis: ResolvedContextBasis;
  needsConfirmation: boolean;
  addedUncertainPoints: string[];
}> {
  let resolvedPracticeDate: string | null = result.practice_date;
  let dateBasis: ResolvedContextBasis = result.practice_date ? "explicit_message" : "unknown";
  let resolvedPracticeType: PracticeType = "不明";
  let typeBasis: ResolvedContextBasis = "unknown";
  const addedUncertainPoints: string[] = [];
  let needsConfirmation = false;
  const recent = await loadRecentPracticeContext(env, userId, sourceId, nowMs);
  const sourceLabel = sourceIdToLabel(sourceId);
  const personalPracticeFallbackEligible = isDateLessPersonalPracticePaymentMessage(result);

  if (!resolvedPracticeDate) {
    if (recent) {
      resolvedPracticeDate = recent.practice_date;
      dateBasis = "kv_recent_context";
    } else if (personalPracticeFallbackEligible) {
      const reverseLookup = await findUniqueUnpaidPersonalPracticeFeeDate(env.DB, sourceLabel);
      if (reverseLookup.practiceDate) {
        resolvedPracticeDate = reverseLookup.practiceDate;
        dateBasis = "d1_personal_fee_unique";
      } else {
        needsConfirmation = true;
        addedUncertainPoints.push("対象日の特定に追加確認が必要です。");
      }
    } else {
      needsConfirmation = true;
      addedUncertainPoints.push("対象日の特定に追加確認が必要です。");
    }
  }

  const recentApplicable =
    !!recent && (!resolvedPracticeDate || recent.practice_date === resolvedPracticeDate);

  let existingType: PracticeType = "不明";
  if (resolvedPracticeDate) {
    const existing = await getPracticeByDate(env.DB, resolvedPracticeDate);
    if (existing && existing.practice_type && existing.practice_type !== "不明") {
      existingType = existing.practice_type;
      if (!result.practice_date && dateBasis === "unknown") {
        dateBasis = "d1_same_date";
      }
    }
  }

  if (result.practice_type !== "不明" && result.practice_type_basis === "explicit") {
    resolvedPracticeType = result.practice_type;
    typeBasis = "explicit_message";
  } else if (existingType !== "不明") {
    resolvedPracticeType = existingType;
    typeBasis = "d1_same_date";
  } else if (recentApplicable && recent && recent.practice_type !== "不明") {
    resolvedPracticeType = recent.practice_type;
    typeBasis = "kv_recent_context";
  } else {
    const inferredByRule = inferPracticeTypeByWeekday(resolvedPracticeDate);
    if (inferredByRule !== "不明") {
      resolvedPracticeType = inferredByRule;
      typeBasis = "weekday_default";
    } else if (result.practice_type !== "不明") {
      resolvedPracticeType = result.practice_type;
      typeBasis = "ai_inferred";
    }
  }

  return {
    resolvedPracticeDate,
    resolvedPracticeType,
    dateBasis,
    typeBasis,
    needsConfirmation,
    addedUncertainPoints
  };
}

function resolvedTypeBasisToPracticeTypeBasis(
  basis: ResolvedContextBasis
): { basis: StoredPracticeTypeBasis; priority: number } {
  switch (basis) {
    case "explicit_message":
    case "message_pair":
      return { basis: "explicit", priority: 1000 };
    case "d1_same_date":
      return { basis: "d1_same_date", priority: 900 };
    case "kv_recent_context":
      return { basis: "kv_recent_context", priority: 850 };
    case "weekday_default":
      return { basis: "weekday_default", priority: 700 };
    case "ai_inferred":
      return { basis: "ai_inferred", priority: 600 };
    default:
      return { basis: "unknown", priority: 0 };
  }
}

function messagePriority(messageKind: MessageKind): number {
  switch (messageKind) {
    case "same_day_change":
      return 400;
    case "dispatch_confirmed":
      return 300;
    case "schedule":
      return 200;
    case "dispatch_candidate":
      return 100;
    default:
      return 0;
  }
}

function shouldDropAiPayments(messageKind: MessageKind): boolean {
  return (
    messageKind === "schedule" ||
    messageKind === "dispatch_candidate" ||
    messageKind === "dispatch_confirmed" ||
    messageKind === "same_day_change" ||
    messageKind === "general_rule"
  );
}

function normalizePersonalPracticePayments(payments: ParsedPayment[]): ParsedPayment[] {
  const personalFee = payments.filter((payment) => payment.type === "個人練習代");
  const personalAdjustment = payments.filter((payment) => payment.type === "個人練習差額");

  const picked: ParsedPayment[] = [];
  if (personalFee.length > 0) {
    picked.push(personalFee[personalFee.length - 1]);
  }
  if (personalAdjustment.length > 0) {
    picked.push(personalAdjustment[personalAdjustment.length - 1]);
  }
  return picked;
}

function isPracticeDateUncertainPoint(point: string): boolean {
  return /(対象日|日付).*(不明|特定|確認|必要)|対象日の特定/.test(point);
}

function reconcileDateResolutionUncertainty(input: {
  resolvedPracticeDate: string | null;
  uncertainPoints: string[];
  parsedNeedsConfirmation: boolean;
  resolvedNeedsConfirmation: boolean;
}): { uncertainPoints: string[]; needsConfirmation: boolean } {
  const hadDateUncertainty = input.uncertainPoints.some((point) => isPracticeDateUncertainPoint(point));
  const filteredUncertainPoints = input.resolvedPracticeDate
    ? input.uncertainPoints.filter((point) => !isPracticeDateUncertainPoint(point))
    : input.uncertainPoints;

  if (filteredUncertainPoints.length > 0) {
    return {
      uncertainPoints: filteredUncertainPoints,
      needsConfirmation: true
    };
  }

  if (input.resolvedNeedsConfirmation) {
    return {
      uncertainPoints: filteredUncertainPoints,
      needsConfirmation: true
    };
  }

  if (!input.resolvedPracticeDate && input.parsedNeedsConfirmation) {
    return {
      uncertainPoints: filteredUncertainPoints,
      needsConfirmation: true
    };
  }

  if (input.resolvedPracticeDate && input.parsedNeedsConfirmation && !hadDateUncertainty) {
    return {
      uncertainPoints: filteredUncertainPoints,
      needsConfirmation: true
    };
  }

  return {
    uncertainPoints: filteredUncertainPoints,
    needsConfirmation: false
  };
}

function applyPersonalPracticeStandardTransport(
  result: StructuredLineResult,
  resolvedPracticeType: PracticeType,
  existingPractice?: PracticeRow | null
): {
  result: StructuredLineResult;
  appliedOutbound: boolean;
  appliedReturn: boolean;
} {
  let appliedOutbound = false;
  let appliedReturn = false;
  const hasExplicitOutbound = result.outbound_transport.type !== "不明";
  const hasExplicitReturn = result.return_transport.type !== "不明";
  const hasExistingOutbound = !!existingPractice && existingPractice.outbound_type !== "不明";
  const hasExistingReturn = !!existingPractice && existingPractice.return_type !== "不明";

  let nextOutbound = result.outbound_transport;
  let nextReturn = result.return_transport;

  if (!hasExplicitOutbound && hasExistingOutbound && existingPractice) {
    nextOutbound = {
      type: existingPractice.outbound_type,
      person: existingPractice.outbound_person
    };
    appliedOutbound = true;
  } else if (!hasExplicitOutbound && resolvedPracticeType === "個人練習") {
    nextOutbound = {
      type: "車",
      person: "志村さん"
    };
    appliedOutbound = true;
  }

  if (!hasExplicitReturn && hasExistingReturn && existingPractice) {
    nextReturn = {
      type: existingPractice.return_type,
      person: existingPractice.return_person
    };
    appliedReturn = true;
  } else if (!hasExplicitReturn && resolvedPracticeType === "個人練習") {
    nextReturn = {
      type: "車",
      person: "志村さん"
    };
    appliedReturn = true;
  }

  if (!appliedOutbound && !appliedReturn) {
    return { result, appliedOutbound: false, appliedReturn: false };
  }

  const filteredUncertainPoints = result.uncertain_points.filter((point) => {
    if (!appliedOutbound && !appliedReturn) {
      return true;
    }
    return !/(交通|行き|帰り|送迎|バス引率)/.test(point);
  });

  return {
    result: {
      ...result,
      outbound_transport: nextOutbound,
      return_transport: nextReturn,
      uncertain_points: filteredUncertainPoints,
      needs_confirmation: filteredUncertainPoints.length > 0 ? result.needs_confirmation : false
    },
    appliedOutbound,
    appliedReturn
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitGuideNames(raw: string | null): string[] {
  if (!isConcreteText(raw)) {
    return [];
  }
  return raw
    .split(/[、,・/／\s]+/)
    .map((name) => name.trim().replace(/[。．,，、]+$/g, ""))
    .filter((name) => name.length > 0 && name !== "不明");
}

function extractReturnBusGuideFromText(inputText: string): string[] {
  const sentenceMatch = inputText.match(/(?:帰り|復路)[^。\n]*引率(?:は|:|：)?\s*([^。\n]+)/);
  if (sentenceMatch && sentenceMatch[1]) {
    return sentenceMatch[1]
      .split(/[、,・/／\s]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0 && name !== "不明" && /さん$/.test(name));
  }

  const roleHintNames: string[] = [];
  const roleRegex = /([^\s、,，。]{1,12}さん)\s*は\s*(初回|経験者|同行経験者)/g;
  let matched: RegExpExecArray | null = roleRegex.exec(inputText);
  while (matched) {
    const name = matched[1]?.trim();
    if (name && !roleHintNames.includes(name)) {
      roleHintNames.push(name);
    }
    matched = roleRegex.exec(inputText);
  }
  return roleHintNames.filter((name) => name.length > 0 && name !== "不明" && /さん$/.test(name));
}

function extractGuideRoleHintsFromText(inputText: string): string[] {
  const hints: string[] = [];
  const regex = /([^\s、,，。]{1,12}さん)\s*は\s*(初回|経験者|同行経験者)/g;
  let matched: RegExpExecArray | null = regex.exec(inputText);
  while (matched) {
    const name = matched[1]?.trim();
    const role = matched[2]?.trim();
    if (name && role) {
      const hint = `${name}は${role}`;
      if (!hints.includes(hint)) {
        hints.push(hint);
      }
    }
    matched = regex.exec(inputText);
  }
  return hints;
}

function applyReturnBusGuideTextFallback(result: StructuredLineResult, inputText: string): StructuredLineResult {
  if (result.return_transport.type !== "バス") {
    return result;
  }
  const extractedGuides = extractReturnBusGuideFromText(inputText);
  const nextBusGuide = isConcreteText(result.bus_guide)
    ? result.bus_guide
    : extractedGuides.length > 0
      ? extractedGuides.join("・")
      : result.bus_guide;
  const roleHints = extractGuideRoleHintsFromText(inputText);
  if (nextBusGuide === result.bus_guide && roleHints.length === 0) {
    return result;
  }

  const currentNotes = result.notes ?? "";
  const additionalHints = roleHints.filter((hint) => !currentNotes.includes(hint));
  const nextNotes =
    additionalHints.length > 0
      ? [currentNotes.trim(), additionalHints.join("。")]
          .filter((part) => part.length > 0)
          .join(currentNotes.trim().length > 0 ? "\n" : "")
      : result.notes;

  return {
    ...result,
    bus_guide: nextBusGuide,
    notes: nextNotes
  };
}

function isNameMarkedBy(text: string, name: string, markerPattern: string): boolean {
  const escapedName = escapeRegExp(name);
  const pattern = new RegExp(
    `${escapedName}[^、,，。\\n]{0,16}${markerPattern}|${markerPattern}[^、,，。\\n]{0,16}${escapedName}`,
    "i"
  );
  return pattern.test(text);
}

function isNameMarkedNearby(text: string, name: string, markerPattern: string): boolean {
  const index = text.indexOf(name);
  if (index < 0) {
    return false;
  }
  const markerRegex = new RegExp(markerPattern, "i");
  const delimiters = [",", "，", "、", "。", "\n"];
  let leftBoundary = -1;
  for (const delimiter of delimiters) {
    const pos = text.lastIndexOf(delimiter, index - 1);
    if (pos > leftBoundary) {
      leftBoundary = pos;
    }
  }
  let rightBoundary = text.length;
  for (const delimiter of delimiters) {
    const pos = text.indexOf(delimiter, index + name.length);
    if (pos >= 0 && pos < rightBoundary) {
      rightBoundary = pos;
    }
  }

  const before = text.slice(Math.max(leftBoundary + 1, index - 12), index);
  const after = text.slice(index + name.length, Math.min(rightBoundary, index + name.length + 12));
  return markerRegex.test(before) || markerRegex.test(after);
}

function resolveBusGuideAllowancePayee(result: StructuredLineResult): {
  payee: string | null;
  needsReview: boolean;
  reviewReason: string | null;
} {
  const guideNames = splitGuideNames(result.bus_guide);
  if (guideNames.length === 0) {
    return {
      payee: null,
      needsReview: true,
      reviewReason: "帰りバスの引率者が特定できないため、支払先の確認が必要です。"
    };
  }

  const contextText = [result.notes ?? "", ...result.uncertain_points].join("\n");
  const roleMap = new Map<string, "初回" | "経験者">();
  const roleRegex = /([^\s、,，。]{1,12}さん)\s*は\s*(初回|経験者|同行経験者)/g;
  let roleMatched: RegExpExecArray | null = roleRegex.exec(contextText);
  while (roleMatched) {
    const name = roleMatched[1]?.trim().replace(/[。．,，、]+$/g, "");
    const roleToken = roleMatched[2] === "初回" ? "初回" : "経験者";
    if (name) {
      roleMap.set(name, roleToken);
    }
    roleMatched = roleRegex.exec(contextText);
  }

  const experienced = guideNames.filter(
    (name) =>
      roleMap.get(name) === "経験者" ||
      isNameMarkedBy(contextText, name, "(経験者|同行経験者)") ||
      isNameMarkedNearby(contextText, name, "(経験者|同行経験者)")
  );
  if (experienced.length === 1) {
    return {
      payee: experienced[0],
      needsReview: false,
      reviewReason: null
    };
  }

  const firstTimers = guideNames.filter(
    (name) => roleMap.get(name) === "初回" || isNameMarkedBy(contextText, name, "初回") || isNameMarkedNearby(contextText, name, "初回")
  );
  if (guideNames.length === 1 && firstTimers.length === 1) {
    return {
      payee: null,
      needsReview: true,
      reviewReason: "帰りバス引率が初回担当のみの記載のため、手当対象者の確認が必要です。"
    };
  }
  if (firstTimers.length === 1) {
    const nonFirstTimer = guideNames.filter((name) => name !== firstTimers[0]);
    if (nonFirstTimer.length === 1) {
      return {
        payee: nonFirstTimer[0],
        needsReview: false,
        reviewReason: null
      };
    }
  }

  if (guideNames.length === 1) {
    return {
      payee: guideNames[0],
      needsReview: false,
      reviewReason: null
    };
  }

  return {
    payee: null,
    needsReview: true,
    reviewReason: "帰りバス引率者が複数のため、手当対象者の確認が必要です。"
  };
}

function buildStandingRuleEventCandidates(
  result: StructuredLineResult,
  resolvedPracticeType: PracticeType
): PaymentForStorage[] {
  const candidates: PaymentForStorage[] = [];
  const eligibleMessageKind =
    result.message_kind === "dispatch_confirmed" ||
    result.message_kind === "same_day_change" ||
    result.message_kind === "schedule";
  const eligiblePracticeType = resolvedPracticeType === "通常練習";
  const eligibleAttendance = result.attendance === "参加";
  if (!eligibleMessageKind || !eligiblePracticeType || !eligibleAttendance) {
    return candidates;
  }

  if (result.outbound_transport.type === "車") {
    candidates.push({
      type: "車同乗代",
      amount: 100,
      payee: result.outbound_transport.person,
      due_date: null,
      payment_method: null,
      billing_scope: "event",
      direction: "outbound"
    });
  }
  if (result.return_transport.type === "車") {
    candidates.push({
      type: "車同乗代",
      amount: 100,
      payee: result.return_transport.person,
      due_date: null,
      payment_method: null,
      billing_scope: "event",
      direction: "return"
    });
  }
  if (result.return_transport.type === "バス" && result.bus_guide !== null) {
    const busGuideResolution = resolveBusGuideAllowancePayee(result);
    candidates.push({
      type: "バス引率代",
      amount: 100,
      payee: busGuideResolution.payee,
      due_date: null,
      payment_method: null,
      billing_scope: "event",
      direction: "return"
    });
  } else if (result.return_transport.type === "バス") {
    candidates.push({
      type: "バス引率代",
      amount: 100,
      payee: null,
      due_date: null,
      payment_method: null,
      billing_scope: "event",
      direction: "return"
    });
  }
  return candidates;
}

function applyStandingPaymentRules(
  result: StructuredLineResult,
  override?: {
    resolvedPracticeType?: PracticeType;
    practiceTypeBasis?: StoredPracticeTypeBasis;
    practiceTypePriority?: number;
  }
): {
  result: StructuredLineResult;
  addedPaymentCount: number;
  resolvedPracticeType: PracticeType;
  practiceTypeBasis: StoredPracticeTypeBasis;
  practiceTypePriority: number;
} {
  const resolvedPractice = override?.resolvedPracticeType
    ? {
        practiceType: override.resolvedPracticeType,
        basis: override.practiceTypeBasis ?? ("unknown" as StoredPracticeTypeBasis),
        priority: override.practiceTypePriority ?? 0
      }
    : resolvePracticeType(result);
  const resolvedPracticeType = resolvedPractice.practiceType;
  let basePayments: ParsedPayment[] = [];
  if (resolvedPracticeType === "個人練習") {
    const beforePayments = result.payments.map((payment) => ({
      type: payment.type,
      amount: payment.amount,
      payee: payment.payee,
      payment_method: payment.payment_method
    }));
    // 個人練習では message_kind に関わらず、AI抽出から個人練習系支払いのみ正規化して保持する。
    basePayments = normalizePersonalPracticePayments([...result.payments]);
    const afterPayments = basePayments.map((payment) => ({
      type: payment.type,
      amount: payment.amount,
      payee: payment.payee,
      payment_method: payment.payment_method
    }));
    console.log({
      stage: "personal_payment_normalized",
      before: beforePayments,
      after: afterPayments
    });
  } else {
    // 通常練習は既存どおり schedule/dispatch系のAI支払いを破棄する。
    basePayments = shouldDropAiPayments(result.message_kind) ? [] : [...result.payments];
  }
  const mergedPayments = [...basePayments];
  const existingCounts = new Map<string, number>();
  for (const payment of mergedPayments) {
    const key = paymentIdentityKey(payment);
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }

  const requiredCandidates = buildStandingRuleEventCandidates(result, resolvedPracticeType);
  const requiredCounts = new Map<string, number>();
  for (const candidate of requiredCandidates) {
    const key = paymentIdentityKey(candidate);
    requiredCounts.set(key, (requiredCounts.get(key) ?? 0) + 1);
  }

  let addedPaymentCount = 0;
  const usedAdditionalCounts = new Map<string, number>();
  for (const candidate of requiredCandidates) {
    const key = paymentIdentityKey(candidate);
    const requiredCount = requiredCounts.get(key) ?? 0;
    const existingCount = existingCounts.get(key) ?? 0;
    const currentAdded = usedAdditionalCounts.get(key) ?? 0;
    if (existingCount + currentAdded >= requiredCount) {
      continue;
    }
    mergedPayments.push({
      type: candidate.type,
      amount: candidate.amount,
      payee: candidate.payee,
      due_date: candidate.due_date,
      payment_method: candidate.payment_method ?? null
    });
    usedAdditionalCounts.set(key, currentAdded + 1);
    addedPaymentCount += 1;
  }

  const outputPracticeTypeBasis: PracticeTypeExtractionBasis =
    resolvedPractice.basis === "explicit"
      ? "explicit"
      : resolvedPractice.basis === "unknown"
        ? "unknown"
        : "inferred";

  return {
    result: {
      ...result,
      practice_type: resolvedPracticeType,
      practice_type_basis: outputPracticeTypeBasis,
      practice_type_evidence:
        outputPracticeTypeBasis === "explicit" ? result.practice_type_evidence : null,
      payments: mergedPayments
    },
    addedPaymentCount,
    resolvedPracticeType,
    practiceTypeBasis: resolvedPractice.basis,
    practiceTypePriority: resolvedPractice.priority
  };
}

function classifyBillingScope(paymentType: PaymentType): BillingScope {
  switch (paymentType) {
    case "車同乗代":
    case "バス引率代":
      return "event";
    default:
      return "other";
  }
}

function mapPaymentsForStorage(result: StructuredLineResult): PaymentForStorage[] {
  const eventCandidateMap = new Map<string, PaymentDirection[]>();
  const resolvedPracticeType = resolvePracticeType(result).practiceType;
  for (const candidate of buildStandingRuleEventCandidates(result, resolvedPracticeType)) {
    const key = paymentIdentityKey(candidate);
    const current = eventCandidateMap.get(key) ?? [];
    current.push(candidate.direction);
    eventCandidateMap.set(key, current);
  }

  return result.payments.map((payment) => {
    const billing_scope = classifyBillingScope(payment.type);
    let direction: PaymentDirection = "none";

    if (billing_scope === "event") {
      const key = paymentIdentityKey(payment);
      const directions = eventCandidateMap.get(key);
      if (directions && directions.length > 0) {
        direction = directions.shift() ?? "none";
      }
    }

    return {
      ...payment,
      billing_scope,
      direction
    };
  });
}

function formatDateForLine(dateString: string): string {
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) {
    return dateString;
  }
  return `${Number(month)}/${Number(day)}`;
}

function formatBillingMonthForLine(billingMonth: string): string {
  const matched = /^(\d{4})-(\d{2})$/.exec(billingMonth);
  if (!matched) {
    return billingMonth;
  }
  return `${Number(matched[1])}年${Number(matched[2])}月`;
}

function monthlyTypeToLabel(monthlyType: MonthlyType): string {
  switch (monthlyType) {
    case "regular_training_total":
      return "通常練習分";
    case "shimura_car_fee":
      return "志村さんお車代";
    default:
      return monthlyType;
  }
}

function buildPaymentItemLine(payment: UnpaidPaymentRow, index: number): string[] {
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  const prefix = circledNumbers[index] ?? `${index + 1}.`;
  const amountPart = typeof payment.amount === "number" ? ` ${payment.amount}円` : "";
  const lines = [`${prefix} ${formatDateForLine(payment.practice_date)} ${payment.payment_type}${amountPart}`];
  if (payment.payee) {
    lines.push(`　支払先：${payment.payee}`);
  }
  if (payment.due_date) {
    lines.push(`　期限：${formatDateForLine(payment.due_date)}`);
  }
  if (payment.payment_method) {
    lines.push(`　支払方法：${payment.payment_method}`);
  }
  return lines;
}

function buildUnifiedPaymentItemLine(item: UnifiedUnpaidItem, index: number): string[] {
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  const prefix = circledNumbers[index] ?? `${index + 1}.`;

  if (item.payment_kind === "event") {
    const amountPart = typeof item.amount === "number" ? ` ${item.amount}円` : "";
    const lines = [`${prefix} ${formatDateForLine(item.practice_date)} ${item.payment_type}${amountPart}`];
    if (item.payee) {
      lines.push(`　支払先：${item.payee}`);
    }
    if (item.due_date) {
      lines.push(`　期限：${formatDateForLine(item.due_date)}`);
    }
    if (item.payment_method) {
      lines.push(`　支払方法：${item.payment_method}`);
    }
    return lines;
  }

  const lines = [
    `${prefix} ${formatBillingMonthForLine(item.billing_month)} ${monthlyTypeToLabel(item.monthly_type)} ${item.amount.toLocaleString(
      "ja-JP"
    )}円`
  ];
  if (item.payee) {
    lines.push(`　支払先：${item.payee}`);
  }
  if (item.due_date) {
    lines.push(`　期限：${formatDateForLine(item.due_date)}`);
  }
  if (item.payment_method) {
    lines.push(`　支払方法：${item.payment_method}`);
  }
  return lines;
}

function buildUnpaidListMessage(payments: UnifiedUnpaidItem[], totalCount: number): LineReplyMessage {
  if (totalCount === 0) {
    return {
      type: "text",
      text: "未払いはありません。"
    };
  }

  const lines: string[] = [`未払い：${totalCount}件`, ""];
  if (totalCount > payments.length) {
    lines.push(`未払いは${totalCount}件あります。`);
    lines.push(`先頭${payments.length}件を表示しています。`);
    lines.push("");
  }

  payments.forEach((payment, index) => {
    lines.push(...buildUnifiedPaymentItemLine(payment, index));
  });
  lines.push("", "下のボタンから支払済みにできます。");

  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return {
    type: "text",
    text: lines.join("\n"),
    quickReply: {
      items: buildMarkPaidQuickReplyItems(payments, MAX_UNPAID_DISPLAY_COUNT)
    }
  };
}

function buildPaidConfirmationMessage(payment: UnifiedUnpaidItem): string {
  if (payment.payment_kind === "event") {
    const amountPart = typeof payment.amount === "number" ? ` ${payment.amount}円` : "";
    const lines = ["支払済みにしました。", "", `${formatDateForLine(payment.practice_date)} ${payment.payment_type}${amountPart}`];
    if (payment.payee) {
      lines.push(`支払先：${payment.payee}`);
    }
    if (payment.payment_method) {
      lines.push(`支払方法：${payment.payment_method}`);
    }
    return lines.join("\n");
  }

  const lines = [
    "支払済みにしました。",
    "",
    `${formatBillingMonthForLine(payment.billing_month)} ${monthlyTypeToLabel(payment.monthly_type)} ${payment.amount.toLocaleString(
      "ja-JP"
    )}円`
  ];
  if (payment.payee) {
    lines.push(`支払先：${payment.payee}`);
  }
  if (payment.payment_method) {
    lines.push(`支払方法：${payment.payment_method}`);
  }
  return lines.join("\n");
}

function buildMarkPaidQuickReplyItems(
  payments: Array<{ id: number; payment_kind?: "event" | "monthly" }>,
  maxItems: number
): NonNullable<
  LineReplyMessage["quickReply"]
>["items"] {
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return payments.slice(0, maxItems).map((payment, index) => ({
    type: "action",
    action: {
      type: "postback",
      label: `${circledNumbers[index] ?? `${index + 1}.`} 支払済みにする`,
      data: `action=mark_paid&payment_kind=${payment.payment_kind ?? "event"}&payment_id=${payment.id}`,
      displayText: `${circledNumbers[index] ?? `${index + 1}.`} 支払済みにする`
    }
  }));
}

function formatReminderMessage(payments: UnifiedUnpaidItem[]): LineReplyMessage {
  const displayed = payments.slice(0, MAX_REMINDER_DISPLAY_COUNT);
  const lines: string[] = ["お支払いリマインド", "", "今日お支払い予定のものがあります。", ""];
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

  if (payments.length > displayed.length) {
    lines.push(`対象は${payments.length}件あります。先頭${displayed.length}件を表示しています。`, "");
  }

  displayed.forEach((payment, index) => {
    lines.push(...buildUnifiedPaymentItemLine(payment, index));
    lines.push("");
  });

  lines.push("「未払い」と送ると、支払済みにできます。");

  const quickReplyItems = buildMarkPaidQuickReplyItems(
    displayed.map((payment) => ({ id: payment.id, payment_kind: payment.payment_kind })),
    MAX_REMINDER_QUICK_REPLY_COUNT
  );
  const message: LineReplyMessage = {
    type: "text",
    text: lines.join("\n")
  };
  if (quickReplyItems.length > 0) {
    message.quickReply = { items: quickReplyItems };
  }
  return message;
}

function getJstDateString(epochMs: number): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date(epochMs));
}

function shiftYmdByDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatYmdWithJapaneseWeekday(ymd: string): string {
  const parsed = parseYmdAsUtcDate(ymd);
  if (!parsed) {
    return ymd;
  }
  const weekdayJp = ["日", "月", "火", "水", "木", "金", "土"][parsed.getUTCDay()] ?? "";
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return `${month}/${day}（${weekdayJp}）`;
}

function parseRuiContactCommand(inputText: string, nowMs: number): RuiContactCommandParseResult | null {
  const trimmed = inputText.trim();
  const today = getJstDateString(nowMs);
  const tomorrow = shiftYmdByDays(today, 1);
  if (trimmed === CONTACT_RUI_COMMAND) {
    return {
      dates: [today, tomorrow],
      labels: [`今日 ${formatYmdWithJapaneseWeekday(today)}`, `明日 ${formatYmdWithJapaneseWeekday(tomorrow)}`]
    };
  }

  const matched = /^(\d{1,2})\/(\d{1,2})\s+塁に連絡$/.exec(trimmed);
  if (!matched) {
    return null;
  }

  const now = new Date(nowMs);
  const year = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric"
    }).format(now)
  );
  const month = Number(matched[1]);
  const day = Number(matched[2]);
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!parseYmdAsUtcDate(ymd)) {
    return null;
  }
  return {
    dates: [ymd],
    labels: [formatYmdWithJapaneseWeekday(ymd)]
  };
}

async function getPracticeByDateAndSource(
  db: D1Database,
  practiceDate: string,
  sourceLabel: string
): Promise<PracticeRow | null> {
  const row = await db
    .prepare(
      `SELECT practice_date, attendance, outbound_type, outbound_person, return_type, return_person, bus_guide,
              meeting_time, meeting_place, outbound_companions, return_dropoff_place, return_release_place, source, notes,
              practice_type, practice_type_basis, practice_type_priority, attendance_priority, outbound_priority, return_priority,
              bus_guide_priority, meeting_time_priority, meeting_place_priority, outbound_companions_priority,
              return_dropoff_place_priority, return_release_place_priority, last_message_kind
       FROM practices
       WHERE practice_date = ?1
         AND source = ?2
       LIMIT 1`
    )
    .bind(practiceDate, sourceLabel)
    .first<PracticeRow>();
  return row ?? null;
}

function buildRuiContactPracticeBlock(headerLabel: string, practice: PracticeRow | null): string[] {
  const lines: string[] = [`【${headerLabel}】`];
  if (!practice) {
    lines.push("練習情報なし");
    return lines;
  }

  const meetingParts = [practice.meeting_time, practice.meeting_place].filter((value): value is string =>
    isConcreteText(value)
  );
  let meetingLabel = meetingParts.length > 0 ? meetingParts.join(" ") : "不明";
  const practiceDate = parseYmdAsUtcDate(practice.practice_date);
  const weekday = practiceDate ? practiceDate.getUTCDay() : -1;
  const isWeekdayRegularPractice = (weekday === 1 || weekday === 2 || weekday === 4) && practice.practice_type === "通常練習";
  if (meetingLabel === "不明" && isWeekdayRegularPractice) {
    meetingLabel = "17:55ごろ KSP（または18:20 溝の口南口）";
  }
  lines.push(`集合：${meetingLabel}`);

  const outboundLabel = isConcreteTransportType(practice.outbound_type)
    ? transportToLineLabel({ type: practice.outbound_type, person: practice.outbound_person ?? null })
    : "不明";
  lines.push(`行き：${outboundLabel}`);
  lines.push(`一緒：${isConcreteText(practice.outbound_companions) ? practice.outbound_companions : "不明"}`);

  const returnLabel = isConcreteTransportType(practice.return_type)
    ? transportToLineLabel({ type: practice.return_type, person: practice.return_person ?? null })
    : "不明";
  lines.push(`帰り：${returnLabel}`);

  if (practice.return_type === "車") {
    lines.push(`降りる場所：${isConcreteText(practice.return_dropoff_place) ? practice.return_dropoff_place : "不明"}`);
  } else if (practice.return_type === "バス") {
    lines.push(`引率：${isConcreteText(practice.bus_guide) ? practice.bus_guide : "不明"}`);
    const returnReleasePlace = isConcreteText(practice.return_release_place)
      ? practice.return_release_place
      : isWeekdayRegularPractice
        ? "溝の口南口"
        : "不明";
    lines.push(`解散：${returnReleasePlace}`);
  }
  return lines;
}

async function buildRuiContactMessage(
  db: D1Database,
  sourceLabel: string,
  dates: string[],
  labels: string[]
): Promise<string> {
  const sections: string[] = [];
  for (let i = 0; i < dates.length; i += 1) {
    const practiceDate = dates[i];
    const headerLabel = labels[i] ?? formatYmdWithJapaneseWeekday(practiceDate);
    const practice = await getPracticeByDateAndSource(db, practiceDate, sourceLabel);
    sections.push(buildRuiContactPracticeBlock(headerLabel, practice).join("\n"));
  }
  return sections.join("\n\n");
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function getUnpaidEventPayments(
  db: D1Database,
  limit: number
): Promise<{ totalCount: number; payments: UnpaidPaymentRow[] }> {
  const totalRow = await db
    .prepare("SELECT COUNT(*) AS count FROM payments WHERE status = 'unpaid' AND voided_at IS NULL")
    .first<{
      count: number;
    }>();
  const totalCount = Number(totalRow?.count ?? 0);

  const paymentsResult = await db
    .prepare(
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status
              ,payment_method
       FROM payments
       WHERE status = 'unpaid'
         AND voided_at IS NULL
       ORDER BY (due_date IS NULL) ASC, due_date ASC, practice_date ASC, id ASC
       LIMIT ?1`
    )
    .bind(limit)
    .all<UnpaidPaymentRow>();

  return {
    totalCount,
    payments: paymentsResult.results ?? []
  };
}

async function getUnpaidMonthlyPayments(
  db: D1Database,
  limit: number
): Promise<{
  totalCount: number;
  payments: Array<{
    id: number;
    billing_month: string;
    monthly_type: MonthlyType;
    amount: number;
    payee: string | null;
    due_date: string | null;
    payment_method: PaymentMethod | null;
    breakdown_text: string | null;
    status: PaymentStatus;
  }>;
}> {
  const totalRow = await db
    .prepare("SELECT COUNT(*) AS count FROM monthly_payments WHERE status = 'unpaid'")
    .first<{ count: number }>();
  const totalCount = Number(totalRow?.count ?? 0);

  const result = await db
    .prepare(
      `SELECT id, billing_month, monthly_type, amount, payee, due_date, payment_method, breakdown_text, status
       FROM monthly_payments
       WHERE status = 'unpaid'
       ORDER BY (due_date IS NULL) ASC, due_date ASC, billing_month ASC, id ASC
       LIMIT ?1`
    )
    .bind(limit)
    .all<{
      id: number;
      billing_month: string;
      monthly_type: MonthlyType;
      amount: number;
      payee: string | null;
      due_date: string | null;
      payment_method: PaymentMethod | null;
      breakdown_text: string | null;
      status: PaymentStatus;
    }>();

  return {
    totalCount,
    payments: result.results ?? []
  };
}

async function getUnifiedUnpaidPayments(
  db: D1Database,
  limit: number
): Promise<{ totalCount: number; payments: UnifiedUnpaidItem[] }> {
  const event = await getUnpaidEventPayments(db, limit);
  const monthly = await getUnpaidMonthlyPayments(db, limit);
  const merged: UnifiedUnpaidItem[] = [
    ...event.payments.map((p) => ({
      payment_kind: "event" as const,
      id: p.id,
      practice_date: p.practice_date,
      payment_type: p.payment_type,
      amount: p.amount,
      payee: p.payee,
      due_date: p.due_date,
      payment_method: p.payment_method,
      sort_date: p.due_date ?? p.practice_date
    })),
    ...monthly.payments.map((p) => ({
      payment_kind: "monthly" as const,
      id: p.id,
      billing_month: p.billing_month,
      monthly_type: p.monthly_type,
      amount: p.amount,
      payee: p.payee,
      due_date: p.due_date,
      payment_method: p.payment_method,
      breakdown_text: p.breakdown_text,
      sort_date: p.due_date ?? `${p.billing_month}-99`
    }))
  ];

  merged.sort((a, b) => {
    const aDueNull = a.due_date === null ? 1 : 0;
    const bDueNull = b.due_date === null ? 1 : 0;
    if (aDueNull !== bDueNull) return aDueNull - bDueNull;
    if (a.sort_date !== b.sort_date) return a.sort_date.localeCompare(b.sort_date);
    return a.id - b.id;
  });

  return {
    totalCount: event.totalCount + monthly.totalCount,
    payments: merged.slice(0, limit)
  };
}

async function markEventPaymentPaid(
  db: D1Database,
  paymentId: number
): Promise<{ outcome: "updated" | "already_paid" | "not_found" | "voided"; payment?: UnpaidPaymentRow }> {
  const payment = await db
    .prepare(
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status
              ,payment_method
       FROM payments
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(paymentId)
    .first<UnpaidPaymentRow>();

  if (!payment) {
    return { outcome: "not_found" };
  }

  if (payment.status === "paid") {
    return { outcome: "already_paid", payment };
  }

  const voidedRow = await db
    .prepare(
      `SELECT voided_at
       FROM payments
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(paymentId)
    .first<{ voided_at: string | null }>();
  if (voidedRow && voidedRow.voided_at !== null) {
    return { outcome: "voided", payment };
  }

  const now = new Date().toISOString();
  const updateResult = await db
    .prepare(
      `UPDATE payments
       SET status = 'paid',
           updated_at = ?1
       WHERE id = ?2
         AND status = 'unpaid'
         AND voided_at IS NULL`
    )
    .bind(now, paymentId)
    .run();

  const changed = Number(updateResult.meta.changes ?? 0);
  if (changed > 0) {
    return { outcome: "updated", payment };
  }

  const current = await db
    .prepare(
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status, payment_method
       FROM payments
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(paymentId)
    .first<UnpaidPaymentRow>();

  if (!current) {
    return { outcome: "not_found" };
  }

  if (current.status === "paid") {
    return { outcome: "already_paid", payment: current };
  }

  const currentVoided = await db
    .prepare(
      `SELECT voided_at
       FROM payments
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(paymentId)
    .first<{ voided_at: string | null }>();
  if (currentVoided && currentVoided.voided_at !== null) {
    return { outcome: "voided", payment: current };
  }

  return { outcome: "not_found" };
}

async function markMonthlyPaymentPaid(
  db: D1Database,
  paymentId: number
): Promise<{
  outcome: "updated" | "already_paid" | "not_found";
  payment?: {
    id: number;
    billing_month: string;
    monthly_type: MonthlyType;
    amount: number;
    payee: string | null;
    due_date: string | null;
    payment_method: PaymentMethod | null;
  };
}> {
  const monthly = await db
    .prepare(
      `SELECT id, billing_month, monthly_type, amount, payee, due_date, payment_method, status
       FROM monthly_payments
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(paymentId)
    .first<{
      id: number;
      billing_month: string;
      monthly_type: MonthlyType;
      amount: number;
      payee: string | null;
      due_date: string | null;
      payment_method: PaymentMethod | null;
      status: PaymentStatus;
    }>();

  if (!monthly) {
    return { outcome: "not_found" };
  }
  if (monthly.status === "paid") {
    return { outcome: "already_paid", payment: monthly };
  }

  const now = new Date().toISOString();
  const update = await db
    .prepare(
      `UPDATE monthly_payments
       SET status = 'paid',
           updated_at = ?1
       WHERE id = ?2
         AND status = 'unpaid'`
    )
    .bind(now, paymentId)
    .run();

  return Number(update.meta.changes ?? 0) > 0
    ? { outcome: "updated", payment: monthly }
    : { outcome: "not_found" };
}

async function getReminderTargets(
  db: D1Database,
  todayJst: string,
  yesterdayJst: string
): Promise<ReminderPaymentRow[]> {
  const result = await db
    .prepare(
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status, reminder_sent_on
              ,payment_method
       FROM payments
       WHERE status = 'unpaid'
         AND voided_at IS NULL
         AND (
           (due_date IS NOT NULL AND due_date = ?1)
           OR
           (due_date IS NULL AND practice_date = ?2)
         )
         AND (
           reminder_sent_on IS NULL
           OR reminder_sent_on <> ?1
         )
       ORDER BY (due_date IS NULL) ASC, due_date ASC, practice_date ASC, id ASC`
    )
    .bind(todayJst, yesterdayJst)
    .all<ReminderPaymentRow>();
  return result.results ?? [];
}

async function getMonthlyReminderTargets(
  db: D1Database,
  todayJst: string
): Promise<
  Array<{
    id: number;
    billing_month: string;
    monthly_type: MonthlyType;
    amount: number;
    payee: string | null;
    due_date: string | null;
    payment_method: PaymentMethod | null;
  }>
> {
  const result = await db
    .prepare(
      `SELECT id, billing_month, monthly_type, amount, payee, due_date, payment_method
       FROM monthly_payments
       WHERE status = 'unpaid'
         AND due_date = ?1
         AND (
           reminder_sent_on IS NULL
           OR reminder_sent_on <> ?1
         )
       ORDER BY due_date ASC, billing_month ASC, id ASC`
    )
    .bind(todayJst)
    .all<{
      id: number;
      billing_month: string;
      monthly_type: MonthlyType;
      amount: number;
      payee: string | null;
      due_date: string | null;
      payment_method: PaymentMethod | null;
    }>();
  return result.results ?? [];
}

async function markReminderSentOn(
  db: D1Database,
  paymentIds: number[],
  todayJst: string
): Promise<number> {
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const paymentId of paymentIds) {
    const updateResult = await db
      .prepare(
        `UPDATE payments
         SET reminder_sent_on = ?1,
             updated_at = ?2
         WHERE id = ?3
           AND status = 'unpaid'
           AND voided_at IS NULL
           AND (reminder_sent_on IS NULL OR reminder_sent_on <> ?1)`
      )
      .bind(todayJst, now, paymentId)
      .run();
    updatedCount += Number(updateResult.meta.changes ?? 0);
  }

  return updatedCount;
}

async function markMonthlyReminderSentOn(
  db: D1Database,
  paymentIds: number[],
  todayJst: string
): Promise<number> {
  const now = new Date().toISOString();
  let updatedCount = 0;
  for (const paymentId of paymentIds) {
    const updateResult = await db
      .prepare(
        `UPDATE monthly_payments
         SET reminder_sent_on = ?1,
             updated_at = ?2
         WHERE id = ?3
           AND status = 'unpaid'
           AND (reminder_sent_on IS NULL OR reminder_sent_on <> ?1)`
      )
      .bind(todayJst, now, paymentId)
      .run();
    updatedCount += Number(updateResult.meta.changes ?? 0);
  }
  return updatedCount;
}

async function pushLineMessages(
  to: string,
  messages: LineReplyMessage[],
  accessToken: string
): Promise<number | undefined> {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      to,
      messages
    })
  });

  if (!response.ok) {
    console.error("LINE push API request failed", { status: response.status });
    return undefined;
  }

  return response.status;
}

async function maybeSetOwnerLineUserId(event: LineWebhookEvent, env: Env): Promise<void> {
  if (event.source?.type !== "user") {
    return;
  }
  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  const currentOwner = await env.STATE.get("owner_line_user_id");
  if (currentOwner) {
    return;
  }

  await env.STATE.put("owner_line_user_id", userId);
}

async function handlePaymentReminderScheduled(
  controller: ScheduledController,
  env: Env
): Promise<void> {
  console.log({ stage: "payment_reminder_start" });
  const ownerLineUserId = await env.STATE.get("owner_line_user_id");
  if (!ownerLineUserId) {
    console.log({ stage: "payment_reminder_no_owner" });
    return;
  }

  const todayJst = getJstDateString(controller.scheduledTime ?? Date.now());
  const yesterdayJst = shiftYmdByDays(todayJst, -1);

  const eventTargets = await getReminderTargets(env.DB, todayJst, yesterdayJst);
  const monthlyTargets = await getMonthlyReminderTargets(env.DB, todayJst);
  const targets: UnifiedUnpaidItem[] = [
    ...eventTargets.map((target) => ({
      payment_kind: "event" as const,
      id: target.id,
      practice_date: target.practice_date,
      payment_type: target.payment_type,
      amount: target.amount,
      payee: target.payee,
      due_date: target.due_date,
      payment_method: target.payment_method,
      sort_date: target.due_date ?? target.practice_date
    })),
    ...monthlyTargets.map((target) => ({
      payment_kind: "monthly" as const,
      id: target.id,
      billing_month: target.billing_month,
      monthly_type: target.monthly_type,
      amount: target.amount,
      payee: target.payee,
      due_date: target.due_date,
      payment_method: target.payment_method,
      breakdown_text: null,
      sort_date: target.due_date ?? `${target.billing_month}-99`
    }))
  ];

  targets.sort((a, b) => {
    const aDueNull = a.due_date === null ? 1 : 0;
    const bDueNull = b.due_date === null ? 1 : 0;
    if (aDueNull !== bDueNull) return aDueNull - bDueNull;
    if (a.sort_date !== b.sort_date) return a.sort_date.localeCompare(b.sort_date);
    return a.id - b.id;
  });

  if (targets.length === 0) {
    console.log({ stage: "payment_reminder_no_targets" });
    return;
  }

  console.log({ stage: "payment_reminder_targets_found", targetCount: targets.length });
  console.log({ stage: "payment_reminder_push_start" });
  const pushStatus = await pushLineMessages(
    ownerLineUserId,
    [formatReminderMessage(targets)],
    env.LINE_CHANNEL_ACCESS_TOKEN
  );
  if (typeof pushStatus !== "number") {
    return;
  }

  console.log({ stage: "payment_reminder_push_success", status: pushStatus });
  const updatedCount = await markReminderSentOn(
    env.DB,
    targets.filter((target) => target.payment_kind === "event").map((target) => target.id),
    todayJst
  );
  const monthlyUpdatedCount = await markMonthlyReminderSentOn(
    env.DB,
    targets.filter((target) => target.payment_kind === "monthly").map((target) => target.id),
    todayJst
  );
  console.log({ stage: "payment_reminder_marked_sent", updatedCount: updatedCount + monthlyUpdatedCount });
}

function isConcreteText(value: string | null): value is string {
  if (value === null) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== "不明";
}

function isConcreteTransportType(value: TransportType): boolean {
  return value !== "不明";
}

function isDispatchOrChangeKind(messageKind: MessageKind): boolean {
  return messageKind === "dispatch_confirmed" || messageKind === "same_day_change";
}

function formatPaymentSummaryLine(payment: {
  practice_date: string;
  payment_type: string;
  amount: number | null;
  payee: string | null;
}): string {
  const amountPart = typeof payment.amount === "number" ? `${payment.amount}円` : "金額不明";
  const payeePart = payment.payee ? `${payment.payee} ` : "";
  return `${formatDateForLine(payment.practice_date)} ${payeePart}${payment.payment_type}${amountPart}`;
}

function toPracticeRowForCalculation(practice: PracticeRow): StructuredLineResult {
  const extractionBasis: PracticeTypeExtractionBasis =
    practice.practice_type_basis === "explicit" ? "explicit" : "unknown";
  return {
    message_kind: "dispatch_confirmed",
    practice_type: practice.practice_type ?? "不明",
    practice_type_basis: extractionBasis,
    practice_type_evidence: null,
    monthly_charges: [],
    practice_date: practice.practice_date,
    attendance: practice.attendance,
    outbound_transport: {
      type: practice.outbound_type,
      person: practice.outbound_person
    },
    return_transport: {
      type: practice.return_type,
      person: practice.return_person
    },
    bus_guide: practice.bus_guide,
    meeting_time: practice.meeting_time,
    meeting_place: practice.meeting_place,
    outbound_companions: practice.outbound_companions,
    return_dropoff_place: practice.return_dropoff_place,
    return_release_place: practice.return_release_place,
    payments: [],
    notes: practice.notes,
    needs_confirmation: false,
    uncertain_points: []
  };
}

async function getPracticeByDate(db: D1Database, practiceDate: string): Promise<PracticeRow | null> {
  const row = await db
    .prepare(
      `SELECT practice_date, attendance, outbound_type, outbound_person, return_type, return_person, bus_guide,
              meeting_time, meeting_place, outbound_companions, return_dropoff_place, return_release_place, source, notes,
              practice_type, practice_type_basis, practice_type_priority, attendance_priority, outbound_priority, return_priority,
              bus_guide_priority, meeting_time_priority, meeting_place_priority, outbound_companions_priority,
              return_dropoff_place_priority, return_release_place_priority, last_message_kind
       FROM practices
       WHERE practice_date = ?1
       LIMIT 1`
    )
    .bind(practiceDate)
    .first<PracticeRow>();
  return row ?? null;
}

function isPersonalPracticePaymentType(paymentType: PaymentType): boolean {
  return paymentType === "個人練習代" || paymentType === "個人練習差額";
}

function isDateLessPersonalPracticePaymentMessage(result: StructuredLineResult): boolean {
  if (result.practice_date) {
    return false;
  }
  return result.payments.some((payment) => isPersonalPracticePaymentType(payment.type));
}

async function findUniqueUnpaidPersonalPracticeFeeDate(
  db: D1Database,
  sourceLabel: string
): Promise<{ practiceDate: string | null; candidateCount: number; candidateDates: string[] }> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT p.practice_date
       FROM payments p
       INNER JOIN practices pr
         ON pr.practice_date = p.practice_date
       WHERE p.rule_key = 'personal_practice_fee'
         AND p.payment_type = '個人練習代'
         AND p.status = 'unpaid'
         AND p.voided_at IS NULL
         AND p.source = ?1
         AND pr.practice_type = '個人練習'
       ORDER BY p.practice_date ASC`
    )
    .bind(sourceLabel)
    .all<{ practice_date: string }>();
  const candidates = rows.results ?? [];
  const candidateDates = candidates
    .map((row) => row.practice_date)
    .filter((date): date is string => typeof date === "string");
  if (candidates.length !== 1) {
    return { practiceDate: null, candidateCount: candidates.length, candidateDates };
  }
  return { practiceDate: candidates[0]?.practice_date ?? null, candidateCount: 1, candidateDates };
}

async function savePracticeToD1(
  env: Env,
  sourceLabel: string,
  result: StructuredLineResult,
  practiceTypeBasis: StoredPracticeTypeBasis,
  practiceTypePriority: number
): Promise<{
  practiceSaved: boolean;
  shouldReconcileEventPayments: boolean;
  messagePriorityValue: number;
}> {
  if (!result.practice_date) {
    return { practiceSaved: false, shouldReconcileEventPayments: false, messagePriorityValue: 0 };
  }

  const now = new Date().toISOString();
  const messagePriorityValue = messagePriority(result.message_kind);
  const existing = await getPracticeByDate(env.DB, result.practice_date);
  const fallback: PracticeRow = existing ?? {
    practice_date: result.practice_date,
    attendance: "不明",
    outbound_type: "不明",
    outbound_person: null,
    return_type: "不明",
    return_person: null,
    bus_guide: null,
    meeting_time: null,
    meeting_place: null,
    outbound_companions: null,
    return_dropoff_place: null,
    return_release_place: null,
    source: sourceLabel,
    notes: null,
    practice_type: "不明",
    practice_type_basis: "unknown",
    practice_type_priority: 0,
    attendance_priority: 0,
    outbound_priority: 0,
    return_priority: 0,
    bus_guide_priority: 0,
    meeting_time_priority: 0,
    meeting_place_priority: 0,
    outbound_companions_priority: 0,
    return_dropoff_place_priority: 0,
    return_release_place_priority: 0,
    last_message_kind: null
  };

  let attendance = fallback.attendance;
  let attendancePriority = fallback.attendance_priority ?? 0;
  let outboundType = fallback.outbound_type;
  let outboundPerson = fallback.outbound_person;
  let outboundPriority = fallback.outbound_priority ?? 0;
  let returnType = fallback.return_type;
  let returnPerson = fallback.return_person;
  let returnPriority = fallback.return_priority ?? 0;
  let busGuide = fallback.bus_guide;
  let busGuidePriority = fallback.bus_guide_priority ?? 0;
  let meetingTime = fallback.meeting_time;
  let meetingTimePriority = fallback.meeting_time_priority ?? 0;
  let meetingPlace = fallback.meeting_place;
  let meetingPlacePriority = fallback.meeting_place_priority ?? 0;
  let outboundCompanions = fallback.outbound_companions;
  let outboundCompanionsPriority = fallback.outbound_companions_priority ?? 0;
  let returnDropoffPlace = fallback.return_dropoff_place;
  let returnDropoffPlacePriority = fallback.return_dropoff_place_priority ?? 0;
  let returnReleasePlace = fallback.return_release_place;
  let returnReleasePlacePriority = fallback.return_release_place_priority ?? 0;
  let notes = fallback.notes;
  let practiceType = fallback.practice_type ?? "不明";
  let storedPracticeTypeBasis = fallback.practice_type_basis ?? "unknown";
  let storedPracticeTypePriority = fallback.practice_type_priority ?? 0;

  let shouldReconcileEventPayments = false;

  if (
    (result.attendance === "参加" || result.attendance === "不参加") &&
    messagePriorityValue >= attendancePriority
  ) {
    attendance = result.attendance;
    attendancePriority = messagePriorityValue;
    shouldReconcileEventPayments = true;
  }

  if (isConcreteTransportType(result.outbound_transport.type) && messagePriorityValue >= outboundPriority) {
    outboundType = result.outbound_transport.type;
    outboundPerson = isConcreteText(result.outbound_transport.person) ? result.outbound_transport.person : null;
    outboundPriority = messagePriorityValue;
    shouldReconcileEventPayments = true;
  }

  let returnUpdated = false;
  if (isConcreteTransportType(result.return_transport.type) && messagePriorityValue >= returnPriority) {
    returnType = result.return_transport.type;
    returnPerson = isConcreteText(result.return_transport.person) ? result.return_transport.person : null;
    returnPriority = messagePriorityValue;
    returnUpdated = true;
    shouldReconcileEventPayments = true;
  }

  if (returnUpdated) {
    if (returnType === "バス" && isConcreteText(result.bus_guide)) {
      busGuide = result.bus_guide;
      busGuidePriority = messagePriorityValue;
    } else {
      busGuide = null;
      busGuidePriority = messagePriorityValue;
    }
  } else if (
    isConcreteText(result.bus_guide) &&
    returnType === "バス" &&
    (messagePriorityValue >= busGuidePriority || !isConcreteText(busGuide))
  ) {
    busGuide = result.bus_guide;
    busGuidePriority = Math.max(busGuidePriority, messagePriorityValue);
    shouldReconcileEventPayments = true;
  }

  if (isConcreteText(result.notes)) {
    notes = result.notes;
  }

  if (isConcreteText(result.meeting_time) && messagePriorityValue >= meetingTimePriority) {
    meetingTime = result.meeting_time;
    meetingTimePriority = messagePriorityValue;
  }
  if (isConcreteText(result.meeting_place) && messagePriorityValue >= meetingPlacePriority) {
    meetingPlace = result.meeting_place;
    meetingPlacePriority = messagePriorityValue;
  }
  if (isConcreteText(result.outbound_companions) && messagePriorityValue >= outboundCompanionsPriority) {
    outboundCompanions = result.outbound_companions;
    outboundCompanionsPriority = messagePriorityValue;
  }
  if (isConcreteText(result.return_dropoff_place) && messagePriorityValue >= returnDropoffPlacePriority) {
    returnDropoffPlace = result.return_dropoff_place;
    returnDropoffPlacePriority = messagePriorityValue;
  }
  if (isConcreteText(result.return_release_place) && messagePriorityValue >= returnReleasePlacePriority) {
    returnReleasePlace = result.return_release_place;
    returnReleasePlacePriority = messagePriorityValue;
  }

  if (practiceTypePriority >= storedPracticeTypePriority) {
    practiceType = result.practice_type;
    storedPracticeTypeBasis = practiceTypeBasis;
    storedPracticeTypePriority = practiceTypePriority;
    shouldReconcileEventPayments = true;
  }

  await env.DB.prepare(
    `INSERT INTO practices (
      practice_date,
      attendance,
      outbound_type,
      outbound_person,
      return_type,
      return_person,
      bus_guide,
      meeting_time,
      meeting_place,
      outbound_companions,
      return_dropoff_place,
      return_release_place,
      source,
      notes,
      practice_type,
      practice_type_basis,
      practice_type_priority,
      attendance_priority,
      outbound_priority,
      return_priority,
      bus_guide_priority,
      meeting_time_priority,
      meeting_place_priority,
      outbound_companions_priority,
      return_dropoff_place_priority,
      return_release_place_priority,
      last_message_kind,
      created_at,
      updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?28)
    ON CONFLICT(practice_date) DO UPDATE SET
      attendance = excluded.attendance,
      outbound_type = excluded.outbound_type,
      outbound_person = excluded.outbound_person,
      return_type = excluded.return_type,
      return_person = excluded.return_person,
      bus_guide = excluded.bus_guide,
      meeting_time = excluded.meeting_time,
      meeting_place = excluded.meeting_place,
      outbound_companions = excluded.outbound_companions,
      return_dropoff_place = excluded.return_dropoff_place,
      return_release_place = excluded.return_release_place,
      source = excluded.source,
      notes = excluded.notes,
      practice_type = excluded.practice_type,
      practice_type_basis = excluded.practice_type_basis,
      practice_type_priority = excluded.practice_type_priority,
      attendance_priority = excluded.attendance_priority,
      outbound_priority = excluded.outbound_priority,
      return_priority = excluded.return_priority,
      bus_guide_priority = excluded.bus_guide_priority,
      meeting_time_priority = excluded.meeting_time_priority,
      meeting_place_priority = excluded.meeting_place_priority,
      outbound_companions_priority = excluded.outbound_companions_priority,
      return_dropoff_place_priority = excluded.return_dropoff_place_priority,
      return_release_place_priority = excluded.return_release_place_priority,
      last_message_kind = excluded.last_message_kind,
      updated_at = excluded.updated_at`
  )
    .bind(
      result.practice_date,
      attendance,
      outboundType,
      outboundPerson,
      returnType,
      returnPerson,
      busGuide,
      meetingTime,
      meetingPlace,
      outboundCompanions,
      returnDropoffPlace,
      returnReleasePlace,
      sourceLabel,
      notes,
      practiceType,
      storedPracticeTypeBasis,
      storedPracticeTypePriority,
      attendancePriority,
      outboundPriority,
      returnPriority,
      busGuidePriority,
      meetingTimePriority,
      meetingPlacePriority,
      outboundCompanionsPriority,
      returnDropoffPlacePriority,
      returnReleasePlacePriority,
      result.message_kind,
      now
    )
    .run();

  return {
    practiceSaved: true,
    shouldReconcileEventPayments:
      shouldReconcileEventPayments &&
      (isDispatchOrChangeKind(result.message_kind) || result.message_kind === "schedule"),
    messagePriorityValue
  };
}

function buildExpectedEventPayments(practice: PracticeRow): PaymentForStorage[] {
  return buildStandingRuleEventCandidates(
    toPracticeRowForCalculation(practice),
    practice.practice_type ?? "不明"
  );
}

function paymentMatchesExpected(
  payment: {
    payment_type: string;
    amount: number | null;
    payee: string | null;
    direction: PaymentDirection;
    rule_key: string | null;
  },
  expected: PaymentForStorage & { rule_key: string }
): boolean {
  return (
    payment.payment_type === expected.type &&
    payment.amount === expected.amount &&
    payment.payee === expected.payee &&
    payment.direction === expected.direction &&
    payment.rule_key === expected.rule_key
  );
}

function eventRuleKey(direction: PaymentDirection, paymentType: PaymentType): string | null {
  if (paymentType === "車同乗代" && direction === "outbound") {
    return "transport:outbound:car";
  }
  if (paymentType === "車同乗代" && direction === "return") {
    return "transport:return:car";
  }
  if (paymentType === "バス引率代" && direction === "return") {
    return "transport:return:bus";
  }
  return null;
}

async function reconcileEventPayments(
  env: Env,
  practice: PracticeRow,
  sourceLabel: string
): Promise<{ paymentCount: number; reviewWarnings: string[] }> {
  const now = new Date().toISOString();
  const expected = buildExpectedEventPayments(practice).map((payment) => ({
    ...payment,
    rule_key: eventRuleKey(payment.direction, payment.type)
  }));
  const expectedContext = toPracticeRowForCalculation(practice);

  const existingRows = await env.DB
    .prepare(
      `SELECT id, payment_type, amount, payee, due_date, status, direction, rule_key, voided_at, needs_review, review_reason
       FROM payments
       WHERE practice_date = ?1
         AND (
           rule_key IN ('transport:outbound:car', 'transport:return:car', 'transport:return:bus')
           OR
           (rule_key IS NULL AND payment_type IN ('車同乗代', 'バス引率代'))
         )
       ORDER BY id ASC`
    )
    .bind(practice.practice_date)
    .all<{
      id: number;
      payment_type: PaymentType;
      amount: number | null;
      payee: string | null;
      due_date: string | null;
      status: PaymentStatus;
      direction: PaymentDirection;
      rule_key: string | null;
      voided_at: string | null;
      needs_review: number;
      review_reason: string | null;
    }>();

  const existing = existingRows.results ?? [];
  const matchedIds = new Set<number>();
  const reviewWarnings: string[] = [];
  let busGuideReviewNotified = false;

  for (const expectedPayment of expected) {
    if (!expectedPayment.rule_key) {
      continue;
    }
    let resolvedExpectedPayee = expectedPayment.payee;
    let expectedNeedsReview = 0;
    let expectedReviewReason: string | null = null;
    if (expectedPayment.type === "バス引率代" && resolvedExpectedPayee === null) {
      const unresolved = resolveBusGuideAllowancePayee(expectedContext);
      resolvedExpectedPayee = unresolved.payee;
      expectedNeedsReview = unresolved.needsReview ? 1 : 0;
      expectedReviewReason = unresolved.reviewReason;

      if (resolvedExpectedPayee === null) {
        const guideNames = splitGuideNames(expectedContext.bus_guide);
        if (guideNames.length > 0) {
          const legacyCandidates = await env.DB
            .prepare(
              `SELECT id, payee
               FROM payments
               WHERE practice_date = ?1
                 AND payment_type = 'バス引率代'
                 AND status = 'unpaid'
                 AND voided_at IS NULL
                 AND payee IS NOT NULL`
            )
            .bind(practice.practice_date)
            .all<{ id: number; payee: string | null }>();
          const matchedLegacyPayees = (legacyCandidates.results ?? [])
            .map((row) => row.payee)
            .filter((payee): payee is string => typeof payee === "string" && guideNames.includes(payee));
          const uniqueLegacyPayees = [...new Set(matchedLegacyPayees)];
          if (uniqueLegacyPayees.length === 1) {
            resolvedExpectedPayee = uniqueLegacyPayees[0];
            expectedNeedsReview = 0;
            expectedReviewReason = null;
          }
        }
      }

      if (!busGuideReviewNotified && expectedNeedsReview === 1 && expectedReviewReason) {
        reviewWarnings.push(`⚠️ ${expectedReviewReason}`);
        busGuideReviewNotified = true;
      }
    }
    const expectedWithRuleKey = {
      ...expectedPayment,
      payee: resolvedExpectedPayee,
      rule_key: expectedPayment.rule_key
    };

    const activeMatch = existing.find(
      (row) => row.voided_at === null && paymentMatchesExpected(row, expectedWithRuleKey)
    );
    if (activeMatch) {
      matchedIds.add(activeMatch.id);
      if (
        activeMatch.needs_review !== expectedNeedsReview ||
        (activeMatch.review_reason ?? null) !== (expectedReviewReason ?? null)
      ) {
        await env.DB.prepare(
          `UPDATE payments
           SET needs_review = ?1,
               review_reason = ?2,
               updated_at = ?3
           WHERE id = ?4`
        )
          .bind(expectedNeedsReview, expectedReviewReason, now, activeMatch.id)
          .run();
      }
      continue;
    }

    const voidedReusable = existing.find(
      (row) =>
        row.status === "unpaid" &&
        row.voided_at !== null &&
        paymentMatchesExpected(row, expectedWithRuleKey)
    );
    if (voidedReusable) {
      matchedIds.add(voidedReusable.id);
      await env.DB.prepare(
        `UPDATE payments
         SET voided_at = NULL,
            needs_review = ?1,
            review_reason = ?2,
            source = ?3,
            updated_at = ?4
         WHERE id = ?5`
      )
        .bind(expectedNeedsReview, expectedReviewReason, sourceLabel, now, voidedReusable.id)
        .run();
      continue;
    }

    const insertResult = await env.DB.prepare(
      `INSERT OR IGNORE INTO payments (
        practice_date,
        payment_type,
        amount,
        payee,
        due_date,
        status,
        billing_scope,
        direction,
        rule_key,
        source,
        created_at,
        updated_at,
        needs_review,
        review_reason
      ) VALUES (?1, ?2, ?3, ?4, NULL, 'unpaid', 'event', ?5, ?6, ?7, ?8, ?8, ?9, ?10)`
    )
      .bind(
        practice.practice_date,
        expectedPayment.type,
        expectedPayment.amount,
        resolvedExpectedPayee,
        expectedPayment.direction,
        expectedPayment.rule_key,
        sourceLabel,
        now,
        expectedNeedsReview,
        expectedReviewReason
      )
      .run();

    if (Number(insertResult.meta.changes ?? 0) > 0) {
      const inserted = await env.DB.prepare(
        `SELECT id FROM payments
         WHERE practice_date = ?1
           AND payment_type = ?2
           AND direction = ?3
           AND rule_key = ?4
           AND ((amount IS NULL AND ?5 IS NULL) OR amount = ?5)
           AND ((payee IS NULL AND ?6 IS NULL) OR payee = ?6)
         ORDER BY id DESC
         LIMIT 1`
      )
        .bind(
          practice.practice_date,
          expectedWithRuleKey.type,
          expectedWithRuleKey.direction,
          expectedWithRuleKey.rule_key,
          expectedWithRuleKey.amount,
          expectedWithRuleKey.payee
        )
        .first<{ id: number }>();
      if (inserted) {
        matchedIds.add(inserted.id);
      }
    }
  }

  for (const row of existing) {
    if (matchedIds.has(row.id) || row.voided_at !== null) {
      continue;
    }

    if (row.status === "unpaid") {
      await env.DB.prepare(
        `UPDATE payments
         SET voided_at = ?1,
             updated_at = ?1
         WHERE id = ?2
           AND status = 'unpaid'
           AND voided_at IS NULL`
      )
        .bind(now, row.id)
        .run();
      continue;
    }

    if (row.status === "paid") {
      const reason = "最新の配車と支払済み内容が一致しません";
      await env.DB.prepare(
        `UPDATE payments
         SET needs_review = 1,
             review_reason = ?1,
             updated_at = ?2
         WHERE id = ?3`
      )
        .bind(reason, now, row.id)
        .run();
      reviewWarnings.push(
        `⚠️ 支払いの確認が必要です\nすでに支払済みの「${formatPaymentSummaryLine({
          practice_date: practice.practice_date,
          payment_type: row.payment_type,
          amount: row.amount,
          payee: row.payee
        })}」と、最新の配車内容が一致していません。`
      );
    }
  }

  const paymentCountRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM payments
     WHERE practice_date = ?1
       AND billing_scope = 'event'
       AND voided_at IS NULL`
  )
    .bind(practice.practice_date)
    .first<{ count: number }>();

  return {
    paymentCount: Number(paymentCountRow?.count ?? 0),
    reviewWarnings
  };
}

async function upsertNonEventPaymentToD1(
  env: Env,
  practiceDate: string,
  sourceLabel: string,
  payment: PaymentForStorage
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `SELECT id
     FROM payments
     WHERE practice_date = ?1
       AND payment_type = ?2
       AND billing_scope = ?3
       AND direction = ?4
       AND ((amount IS NULL AND ?5 IS NULL) OR amount = ?5)
       AND ((payee IS NULL AND ?6 IS NULL) OR payee = ?6)
     LIMIT 1`
  )
    .bind(
      practiceDate,
      payment.type,
      payment.billing_scope,
      payment.direction,
      payment.amount,
      payment.payee
    )
    .first<{ id: number }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE payments
       SET due_date = COALESCE(?1, due_date),
           payment_method = COALESCE(?2, payment_method),
           source = ?3,
           updated_at = ?4
       WHERE id = ?5`
    )
      .bind(payment.due_date, payment.payment_method, sourceLabel, now, existing.id)
      .run();
    return;
  }

  await env.DB.prepare(
    `INSERT INTO payments (
      practice_date,
      payment_type,
      amount,
      payee,
      due_date,
      payment_method,
      status,
      billing_scope,
      direction,
      source,
      created_at,
      updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unpaid', ?7, ?8, ?9, ?10, ?10)`
  )
    .bind(
      practiceDate,
      payment.type,
      payment.amount,
      payment.payee,
      payment.due_date,
      payment.payment_method,
      payment.billing_scope,
      payment.direction,
      sourceLabel,
      now
    )
    .run();
}

async function upsertPersonalPracticePaymentToD1(
  env: Env,
  practiceDate: string,
  sourceLabel: string,
  payment: PaymentForStorage,
  hasExplicitAdjustment: boolean,
  hasExplicitFee: boolean
): Promise<string | null> {
  const now = new Date().toISOString();
  const ruleKey =
    payment.type === "個人練習代"
      ? "personal_practice_fee"
      : payment.type === "個人練習差額"
        ? "personal_practice_fee_adjustment"
        : null;
  if (!ruleKey) {
    return null;
  }

  if (payment.type === "個人練習差額") {
    const base = await env.DB.prepare(
      `SELECT id, amount, payee, due_date, payment_method, status
       FROM payments
       WHERE practice_date = ?1
         AND rule_key = 'personal_practice_fee'
       LIMIT 1`
    )
      .bind(practiceDate)
      .first<{
        id: number;
        amount: number | null;
        payee: string | null;
        due_date: string | null;
        payment_method: string | null;
        status: PaymentStatus;
      }>();
    if (base && base.status === "unpaid" && typeof base.amount === "number" && typeof payment.amount === "number") {
      // 同一メッセージ内に最終総額(個人練習代)がある場合は、差額を別加算しない。
      // 基準請求(unpaid)は最終総額への更新を優先する。
      if (hasExplicitFee) {
        await env.DB.prepare(
          `UPDATE payments
           SET payee = COALESCE(?1, payee),
               due_date = COALESCE(?2, due_date),
               payment_method = COALESCE(?3, payment_method),
               source = ?4,
               updated_at = ?5
           WHERE id = ?6`
        )
          .bind(payment.payee, payment.due_date, payment.payment_method, sourceLabel, now, base.id)
          .run();
        return null;
      }
      await env.DB.prepare(
        `UPDATE payments
         SET amount = ?1,
             payee = COALESCE(?2, payee),
             due_date = COALESCE(?3, due_date),
             payment_method = COALESCE(?4, payment_method),
             source = ?5,
             updated_at = ?6
         WHERE id = ?7`
      )
        .bind(base.amount + payment.amount, payment.payee, payment.due_date, payment.payment_method, sourceLabel, now, base.id)
        .run();
      return null;
    }

    if (base && base.status === "paid") {
      const existingAdjustment = await env.DB.prepare(
        `SELECT id, amount, payee, due_date, payment_method, status
         FROM payments
         WHERE practice_date = ?1
           AND rule_key = 'personal_practice_fee_adjustment'
         LIMIT 1`
      )
        .bind(practiceDate)
        .first<{
          id: number;
          amount: number | null;
          payee: string | null;
          due_date: string | null;
          payment_method: string | null;
          status: PaymentStatus;
        }>();

      if (!existingAdjustment) {
        await env.DB.prepare(
          `INSERT INTO payments (
            practice_date, payment_type, amount, payee, due_date, payment_method, status,
            billing_scope, direction, rule_key, source, created_at, updated_at
          ) VALUES (?1, '個人練習差額', ?2, ?3, ?4, ?5, 'unpaid', ?6, ?7, 'personal_practice_fee_adjustment', ?8, ?9, ?9)`
        )
          .bind(
            practiceDate,
            payment.amount,
            payment.payee,
            payment.due_date,
            payment.payment_method,
            payment.billing_scope,
            payment.direction,
            sourceLabel,
            now
          )
          .run();
        return null;
      }

      if (existingAdjustment.status === "unpaid") {
        await env.DB.prepare(
          `UPDATE payments
           SET payment_type = '個人練習差額',
               amount = COALESCE(?1, amount),
               payee = COALESCE(?2, payee),
               due_date = COALESCE(?3, due_date),
               payment_method = COALESCE(?4, payment_method),
               source = ?5,
               updated_at = ?6
           WHERE id = ?7`
        )
          .bind(
            payment.amount,
            payment.payee,
            payment.due_date,
            payment.payment_method,
            sourceLabel,
            now,
            existingAdjustment.id
          )
          .run();
        return null;
      }
    }
  }

  const existing = await env.DB.prepare(
    `SELECT id, amount, payee, due_date, payment_method, status
     FROM payments
     WHERE practice_date = ?1
       AND rule_key = ?2
     LIMIT 1`
  )
    .bind(practiceDate, ruleKey)
    .first<{
      id: number;
      amount: number | null;
      payee: string | null;
      due_date: string | null;
      payment_method: string | null;
      status: PaymentStatus;
    }>();

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO payments (
        practice_date, payment_type, amount, payee, due_date, status,
        payment_method, billing_scope, direction, rule_key, source, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'unpaid', ?6, ?7, ?8, ?9, ?10, ?11, ?11)`
    )
      .bind(
        practiceDate,
        payment.type,
        payment.amount,
        payment.payee,
        payment.due_date,
        payment.payment_method,
        payment.billing_scope,
        payment.direction,
        ruleKey,
        sourceLabel,
        now
      )
      .run();
    return null;
  }

  if (existing.status === "unpaid") {
    await env.DB.prepare(
      `UPDATE payments
       SET payment_type = ?1,
           amount = COALESCE(?2, amount),
           payee = COALESCE(?3, payee),
           due_date = COALESCE(?4, due_date),
           payment_method = COALESCE(?5, payment_method),
           source = ?6,
           updated_at = ?7,
           needs_review = 0,
           review_reason = NULL
       WHERE id = ?8`
    )
      .bind(
        payment.type,
        payment.amount,
        payment.payee,
        payment.due_date,
        payment.payment_method,
        sourceLabel,
        now,
        existing.id
      )
      .run();
    return null;
  }

  const nextAmount = payment.amount ?? existing.amount;
  const nextPayee = payment.payee ?? existing.payee;
  const nextDueDate = payment.due_date ?? existing.due_date;
  const nextPaymentMethod = payment.payment_method ?? existing.payment_method;
  const changed =
    existing.amount !== nextAmount ||
    existing.payee !== nextPayee ||
    existing.due_date !== nextDueDate ||
    existing.payment_method !== nextPaymentMethod;
  if (!changed) {
    return null;
  }

  if (payment.type === "個人練習差額") {
    const hasExistingAdjustment = await env.DB.prepare(
      `SELECT id FROM payments
       WHERE practice_date = ?1
         AND rule_key = 'personal_practice_fee_adjustment'
         AND id <> ?2
       LIMIT 1`
    )
      .bind(practiceDate, existing.id)
      .first<{ id: number }>();
    if (hasExistingAdjustment) {
      await env.DB.prepare(
        `UPDATE payments
         SET amount = ?1,
             payee = COALESCE(?2, payee),
             due_date = COALESCE(?3, due_date),
             payment_method = COALESCE(?4, payment_method),
             source = ?5,
             updated_at = ?6
         WHERE id = ?7`
      )
        .bind(
          payment.amount,
          payment.payee,
          payment.due_date,
          payment.payment_method,
          sourceLabel,
          now,
          hasExistingAdjustment.id
        )
        .run();
      return null;
    }
  }

  if (ruleKey === "personal_practice_fee" && hasExplicitAdjustment) {
    return null;
  }

  await env.DB.prepare(
    `UPDATE payments
     SET needs_review = 1,
         review_reason = '支払済み後に請求内容が変更されています',
         source = ?1,
         updated_at = ?2
     WHERE id = ?3`
  )
    .bind(sourceLabel, now, existing.id)
    .run();

  return "⚠️ 支払いの確認が必要です\n支払済み後に個人練習代の請求内容が変更されています。";
}

function normalizeMonthlyCharge(
  result: StructuredLineResult,
  charge: MonthlyCharge
): MonthlyCharge | null {
  if (result.message_kind !== "accounting_notice") {
    return null;
  }
  if (!/^\d{4}-\d{2}$/.test(charge.billing_month)) {
    return null;
  }
  if (!Number.isFinite(charge.amount) || charge.amount <= 0) {
    return null;
  }
  if (charge.due_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(charge.due_date)) {
    return null;
  }
  return charge;
}

async function upsertMonthlyPaymentToD1(
  db: D1Database,
  sourceLabel: string,
  charge: MonthlyCharge
): Promise<{
  row: {
    id: number;
    billing_month: string;
    monthly_type: MonthlyType;
    amount: number;
    payee: string | null;
    due_date: string | null;
    payment_method: PaymentMethod | null;
    breakdown_text: string | null;
    status: PaymentStatus;
    needs_review: number;
    review_reason: string | null;
  };
  reviewWarning: string | null;
}> {
  const now = new Date().toISOString();
  const existing = await db
    .prepare(
      `SELECT id, billing_month, monthly_type, amount, payee, due_date, payment_method, breakdown_text,
              status, needs_review, review_reason
       FROM monthly_payments
       WHERE billing_month = ?1
         AND monthly_type = ?2
       LIMIT 1`
    )
    .bind(charge.billing_month, charge.monthly_type)
    .first<{
      id: number;
      billing_month: string;
      monthly_type: MonthlyType;
      amount: number;
      payee: string | null;
      due_date: string | null;
      payment_method: PaymentMethod | null;
      breakdown_text: string | null;
      status: PaymentStatus;
      needs_review: number;
      review_reason: string | null;
    }>();

  if (!existing) {
    await db.prepare(
      `INSERT INTO monthly_payments (
         billing_month, monthly_type, amount, payee, due_date, payment_method, breakdown_text,
         status, source, reminder_sent_on, needs_review, review_reason, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'unpaid', ?8, NULL, 0, NULL, ?9, ?9)`
    )
      .bind(
        charge.billing_month,
        charge.monthly_type,
        charge.amount,
        charge.payee,
        charge.due_date,
        charge.payment_method,
        charge.breakdown_text,
        sourceLabel,
        now
      )
      .run();
  } else if (existing.status === "unpaid") {
    const changed =
      existing.amount !== charge.amount ||
      existing.payee !== charge.payee ||
      existing.due_date !== charge.due_date ||
      existing.payment_method !== charge.payment_method ||
      existing.breakdown_text !== charge.breakdown_text;

    await db.prepare(
      `UPDATE monthly_payments
       SET amount = ?1,
           payee = ?2,
           due_date = ?3,
           payment_method = ?4,
           breakdown_text = ?5,
           source = ?6,
           reminder_sent_on = CASE WHEN ?7 THEN NULL ELSE reminder_sent_on END,
           needs_review = 0,
           review_reason = NULL,
           updated_at = ?8
       WHERE id = ?9`
    )
      .bind(
        charge.amount,
        charge.payee,
        charge.due_date,
        charge.payment_method,
        charge.breakdown_text,
        sourceLabel,
        changed ? 1 : 0,
        now,
        existing.id
      )
      .run();
  } else {
    const changed =
      existing.amount !== charge.amount ||
      existing.payee !== charge.payee ||
      existing.due_date !== charge.due_date ||
      existing.payment_method !== charge.payment_method ||
      existing.breakdown_text !== charge.breakdown_text;

    if (changed) {
      await db.prepare(
        `UPDATE monthly_payments
         SET needs_review = 1,
             review_reason = '支払済み後に請求内容が変更されています',
             source = ?1,
             updated_at = ?2
         WHERE id = ?3`
      )
        .bind(sourceLabel, now, existing.id)
        .run();
    }
  }

  const row = await db
    .prepare(
      `SELECT id, billing_month, monthly_type, amount, payee, due_date, payment_method, breakdown_text,
              status, needs_review, review_reason
       FROM monthly_payments
       WHERE billing_month = ?1
         AND monthly_type = ?2
       LIMIT 1`
    )
    .bind(charge.billing_month, charge.monthly_type)
    .first<{
      id: number;
      billing_month: string;
      monthly_type: MonthlyType;
      amount: number;
      payee: string | null;
      due_date: string | null;
      payment_method: PaymentMethod | null;
      breakdown_text: string | null;
      status: PaymentStatus;
      needs_review: number;
      review_reason: string | null;
    }>();

  if (!row) {
    throw new Error("monthly_upsert_failed");
  }

  let reviewWarning: string | null = null;
  if (row.status === "paid" && row.needs_review === 1) {
    reviewWarning =
      "⚠️ 支払いの確認が必要です\n支払済み後に月次請求内容が変更されています。内容を確認してください。";
  }

  return { row, reviewWarning };
}

function formatMonthlyChargeSavedMessage(
  rows: Array<{
    billing_month: string;
    monthly_type: MonthlyType;
    amount: number;
    payee: string | null;
    due_date: string | null;
    payment_method: PaymentMethod | null;
    breakdown_text: string | null;
  }>
): string {
  const lines: string[] = ["月次支払い："];
  for (const row of rows) {
    const parts = [
      `・${formatBillingMonthForLine(row.billing_month)} ${monthlyTypeToLabel(row.monthly_type)}（${row.amount.toLocaleString(
        "ja-JP"
      )}円`
    ];
    if (row.payee) {
      parts.push(`、支払先：${row.payee}`);
    }
    if (row.due_date) {
      parts.push(`、期限：${formatDateForLine(row.due_date)}`);
    }
    if (row.payment_method && row.payment_method !== "不明") {
      parts.push(`、${row.payment_method}`);
    }
    parts.push("）");
    lines.push(parts.join(""));

    if (row.breakdown_text) {
      lines.push("内訳：");
      lines.push(row.breakdown_text);
    }
  }
  return lines.join("\n");
}

async function saveStructuredResultToD1(
  env: Env,
  sourceLabel: string,
  result: StructuredLineResult,
  practiceTypeBasis: StoredPracticeTypeBasis,
  practiceTypePriority: number
): Promise<SaveStructuredResultOutcome> {
  const savedMonthlyCharges: SaveStructuredResultOutcome["savedMonthlyCharges"] = [];
  const reviewWarnings: string[] = [];
  const normalizedMonthlyCharges = result.monthly_charges
    .map((charge) => normalizeMonthlyCharge(result, charge))
    .filter((charge): charge is MonthlyCharge => charge !== null);

  for (const charge of normalizedMonthlyCharges) {
    const monthlySave = await upsertMonthlyPaymentToD1(env.DB, sourceLabel, charge);
    savedMonthlyCharges.push({
      billing_month: monthlySave.row.billing_month,
      monthly_type: monthlySave.row.monthly_type,
      amount: monthlySave.row.amount,
      payee: monthlySave.row.payee,
      due_date: monthlySave.row.due_date,
      payment_method: monthlySave.row.payment_method,
      breakdown_text: monthlySave.row.breakdown_text
    });
    if (monthlySave.reviewWarning) {
      reviewWarnings.push(monthlySave.reviewWarning);
    }
  }

  const practiceSave = await savePracticeToD1(env, sourceLabel, result, practiceTypeBasis, practiceTypePriority);
  if (!result.practice_date) {
    return {
      practiceSaved: practiceSave.practiceSaved,
      paymentCount: 0,
      reviewWarnings,
      savedMonthlyCharges
    };
  }

  const latestPractice = await getPracticeByDate(env.DB, result.practice_date);
  if (!latestPractice) {
    return {
      practiceSaved: practiceSave.practiceSaved,
      paymentCount: 0,
      reviewWarnings,
      savedMonthlyCharges
    };
  }

  const paymentsForStorage = mapPaymentsForStorage(result);
  const shouldSkipLegacyPaymentUpsert =
    result.message_kind === "accounting_notice" && normalizedMonthlyCharges.length > 0;
  // Event payments are reconciled from practice state (rule_key管理) to avoid duplicate rows.
  const basePaymentsToUpsert = paymentsForStorage.filter((payment) => payment.billing_scope !== "event");
  const paymentsToUpsert = shouldSkipLegacyPaymentUpsert ? [] : basePaymentsToUpsert;
  const hasExplicitPersonalAdjustment = paymentsToUpsert.some((payment) => payment.type === "個人練習差額");
  const hasExplicitPersonalFee = paymentsToUpsert.some((payment) => payment.type === "個人練習代");
  for (const payment of paymentsToUpsert) {
    if (payment.type === "個人練習代" || payment.type === "個人練習差額") {
      const warning = await upsertPersonalPracticePaymentToD1(
        env,
        result.practice_date,
        sourceLabel,
        payment,
        hasExplicitPersonalAdjustment,
        hasExplicitPersonalFee
      );
      if (warning) {
        reviewWarnings.push(warning);
      }
      continue;
    }
    await upsertNonEventPaymentToD1(env, result.practice_date, sourceLabel, payment);
  }

  if (!practiceSave.shouldReconcileEventPayments) {
    const paymentCountRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM payments
       WHERE practice_date = ?1
         AND voided_at IS NULL`
    )
      .bind(result.practice_date)
      .first<{ count: number }>();
    return {
      practiceSaved: practiceSave.practiceSaved,
      paymentCount: Number(paymentCountRow?.count ?? 0),
      reviewWarnings,
      savedMonthlyCharges
    };
  }

  const reconciliation = await reconcileEventPayments(env, latestPractice, sourceLabel);
  return {
    practiceSaved: practiceSave.practiceSaved,
    paymentCount: reconciliation.paymentCount,
    reviewWarnings: [...reviewWarnings, ...reconciliation.reviewWarnings],
    savedMonthlyCharges
  };
}

async function getActiveUnpaidEventPaymentsForPractice(
  db: D1Database,
  practiceDate: string
): Promise<ParsedPayment[]> {
  const rows = await db
    .prepare(
      `SELECT payment_type, amount, payee, due_date
              ,payment_method
       FROM payments
       WHERE practice_date = ?1
         AND billing_scope = 'event'
         AND status = 'unpaid'
         AND voided_at IS NULL
       ORDER BY id ASC`
    )
    .bind(practiceDate)
    .all<{
      payment_type: PaymentType;
      amount: number | null;
      payee: string | null;
      due_date: string | null;
      payment_method: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    type: row.payment_type,
    amount: row.amount,
    payee: row.payee,
    due_date: row.due_date,
    payment_method: row.payment_method
  }));
}

async function getActiveUnpaidPersonalPracticePaymentsForPractice(
  db: D1Database,
  practiceDate: string
): Promise<ParsedPayment[]> {
  const rows = await db
    .prepare(
      `SELECT payment_type, amount, payee, due_date
              ,payment_method
       FROM payments
       WHERE practice_date = ?1
         AND status = 'unpaid'
         AND voided_at IS NULL
         AND rule_key IN ('personal_practice_fee', 'personal_practice_fee_adjustment')
       ORDER BY CASE rule_key
         WHEN 'personal_practice_fee' THEN 0
         ELSE 1
       END, id`
    )
    .bind(practiceDate)
    .all<{
      payment_type: PaymentType;
      amount: number | null;
      payee: string | null;
      due_date: string | null;
      payment_method: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    type: row.payment_type,
    amount: row.amount,
    payee: row.payee,
    due_date: row.due_date,
    payment_method: row.payment_method
  }));
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
  const currentDateJst = getJstDateString(Date.now());
  const systemPrompt =
    "あなたはLINE本文の情報抽出器です。必ずJSON Schemaに従って厳密なJSONのみを返してください。" +
    "message_kindは必須で、schedule/dispatch_candidate/dispatch_confirmed/same_day_change/accounting_notice/general_rule/otherのどれかを返してください。" +
    "scheduleは参加予定、dispatch_candidateは配車候補、dispatch_confirmedは確定配車、same_day_changeは当日含む変更連絡、" +
    "accounting_noticeは会計・請求連絡、general_ruleは恒常ルール、otherはその他です。" +
    "practice_typeは必須で、本文や画像に明示があれば通常練習または個人練習を返してください。" +
    "明示がないが推測できる場合はpractice_typeを返してpractice_type_basis=inferred、推測不能ならpractice_type=不明かつpractice_type_basis=unknownにしてください。" +
    "practice_type_basisは必須で、practice_typeが本文や画像中の直接表現（個人練習/個別練習/通常練習等）に基づく場合だけexplicit、" +
    "曜日・会場・料金文脈などからの推測はinferred、判定不能はunknownにしてください。" +
    "practice_type_evidenceにはexplicitの根拠となる短い原文を入れ、explicitでない場合はnullにしてください。" +
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
    "meeting_time/meeting_place/outbound_companions/return_dropoff_place/return_release_placeも同様に、本文に明示があるときのみ設定し、" +
    "根拠がなければ必ずnullにしてください。" +
    "バス引率者の案内のみを根拠にreturn_transport.typeをバスに確定しないでください。" +
    "配車表画像を読むときは、渡辺塁（塁/塁くん/ルイくん）本人が記載された行を最優先し、他人の行の交通手段を本人へ適用しないでください。" +
    "同一表内に『バス』行と『○○号』行が混在する場合でも、本人名がある行の値だけを本人情報として採用してください。" +
    "同様に、帰りがバスの場合のbus_guideも本人行の記載を最優先し、本人行にある担当者名を抽出してください。" +
    "配車表などで『○○号』は『○○さんの車』として扱い、渡辺塁本人の割当が『渡辺→丹下号』のように明示される場合は" +
    "return_transport.type='車'、return_transport.person='丹下さん'のようにpersonまで必ず設定してください。" +
    "『志村号』等で車を確定してよいのは、渡辺塁本人名と同じ行（または明確に本人へ紐づくセル）にその号がある場合のみです。" +
    "本人名のない別行に『志村号』があるだけなら、渡辺塁本人のreturn_transport/outbound_transportを車にしないでください。" +
    "同様に山田号→山田さん、佐藤号→佐藤さんのように扱ってください。" +
    "本人の帰りが車などでバスを使わないことが確定している場合、条件付きの一般案内を根拠にbus_guideを設定せず、bus_guideはnullにしてください。" +
    "そのような全体向け条件情報は必要ならnotesへ記載し、本人に適用されない条件付き支払い・引率に関する不明点をuncertain_pointsへ追加しないでください。" +
    "dispatch_candidateでは『車出し可能』『引率可能』を本人確定配車として扱わないでください。" +
    "『帰りバス引率は藤田さん』等の一般情報だけで本人のreturn_transportを確定しないでください。" +
    "『100円』という金額だけで見守り代や他のpayment_typeを推測しないでください。見守り代は『見守り代』と明記がある場合のみ抽出してください。" +
    "monthly_chargesは必須配列です。実際に支払う具体的な月次請求（対象月と金額が確定）でない限り必ず空配列にしてください。" +
    "一般料金ルール（単価説明・毎月の一般規則）だけではmonthly_chargesを作らないでください。" +
    "regular_training_totalは『計○○円』等の実支払合計が明示される場合のみ作成してください。" +
    "shimura_car_feeは対象月が特定された具体請求の場合のみ作成してください。" +
    "monthly_chargesへ入れた請求をpaymentsへ重複して入れないでください。" +
    "payments.amountは『このメッセージの受け手本人が実際に支払うよう指示されている金額』だけを入れてください。" +
    "全参加者分の合計、グループ全体総額、計算途中の小計、施設費/高速代/引率代などの内訳、他者へ最終的に渡る総額はpayments.amountにしないでください。" +
    "『1人あたり○円』『あなたの分は○円』『○円お願いします』『○円支払ってください』のような表現がある場合は、その金額を本人の支払額として最優先してください。" +
    "例として『合計7240円、2人で割ると1人3620円、丹下までPayPay』ならpaymentsは3620円を採用し、7240円は採用しないでください。" +
    "個人練習では参加費・施設費・高速代・引率代などの内訳をpaymentsの別明細に分割せず、最終的な1人分請求額のみを『個人練習代』として抽出してください。" +
    "本文に個人練習の明記がなくても、人数按分・施設費・高速代・引率代・指導料などの内訳から1人あたり最終金額を案内している構造なら、payments.typeは『個人練習代』として抽出してください。" +
    "個人練習の請求額訂正で差額支払いが本文に明示される場合のみ『個人練習差額』を抽出し、本文に明示がない差額を自動計算して作成しないでください。" +
    "『高速往復』『志村さんへ渡す金額』などは料金計算や最終受取先の説明であり、車同乗代の根拠にはなりません。" +
    "通常練習の片道100円ルールに明示的に該当しない限り、車同乗代を作成しないでください。" +
    "個人練習では通常練習用の車同乗代100円やバス引率代100円をpaymentsとして作成しないでください。" +
    "payments.payeeは『○○までお願いします』『○○さんへ支払ってください』『○○へPayPay』など、ユーザー本人が直接支払う相手を優先して抽出してください。" +
    "『志村さんにお渡しする金額』のような計算説明だけではpayeeを志村さんにしないでください。" +
    "payments.payment_methodには本文で明示された支払方法（PayPay/現金/振込/その他の具体記載）を入れ、明示がない場合はnullにしてください。";

  const userPrompt = JSON.stringify(
    {
      source_name: sourceLabel,
      current_date_japan: currentDateJst,
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

async function replyUnpaidList(
  replyToken: string,
  env: Env
): Promise<{ totalCount: number; displayedCount: number; lineStatus?: number }> {
  console.log({ stage: "unpaid_list_start" });
  const unpaid = await getUnifiedUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
  console.log({
    stage: "unpaid_list_success",
    unpaidCount: unpaid.totalCount,
    displayedCount: unpaid.payments.length
  });

  console.log({ stage: "line_reply_start" });
  const lineStatus = await replyMessages(
    replyToken,
    [buildUnpaidListMessage(unpaid.payments, unpaid.totalCount)],
    env.LINE_CHANNEL_ACCESS_TOKEN
  );
  if (typeof lineStatus === "number") {
    console.log({ stage: "line_reply_success", status: lineStatus });
  }
  return {
    totalCount: unpaid.totalCount,
    displayedCount: unpaid.payments.length,
    lineStatus
  };
}

async function handleMarkPaidPostback(
  event: LineWebhookEvent,
  env: Env,
  paymentIdRaw: string | null,
  paymentKindRaw: string | null
): Promise<void> {
  if (!event.replyToken) {
    return;
  }

  console.log({ stage: "mark_paid_start" });
  const paymentId = parsePositiveInt(paymentIdRaw);
  if (!paymentId) {
    console.log({ stage: "mark_paid_success", updated: false });
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: "該当する支払いが見つかりませんでした。" }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  const paymentKind = paymentKindRaw === "monthly" ? "monthly" : "event";
  if (paymentKind === "monthly") {
    const markResult = await markMonthlyPaymentPaid(env.DB, paymentId);
    console.log({ stage: "mark_paid_success", updated: markResult.outcome === "updated" });

    if (markResult.outcome === "not_found") {
      console.log({ stage: "line_reply_start" });
      const lineStatus = await replyMessages(
        event.replyToken,
        [{ type: "text", text: "該当する支払いが見つかりませんでした。" }],
        env.LINE_CHANNEL_ACCESS_TOKEN
      );
      if (typeof lineStatus === "number") {
        console.log({ stage: "line_reply_success", status: lineStatus });
        console.log({ stage: "background_processing_complete" });
      }
      return;
    }

    if (markResult.outcome === "already_paid") {
      console.log({ stage: "unpaid_list_start" });
      const unpaid = await getUnifiedUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
      console.log({
        stage: "unpaid_list_success",
        unpaidCount: unpaid.totalCount,
        displayedCount: unpaid.payments.length
      });
      const messages: LineReplyMessage[] = [{ type: "text", text: "この支払いはすでに支払済みです。" }];
      messages.push(buildUnpaidListMessage(unpaid.payments, unpaid.totalCount));
      console.log({ stage: "line_reply_start" });
      const lineStatus = await replyMessages(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
      if (typeof lineStatus === "number") {
        console.log({ stage: "line_reply_success", status: lineStatus });
        console.log({ stage: "background_processing_complete" });
      }
      return;
    }

    console.log({ stage: "unpaid_list_start" });
    const unpaid = await getUnifiedUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
    console.log({
      stage: "unpaid_list_success",
      unpaidCount: unpaid.totalCount,
      displayedCount: unpaid.payments.length
    });
    const messages: LineReplyMessage[] = [];
    if (markResult.payment) {
      messages.push({
        type: "text",
        text: buildPaidConfirmationMessage({
          payment_kind: "monthly",
          id: markResult.payment.id,
          billing_month: markResult.payment.billing_month,
          monthly_type: markResult.payment.monthly_type,
          amount: markResult.payment.amount,
          payee: markResult.payment.payee,
          due_date: markResult.payment.due_date,
          payment_method: markResult.payment.payment_method,
          breakdown_text: null,
          sort_date: markResult.payment.due_date ?? `${markResult.payment.billing_month}-99`
        })
      });
    } else {
      messages.push({ type: "text", text: "支払済みにしました。" });
    }
    messages.push(buildUnpaidListMessage(unpaid.payments, unpaid.totalCount));
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  const markResult = await markEventPaymentPaid(env.DB, paymentId);
  console.log({ stage: "mark_paid_success", updated: markResult.outcome === "updated" });

  if (markResult.outcome === "not_found") {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: "該当する支払いが見つかりませんでした。" }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  if (markResult.outcome === "voided") {
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: "この支払いは現在の配車では不要になっています。" }],
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  if (markResult.outcome === "already_paid") {
    console.log({ stage: "unpaid_list_start" });
    const unpaid = await getUnifiedUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
    console.log({
      stage: "unpaid_list_success",
      unpaidCount: unpaid.totalCount,
      displayedCount: unpaid.payments.length
    });

    const messages: LineReplyMessage[] = [{ type: "text", text: "この支払いはすでに支払済みです。" }];
    messages.push(buildUnpaidListMessage(unpaid.payments, unpaid.totalCount));

    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
    if (typeof lineStatus === "number") {
      console.log({ stage: "line_reply_success", status: lineStatus });
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

  console.log({ stage: "unpaid_list_start" });
  const unpaid = await getUnifiedUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
  console.log({
    stage: "unpaid_list_success",
    unpaidCount: unpaid.totalCount,
    displayedCount: unpaid.payments.length
  });

  const messages: LineReplyMessage[] = [];
  if (markResult.payment) {
    messages.push({
      type: "text",
      text: buildPaidConfirmationMessage({
        payment_kind: "event",
        id: markResult.payment.id,
        practice_date: markResult.payment.practice_date,
        payment_type: markResult.payment.payment_type,
        amount: markResult.payment.amount,
        payee: markResult.payment.payee,
        due_date: markResult.payment.due_date,
        payment_method: markResult.payment.payment_method,
        sort_date: markResult.payment.due_date ?? markResult.payment.practice_date
      })
    });
  } else {
    messages.push({ type: "text", text: "支払済みにしました。" });
  }
  messages.push(buildUnpaidListMessage(unpaid.payments, unpaid.totalCount));

  console.log({ stage: "line_reply_start" });
  const lineStatus = await replyMessages(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
  if (typeof lineStatus === "number") {
    console.log({ stage: "line_reply_success", status: lineStatus });
    console.log({ stage: "background_processing_complete" });
  }
}

async function handlePostbackEvent(event: LineWebhookEvent, env: Env): Promise<void> {
  if (!event.replyToken) {
    return;
  }

  const postbackData = event.postback?.data ?? "";
  const params = new URLSearchParams(postbackData);
  const action = params.get("action");
  if (action === "mark_paid") {
    await handleMarkPaidPostback(event, env, params.get("payment_id"), params.get("payment_kind"));
    return;
  }

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
  if (UNPAID_COMMANDS.has(inputText)) {
    const replyResult = await replyUnpaidList(event.replyToken, env);
    if (typeof replyResult.lineStatus === "number") {
      console.log({ stage: "background_processing_complete" });
    }
    return;
  }

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

  const contactCommand = parseRuiContactCommand(inputText, event.timestamp ?? Date.now());
  if (contactCommand) {
    const userId = event.source?.userId;
    if (!userId) {
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
    const selectedSourceId = await env.STATE.get(selectedSourceKey(userId));
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
    const contactText = await buildRuiContactMessage(
      env.DB,
      sourceLabel,
      contactCommand.dates,
      contactCommand.labels
    );
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      [{ type: "text", text: contactText }],
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
  const textTimestamp = event.timestamp ?? Date.now();
  const imageDataUrl = await resolvePairedImageDataUrlForTextEvent(env, userId, textTimestamp);

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
    const receivedAtMs = event.timestamp ?? Date.now();
    const receivedAtIso = new Date(receivedAtMs).toISOString();
    const parsed = await callOpenAIForStructuredResult(
      inputText,
      sourceLabel,
      receivedAtIso,
      imageDataUrl,
      env
    );
    console.log({
      stage: "openai_structured_result",
      message_kind: parsed.message_kind,
      practice_date: parsed.practice_date,
      practice_type: parsed.practice_type,
      practice_type_basis: parsed.practice_type_basis,
      payments: parsed.payments.map((payment) => ({
        type: payment.type,
        amount: payment.amount,
        payee: payment.payee,
        payment_method: payment.payment_method
      }))
    });
    const resolved = await resolvePracticeContext(env, selectedSourceId, userId, parsed, receivedAtMs);
    console.log({
      stage: "context_resolved",
      resolved_practice_date: resolved.resolvedPracticeDate,
      resolved_practice_type: resolved.resolvedPracticeType,
      resolved_basis: {
        date: resolved.dateBasis,
        type: resolved.typeBasis
      }
    });
    const resolvedTypeMeta = resolvedTypeBasisToPracticeTypeBasis(resolved.typeBasis);
    const resolvedExtractionBasis: PracticeTypeExtractionBasis =
      resolved.typeBasis === "explicit_message" || resolved.typeBasis === "message_pair"
        ? "explicit"
        : resolved.typeBasis === "unknown"
          ? "unknown"
          : "inferred";
    const combinedUncertainPoints = [...parsed.uncertain_points, ...resolved.addedUncertainPoints];
    const reconciledDateUncertainty = reconcileDateResolutionUncertainty({
      resolvedPracticeDate: resolved.resolvedPracticeDate,
      uncertainPoints: combinedUncertainPoints,
      parsedNeedsConfirmation: parsed.needs_confirmation,
      resolvedNeedsConfirmation: resolved.needsConfirmation
    });
    const contextResolvedResult: StructuredLineResult = {
      ...parsed,
      practice_date: resolved.resolvedPracticeDate,
      practice_type: resolved.resolvedPracticeType,
      practice_type_basis: resolvedExtractionBasis,
      practice_type_evidence: resolvedExtractionBasis === "explicit" ? parsed.practice_type_evidence : null,
      uncertain_points: reconciledDateUncertainty.uncertainPoints,
      needs_confirmation: reconciledDateUncertainty.needsConfirmation
    };
    const busGuideTextFallbackApplied = applyReturnBusGuideTextFallback(contextResolvedResult, inputText);

    const existingPracticeForResolvedDate = resolved.resolvedPracticeDate
      ? await getPracticeByDate(env.DB, resolved.resolvedPracticeDate)
      : null;
    const transportApplied = applyPersonalPracticeStandardTransport(
      busGuideTextFallbackApplied,
      resolved.resolvedPracticeType,
      existingPracticeForResolvedDate
    );
    const standingApplied = applyStandingPaymentRules(transportApplied.result, {
      resolvedPracticeType: resolved.resolvedPracticeType,
      practiceTypeBasis: resolvedTypeMeta.basis,
      practiceTypePriority: resolvedTypeMeta.priority
    });
    console.log({
      stage: "message_classification_resolved",
      messageKind: standingApplied.result.message_kind,
      openAiPracticeType: parsed.practice_type,
      resolvedPracticeType: standingApplied.resolvedPracticeType,
      resolvedPracticeDate: resolved.resolvedPracticeDate,
      dateBasis: resolved.dateBasis,
      typeBasis: resolved.typeBasis,
      defaultOutboundApplied: transportApplied.appliedOutbound,
      defaultReturnApplied: transportApplied.appliedReturn
    });
    console.log({
      stage: "standing_payment_rules_applied",
      messageKind: standingApplied.result.message_kind,
      practiceType: standingApplied.resolvedPracticeType,
      addedPaymentCount: standingApplied.addedPaymentCount
    });

    console.log({ stage: "d1_save_start" });
    let saveResult: SaveStructuredResultOutcome = {
      practiceSaved: false,
      paymentCount: 0,
      reviewWarnings: [],
      savedMonthlyCharges: []
    };
    try {
      saveResult = await saveStructuredResultToD1(
        env,
        sourceLabel,
        standingApplied.result,
        resolvedTypeMeta.basis,
        resolvedTypeMeta.priority
      );
      console.log({
        stage: "d1_save_success",
        practiceSaved: saveResult.practiceSaved,
        paymentCount: saveResult.paymentCount
      });
    } catch (error) {
      const errorType = error instanceof Error ? error.name : "unknown";
      console.error("D1 save failed", { errorType });
    }

    let replyResult: StructuredLineResult = standingApplied.result;
    if (standingApplied.result.practice_date && standingApplied.resolvedPracticeType === "個人練習") {
      const activePersonalPayments = await getActiveUnpaidPersonalPracticePaymentsForPractice(
        env.DB,
        standingApplied.result.practice_date
      );
      replyResult = {
        ...standingApplied.result,
        payments: activePersonalPayments
      };
    } else if (
      isDispatchOrChangeKind(standingApplied.result.message_kind) &&
      standingApplied.result.practice_date
    ) {
      const activeEventPayments = await getActiveUnpaidEventPaymentsForPractice(
        env.DB,
        standingApplied.result.practice_date
      );
      replyResult = {
        ...standingApplied.result,
        payments: activeEventPayments
      };
    }

    const formatted = formatStructuredResultForLine(sourceLabel, replyResult);
    const messages: LineReplyMessage[] = [{ type: "text", text: formatted }];
    if (saveResult.savedMonthlyCharges.length > 0) {
      messages.push({
        type: "text",
        text: formatMonthlyChargeSavedMessage(saveResult.savedMonthlyCharges)
      });
    }
    if (saveResult.reviewWarnings.length > 0) {
      messages.push({ type: "text", text: saveResult.reviewWarnings[0] });
    }

    if (standingApplied.result.practice_date && standingApplied.resolvedPracticeType !== "不明") {
      try {
        await saveRecentPracticeContext(
          env,
          userId,
          selectedSourceId,
          standingApplied.result.practice_date,
          standingApplied.resolvedPracticeType,
          receivedAtMs
        );
      } catch {
        // Context cache failure should not block normal reply/save flow.
      }
    }
    console.log({ stage: "line_reply_start" });
    const lineStatus = await replyMessages(
      event.replyToken,
      messages,
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
  await maybeSetOwnerLineUserId(event, env);
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
          const errorMessage = error instanceof Error ? error.message : "unknown";
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error("Background event processing failed", {
            eventType: event.type,
            errorType,
            errorMessage,
            errorStack
          });
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
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      handlePaymentReminderScheduled(controller, env).catch((error) => {
        const errorType = error instanceof Error ? error.name : "unknown";
        console.error("Payment reminder scheduled failed", { errorType });
      })
    );
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

export const TEST_HOOKS = {
  applyStandingPaymentRules,
  applyPersonalPracticeStandardTransport,
  applyReturnBusGuideTextFallback,
  reconcileDateResolutionUncertainty,
  parseRuiContactCommand,
  buildRuiContactMessage,
  resolvePairedImageDataUrlForTextEvent,
  resolvePracticeContext,
  saveRecentPracticeContext,
  loadRecentPracticeContext,
  saveStructuredResultToD1,
  getUnifiedUnpaidPayments,
  markEventPaymentPaid,
  markMonthlyPaymentPaid,
  getReminderTargets,
  getMonthlyReminderTargets,
  handleMarkPaidPostback,
  handlePaymentReminderScheduled
};
