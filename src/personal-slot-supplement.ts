export const PERSONAL_SLOT_CONTEXT_TTL_SECONDS = 30 * 60;
export const PERSONAL_SLOT_SUPPLEMENT_PREFIX = "個人練習補足";

export type PersonalTransport =
  | "shimura_car"
  | "bicycle"
  | "parent_car"
  | "bus"
  | "public_transport"
  | "walk"
  | "other"
  | "unknown";

export type PersonalTransportSource =
  | "default_personal_practice"
  | "explicit_user_supplement"
  | "unresolved_multi_participant"
  | "unresolved_nonstandard_meeting";

export type SlotFeeType =
  | "instruction_fee"
  | "facility_fee"
  | "highway_fee"
  | "escort_fee"
  | "parking_fee"
  | "instruction_multiplier";

export type SlotFeeOverrideMode = "fixed_amount" | "no_charge" | "deferred" | "needs_confirmation";

export type SlotFeeOverrideInput = {
  fee_type: SlotFeeType;
  mode: SlotFeeOverrideMode;
  amount: number | null;
  note: string | null;
};

export type PersonalSlotParticipantRow = {
  id?: number;
  slot_id: number;
  participant_order: number;
  participant_name: string;
  outbound_transport: PersonalTransport;
  outbound_source: PersonalTransportSource;
  return_transport: PersonalTransport;
  return_source: PersonalTransportSource;
  escort_fee_override: string | null;
  escort_fee_override_reason: string | null;
};

export type PersonalSlotIdentity = {
  id?: number;
  practice_date: string;
  start_time: string;
};

export type PersonalSlotContextRecord = {
  slots: PersonalSlotIdentity[];
  saved_at: string;
};

export type SupplementTargetHint = {
  practice_date: string | null;
  start_time: string | null;
  period: "am" | "pm" | null;
};

export type ParticipantTransportOverride = {
  participant_name: string;
  outbound_transport: PersonalTransport | null;
  return_transport: PersonalTransport | null;
  escort_fee_override: "no_charge_this_slot" | null;
  escort_fee_override_reason: string | null;
};

export type PersonalSupplementInterpretation =
  | { status: "not_supplement" }
  | { status: "needs_confirmation"; message: string }
  | {
      status: "apply";
      hint: SupplementTargetHint;
      overrides: ParticipantTransportOverride[];
      meeting_place: string | null;
      court_or_area: string | null;
      deferred_fee_note: string | null;
      fee_overrides: SlotFeeOverrideInput[];
    };

const NICKNAME_GROUPS: string[][] = [
  ["渡辺", "渡辺塁", "塁", "ルイ", "るい"],
  ["重松", "センタ", "せんた", "千太", "セン太"],
  ["山田", "ケンタ", "けんた", "健太", "山田健太"],
  ["村中", "村中佑史"],
  ["藤田"],
  ["佐藤"]
];

export function personalSlotContextKey(userId: string): string {
  return `personal_slot_context:${userId}`;
}

export function defaultTransportForParticipantCount(count: number): {
  transport: PersonalTransport;
  source: PersonalTransportSource;
} {
  return defaultTransportForParticipant(count, null, "outbound");
}

export function defaultTransportForParticipant(
  count: number,
  meetingPlace: string | null,
  direction: "outbound" | "return"
): { transport: PersonalTransport; source: PersonalTransportSource } {
  if (count >= 4 || count < 1) {
    return { transport: "unknown", source: "unresolved_multi_participant" };
  }
  if (direction === "outbound" && meetingPlace && meetingPlace !== "志村家前") {
    return { transport: "unknown", source: "unresolved_nonstandard_meeting" };
  }
  return { transport: "shimura_car", source: "default_personal_practice" };
}

export function shouldRoutePersonalSlotSupplement(inputText: string, hasRecentSlotContext: boolean): boolean {
  const text = inputText.trim();
  if (text.startsWith(PERSONAL_SLOT_SUPPLEMENT_PREFIX)) {
    return true;
  }
  if (!hasRecentSlotContext) {
    return false;
  }
  const strongCue =
    /自転車|志村号|志村さん|送迎|往復|現地集合|引率代|精算|個人練|個人練習|[ABCabcＡＢＣ1-9１-９]面|母が送|母送迎|母が送り|施設費|設備費|高速|コインパ/.test(
      text
    );
  const namedDirection = /行き|帰り/.test(text) && /塁|ルイ|センタ|千太|ケンタ|渡辺|重松|山田|藤田|佐藤|村中/.test(text);
  return strongCue || namedDirection;
}

function stripSupplementPrefix(inputText: string): string {
  const trimmed = inputText.trim();
  if (!trimmed.startsWith(PERSONAL_SLOT_SUPPLEMENT_PREFIX)) {
    return trimmed;
  }
  return trimmed.slice(PERSONAL_SLOT_SUPPLEMENT_PREFIX.length).trim();
}

export function resolveMentionToSlotParticipant(mention: string, slotNames: string[]): string | "ambiguous" | null {
  const normalized = mention.replace(/\s+/g, "");
  const group = NICKNAME_GROUPS.find((names) => names.includes(normalized));
  const candidates = slotNames.filter((slotName) => {
    if (slotName === normalized) {
      return true;
    }
    if (!group) {
      return false;
    }
    return group.includes(slotName);
  });
  const unique = [...new Set(candidates)];
  if (unique.length === 1) {
    return unique[0] ?? null;
  }
  if (unique.length > 1) {
    return "ambiguous";
  }
  return null;
}

function extractHint(text: string, knownDates: string[]): SupplementTargetHint {
  const dateMatch = /(\d{1,2})\/(\d{1,2})/.exec(text);
  let practiceDate: string | null = null;
  if (dateMatch) {
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);
    const matches = knownDates.filter((date) => {
      const [, monthText, dayText] = date.split("-");
      return Number(monthText) === month && Number(dayText) === day;
    });
    practiceDate = matches.length === 1 ? matches[0] ?? null : null;
  }
  const hourMatch = /(\d{1,2})時/.exec(text);
  const startTime = hourMatch ? `${String(Number(hourMatch[1])).padStart(2, "0")}:00` : null;
  const period = text.includes("午後") ? "pm" : text.includes("午前") ? "am" : null;
  return { practice_date: practiceDate, start_time: startTime, period };
}

function transportFromWords(text: string): PersonalTransport | null {
  if (/自転車/.test(text)) {
    return "bicycle";
  }
  if (/志村号|志村さん|志村の車/.test(text)) {
    return "shimura_car";
  }
  if (/母が送|母送迎|母が送り|保護者の車|送迎/.test(text)) {
    return "parent_car";
  }
  if (/バス/.test(text)) {
    return "bus";
  }
  if (/徒歩/.test(text)) {
    return "walk";
  }
  return null;
}

function namesInClause(clause: string): string[] {
  const matched = /^([^はの]{1,40})(?:は|の)/.exec(clause.trim());
  if (!matched?.[1]) {
    return [];
  }
  return matched[1]
    .replace(/^\d{1,2}\/\d{1,2}(?:午前|午後)?[、,]\s*/u, "")
    .replace(/^(?:午前|午後)[、,]?\s*/u, "")
    .split(/と|、|,/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !/^\d/.test(name) && !/^(午前|午後|行き|帰り)$/.test(name));
}

export function interpretPersonalPracticeSupplement(
  inputText: string,
  knownDates: string[]
): PersonalSupplementInterpretation {
  const text = stripSupplementPrefix(inputText);
  if (!text) {
    return { status: "not_supplement" };
  }
  if (/自転車/.test(text) && !/往復|行き帰り|行きも帰りも|行き|帰り/.test(text)) {
    return {
      status: "needs_confirmation",
      message:
        "《確認が必要》\n\n自転車が、行きのみ／帰りのみ／往復のどれか確定できません。\n\n・行きのみ\n・帰りのみ\n・往復\n\nのいずれかを教えてください。"
    };
  }
  const hint = extractHint(text, knownDates);
  const overrides = new Map<string, ParticipantTransportOverride>();
  let lastNames: string[] = [];
  let meetingPlace: string | null = null;
  let court: string | null = null;
  let deferred: string | null = null;
  const feeOverrides: SlotFeeOverrideInput[] = [];
  const clauses = text
    .split(/[。．\n]/)
    .flatMap((part) => part.split("、"))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  for (const clause of clauses) {
    const names = namesInClause(clause);
    const activeNames = names.length > 0 ? names : lastNames;
    if (names.length > 0) {
      lastNames = names;
    }
    if (/引率代/.test(clause) && /午前|他の枠|別の枠|別枠/.test(clause)) {
      for (const name of activeNames) {
        const current = overrides.get(name) ?? {
          participant_name: name,
          outbound_transport: null,
          return_transport: null,
          escort_fee_override: null,
          escort_fee_override_reason: null
        };
        current.escort_fee_override = "no_charge_this_slot";
        current.escort_fee_override_reason = "settled_in_other_slot";
        overrides.set(name, current);
      }
      continue;
    }
    const courtMatch = /([ABCabcＡＢＣ])面/.exec(clause) ?? /([1-9])面/.exec(clause);
    if (courtMatch?.[1]) {
      court = `${courtMatch[1].replace("Ａ", "A").replace("Ｂ", "B").replace("Ｃ", "C").toUpperCase()}面`;
      continue;
    }
    if (/現地集合/.test(clause)) {
      meetingPlace = "現地";
      continue;
    }
    if (/(施設費|設備費|高速|コインパ)/.test(clause) && /(高い|少し)/.test(clause)) {
      return {
        status: "needs_confirmation",
        message: "《確認が必要》\n\n金額が特定できないため、料金には反映しません。"
      };
    }
    const facilityAmount = /(?:施設費|設備費)(?:は|が)?\s*(\d{1,6})\s*円/.exec(clause);
    if (facilityAmount?.[1]) {
      feeOverrides.push({
        fee_type: "facility_fee",
        mode: "fixed_amount",
        amount: Number(facilityAmount[1]),
        note: null
      });
      continue;
    }
    const parkingAmount = /(?:コインパーキング|コインパ)(?:代)?(?:は|が)?\s*(\d{1,6})\s*円/.exec(clause);
    if (parkingAmount?.[1]) {
      feeOverrides.push({
        fee_type: "parking_fee",
        mode: "fixed_amount",
        amount: Number(parkingAmount[1]),
        note: null
      });
      continue;
    }
    if (/高速(?:代)?(?:は|が)?(?:なし|無い|ない)/.test(clause)) {
      feeOverrides.push({ fee_type: "highway_fee", mode: "no_charge", amount: null, note: null });
      continue;
    }
    if (/施設費|設備費/.test(clause) && /後日/.test(clause)) {
      deferred = "施設費等は後日精算";
      feeOverrides.push({
        fee_type: "facility_fee",
        mode: "deferred",
        amount: null,
        note: "※設備費等は後日精算となります。"
      });
      continue;
    }
    if (/(?:^|指導料は)2コマ(?:です)?$/.test(clause.replace(/\s+/g, ""))) {
      feeOverrides.push({ fee_type: "instruction_multiplier", mode: "fixed_amount", amount: 2, note: null });
      continue;
    }
    const roundTrip = /往復|行き帰り|行きも帰りも|自転車往復|往復自転車/.test(clause);
    const hasOutboundWords = /行き|行きます|送り/.test(clause);
    const hasReturnWords = /帰り/.test(clause);
    if (!roundTrip && !hasOutboundWords && !hasReturnWords && !/母が送|母送迎/.test(clause)) {
      continue;
    }
    if (activeNames.length === 0) {
      return {
        status: "needs_confirmation",
        message: "《確認が必要》\n\n誰の交通か確定できません。"
      };
    }
    for (const name of activeNames) {
      const current = overrides.get(name) ?? {
        participant_name: name,
        outbound_transport: null,
        return_transport: null,
        escort_fee_override: null,
        escort_fee_override_reason: null
      };
      if (roundTrip) {
        const transport = transportFromWords(clause);
        if (!transport) {
          return { status: "needs_confirmation", message: "《確認が必要》\n\n往復の交通手段を確定できません。" };
        }
        current.outbound_transport = transport;
        current.return_transport = transport;
      } else if (hasOutboundWords && hasReturnWords) {
        const [outboundText, returnText] = clause.split(/帰り/);
        const outbound = transportFromWords(outboundText ?? "");
        const inbound = transportFromWords(`帰り${returnText ?? ""}`);
        if (!outbound || !inbound) {
          return { status: "needs_confirmation", message: "《確認が必要》\n\n行きと帰りの交通を確定できません。" };
        }
        current.outbound_transport = outbound;
        current.return_transport = inbound;
      } else if (hasOutboundWords || /母が送|母送迎/.test(clause)) {
        const outbound = transportFromWords(clause);
        if (!outbound) {
          return { status: "needs_confirmation", message: "《確認が必要》\n\n行きの交通を確定できません。" };
        }
        current.outbound_transport = outbound;
      } else if (hasReturnWords) {
        const inbound = transportFromWords(clause);
        if (!inbound) {
          return { status: "needs_confirmation", message: "《確認が必要》\n\n帰りの交通を確定できません。" };
        }
        current.return_transport = inbound;
      }
      overrides.set(name, current);
    }
  }

  if (overrides.size === 0 && feeOverrides.length === 0 && !meetingPlace && !court && !deferred) {
    return { status: "not_supplement" };
  }
  return {
    status: "apply",
    hint,
    overrides: [...overrides.values()],
    meeting_place: meetingPlace,
    court_or_area: court,
    deferred_fee_note: deferred,
    fee_overrides: feeOverrides
  };
}

export function resolveSupplementSlot(
  hint: SupplementTargetHint,
  slots: PersonalSlotIdentity[],
  recent: PersonalSlotIdentity[] | null
): { ok: true; slot: PersonalSlotIdentity } | { ok: false; message: string } {
  const dated = hint.practice_date
    ? slots.filter((slot) => slot.practice_date === hint.practice_date)
    : slots;
  if (hint.practice_date && hint.start_time) {
    const exact = dated.filter((slot) => slot.start_time === hint.start_time);
    if (exact.length === 1 && exact[0]) {
      return { ok: true, slot: exact[0] };
    }
    return { ok: false, message: "《確認が必要》\n\n指定された日時の個人練習枠を1件に確定できません。" };
  }
  if (hint.practice_date && hint.period) {
    const periodSlots = dated.filter((slot) => {
      const hour = Number(slot.start_time.slice(0, 2));
      return hint.period === "am" ? hour < 12 : hour >= 12;
    });
    if (periodSlots.length === 1 && periodSlots[0]) {
      return { ok: true, slot: periodSlots[0] };
    }
    return { ok: false, message: "《確認が必要》\n\n午前または午後の枠を1件に確定できません。" };
  }
  if (hint.practice_date) {
    if (dated.length === 1 && dated[0]) {
      return { ok: true, slot: dated[0] };
    }
    return { ok: false, message: "《確認が必要》\n\nその日の個人練習枠が複数あるため、対象を確定できません。" };
  }
  const recentSlots = recent ?? [];
  if (recentSlots.length === 1 && recentSlots[0]) {
    const matched = slots.find(
      (slot) => slot.practice_date === recentSlots[0]?.practice_date && slot.start_time === recentSlots[0]?.start_time
    );
    if (matched) {
      return { ok: true, slot: matched };
    }
  }
  if (recentSlots.length > 1) {
    return { ok: false, message: "《確認が必要》\n\n直前に複数の枠を登録したため、どの枠への補足か確定できません。" };
  }
  return { ok: false, message: "《確認が必要》\n\nどの個人練習枠への補足か確定できません。" };
}

export function mergeParticipantOverrides(
  existing: PersonalSlotParticipantRow[],
  overrides: ParticipantTransportOverride[],
  slotNames: string[]
): { ok: true; rows: PersonalSlotParticipantRow[] } | { ok: false; message: string } {
  const next = existing.map((row) => ({ ...row }));
  for (const override of overrides) {
    const resolved = resolveMentionToSlotParticipant(override.participant_name, slotNames);
    if (resolved === "ambiguous" || resolved === null) {
      return {
        ok: false,
        message: `《確認が必要》\n\n「${override.participant_name}」をこの枠の参加者1人に確定できません。`
      };
    }
    const row = next.find((participant) => participant.participant_name === resolved);
    if (!row) {
      return {
        ok: false,
        message: `《確認が必要》\n\n「${override.participant_name}」をこの枠の参加者1人に確定できません。`
      };
    }
    if (override.outbound_transport) {
      row.outbound_transport = override.outbound_transport;
      row.outbound_source = "explicit_user_supplement";
    }
    if (override.return_transport) {
      row.return_transport = override.return_transport;
      row.return_source = "explicit_user_supplement";
    }
    if (override.escort_fee_override) {
      row.escort_fee_override = override.escort_fee_override;
      row.escort_fee_override_reason = override.escort_fee_override_reason;
    }
  }
  return { ok: true, rows: next };
}

export function rebuildParticipantsPreservingExplicit(
  names: string[],
  existing: PersonalSlotParticipantRow[],
  slotId: number,
  nowIso: string,
  meetingPlace: string | null = null
): PersonalSlotParticipantRow[] {
  return names.map((name, index) => {
    const previous = existing.find((row) => row.participant_name === name);
    const outboundExplicit = previous?.outbound_source === "explicit_user_supplement";
    const returnExplicit = previous?.return_source === "explicit_user_supplement";
    const outbound = defaultTransportForParticipant(names.length, meetingPlace, "outbound");
    const inbound = defaultTransportForParticipant(names.length, meetingPlace, "return");
    return {
      slot_id: slotId,
      participant_order: index,
      participant_name: name,
      outbound_transport: outboundExplicit && previous ? previous.outbound_transport : outbound.transport,
      outbound_source: outboundExplicit && previous ? previous.outbound_source : outbound.source,
      return_transport: returnExplicit && previous ? previous.return_transport : inbound.transport,
      return_source: returnExplicit && previous ? previous.return_source : inbound.source,
      escort_fee_override: previous?.escort_fee_override ?? null,
      escort_fee_override_reason: previous?.escort_fee_override_reason ?? null,
      updated_at: nowIso
    };
  });
}

export function formatTransportStateLabel(transport: PersonalTransport, source: PersonalTransportSource): string {
  const transportLabel =
    transport === "shimura_car"
      ? "志村号"
      : transport === "bicycle"
        ? "自転車"
        : transport === "parent_car"
          ? "保護者送迎"
          : transport === "unknown"
            ? "未確定"
            : transport;
  const sourceLabel =
    source === "default_personal_practice" ? "標準" : source === "explicit_user_supplement" ? "明示" : "未確定";
  return `${transportLabel}（${sourceLabel}）`;
}

export function formatPersonalSupplementReply(
  slotLabel: string,
  location: string | null,
  rows: PersonalSlotParticipantRow[]
): string {
  const lines = ["《個人練習の補足を反映》", "", slotLabel, location ?? "場所：不明", ""];
  for (const row of rows) {
    lines.push(row.participant_name);
    lines.push(`行き：${formatTransportStateLabel(row.outbound_transport, row.outbound_source)}`);
    lines.push(`帰り：${formatTransportStateLabel(row.return_transport, row.return_source)}`);
    if (row.escort_fee_override === "no_charge_this_slot") {
      lines.push("引率代：この枠では請求なし");
      lines.push("理由：午前枠で精算");
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function participantsNeedTransportConfirmation(rows: PersonalSlotParticipantRow[]): boolean {
  return rows.some((row) => row.outbound_transport === "unknown" || row.return_transport === "unknown");
}
