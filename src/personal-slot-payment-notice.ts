export const PERSONAL_PRACTICE_PAYMENT_COMMAND = "個人練習支払い";

export type PersonalPracticePaymentFeeItem = {
  label: string;
  amount: number;
  detail: string | null;
};

export type PersonalPracticePaymentNoticeDraft = {
  practice_date: string | null;
  start_time: string | null;
  end_time: string | null;
  practice_location: string | null;
  payee_name: string | null;
  payee_source: "explicit_notice" | "slot_coordinator";
  payment_method: string;
  payment_method_source: "explicit_notice" | "default_personal_practice";
  participant_amount: number | null;
  total_amount: number | null;
  fee_items: PersonalPracticePaymentFeeItem[];
  court_or_area: string | null;
  uncertain_points: string[];
};

export type PersonalPracticePaymentNoticeParse =
  | { status: "needs_image" }
  | { status: "needs_confirmation"; message: string }
  | { status: "parsed"; notice: PersonalPracticePaymentNoticeDraft };

export type PaymentNoticeSlotCandidate = {
  id: number;
  practice_date: string;
  start_time: string;
  end_time: string | null;
  practice_location: string | null;
  coordinator_name: string;
  watanabe_is_coordinator: number;
  payment_reminder_sent_at: string | null;
};

export function splitPersonalPracticePaymentCommand(inputText: string): "image" | "text" | null {
  const trimmed = inputText.trim();
  if (!trimmed.startsWith(PERSONAL_PRACTICE_PAYMENT_COMMAND)) {
    return null;
  }
  const rest = trimmed.slice(PERSONAL_PRACTICE_PAYMENT_COMMAND.length).trim();
  return rest.length === 0 ? "image" : "text";
}

export function looksLikePersonalPracticePaymentNotice(inputText: string): boolean {
  const trimmed = inputText.trim();
  if (!trimmed || splitPersonalPracticePaymentCommand(trimmed)) {
    return false;
  }
  if (trimmed.startsWith("個人練習カレンダー") || trimmed.startsWith("個人練習補足")) {
    return false;
  }
  const compact = trimmed.replace(/\s+/gu, "");
  if (!compact.includes("個人練習") || !compact.includes("参加費") || !compact.includes("円")) {
    return false;
  }
  return /お一人|おひとり|1人分|１人分|一人あたり|1人あたり|１人あたり|合計/u.test(trimmed);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseYenAmount(source: string): number | null {
  const matched = /([\d,]+)\s*円/u.exec(source);
  if (!matched?.[1]) {
    return null;
  }
  const amount = Number(matched[1].replace(/,/g, ""));
  return Number.isInteger(amount) ? amount : null;
}

function lineAmount(line: string): number | null {
  const equals = /=\s*([\d,]+)\s*円/u.exec(line);
  if (equals?.[1]) {
    const amount = Number(equals[1].replace(/,/g, ""));
    return Number.isInteger(amount) ? amount : null;
  }
  const amounts = [...line.matchAll(/([\d,]+)\s*円/gu)];
  const last = amounts[amounts.length - 1];
  if (!last?.[1]) {
    return null;
  }
  const amount = Number(last[1].replace(/,/g, ""));
  return Number.isInteger(amount) ? amount : null;
}

function noticeDate(month: number, day: number, referenceDate: string, knownDates: string[]): string | null {
  const matches = knownDates.filter((date) => Number(date.slice(5, 7)) === month && Number(date.slice(8, 10)) === day);
  if (matches.length === 1) {
    return matches[0] ?? null;
  }
  const year = Number(referenceDate.slice(0, 4));
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parsePersonalPracticePaymentNotice(
  inputText: string,
  referenceDate: string,
  knownDates: string[] = []
): PersonalPracticePaymentNoticeParse {
  const route = splitPersonalPracticePaymentCommand(inputText);
  const text = route === "text" ? inputText.trim().slice(PERSONAL_PRACTICE_PAYMENT_COMMAND.length).trim() : inputText.trim();
  if (!text) {
    return { status: "needs_image" };
  }
  const dateMatch = /(\d{1,2})\s*\/\s*(\d{1,2})/u.exec(text) ?? /(\d{1,2})\s*月\s*(\d{1,2})\s*日/u.exec(text);
  const practiceDate = dateMatch ? noticeDate(Number(dateMatch[1]), Number(dateMatch[2]), referenceDate, knownDates) : null;
  const timeMatch = /(\d{1,2}):(\d{2})\s*[〜~\-－]\s*(\d{1,2}):(\d{2})/u.exec(text);
  const startTime = timeMatch ? `${pad2(Number(timeMatch[1]))}:${timeMatch[2]}` : null;
  const endTime = timeMatch ? `${pad2(Number(timeMatch[3]))}:${timeMatch[4]}` : null;
  const locationMatch = /【\s*([^】]+?)\s*】/u.exec(text);
  const courtMatch = /([ABCabcＡＢＣ])\s*面/u.exec(text);
  const court = courtMatch?.[1]
    ? `${courtMatch[1].replace("Ａ", "A").replace("Ｂ", "B").replace("Ｃ", "C").toUpperCase()}面`
    : null;
  const payeeMatch = /([一-龥ぁ-んァ-ン]{1,8})まで\s*PayPay/u.exec(text);
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const feeItems: PersonalPracticePaymentFeeItem[] = [];
  let totalAmount: number | null = null;
  let participantAmount: number | null = null;
  for (const line of lines) {
    if (/^合計/u.test(line)) {
      totalAmount = lineAmount(line);
      continue;
    }
    if (/お一人|おひとり|1人分|１人分|一人あたり|1人あたり|１人あたり/u.test(line)) {
      participantAmount = lineAmount(line);
      continue;
    }
    const label = /指導料/u.test(line)
      ? "指導料"
      : /施設費/u.test(line)
        ? "施設費"
        : /高速/u.test(line)
          ? "高速代"
          : /引率/u.test(line)
            ? "引率代"
            : null;
    if (!label) {
      continue;
    }
    const amount = lineAmount(line);
    if (amount === null) {
      continue;
    }
    const detail = /=\s*[\d,]+\s*円/u.test(line) ? line.replace(/=\s*[\d,]+\s*円.*$/u, "").replace(label, "").trim() || null : null;
    feeItems.push({ label, amount, detail });
  }
  if (!practiceDate && !startTime && !locationMatch && feeItems.length === 0 && participantAmount === null && totalAmount === null) {
    return { status: "needs_confirmation", message: "《確認が必要》\n\n個人練習の料金案内として読めませんでした。" };
  }
  const uncertain: string[] = [];
  if (participantAmount === null) {
    uncertain.push("1人分の支払額は案内から確定できませんでした");
  }
  return {
    status: "parsed",
    notice: {
      practice_date: practiceDate,
      start_time: startTime,
      end_time: endTime,
      practice_location: locationMatch?.[1]?.trim() ?? null,
      payee_name: payeeMatch?.[1] ?? null,
      payee_source: payeeMatch ? "explicit_notice" : "slot_coordinator",
      payment_method: "PayPay",
      payment_method_source: /PayPay/u.test(text) ? "explicit_notice" : "default_personal_practice",
      participant_amount: participantAmount,
      total_amount: totalAmount,
      fee_items: feeItems,
      court_or_area: court,
      uncertain_points: uncertain
    }
  };
}

function locationsMatch(slotLocation: string | null, noticeLocation: string | null): boolean {
  if (!noticeLocation) {
    return true;
  }
  if (!slotLocation) {
    return false;
  }
  const slot = slotLocation.replace(/\s+/g, "");
  const notice = noticeLocation.replace(/\s+/g, "");
  return slot.includes(notice) || notice.includes(slot);
}

export function resolvePaymentNoticeSlot(
  notice: PersonalPracticePaymentNoticeDraft,
  slots: PaymentNoticeSlotCandidate[],
  recent: Array<{ practice_date: string; start_time: string }> | null
): { ok: true; slot: PaymentNoticeSlotCandidate } | { ok: false; message: string } {
  const payerSlots = slots.filter((slot) => Number(slot.watanabe_is_coordinator) === 0);
  const dated = notice.practice_date ? payerSlots.filter((slot) => slot.practice_date === notice.practice_date) : payerSlots;
  const rejectCoordinator = (matched: PaymentNoticeSlotCandidate[]): string | null => {
    if (!notice.practice_date && !notice.start_time) {
      return null;
    }
    const coordinatorMatch = slots.filter((slot) => {
      if (Number(slot.watanabe_is_coordinator) !== 1) {
        return false;
      }
      if (notice.practice_date && slot.practice_date !== notice.practice_date) {
        return false;
      }
      if (notice.start_time && slot.start_time !== notice.start_time) {
        return false;
      }
      return true;
    });
    if (matched.length === 0 && coordinatorMatch.length === 1) {
      return "《確認が必要》\n\nこの枠は渡辺家が取りまとめ担当です。\n支払い側の料金案内としては登録しません。";
    }
    return null;
  };

  if (notice.practice_date && notice.start_time) {
    const exact = dated.filter((slot) => slot.start_time === notice.start_time && locationsMatch(slot.practice_location, notice.practice_location));
    const coordinatorMessage = rejectCoordinator(exact);
    if (exact.length === 1 && exact[0]) {
      return { ok: true, slot: exact[0] };
    }
    if (coordinatorMessage) {
      return { ok: false, message: coordinatorMessage };
    }
    return { ok: false, message: "《確認が必要》\n\nどの個人練習の料金案内か確認が必要です。" };
  }
  if (notice.practice_date && notice.practice_location) {
    const located = dated.filter((slot) => locationsMatch(slot.practice_location, notice.practice_location));
    if (located.length === 1 && located[0]) {
      return { ok: true, slot: located[0] };
    }
  }
  if (notice.practice_date) {
    if (dated.length === 1 && dated[0]) {
      return { ok: true, slot: dated[0] };
    }
    const coordinatorMessage = rejectCoordinator(dated);
    if (coordinatorMessage) {
      return { ok: false, message: coordinatorMessage };
    }
    return { ok: false, message: "《確認が必要》\n\nどの個人練習の料金案内か確認が必要です。" };
  }
  const recentSlots = recent ?? [];
  if (recentSlots.length === 1 && recentSlots[0]) {
    const matched = payerSlots.find(
      (slot) =>
        slot.practice_date === recentSlots[0]?.practice_date &&
        slot.start_time === recentSlots[0]?.start_time &&
        locationsMatch(slot.practice_location, notice.practice_location)
    );
    if (matched) {
      return { ok: true, slot: matched };
    }
  }
  return { ok: false, message: "《確認が必要》\n\nどの個人練習の料金案内か確認が必要です。" };
}

export function formatPersonalPracticePaymentNoticeReply(
  whenLabel: string,
  location: string | null,
  coordinatorName: string,
  notice: PersonalPracticePaymentNoticeDraft,
  alreadySent: boolean
): string {
  const payee = notice.payee_name ?? coordinatorName;
  const lines = [
    "《個人練習の支払い案内を登録》",
    "",
    whenLabel,
    location ?? "場所：不明",
    "",
    `取りまとめ：${payee.endsWith("さん") ? payee : `${payee}さん`}`,
    `支払方法：${notice.payment_method}`,
    notice.participant_amount === null ? "支払額：1人分の支払額は案内から確定できませんでした" : `支払額：${notice.participant_amount.toLocaleString("ja-JP")}円`
  ];
  if (notice.fee_items.length > 0) {
    lines.push("", "内訳：");
    for (const item of notice.fee_items) {
      const amount = `${item.amount.toLocaleString("ja-JP")}円`;
      if (item.label === "施設費" && notice.court_or_area) {
        lines.push(`施設費（${notice.court_or_area}）${amount}`);
      } else if (item.label === "高速代") {
        lines.push(`高速代往復 ${amount}`);
      } else if (item.label === "引率代") {
        lines.push(`引率代往復 ${amount}`);
      } else {
        lines.push(`${item.label} ${amount}`);
      }
    }
  }
  if (notice.total_amount !== null) {
    lines.push("", `合計：${notice.total_amount.toLocaleString("ja-JP")}円`);
  }
  if (notice.participant_amount !== null) {
    lines.push("", "練習終了時に、", `${payee.endsWith("さん") ? payee : `${payee}さん`}への支払いをリマインドします。`);
  }
  if (alreadySent) {
    lines.push("", "この枠の終了時リマインドはすでに送信済みです。");
  }
  return lines.join("\n");
}
