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
const OPENAI_MODEL = "gpt-5.6-luna";
const PAIR_WINDOW_MS = 5000;
const PAIR_WAIT_MS = 1200;
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
type PaymentType = "参加費" | "車同乗代" | "バス引率代" | "見守り代" | "志村さん車代" | "その他";
type MessageKind =
  | "schedule"
  | "dispatch_candidate"
  | "dispatch_confirmed"
  | "same_day_change"
  | "accounting_notice"
  | "general_rule"
  | "other";
type PracticeType = "通常練習" | "個人練習" | "不明";

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
  status: PaymentStatus;
};

type ReminderPaymentRow = {
  id: number;
  practice_date: string;
  payment_type: string;
  amount: number | null;
  payee: string | null;
  due_date: string | null;
  status: PaymentStatus;
  reminder_sent_on: string | null;
};

type PracticeTypeBasis = "explicit" | "weekday_default" | "unknown";

type PracticeRow = {
  practice_date: string;
  attendance: Attendance;
  outbound_type: TransportType;
  outbound_person: string | null;
  return_type: TransportType;
  return_person: string | null;
  bus_guide: string | null;
  source: string;
  notes: string | null;
  practice_type: PracticeType | null;
  practice_type_basis: PracticeTypeBasis | null;
  practice_type_priority: number | null;
  attendance_priority: number | null;
  outbound_priority: number | null;
  return_priority: number | null;
  bus_guide_priority: number | null;
  last_message_kind: MessageKind | null;
};

type SaveStructuredResultOutcome = {
  practiceSaved: boolean;
  paymentCount: number;
  reviewWarnings: string[];
};

type StructuredLineResult = {
  message_kind: MessageKind;
  practice_type: PracticeType;
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
    "message_kind",
    "practice_type",
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
  basis: PracticeTypeBasis;
  priority: number;
} {
  if (result.practice_type !== "不明") {
    return {
      practiceType: result.practice_type,
      basis: "explicit",
      priority: 1000
    };
  }
  const inferred = inferPracticeTypeByWeekday(result.practice_date);
  if (inferred !== "不明") {
    return {
      practiceType: inferred,
      basis: "weekday_default",
      priority: 100
    };
  }
  return {
    practiceType: "不明",
    basis: "unknown",
    priority: 0
  };
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

function buildStandingRuleEventCandidates(
  result: StructuredLineResult,
  resolvedPracticeType: PracticeType
): PaymentForStorage[] {
  const candidates: PaymentForStorage[] = [];
  const eligibleMessageKind =
    result.message_kind === "dispatch_confirmed" || result.message_kind === "same_day_change";
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
      billing_scope: "event",
      direction: "return"
    });
  }
  if (result.return_transport.type === "バス" && result.bus_guide !== null) {
    candidates.push({
      type: "バス引率代",
      amount: 100,
      payee: result.bus_guide,
      due_date: null,
      billing_scope: "event",
      direction: "return"
    });
  }
  return candidates;
}

function applyStandingPaymentRules(
  result: StructuredLineResult
): {
  result: StructuredLineResult;
  addedPaymentCount: number;
  resolvedPracticeType: PracticeType;
  practiceTypeBasis: PracticeTypeBasis;
  practiceTypePriority: number;
} {
  const resolvedPractice = resolvePracticeType(result);
  const resolvedPracticeType = resolvedPractice.practiceType;
  const basePayments = shouldDropAiPayments(result.message_kind) ? [] : [...result.payments];
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
      due_date: candidate.due_date
    });
    usedAdditionalCounts.set(key, currentAdded + 1);
    addedPaymentCount += 1;
  }

  return {
    result: {
      ...result,
      practice_type: resolvedPracticeType,
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
  return lines;
}

function buildUnpaidListMessage(payments: UnpaidPaymentRow[], totalCount: number): LineReplyMessage {
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
    lines.push(...buildPaymentItemLine(payment, index));
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

function buildPaidConfirmationMessage(payment: UnpaidPaymentRow): string {
  const amountPart = typeof payment.amount === "number" ? ` ${payment.amount}円` : "";
  const lines = ["支払済みにしました。", "", `${formatDateForLine(payment.practice_date)} ${payment.payment_type}${amountPart}`];
  if (payment.payee) {
    lines.push(`支払先：${payment.payee}`);
  }
  return lines.join("\n");
}

function buildMarkPaidQuickReplyItems(payments: Array<{ id: number }>, maxItems: number): NonNullable<
  LineReplyMessage["quickReply"]
>["items"] {
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return payments.slice(0, maxItems).map((payment, index) => ({
    type: "action",
    action: {
      type: "postback",
      label: `${circledNumbers[index] ?? `${index + 1}.`} 支払済みにする`,
      data: `action=mark_paid&payment_id=${payment.id}`,
      displayText: `${circledNumbers[index] ?? `${index + 1}.`} 支払済みにする`
    }
  }));
}

function formatReminderMessage(payments: ReminderPaymentRow[]): LineReplyMessage {
  const displayed = payments.slice(0, MAX_REMINDER_DISPLAY_COUNT);
  const lines: string[] = ["お支払いリマインド", "", "今日お支払い予定のものがあります。", ""];
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

  if (payments.length > displayed.length) {
    lines.push(`対象は${payments.length}件あります。先頭${displayed.length}件を表示しています。`, "");
  }

  displayed.forEach((payment, index) => {
    const marker = circledNumbers[index] ?? `${index + 1}.`;
    const amountPart = typeof payment.amount === "number" ? ` ${payment.amount}円` : "";
    lines.push(`${marker} ${formatDateForLine(payment.practice_date)} ${payment.payment_type}${amountPart}`);
    if (payment.payee) {
      lines.push(`　支払先：${payment.payee}`);
    }
    if (payment.due_date) {
      lines.push(`　期限：${formatDateForLine(payment.due_date)}`);
    }
    lines.push("");
  });

  lines.push("「未払い」と送ると、支払済みにできます。");

  const quickReplyItems = buildMarkPaidQuickReplyItems(displayed, MAX_REMINDER_QUICK_REPLY_COUNT);
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

async function getUnpaidPayments(
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

async function markPaymentPaid(
  db: D1Database,
  paymentId: number
): Promise<{ outcome: "updated" | "already_paid" | "not_found" | "voided"; payment?: UnpaidPaymentRow }> {
  const payment = await db
    .prepare(
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status
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
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status
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

async function getReminderTargets(
  db: D1Database,
  todayJst: string,
  yesterdayJst: string
): Promise<ReminderPaymentRow[]> {
  const result = await db
    .prepare(
      `SELECT id, practice_date, payment_type, amount, payee, due_date, status, reminder_sent_on
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

  const targets = await getReminderTargets(env.DB, todayJst, yesterdayJst);
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
    targets.map((target) => target.id),
    todayJst
  );
  console.log({ stage: "payment_reminder_marked_sent", updatedCount });
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
  return {
    message_kind: "dispatch_confirmed",
    practice_type: practice.practice_type ?? "不明",
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
    payments: [],
    notes: practice.notes,
    needs_confirmation: false,
    uncertain_points: []
  };
}

async function getPracticeByDate(db: D1Database, practiceDate: string): Promise<PracticeRow | null> {
  const row = await db
    .prepare(
      `SELECT practice_date, attendance, outbound_type, outbound_person, return_type, return_person, bus_guide, source, notes,
              practice_type, practice_type_basis, practice_type_priority, attendance_priority, outbound_priority, return_priority,
              bus_guide_priority, last_message_kind
       FROM practices
       WHERE practice_date = ?1
       LIMIT 1`
    )
    .bind(practiceDate)
    .first<PracticeRow>();
  return row ?? null;
}

async function savePracticeToD1(
  env: Env,
  sourceLabel: string,
  result: StructuredLineResult,
  practiceTypeBasis: PracticeTypeBasis,
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
    source: sourceLabel,
    notes: null,
    practice_type: "不明",
    practice_type_basis: "unknown",
    practice_type_priority: 0,
    attendance_priority: 0,
    outbound_priority: 0,
    return_priority: 0,
    bus_guide_priority: 0,
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
  } else if (isConcreteText(result.bus_guide) && messagePriorityValue >= busGuidePriority) {
    busGuide = result.bus_guide;
    busGuidePriority = messagePriorityValue;
    shouldReconcileEventPayments = true;
  }

  if (isConcreteText(result.notes)) {
    notes = result.notes;
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
      source,
      notes,
      practice_type,
      practice_type_basis,
      practice_type_priority,
      attendance_priority,
      outbound_priority,
      return_priority,
      bus_guide_priority,
      last_message_kind,
      created_at,
      updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)
    ON CONFLICT(practice_date) DO UPDATE SET
      attendance = excluded.attendance,
      outbound_type = excluded.outbound_type,
      outbound_person = excluded.outbound_person,
      return_type = excluded.return_type,
      return_person = excluded.return_person,
      bus_guide = excluded.bus_guide,
      source = excluded.source,
      notes = excluded.notes,
      practice_type = excluded.practice_type,
      practice_type_basis = excluded.practice_type_basis,
      practice_type_priority = excluded.practice_type_priority,
      attendance_priority = excluded.attendance_priority,
      outbound_priority = excluded.outbound_priority,
      return_priority = excluded.return_priority,
      bus_guide_priority = excluded.bus_guide_priority,
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
      sourceLabel,
      notes,
      practiceType,
      storedPracticeTypeBasis,
      storedPracticeTypePriority,
      attendancePriority,
      outboundPriority,
      returnPriority,
      busGuidePriority,
      result.message_kind,
      now
    )
    .run();

  return {
    practiceSaved: true,
    shouldReconcileEventPayments: shouldReconcileEventPayments && isDispatchOrChangeKind(result.message_kind),
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

  const existingRows = await env.DB
    .prepare(
      `SELECT id, payment_type, amount, payee, due_date, status, direction, rule_key, voided_at, needs_review
       FROM payments
       WHERE practice_date = ?1
         AND billing_scope = 'event'
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
    }>();

  const existing = existingRows.results ?? [];
  const matchedIds = new Set<number>();
  const reviewWarnings: string[] = [];

  for (const expectedPayment of expected) {
    if (!expectedPayment.rule_key) {
      continue;
    }
    const expectedWithRuleKey = {
      ...expectedPayment,
      rule_key: expectedPayment.rule_key
    };

    const activeMatch = existing.find(
      (row) => row.voided_at === null && paymentMatchesExpected(row, expectedWithRuleKey)
    );
    if (activeMatch) {
      matchedIds.add(activeMatch.id);
      if (activeMatch.needs_review === 1) {
        await env.DB.prepare(
          `UPDATE payments
           SET needs_review = 0,
               review_reason = NULL,
               updated_at = ?1
           WHERE id = ?2`
        )
          .bind(now, activeMatch.id)
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
             needs_review = 0,
             review_reason = NULL,
             source = ?1,
             updated_at = ?2
         WHERE id = ?3`
      )
        .bind(sourceLabel, now, voidedReusable.id)
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
        needs_review
      ) VALUES (?1, ?2, ?3, ?4, NULL, 'unpaid', 'event', ?5, ?6, ?7, ?8, ?8, 0)`
    )
      .bind(
        practice.practice_date,
        expectedPayment.type,
        expectedPayment.amount,
        expectedPayment.payee,
        expectedPayment.direction,
        expectedPayment.rule_key,
        sourceLabel,
        now
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
           source = ?2,
           updated_at = ?3
       WHERE id = ?4`
    )
      .bind(payment.due_date, sourceLabel, now, existing.id)
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
      status,
      billing_scope,
      direction,
      source,
      created_at,
      updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, 'unpaid', ?6, ?7, ?8, ?9, ?9)`
  )
    .bind(
      practiceDate,
      payment.type,
      payment.amount,
      payment.payee,
      payment.due_date,
      payment.billing_scope,
      payment.direction,
      sourceLabel,
      now
    )
    .run();
}

async function saveStructuredResultToD1(
  env: Env,
  sourceLabel: string,
  result: StructuredLineResult,
  practiceTypeBasis: PracticeTypeBasis,
  practiceTypePriority: number
): Promise<SaveStructuredResultOutcome> {
  const practiceSave = await savePracticeToD1(env, sourceLabel, result, practiceTypeBasis, practiceTypePriority);
  if (!result.practice_date) {
    return { practiceSaved: practiceSave.practiceSaved, paymentCount: 0, reviewWarnings: [] };
  }

  const latestPractice = await getPracticeByDate(env.DB, result.practice_date);
  if (!latestPractice) {
    return { practiceSaved: practiceSave.practiceSaved, paymentCount: 0, reviewWarnings: [] };
  }

  const paymentsForStorage = mapPaymentsForStorage(result);
  const paymentsToUpsert = isDispatchOrChangeKind(result.message_kind)
    ? paymentsForStorage.filter((payment) => payment.billing_scope !== "event")
    : paymentsForStorage;
  for (const payment of paymentsToUpsert) {
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
      reviewWarnings: []
    };
  }

  const reconciliation = await reconcileEventPayments(env, latestPractice, sourceLabel);
  return {
    practiceSaved: practiceSave.practiceSaved,
    paymentCount: reconciliation.paymentCount,
    reviewWarnings: reconciliation.reviewWarnings
  };
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
    "message_kindは必須で、schedule/dispatch_candidate/dispatch_confirmed/same_day_change/accounting_notice/general_rule/otherのどれかを返してください。" +
    "scheduleは参加予定、dispatch_candidateは配車候補、dispatch_confirmedは確定配車、same_day_changeは当日含む変更連絡、" +
    "accounting_noticeは会計・請求連絡、general_ruleは恒常ルール、otherはその他です。" +
    "practice_typeは必須で、本文や画像に明示がある場合のみ通常練習または個人練習を返し、明示がなければ不明にしてください。" +
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
    "そのような全体向け条件情報は必要ならnotesへ記載し、本人に適用されない条件付き支払い・引率に関する不明点をuncertain_pointsへ追加しないでください。" +
    "dispatch_candidateでは『車出し可能』『引率可能』を本人確定配車として扱わないでください。" +
    "『帰りバス引率は藤田さん』等の一般情報だけで本人のreturn_transportを確定しないでください。" +
    "『100円』という金額だけで見守り代や他のpayment_typeを推測しないでください。見守り代は『見守り代』と明記がある場合のみ抽出してください。";

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

async function replyUnpaidList(
  replyToken: string,
  env: Env
): Promise<{ totalCount: number; displayedCount: number; lineStatus?: number }> {
  console.log({ stage: "unpaid_list_start" });
  const unpaid = await getUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
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

async function handleMarkPaidPostback(event: LineWebhookEvent, env: Env, paymentIdRaw: string | null): Promise<void> {
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

  const markResult = await markPaymentPaid(env.DB, paymentId);
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
    const unpaid = await getUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
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
  const unpaid = await getUnpaidPayments(env.DB, MAX_UNPAID_DISPLAY_COUNT);
  console.log({
    stage: "unpaid_list_success",
    unpaidCount: unpaid.totalCount,
    displayedCount: unpaid.payments.length
  });

  const messages: LineReplyMessage[] = [];
  if (markResult.payment) {
    messages.push({ type: "text", text: buildPaidConfirmationMessage(markResult.payment) });
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
    await handleMarkPaidPostback(event, env, params.get("payment_id"));
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
    const parsed = await callOpenAIForStructuredResult(
      inputText,
      sourceLabel,
      receivedAtIso,
      imageDataUrl,
      env
    );
    const standingApplied = applyStandingPaymentRules(parsed);
    console.log({
      stage: "message_classification_resolved",
      messageKind: standingApplied.result.message_kind,
      openAiPracticeType: parsed.practice_type,
      resolvedPracticeType: standingApplied.resolvedPracticeType
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
      reviewWarnings: []
    };
    try {
      saveResult = await saveStructuredResultToD1(
        env,
        sourceLabel,
        standingApplied.result,
        standingApplied.practiceTypeBasis,
        standingApplied.practiceTypePriority
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

    const formatted = formatStructuredResultForLine(sourceLabel, standingApplied.result);
    const messages: LineReplyMessage[] = [{ type: "text", text: formatted }];
    if (saveResult.reviewWarnings.length > 0) {
      messages.push({ type: "text", text: saveResult.reviewWarnings[0] });
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
