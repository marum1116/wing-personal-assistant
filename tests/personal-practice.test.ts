import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { TEST_HOOKS } from "../src/index";

type D1Result = { meta: { changes: number; last_row_id?: number } };

class MockPreparedStatement {
  private boundValues: unknown[] = [];

  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string
  ) {}

  bind(...values: unknown[]): MockPreparedStatement {
    this.boundValues = values;
    return this;
  }

  async run(): Promise<D1Result> {
    const stmt = this.db.prepare(this.sql);
    const result = stmt.run(...this.boundValues);
    return {
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: typeof result.lastInsertRowid === "number" ? result.lastInsertRowid : undefined
      }
    };
  }

  async first<T>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.boundValues) as T | undefined;
    return row ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...this.boundValues) as T[];
    return { results: rows };
  }
}

class MockD1Database {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string): MockPreparedStatement {
    return new MockPreparedStatement(this.db, sql);
  }

  async batch(statements: MockPreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }
}

class MockKvNamespace {
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
    this.map.set(key, value);
  }
}

function createTestEnv() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_date TEXT NOT NULL UNIQUE,
      attendance TEXT NOT NULL,
      outbound_type TEXT NOT NULL,
      outbound_person TEXT,
      return_type TEXT NOT NULL,
      return_person TEXT,
      bus_guide TEXT,
      source TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      practice_type TEXT,
      practice_type_basis TEXT,
      practice_type_priority INTEGER NOT NULL DEFAULT 0,
      attendance_priority INTEGER NOT NULL DEFAULT 0,
      outbound_priority INTEGER NOT NULL DEFAULT 0,
      return_priority INTEGER NOT NULL DEFAULT 0,
      bus_guide_priority INTEGER NOT NULL DEFAULT 0,
      last_message_kind TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_date TEXT NOT NULL,
      payment_type TEXT NOT NULL,
      amount INTEGER,
      payee TEXT,
      due_date TEXT,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'unpaid',
      billing_scope TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'none',
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reminder_sent_on TEXT,
      rule_key TEXT,
      voided_at TEXT,
      needs_review INTEGER NOT NULL DEFAULT 0,
      review_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS monthly_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billing_month TEXT NOT NULL,
      monthly_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payee TEXT,
      due_date TEXT,
      payment_method TEXT,
      breakdown_text TEXT,
      status TEXT NOT NULL DEFAULT 'unpaid',
      source TEXT NOT NULL,
      reminder_sent_on TEXT,
      needs_review INTEGER NOT NULL DEFAULT 0,
      review_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (billing_month, monthly_type)
    );
  `);

  return {
    raw: sqlite,
    env: {
      DB: new MockD1Database(sqlite),
      STATE: new MockKvNamespace()
    } as any
  };
}

function baseResult(overrides: Record<string, unknown>) {
  return {
    message_kind: "accounting_notice",
    practice_type: "不明",
    practice_type_basis: "unknown",
    practice_type_evidence: null,
    monthly_charges: [],
    practice_date: "2026-08-01",
    attendance: "参加",
    outbound_transport: { type: "不明", person: null },
    return_transport: { type: "不明", person: null },
    bus_guide: null,
    payments: [],
    notes: null,
    needs_confirmation: false,
    uncertain_points: [],
    ...overrides
  };
}

async function main() {
  const { raw, env } = createTestEnv();
  const hooks = TEST_HOOKS;
  const sourceId = "wing" as const;
  const userId = "test-user";

  // Pairing Case A: take-nearestが正常nullでも本文処理継続相当（null返却）
  let pairingFetchCalled = false;
  const pairingAResult = await hooks.resolvePairedImageDataUrlForTextEvent(env, userId, Date.now(), {
    takeNearest: async () => null,
    fetchImageDataUrl: async () => {
      pairingFetchCalled = true;
      return "data:image/png;base64,unused";
    }
  });
  assert.equal(pairingAResult, null);
  assert.equal(pairingFetchCalled, false);

  // Pairing Case B: Pairing取得で例外でもfail-openでnull返却
  const pairingBResult = await hooks.resolvePairedImageDataUrlForTextEvent(env, userId, Date.now(), {
    takeNearest: async () => {
      throw new Error("pairing fetch failed");
    },
    fetchImageDataUrl: async () => "data:image/png;base64,unused"
  });
  assert.equal(pairingBResult, null);

  // Pairing Case C: 画像ペアリング成功時は画像URLを利用
  const pairingCResult = await hooks.resolvePairedImageDataUrlForTextEvent(env, userId, Date.now(), {
    takeNearest: async () => ({ messageId: "mid-1", timestamp: Date.now() }),
    fetchImageDataUrl: async (messageId: string) => `data:image/png;base64,${messageId}`
  });
  assert.equal(pairingCResult, "data:image/png;base64,mid-1");

  // Requested Case A: 金曜日・種別明示なし・AI推測通常練習でも曜日ルール優先で個人練習
  const reqCaseA = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "req-a-user",
    baseResult({
      message_kind: "schedule",
      practice_date: "2026-08-14",
      practice_type: "通常練習",
      practice_type_basis: "inferred",
      practice_type_evidence: null,
      payments: []
    }) as any,
    Date.now()
  );
  assert.equal(reqCaseA.resolvedPracticeType, "個人練習");

  // Requested Case B: 月曜日・種別明示なし・AI推測個人練習でも曜日ルール優先で通常練習
  const reqCaseB = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "req-b-user",
    baseResult({
      message_kind: "schedule",
      practice_date: "2026-08-10",
      practice_type: "個人練習",
      practice_type_basis: "inferred",
      practice_type_evidence: null,
      payments: []
    }) as any,
    Date.now()
  );
  assert.equal(reqCaseB.resolvedPracticeType, "通常練習");

  // Requested Case C: 月曜日でも本文明示個人練習なら個人練習を優先
  const reqCaseC = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "req-c-user",
    baseResult({
      message_kind: "schedule",
      practice_date: "2026-08-10",
      practice_type: "個人練習",
      practice_type_basis: "explicit",
      practice_type_evidence: "個人練習",
      payments: []
    }) as any,
    Date.now()
  );
  assert.equal(reqCaseC.resolvedPracticeType, "個人練習");

  // New Case 1: 個人練習の標準交通補完（交通記載なし）
  const case1Resolved = await hooks.resolvePracticeContext(
    env,
    sourceId,
    userId,
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-26",
      outbound_transport: { type: "不明", person: null },
      return_transport: { type: "不明", person: null },
      payments: []
    }) as any,
    Date.now()
  );
  assert.equal(case1Resolved.resolvedPracticeType, "個人練習");
  const case1TransportApplied = hooks.applyPersonalPracticeStandardTransport(
    {
      ...(baseResult({
        practice_type: "個人練習",
        practice_date: "2026-08-26",
        outbound_transport: { type: "不明", person: null },
        return_transport: { type: "不明", person: null },
        payments: []
      }) as any),
      practice_type: case1Resolved.resolvedPracticeType,
      practice_date: case1Resolved.resolvedPracticeDate
    },
    case1Resolved.resolvedPracticeType
  );
  assert.equal(case1TransportApplied.result.outbound_transport.type, "車");
  assert.equal(case1TransportApplied.result.outbound_transport.person, "志村さん");
  assert.equal(case1TransportApplied.result.return_transport.type, "車");
  assert.equal(case1TransportApplied.result.return_transport.person, "志村さん");
  const case1Standing = hooks.applyStandingPaymentRules(case1TransportApplied.result as any, {
    resolvedPracticeType: case1Resolved.resolvedPracticeType
  });
  assert.equal(case1Standing.addedPaymentCount, 0);

  // New Case 2: D1既存情報でpractice_typeを補完
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-27",
      payments: [{ type: "個人練習代", amount: 3000, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  const case2Parsed = baseResult({
    practice_type: "不明",
    practice_date: "2026-08-27",
    payments: [
      { type: "個人練習代", amount: 4040, payee: "丹下さん", due_date: null, payment_method: "PayPay" },
      { type: "その他", amount: 1234, payee: null, due_date: null, payment_method: null }
    ]
  }) as any;
  const case2Resolved = await hooks.resolvePracticeContext(env, sourceId, userId, case2Parsed, Date.now());
  assert.equal(case2Resolved.resolvedPracticeType, "個人練習");
  const case2Standing = hooks.applyStandingPaymentRules(
    {
      ...case2Parsed,
      practice_type: case2Resolved.resolvedPracticeType,
      practice_date: case2Resolved.resolvedPracticeDate
    },
    { resolvedPracticeType: case2Resolved.resolvedPracticeType }
  );
  assert.equal(case2Standing.result.payments.length, 1);
  assert.equal(case2Standing.result.payments[0]?.type, "個人練習代");

  // New Case 3: KV直前コンテキストで日付なし差額を解決
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-28",
      payments: [{ type: "個人練習代", amount: 3620, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
    }) as any,
    "explicit",
    40
  );
  await hooks.saveRecentPracticeContext(
    env,
    userId,
    sourceId,
    "2026-08-28",
    "個人練習",
    Date.now() - 5 * 60 * 1000
  );
  const case3ParsedNoDate = baseResult({
    practice_type: "不明",
    practice_date: null,
    payments: [{ type: "個人練習差額", amount: 420, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
  }) as any;
  const case3ResolvedNoDate = await hooks.resolvePracticeContext(
    env,
    sourceId,
    userId,
    case3ParsedNoDate,
    Date.now()
  );
  assert.equal(case3ResolvedNoDate.resolvedPracticeDate, "2026-08-28");
  assert.equal(case3ResolvedNoDate.resolvedPracticeType, "個人練習");
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    {
      ...case3ParsedNoDate,
      practice_date: case3ResolvedNoDate.resolvedPracticeDate,
      practice_type: case3ResolvedNoDate.resolvedPracticeType
    },
    "explicit",
    800
  );
  const case3Integrated = raw
    .prepare(
      "SELECT payment_type, amount, status, rule_key, payee, payment_method FROM payments WHERE practice_date='2026-08-28' ORDER BY id"
    )
    .all() as Array<{
      payment_type: string;
      amount: number;
      status: string;
      rule_key: string | null;
      payee: string | null;
      payment_method: string | null;
    }>;
  assert.equal(case3Integrated.length, 1);
  assert.equal(case3Integrated[0]?.payment_type, "個人練習代");
  assert.equal(case3Integrated[0]?.amount, 4040);
  assert.equal(case3Integrated[0]?.status, "unpaid");

  // New Case 4: コンテキストなしの日付なし料金は要確認
  const case4ResolvedNoContext = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "no-context-user",
    baseResult({
      practice_type: "不明",
      practice_date: null,
      payments: [{ type: "個人練習差額", amount: 420, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
    }) as any,
    Date.now()
  );
  assert.equal(case4ResolvedNoContext.resolvedPracticeDate, null);
  assert.equal(case4ResolvedNoContext.needsConfirmation, true);

  // New Case 5: 個人練習でも明示交通を優先（標準交通で上書きしない）
  const case5Transport = hooks.applyPersonalPracticeStandardTransport(
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-29",
      outbound_transport: { type: "バス", person: null },
      return_transport: { type: "車", person: "山田さん" },
      payments: []
    }) as any,
    "個人練習"
  );
  assert.equal(case5Transport.result.outbound_transport.type, "バス");
  assert.equal(case5Transport.result.return_transport.type, "車");
  assert.equal(case5Transport.result.return_transport.person, "山田さん");

  // Transport display: 既存D1交通を返信用resultへ反映
  const existingPracticeTransport = {
    practice_date: "2026-08-14",
    attendance: "参加",
    outbound_type: "車",
    outbound_person: "志村さん",
    return_type: "車",
    return_person: "志村さん",
    bus_guide: null,
    source: "羽魂練習会",
    notes: null,
    practice_type: "個人練習",
    practice_type_basis: "weekday_default",
    practice_type_priority: 700,
    attendance_priority: 0,
    outbound_priority: 0,
    return_priority: 0,
    bus_guide_priority: 0,
    last_message_kind: "schedule"
  } as const;
  const mergedFromExisting = hooks.applyPersonalPracticeStandardTransport(
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-14",
      outbound_transport: { type: "不明", person: null },
      return_transport: { type: "不明", person: null }
    }) as any,
    "個人練習",
    existingPracticeTransport as any
  );
  assert.equal(mergedFromExisting.result.outbound_transport.type, "車");
  assert.equal(mergedFromExisting.result.outbound_transport.person, "志村さん");
  assert.equal(mergedFromExisting.result.return_transport.type, "車");
  assert.equal(mergedFromExisting.result.return_transport.person, "志村さん");

  // Transport display: 今回明示交通は既存D1値で上書きしない
  const keepExplicitOverD1 = hooks.applyPersonalPracticeStandardTransport(
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-14",
      outbound_transport: { type: "バス", person: null },
      return_transport: { type: "車", person: "山田さん" }
    }) as any,
    "個人練習",
    existingPracticeTransport as any
  );
  assert.equal(keepExplicitOverD1.result.outbound_transport.type, "バス");
  assert.equal(keepExplicitOverD1.result.return_transport.type, "車");
  assert.equal(keepExplicitOverD1.result.return_transport.person, "山田さん");

  // Flip Case A: 料金系メッセージで既存個人練習を通常練習へ反転しない
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      message_kind: "dispatch_confirmed",
      practice_type: "個人練習",
      practice_date: "2026-10-01",
      outbound_transport: { type: "車", person: "志村さん" },
      return_transport: { type: "車", person: "志村さん" },
      payments: [{ type: "個人練習代", amount: 3000, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    1000
  );
  const flipAParsed = baseResult({
    message_kind: "accounting_notice",
    practice_type: "通常練習",
    practice_date: "2026-10-01",
    payments: [
      { type: "参加費", amount: 3620, payee: null, due_date: null, payment_method: "PayPay" },
      { type: "その他", amount: 3620, payee: null, due_date: null, payment_method: "PayPay" },
      { type: "個人練習代", amount: 3620, payee: "丹下さん", due_date: null, payment_method: "PayPay" }
    ]
  }) as any;
  const flipAResolved = await hooks.resolvePracticeContext(env, sourceId, userId, flipAParsed, Date.now());
  assert.equal(flipAResolved.resolvedPracticeType, "個人練習");
  const flipAStanding = hooks.applyStandingPaymentRules(
    {
      ...flipAParsed,
      practice_type: flipAResolved.resolvedPracticeType,
      practice_date: flipAResolved.resolvedPracticeDate
    },
    { resolvedPracticeType: flipAResolved.resolvedPracticeType }
  );
  assert.equal(flipAStanding.result.payments.length, 1);
  assert.equal(flipAStanding.result.payments[0]?.type, "個人練習代");
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    flipAStanding.result,
    "explicit",
    300
  );
  const flipAPractice = raw
    .prepare("SELECT practice_type FROM practices WHERE practice_date='2026-10-01' LIMIT 1")
    .get() as { practice_type: string };
  assert.equal(flipAPractice.practice_type, "個人練習");
  const flipAPayments = raw
    .prepare("SELECT payment_type, amount, rule_key FROM payments WHERE practice_date='2026-10-01' AND status='unpaid'")
    .all() as Array<{ payment_type: string; amount: number; rule_key: string | null }>;
  assert.ok(flipAPayments.some((row) => row.rule_key === "personal_practice_fee" && row.amount === 3620));
  assert.equal(flipAPayments.some((row) => row.payment_type === "参加費" || row.payment_type === "その他"), false);

  // Requested Case D: D1既存個人練習 + 後続AI inferred通常練習でも個人練習維持
  const reqCaseD = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "req-d-user",
    baseResult({
      message_kind: "other",
      practice_type: "通常練習",
      practice_type_basis: "inferred",
      practice_type_evidence: null,
      practice_date: "2026-10-01",
      payments: [{ type: "その他", amount: 1000, payee: null, due_date: null, payment_method: null }]
    }) as any,
    Date.now()
  );
  assert.equal(reqCaseD.resolvedPracticeType, "個人練習");

  // Flip Case B: 料金系メッセージで既存通常練習を個人練習へ反転しない
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      message_kind: "dispatch_confirmed",
      practice_type: "通常練習",
      practice_date: "2026-10-02",
      outbound_transport: { type: "車", person: "山田さん" },
      return_transport: { type: "自力", person: null },
      payments: []
    }) as any,
    "explicit",
    1000
  );
  const flipBParsed = baseResult({
    message_kind: "accounting_notice",
    practice_type: "個人練習",
    practice_date: "2026-10-02",
    payments: [{ type: "個人練習代", amount: 3500, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
  }) as any;
  const flipBResolved = await hooks.resolvePracticeContext(env, sourceId, userId, flipBParsed, Date.now());
  assert.equal(flipBResolved.resolvedPracticeType, "通常練習");
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    {
      ...flipBParsed,
      practice_type: flipBResolved.resolvedPracticeType,
      practice_date: flipBResolved.resolvedPracticeDate
    },
    "explicit",
    300
  );
  const flipBPractice = raw
    .prepare("SELECT practice_type FROM practices WHERE practice_date='2026-10-02' LIMIT 1")
    .get() as { practice_type: string };
  assert.equal(flipBPractice.practice_type, "通常練習");

  // Requested Case E: D1既存通常練習 + 後続explicit個人練習なら訂正可能
  const reqCaseEResolved = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "req-e-user",
    baseResult({
      message_kind: "schedule",
      practice_type: "個人練習",
      practice_type_basis: "explicit",
      practice_type_evidence: "個人練習です",
      practice_date: "2026-10-02",
      payments: []
    }) as any,
    Date.now()
  );
  assert.equal(reqCaseEResolved.resolvedPracticeType, "個人練習");
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    {
      ...(baseResult({
        message_kind: "schedule",
        practice_date: "2026-10-02",
        practice_type: "個人練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "個人練習です",
        payments: []
      }) as any),
      practice_type: reqCaseEResolved.resolvedPracticeType
    },
    "explicit",
    1000
  );
  const reqCaseEPractice = raw
    .prepare("SELECT practice_type FROM practices WHERE practice_date='2026-10-02' LIMIT 1")
    .get() as { practice_type: string };
  assert.equal(reqCaseEPractice.practice_type, "個人練習");

  // Flip Case C: D1なし + KVありなら料金系AI種別よりKVを優先
  await hooks.saveRecentPracticeContext(
    env,
    "flip-c-user",
    sourceId,
    "2026-10-03",
    "個人練習",
    Date.now() - 2 * 60 * 1000
  );
  const flipCResolved = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "flip-c-user",
    baseResult({
      message_kind: "accounting_notice",
      practice_type: "通常練習",
      practice_date: null,
      payments: [{ type: "個人練習代", amount: 4040, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
    }) as any,
    Date.now()
  );
  assert.equal(flipCResolved.resolvedPracticeDate, "2026-10-03");
  assert.equal(flipCResolved.resolvedPracticeType, "個人練習");

  // Flip Case D: D1/KVなしの料金系は他日practice_typeを変更しない
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      message_kind: "dispatch_confirmed",
      practice_type: "個人練習",
      practice_date: "2026-10-04",
      payments: []
    }) as any,
    "explicit",
    1000
  );
  const flipDBefore = raw
    .prepare("SELECT practice_type FROM practices WHERE practice_date='2026-10-04' LIMIT 1")
    .get() as { practice_type: string };
  assert.equal(flipDBefore.practice_type, "個人練習");
  const flipDResolved = await hooks.resolvePracticeContext(
    env,
    sourceId,
    "flip-d-user",
    baseResult({
      message_kind: "accounting_notice",
      practice_type: "通常練習",
      practice_date: null,
      payments: [{ type: "参加費", amount: 1200, payee: null, due_date: null, payment_method: null }]
    }) as any,
    Date.now()
  );
  assert.equal(flipDResolved.resolvedPracticeDate, null);
  assert.equal(flipDResolved.needsConfirmation, true);
  const flipDAfter = raw
    .prepare("SELECT practice_type FROM practices WHERE practice_date='2026-10-04' LIMIT 1")
    .get() as { practice_type: string };
  assert.equal(flipDAfter.practice_type, "個人練習");

  // Requested Case F: 実メッセージ相当（金曜・内訳・1人3620・丹下までPayPay）
  // OpenAI期待仕様（プロンプト固定化メモ）:
  // 入力相当:
  // - 8/14金曜日 9-13時
  // - 寺尾地区センター
  // - 参加費 1500円×2人 / 施設費 / 高速往復 / 引率代
  // - 全体合計7240円
  // - 2人で割ると1人あたり3620円
  // - 丹下までPayPayお願いします
  // 期待payments:
  // [
  //   { type: "個人練習代", amount: 3620, payee: "丹下さん", payment_method: "PayPay" }
  // ]
  // 抽出禁止:
  // - 参加費7240
  // - 車同乗代
  // - 施設費 / 高速代 / 引率代など内訳単体
  const reqCaseFParsed = baseResult({
    message_kind: "schedule",
    practice_date: "2026-08-14",
    practice_type: "通常練習",
    practice_type_basis: "inferred",
    practice_type_evidence: null,
    outbound_transport: { type: "不明", person: null },
    return_transport: { type: "不明", person: null },
    notes: "寺尾地区センター。集合時間は後から連絡",
    payments: [
      { type: "参加費", amount: 2000, payee: null, due_date: null, payment_method: "PayPay" },
      { type: "その他", amount: 1620, payee: null, due_date: null, payment_method: "PayPay" },
      { type: "個人練習代", amount: 3620, payee: "丹下さん", due_date: null, payment_method: "PayPay" }
    ]
  }) as any;
  const reqCaseFResolved = await hooks.resolvePracticeContext(env, sourceId, "req-f-user", reqCaseFParsed, Date.now());
  assert.equal(reqCaseFResolved.resolvedPracticeType, "個人練習");
  const reqCaseFTransport = hooks.applyPersonalPracticeStandardTransport(
    { ...reqCaseFParsed, practice_type: reqCaseFResolved.resolvedPracticeType },
    reqCaseFResolved.resolvedPracticeType
  );
  assert.equal(reqCaseFTransport.result.outbound_transport.type, "車");
  assert.equal(reqCaseFTransport.result.outbound_transport.person, "志村さん");
  assert.equal(reqCaseFTransport.result.return_transport.type, "車");
  assert.equal(reqCaseFTransport.result.return_transport.person, "志村さん");
  const reqCaseFStanding = hooks.applyStandingPaymentRules(reqCaseFTransport.result as any, {
    resolvedPracticeType: reqCaseFResolved.resolvedPracticeType
  });
  assert.equal(reqCaseFStanding.result.payments.length, 1);
  assert.equal(reqCaseFStanding.result.payments[0]?.type, "個人練習代");
  assert.equal(reqCaseFStanding.result.payments[0]?.amount, 3620);
  assert.equal(reqCaseFStanding.result.payments[0]?.payee, "丹下さん");
  assert.equal(reqCaseFStanding.result.payments[0]?.payment_method, "PayPay");

  // Requested Regression: 通常練習 schedule は従来どおりAI支払いを落とす
  const regularScheduleDrop = hooks.applyStandingPaymentRules(
    baseResult({
      message_kind: "schedule",
      practice_date: "2026-08-11",
      practice_type: "通常練習",
      practice_type_basis: "explicit",
      practice_type_evidence: "通常練習",
      payments: [
        { type: "参加費", amount: 3620, payee: null, due_date: null, payment_method: null },
        { type: "その他", amount: 1000, payee: null, due_date: null, payment_method: null }
      ]
    }) as any
  );
  assert.equal(regularScheduleDrop.result.payments.length, 0);

  // Requested Regression: 個人練習差額は message_kind だけで削除しない
  const personalAdjustmentOnSchedule = hooks.applyStandingPaymentRules(
    baseResult({
      message_kind: "schedule",
      practice_date: "2026-08-16",
      practice_type: "通常練習",
      practice_type_basis: "inferred",
      practice_type_evidence: null,
      payments: [
        { type: "個人練習差額", amount: 420, payee: "丹下さん", due_date: null, payment_method: "PayPay" },
        { type: "その他", amount: 2000, payee: null, due_date: null, payment_method: null }
      ]
    }) as any,
    { resolvedPracticeType: "個人練習" }
  );
  assert.equal(personalAdjustmentOnSchedule.result.payments.length, 1);
  assert.equal(personalAdjustmentOnSchedule.result.payments[0]?.type, "個人練習差額");
  assert.equal(personalAdjustmentOnSchedule.result.payments[0]?.amount, 420);

  // Case A: payee/payment_method 抽出結果の保存（志村さんをpayeeにしない）
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-14",
      notes: "7240円（志村さんにお渡しする金額）/ 2人で割ると1人3620円 / 丹下までPayPayお願いします",
      payments: [{ type: "個人練習代", amount: 3620, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
    }) as any,
    "explicit",
    40
  );
  const caseARows = raw
    .prepare(
      "SELECT payment_type, amount, payee, payment_method, rule_key FROM payments WHERE practice_date = '2026-08-14' ORDER BY id"
    )
    .all() as Array<{
      payment_type: string;
      amount: number;
      payee: string | null;
      payment_method: string | null;
      rule_key: string | null;
    }>;
  assert.equal(caseARows.length, 1);
  assert.equal(caseARows[0]?.payment_type, "個人練習代");
  assert.equal(caseARows[0]?.amount, 3620);
  assert.equal(caseARows[0]?.payee, "丹下さん");
  assert.equal(caseARows[0]?.payment_method, "PayPay");
  assert.equal(caseARows[0]?.rule_key, "personal_practice_fee");

  // Case 1: 内訳多数 + 最終1人分のみ
  const case1Parsed = hooks.applyStandingPaymentRules(
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-15",
      outbound_transport: { type: "車", person: "志村さん" },
      return_transport: { type: "車", person: "志村さん" },
      payments: [
        { type: "参加費", amount: 900, payee: null, due_date: null, payment_method: null },
        { type: "その他", amount: 3140, payee: null, due_date: null, payment_method: null },
        { type: "個人練習代", amount: 4040, payee: null, due_date: null, payment_method: null }
      ]
    }) as any
  );
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    case1Parsed.result as any,
    case1Parsed.practiceTypeBasis,
    case1Parsed.practiceTypePriority
  );
  const case1Rows = raw
    .prepare("SELECT payment_type, amount, rule_key FROM payments WHERE practice_date = '2026-08-15' ORDER BY id")
    .all() as Array<{ payment_type: string; amount: number; rule_key: string | null }>;
  assert.equal(case1Rows.length, 1);
  assert.equal(case1Rows[0]?.payment_type, "個人練習代");
  assert.equal(case1Rows[0]?.amount, 4040);
  assert.equal(case1Rows[0]?.rule_key, "personal_practice_fee");

  // Case B: 訂正時にpayee/payment_methodを失わない
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-20",
      payments: [{ type: "個人練習代", amount: 3620, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
    }) as any,
    "explicit",
    40
  );
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-20",
      payments: [{ type: "個人練習代", amount: 4040, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  const case2Rows = raw
    .prepare(
      "SELECT amount, payee, payment_method FROM payments WHERE practice_date = '2026-08-20' AND rule_key = 'personal_practice_fee'"
    )
    .all() as Array<{ amount: number; payee: string | null; payment_method: string | null }>;
  assert.equal(case2Rows.length, 1);
  assert.equal(case2Rows[0]?.amount, 4040);
  assert.equal(case2Rows[0]?.payee, "丹下さん");
  assert.equal(case2Rows[0]?.payment_method, "PayPay");

  // Case C (unpaid + 同一メッセージに最終総額と差額文が共存)
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-24",
      payments: [{ type: "個人練習代", amount: 3620, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-24",
      payments: [
        { type: "個人練習代", amount: 4040, payee: null, due_date: null, payment_method: null },
        { type: "個人練習差額", amount: 420, payee: "丹下さん", due_date: null, payment_method: "PayPay" }
      ]
    }) as any,
    "explicit",
    40
  );
  const case2bRows = raw
    .prepare(
      "SELECT payment_type, amount, payee, payment_method, rule_key, status FROM payments WHERE practice_date = '2026-08-24' ORDER BY id"
    )
    .all() as Array<{
      payment_type: string;
      amount: number;
      payee: string | null;
      payment_method: string | null;
      rule_key: string | null;
      status: string;
    }>;
  assert.equal(case2bRows.length, 1);
  assert.equal(case2bRows[0]?.payment_type, "個人練習代");
  assert.equal(case2bRows[0]?.amount, 4040);
  assert.equal(case2bRows[0]?.payee, "丹下さん");
  assert.equal(case2bRows[0]?.payment_method, "PayPay");
  assert.equal(case2bRows[0]?.rule_key, "personal_practice_fee");
  assert.equal(case2bRows[0]?.status, "unpaid");

  // Case 3（既存ケース）: paid + 総額と差額が同時に来る
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-21",
      payments: [{ type: "個人練習代", amount: 3620, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  const case3BaseIdRow = raw
    .prepare("SELECT id FROM payments WHERE practice_date = '2026-08-21' AND rule_key = 'personal_practice_fee'")
    .get() as { id: number };
  await hooks.markEventPaymentPaid(env.DB as any, case3BaseIdRow.id);
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-21",
      payments: [
        { type: "個人練習代", amount: 4040, payee: null, due_date: null, payment_method: null },
        { type: "個人練習差額", amount: 420, payee: "丹下さん", due_date: null, payment_method: "PayPay" }
      ]
    }) as any,
    "explicit",
    40
  );
  const case3Rows = raw
    .prepare(
      "SELECT payment_type, amount, payee, payment_method, status, needs_review, rule_key FROM payments WHERE practice_date = '2026-08-21' ORDER BY rule_key"
    )
    .all() as Array<{
      payment_type: string;
      amount: number;
      payee: string | null;
      payment_method: string | null;
      status: string;
      needs_review: number;
      rule_key: string | null;
    }>;
  assert.equal(case3Rows.length, 2);
  const case3Base = case3Rows.find((row) => row.rule_key === "personal_practice_fee");
  const case3Adjustment = case3Rows.find((row) => row.rule_key === "personal_practice_fee_adjustment");
  assert.ok(case3Base);
  assert.ok(case3Adjustment);
  assert.equal(case3Adjustment.payment_type, "個人練習差額");
  assert.equal(case3Adjustment.amount, 420);
  assert.equal(case3Adjustment.payee, "丹下さん");
  assert.equal(case3Adjustment.payment_method, "PayPay");
  assert.equal(case3Adjustment.status, "unpaid");
  assert.equal(case3Adjustment.needs_review, 0);
  assert.equal(case3Base.payment_type, "個人練習代");
  assert.equal(case3Base.amount, 3620);
  assert.equal(case3Base.payee, null);
  assert.equal(case3Base.payment_method, null);
  assert.equal(case3Base.status, "paid");
  assert.equal(case3Base.needs_review, 0);

  // Case D: paid + 差額明示のみ（payee/payment_methodを差額へ保持）
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-23",
      payments: [{ type: "個人練習代", amount: 3620, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  const caseDBaseIdRow = raw
    .prepare("SELECT id FROM payments WHERE practice_date = '2026-08-23' AND rule_key = 'personal_practice_fee'")
    .get() as { id: number };
  await hooks.markEventPaymentPaid(env.DB as any, caseDBaseIdRow.id);
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-23",
      payments: [{ type: "個人練習差額", amount: 420, payee: "丹下さん", due_date: null, payment_method: "PayPay" }]
    }) as any,
    "explicit",
    40
  );
  const caseDRows = raw
    .prepare(
      "SELECT payment_type, amount, payee, payment_method, status, rule_key FROM payments WHERE practice_date = '2026-08-23' ORDER BY rule_key"
    )
    .all() as Array<{
      payment_type: string;
      amount: number;
      payee: string | null;
      payment_method: string | null;
      status: string;
      rule_key: string | null;
    }>;
  assert.equal(caseDRows.length, 2);
  const caseDBase = caseDRows.find((row) => row.rule_key === "personal_practice_fee");
  const caseDAdjustment = caseDRows.find((row) => row.rule_key === "personal_practice_fee_adjustment");
  assert.ok(caseDBase);
  assert.ok(caseDAdjustment);
  assert.equal(caseDAdjustment.payment_type, "個人練習差額");
  assert.equal(caseDAdjustment.amount, 420);
  assert.equal(caseDAdjustment.payee, "丹下さん");
  assert.equal(caseDAdjustment.payment_method, "PayPay");
  assert.equal(caseDAdjustment.status, "unpaid");
  assert.equal(caseDBase.payment_type, "個人練習代");
  assert.equal(caseDBase.amount, 3620);
  assert.equal(caseDBase.status, "paid");

  // Case 4: paid + 総額訂正のみ（差額自動生成しない）
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-22",
      payments: [{ type: "個人練習代", amount: 3620, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  const case4Base = raw
    .prepare("SELECT id FROM payments WHERE practice_date = '2026-08-22' AND rule_key = 'personal_practice_fee'")
    .get() as { id: number };
  await hooks.markEventPaymentPaid(env.DB as any, case4Base.id);
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      practice_type: "個人練習",
      practice_date: "2026-08-22",
      payments: [{ type: "個人練習代", amount: 4040, payee: null, due_date: null, payment_method: null }]
    }) as any,
    "explicit",
    40
  );
  const case4Rows = raw
    .prepare(
      "SELECT payment_type, amount, status, needs_review FROM payments WHERE practice_date = '2026-08-22' ORDER BY rule_key"
    )
    .all() as Array<{ payment_type: string; amount: number; status: string; needs_review: number }>;
  assert.equal(case4Rows.length, 1);
  assert.equal(case4Rows[0]?.payment_type, "個人練習代");
  assert.equal(case4Rows[0]?.amount, 3620);
  assert.equal(case4Rows[0]?.status, "paid");
  assert.equal(case4Rows[0]?.needs_review, 1);

  // 回帰: 通常練習の車/バス
  const regularRows: Array<[string, number]> = [
    ["2026-08-30", 1],
    ["2026-08-31", 1],
    ["2026-09-01", 1]
  ];
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "dispatch_confirmed",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: regularRows[0][0],
        outbound_transport: { type: "車", person: "志村さん" },
        return_transport: { type: "自力", person: null }
      }) as any
    ).result as any,
    "explicit",
    30
  );
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "dispatch_confirmed",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: regularRows[1][0],
        outbound_transport: { type: "自力", person: null },
        return_transport: { type: "車", person: "志村さん" }
      }) as any
    ).result as any,
    "explicit",
    30
  );
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "dispatch_confirmed",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: regularRows[2][0],
        outbound_transport: { type: "自力", person: null },
        return_transport: { type: "バス", person: null },
        bus_guide: "村中さん"
      }) as any
    ).result as any,
    "explicit",
    30
  );
  const carBusRows = raw
    .prepare(
      "SELECT practice_date, payment_type, amount FROM payments WHERE practice_date IN ('2026-08-30','2026-08-31','2026-09-01') ORDER BY practice_date"
    )
    .all() as Array<{ practice_date: string; payment_type: string; amount: number }>;
  assert.equal(carBusRows.length, 3);
  assert.deepEqual(carBusRows.map((row) => [row.practice_date, row.payment_type, row.amount]), [
    ["2026-08-30", "車同乗代", 100],
    ["2026-08-31", "車同乗代", 100],
    ["2026-09-01", "バス引率代", 100]
  ]);

  // 回帰: paid後配車変更needs_review
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "dispatch_confirmed",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: "2026-09-02",
        outbound_transport: { type: "車", person: "志村さん" },
        return_transport: { type: "自力", person: null }
      }) as any
    ).result as any,
    "explicit",
    30
  );
  const paidChangeTarget = raw
    .prepare("SELECT id FROM payments WHERE practice_date='2026-09-02' LIMIT 1")
    .get() as { id: number };
  await hooks.markEventPaymentPaid(env.DB as any, paidChangeTarget.id);
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "same_day_change",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: "2026-09-02",
        outbound_transport: { type: "自力", person: null },
        return_transport: { type: "自力", person: null }
      }) as any
    ).result as any,
    "explicit",
    60
  );
  const paidNeedsReview = raw
    .prepare("SELECT needs_review FROM payments WHERE id = ?1")
    .get(paidChangeTarget.id) as { needs_review: number };
  assert.equal(paidNeedsReview.needs_review, 1);

  // 回帰: void / reactivate
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "dispatch_confirmed",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: "2026-09-03",
        outbound_transport: { type: "車", person: "志村さん" },
        return_transport: { type: "バス", person: null },
        bus_guide: "村中さん"
      }) as any
    ).result as any,
    "explicit",
    30
  );
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "same_day_change",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: "2026-09-03",
        outbound_transport: { type: "自力", person: null },
        return_transport: { type: "自力", person: null },
        bus_guide: null
      }) as any
    ).result as any,
    "explicit",
    60
  );
  const voidedCount = raw
    .prepare("SELECT COUNT(*) AS count FROM payments WHERE practice_date='2026-09-03' AND voided_at IS NOT NULL")
    .get() as { count: number };
  assert.equal(voidedCount.count, 2);
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    hooks.applyStandingPaymentRules(
      baseResult({
        message_kind: "same_day_change",
        practice_type: "通常練習",
        practice_type_basis: "explicit",
        practice_type_evidence: "通常練習",
        practice_date: "2026-09-03",
        outbound_transport: { type: "車", person: "志村さん" },
        return_transport: { type: "バス", person: null },
        bus_guide: "村中さん"
      }) as any
    ).result as any,
    "explicit",
    60
  );
  const reactivatedCount = raw
    .prepare("SELECT COUNT(*) AS count FROM payments WHERE practice_date='2026-09-03' AND voided_at IS NULL")
    .get() as { count: number };
  assert.equal(reactivatedCount.count, 2);

  // 回帰: 月次支払い + 未払い一覧
  await hooks.saveStructuredResultToD1(
    env,
    "羽魂練習会",
    baseResult({
      message_kind: "accounting_notice",
      practice_date: null,
      attendance: "不明",
      monthly_charges: [
        {
          billing_month: "2026-08",
          monthly_type: "regular_training_total",
          amount: 5000,
          payee: "会計",
          due_date: "2026-09-10",
          payment_method: "PayPay",
          breakdown_text: "通常練習分"
        }
      ]
    }) as any,
    "explicit",
    30
  );
  const unpaid = await hooks.getUnifiedUnpaidPayments(env.DB as any, 20);
  assert.ok(unpaid.totalCount >= 1);
  assert.ok(unpaid.payments.some((item: any) => item.payment_kind === "monthly"));

  // 回帰: mark_paid
  const unpaidPersonal = raw
    .prepare("SELECT id FROM payments WHERE rule_key='personal_practice_fee' AND status='unpaid' LIMIT 1")
    .get() as { id: number };
  const markResult = await hooks.markEventPaymentPaid(env.DB as any, unpaidPersonal.id);
  assert.equal(markResult.outcome, "updated");
  const nowPaid = raw.prepare("SELECT status FROM payments WHERE id=?1").get(unpaidPersonal.id) as { status: string };
  assert.equal(nowPaid.status, "paid");

  // 回帰: Cron対象抽出
  raw.prepare(
    "INSERT INTO payments (practice_date,payment_type,amount,payee,due_date,status,billing_scope,direction,source,created_at,updated_at,rule_key) VALUES ('2026-09-04','その他',1000,NULL,NULL,'unpaid','other','none','羽魂練習会',datetime('now'),datetime('now'),'manual:test')"
  ).run();
  raw.prepare(
    "INSERT INTO payments (practice_date,payment_type,amount,payee,due_date,status,billing_scope,direction,source,created_at,updated_at,rule_key) VALUES ('2026-09-01','その他',2000,NULL,'2026-09-05','unpaid','other','none','羽魂練習会',datetime('now'),datetime('now'),'manual:test-due')"
  ).run();
  raw.prepare(
    "INSERT INTO monthly_payments (billing_month,monthly_type,amount,payee,due_date,payment_method,breakdown_text,status,source,created_at,updated_at) VALUES ('2026-09','shimura_car_fee',3000,'志村さん','2026-09-05','現金','-', 'unpaid','羽魂練習会',datetime('now'),datetime('now'))"
  ).run();
  const reminderEvents = await hooks.getReminderTargets(env.DB as any, "2026-09-05", "2026-09-04");
  const reminderMonthly = await hooks.getMonthlyReminderTargets(env.DB as any, "2026-09-05");
  assert.ok(reminderEvents.some((row: any) => row.practice_date === "2026-09-04"));
  assert.ok(reminderEvents.some((row: any) => row.due_date === "2026-09-05"));
  assert.equal(reminderMonthly.length, 1);

  console.log("personal-practice test: all cases passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
