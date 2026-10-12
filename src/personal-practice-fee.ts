import type { PersonalSlotParticipantRow, SlotFeeOverrideInput } from "./personal-slot-supplement";

export type PersonalPracticeFeeTemplate = {
  id: number;
  facility_key: string;
  facility_name: string;
  version: number;
  is_active: number;
  valid_from: string;
  instruction_fee_per_person: number;
  escort_fee_per_shimura_direction: number;
  facility_fee_mode: string;
  facility_fee_amount: number | null;
  highway_fee_mode: string;
  highway_fee_round_trip: number | null;
  parking_fee_mode: string;
  parking_fee_amount: number | null;
  deferred_note: string | null;
  blocks_completion_note: string | null;
};

export type PersonalPracticeFeeVariant = {
  template_id: number;
  variant_key: string;
  amount: number;
};

export type PersonalPracticeFeeLine = {
  fee_type: "instruction_fee" | "facility_fee" | "highway_fee" | "escort_fee" | "parking_fee";
  label: string;
  status: "amount" | "no_charge" | "deferred" | "uncertain";
  amount: number | null;
  origin: "template" | "override" | "calculated";
};

export type PersonalPracticeFeeResult = {
  status: "complete" | "needs_confirmation";
  items: PersonalPracticeFeeLine[];
  total_amount: number | null;
  per_person_amount: number | null;
  participant_amounts: Array<{ participant_name: string; amount: number }> | null;
  uncertain_points: string[];
  template_version: number | null;
  template_facility_key: string | null;
  deferred_note: string | null;
};

export type PersonalPracticeFeeSlotInput = {
  practice_date: string;
  start_time: string;
  end_time: string | null;
  practice_location: string | null;
  meeting_place: string | null;
  court_or_area: string | null;
  participant_names: string[];
};

const STANDARD_MEETING_PLACE = "志村家前";

export function selectPersonalPracticeFeeTemplate(
  templates: PersonalPracticeFeeTemplate[],
  location: string | null,
  practiceDate: string
): PersonalPracticeFeeTemplate | null {
  if (!location) {
    return null;
  }
  const normalizedLocation = location.replace(/\s+/g, "");
  const matches = templates.filter((template) => {
    if (Number(template.is_active) !== 1) {
      return false;
    }
    if (template.valid_from > practiceDate) {
      return false;
    }
    const name = template.facility_name.replace(/\s+/g, "");
    return normalizedLocation.includes(name) || name.includes(normalizedLocation);
  });
  matches.sort((left, right) => right.version - left.version || right.valid_from.localeCompare(left.valid_from));
  return matches[0] ?? null;
}

function durationHours(startTime: string, endTime: string | null): number | null {
  if (!endTime) {
    return null;
  }
  const start = /^(\d{2}):(\d{2})$/.exec(startTime);
  const end = /^(\d{2}):(\d{2})$/.exec(endTime);
  if (!start || !end) {
    return null;
  }
  const minutes = Number(end[1]) * 60 + Number(end[2]) - (Number(start[1]) * 60 + Number(start[2]));
  if (minutes <= 0 || minutes % 60 !== 0) {
    return null;
  }
  return minutes / 60;
}

function courtCount(courtOrArea: string | null): number | null {
  if (!courtOrArea) {
    return null;
  }
  const count = /^([1-9])面$/.exec(courtOrArea.trim());
  if (count?.[1]) {
    return Number(count[1]);
  }
  if (/^[ABC]面$/.test(courtOrArea.trim())) {
    return 1;
  }
  return null;
}

function courtLabel(courtOrArea: string | null): string | null {
  const match = /^([ABC])面$/.exec(courtOrArea?.trim() ?? "");
  return match?.[1] ?? null;
}

function overrideFor(
  overrides: SlotFeeOverrideInput[],
  feeType: SlotFeeOverrideInput["fee_type"]
): SlotFeeOverrideInput | null {
  return overrides.find((override) => override.fee_type === feeType) ?? null;
}

function escortYen(row: PersonalSlotParticipantRow, unit: number): number | null {
  if (row.outbound_transport === "unknown" || row.return_transport === "unknown") {
    return null;
  }
  if (row.escort_fee_override === "no_charge_this_slot") {
    return 0;
  }
  let amount = 0;
  if (row.outbound_transport === "shimura_car") {
    amount += unit;
  }
  if (row.return_transport === "shimura_car") {
    amount += unit;
  }
  return amount;
}

export function calculatePersonalPracticeFee(input: {
  slot: PersonalPracticeFeeSlotInput;
  participants: PersonalSlotParticipantRow[];
  templates: PersonalPracticeFeeTemplate[];
  variants: PersonalPracticeFeeVariant[];
  overrides: SlotFeeOverrideInput[];
}): PersonalPracticeFeeResult {
  const uncertain = new Set<string>();
  const template = selectPersonalPracticeFeeTemplate(input.templates, input.slot.practice_location, input.slot.practice_date);
  if (!template) {
    uncertain.add("この日付に使える施設料金テンプレート");
  }
  if (input.participants.length >= 4) {
    uncertain.add("参加者が4名以上のため、交通と料金は自動確定しません");
  }
  if (input.participants.some((row) => row.outbound_transport === "unknown" || row.return_transport === "unknown")) {
    uncertain.add("参加者ごとの交通手段");
  }
  if (input.slot.meeting_place && input.slot.meeting_place !== STANDARD_MEETING_PLACE) {
    const outboundUsesDefaultShimura = input.participants.some(
      (row) => row.outbound_transport === "shimura_car" && row.outbound_source === "default_personal_practice"
    );
    if (outboundUsesDefaultShimura) {
      uncertain.add("志村家前以外の集合があるため、行きの志村号を標準値のまま確定できません");
    }
  }

  const instructionMultiplier = overrideFor(input.overrides, "instruction_multiplier");
  let multiplier = 1;
  if (instructionMultiplier) {
    if (instructionMultiplier.mode === "fixed_amount" && instructionMultiplier.amount && instructionMultiplier.amount > 0) {
      multiplier = instructionMultiplier.amount;
    } else {
      uncertain.add("指導料のコマ数");
    }
  }
  const instructionAmount = template ? template.instruction_fee_per_person * input.slot.participant_names.length * multiplier : null;
  const items: PersonalPracticeFeeLine[] = [
    {
      fee_type: "instruction_fee",
      label: "指導料",
      status: instructionAmount === null ? "uncertain" : "amount",
      amount: instructionAmount,
      origin: "template"
    }
  ];

  const facilityOverride = overrideFor(input.overrides, "facility_fee");
  let facility: PersonalPracticeFeeLine = {
    fee_type: "facility_fee",
    label: "施設費",
    status: "uncertain",
    amount: null,
    origin: "template"
  };
  let deferredNote = template?.deferred_note ?? null;
  if (facilityOverride?.mode === "fixed_amount" && typeof facilityOverride.amount === "number") {
    facility = { ...facility, status: "amount", amount: facilityOverride.amount, origin: "override" };
    deferredNote = null;
  } else if (facilityOverride?.mode === "deferred") {
    facility = { ...facility, status: "deferred", amount: null, origin: "override" };
    deferredNote = facilityOverride.note ?? "※設備費等は後日精算となります。";
  } else if (facilityOverride?.mode === "no_charge") {
    facility = { ...facility, status: "no_charge", amount: 0, origin: "override" };
    deferredNote = null;
  } else if (template?.facility_fee_mode === "fixed" && typeof template.facility_fee_amount === "number") {
    facility = { ...facility, status: "amount", amount: template.facility_fee_amount };
  } else if (template?.facility_fee_mode === "deferred") {
    facility = { ...facility, status: "deferred", amount: null };
  } else if (template?.facility_fee_mode === "by_court_label") {
    const label = courtLabel(input.slot.court_or_area);
    const variant = label
      ? input.variants.find((row) => row.template_id === template.id && row.variant_key === `court:${label}`)
      : null;
    if (variant) {
      facility = { ...facility, status: "amount", amount: variant.amount };
    } else {
      uncertain.add("使用コート面ごとの施設費");
    }
  } else if (template?.facility_fee_mode === "by_duration_hours") {
    const hours = durationHours(input.slot.start_time, input.slot.end_time);
    const variant =
      hours === null
        ? null
        : input.variants.find((row) => row.template_id === template.id && row.variant_key === `duration:${hours}`);
    if (variant) {
      facility = { ...facility, status: "amount", amount: variant.amount };
    } else {
      uncertain.add("練習時間に対応する施設費");
    }
  } else if (template?.facility_fee_mode === "per_court_count" && typeof template.facility_fee_amount === "number") {
    const count = courtCount(input.slot.court_or_area);
    if (count) {
      facility = { ...facility, status: "amount", amount: template.facility_fee_amount * count };
    } else {
      uncertain.add("使用コート面数");
    }
  } else if (template) {
    uncertain.add("施設費");
  }
  items.push(facility);

  const allRoundTripShimura =
    input.participants.length > 0 &&
    input.participants.length <= 3 &&
    input.participants.every((row) => row.outbound_transport === "shimura_car" && row.return_transport === "shimura_car");
  const highwayOverride = overrideFor(input.overrides, "highway_fee");
  let highway: PersonalPracticeFeeLine = {
    fee_type: "highway_fee",
    label: "高速代",
    status: "uncertain",
    amount: null,
    origin: "template"
  };
  if (highwayOverride?.mode === "no_charge") {
    highway = { ...highway, status: "no_charge", amount: 0, origin: "override" };
  } else if (highwayOverride?.mode === "fixed_amount" && typeof highwayOverride.amount === "number") {
    highway = { ...highway, status: "amount", amount: highwayOverride.amount, origin: "override" };
  } else if (!allRoundTripShimura) {
    uncertain.add("高速代の負担");
  } else if (template?.highway_fee_mode === "none") {
    highway = { ...highway, status: "no_charge", amount: 0 };
  } else if (template?.highway_fee_mode === "round_trip" && typeof template.highway_fee_round_trip === "number") {
    highway = { ...highway, status: "amount", amount: template.highway_fee_round_trip };
  } else if (template) {
    uncertain.add("高速代");
  }
  items.push(highway);

  const escortUnit = template?.escort_fee_per_shimura_direction ?? 100;
  const escortAmounts = input.participants.map((row) => escortYen(row, escortUnit));
  const escortKnown = escortAmounts.every((amount) => amount !== null);
  const escortTotal = escortKnown ? escortAmounts.reduce((sum, amount) => sum + (amount ?? 0), 0) : null;
  items.push({
    fee_type: "escort_fee",
    label: "引率代",
    status: escortTotal === null ? "uncertain" : "amount",
    amount: escortTotal,
    origin: "calculated"
  });
  if (escortTotal === null) {
    uncertain.add("引率代");
  }

  const parkingOverride = overrideFor(input.overrides, "parking_fee");
  let parking: PersonalPracticeFeeLine = {
    fee_type: "parking_fee",
    label: "コインパーキング",
    status: "uncertain",
    amount: null,
    origin: "template"
  };
  if (parkingOverride?.mode === "fixed_amount" && typeof parkingOverride.amount === "number") {
    parking = { ...parking, status: "amount", amount: parkingOverride.amount, origin: "override" };
  } else if (parkingOverride?.mode === "no_charge") {
    parking = { ...parking, status: "no_charge", amount: 0, origin: "override" };
  } else if (template?.parking_fee_mode === "none") {
    parking = { ...parking, status: "no_charge", amount: 0 };
  } else if (template?.parking_fee_mode === "fixed" && typeof template.parking_fee_amount === "number") {
    parking = { ...parking, status: "amount", amount: template.parking_fee_amount };
  } else if (template?.parking_fee_mode === "uncertain") {
    uncertain.add("コインパーキング代");
  } else if (template) {
    uncertain.add("コインパーキング代");
  }
  items.push(parking);

  if (template?.blocks_completion_note) {
    uncertain.add(template.blocks_completion_note);
  }

  const sameTransport =
    input.participants.length > 0 &&
    input.participants.every(
      (row) =>
        row.outbound_transport === input.participants[0]?.outbound_transport &&
        row.return_transport === input.participants[0]?.return_transport &&
        row.escort_fee_override === input.participants[0]?.escort_fee_override
    );
  if (!sameTransport) {
    uncertain.add("参加者ごとの負担額");
  }

  const billable = items.filter((item) => item.status === "amount" || item.status === "no_charge");
  const hasUncertainItem = items.some((item) => item.status === "uncertain");
  const complete = uncertain.size === 0 && !hasUncertainItem && billable.length === items.filter((item) => item.status !== "deferred").length;
  if (!complete) {
    return {
      status: "needs_confirmation",
      items,
      total_amount: null,
      per_person_amount: null,
      participant_amounts: null,
      uncertain_points: [...uncertain],
      template_version: template?.version ?? null,
      template_facility_key: template?.facility_key ?? null,
      deferred_note: deferredNote
    };
  }
  const total = items.reduce((sum, item) => sum + (item.status === "amount" ? item.amount ?? 0 : 0), 0);
  const count = input.slot.participant_names.length;
  const perPerson = count > 0 ? Math.ceil(total / count) : null;
  return {
    status: "complete",
    items,
    total_amount: total,
    per_person_amount: perPerson,
    participant_amounts:
      perPerson === null ? null : input.slot.participant_names.map((name) => ({ participant_name: name, amount: perPerson })),
    uncertain_points: [],
    template_version: template?.version ?? null,
    template_facility_key: template?.facility_key ?? null,
    deferred_note: deferredNote
  };
}
