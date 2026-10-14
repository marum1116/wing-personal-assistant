export const IMAGE_CATEGORIES = [
  "personal_yahoo_calendar",
  "personal_payment_notice",
  "regular_practice_or_transport",
  "monthly_fee_notice",
  "unknown"
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export type PracticeTextClass = "personal_notice" | "personal" | "regular" | "monthly" | "ambiguous" | "general";

export const PENDING_IMAGE_TTL_SECONDS = 10 * 60;
export const PENDING_TEXT_TTL_SECONDS = 10 * 60;

export function classifyPracticeText(inputText: string): PracticeTextClass {
  const compact = inputText.replace(/\s+/gu, "");
  const personal = /個人練習|個別練習/u.test(compact);
  const regular = /通常練習|羽魂練習|配車/u.test(compact);
  const monthly = /お月謝|月謝案内|月謝について/u.test(compact);
  const notice = personal && /参加費/u.test(compact) && /円/u.test(compact) && /お一人|おひとり|合計/u.test(inputText);
  if (notice) {
    return "personal_notice";
  }
  if (monthly && !personal && !regular) {
    return "monthly";
  }
  if (personal && regular) {
    return "ambiguous";
  }
  if (personal) {
    return "personal";
  }
  if (regular) {
    return "regular";
  }
  return "general";
}

export function decideImageRoute(category: ImageCategory): "yahoo" | "notice" | "regular" | "monthly" | "ask" {
  if (category === "personal_yahoo_calendar") {
    return "yahoo";
  }
  if (category === "personal_payment_notice") {
    return "notice";
  }
  if (category === "regular_practice_or_transport") {
    return "regular";
  }
  if (category === "monthly_fee_notice") {
    return "monthly";
  }
  return "ask";
}

export function parseImageCategory(value: unknown): ImageCategory {
  return IMAGE_CATEGORIES.includes(value as ImageCategory) ? (value as ImageCategory) : "unknown";
}

export function buildMenuHelpText(): string {
  return [
    "《羽魂メニュー》",
    "",
    "・Excel",
    "・通常調整さん",
    "・未払い",
    "・引率チェック",
    "・個人練習集金確認",
    "・塁に連絡",
    "",
    "LINEの転送メッセージや画像は、そのまま送ってください。",
    "内容をBotが判定します。"
  ].join("\n");
}

export function buildAmbiguousTextQuickReply(): { text: string; items: Array<{ label: string; data: string; displayText: string }> } {
  return {
    text: "この連絡はどちらですか？",
    items: [
      { label: "通常練習", data: "action=text_kind&kind=regular", displayText: "通常練習" },
      { label: "個人練習", data: "action=text_kind&kind=personal", displayText: "個人練習" }
    ]
  };
}

export function buildAmbiguousImageQuickReply(): { text: string; items: Array<{ label: string; data: string; displayText: string }> } {
  return {
    text: "この画像の種類を確定できませんでした。",
    items: [
      { label: "通常練習", data: "action=image_kind&kind=regular_practice_or_transport", displayText: "通常練習" },
      { label: "個人練習予定", data: "action=image_kind&kind=personal_yahoo_calendar", displayText: "個人練習予定" },
      { label: "個人練習料金", data: "action=image_kind&kind=personal_payment_notice", displayText: "個人練習料金" },
      { label: "月謝案内", data: "action=image_kind&kind=monthly_fee_notice", displayText: "月謝案内" }
    ]
  };
}

export function pendingImageKey(userId: string): string {
  return `pending_line_image:${userId}`;
}

export function pendingTextKey(userId: string): string {
  return `pending_line_text:${userId}`;
}

const COLLECTION_COMMAND = "個人練習集金確認";

export function parsePersonalCollectionCommand(inputText: string): "list" | { action: "received" | "unreceived"; practiceDate: string; startTime: string; participantName: string } | null {
  const trimmed = inputText.trim();
  if (trimmed === COLLECTION_COMMAND) {
    return "list";
  }
  const matched = /^(個人練習受取済|個人練習未受取)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/u.exec(trimmed);
  if (!matched) {
    return null;
  }
  return {
    action: matched[1] === "個人練習受取済" ? "received" : "unreceived",
    practiceDate: matched[2] ?? "",
    startTime: matched[3] ?? "",
    participantName: (matched[4] ?? "").trim()
  };
}
