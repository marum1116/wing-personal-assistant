export type ReceivableStatus = "open" | "received" | "needs_review";

export type ReceivableSnapshot = {
  participant_name: string;
  expected_amount: number | null;
  received_at: string | null;
  received_amount: number | null;
  status: ReceivableStatus;
  review_note: string | null;
};

export type ReceivablePlan = {
  upserts: ReceivableSnapshot[];
  blockedReason: string | null;
};

export function isWatanabeReceivableName(name: string): boolean {
  const compact = name.replace(/\s+/gu, "");
  return compact === "渡辺" || compact === "渡辺塁";
}

export function planReceivableSync(input: {
  participantNames: string[];
  perPersonAmount: number | null;
  complete: boolean;
  uncertainPoints: string[];
  existing: ReceivableSnapshot[];
}): ReceivablePlan {
  if (!input.complete || typeof input.perPersonAmount !== "number" || input.perPersonAmount <= 0) {
    return {
      upserts: [],
      blockedReason: input.uncertainPoints.length > 0 ? input.uncertainPoints.join("\n") : "金額が未確定のため集金状況を作成できません。"
    };
  }
  const targets = input.participantNames.filter((name) => !isWatanabeReceivableName(name));
  const existingByName = new Map(input.existing.map((row) => [row.participant_name, row]));
  const upserts = targets.map((name) => {
    const current = existingByName.get(name);
    if (current && (current.status === "received" || current.received_at) && current.expected_amount !== input.perPersonAmount) {
      return {
        ...current,
        status: "needs_review" as const,
        review_note: `受取済みの金額 ${current.expected_amount ?? "不明"}円 と、再計算の ${input.perPersonAmount}円 が違います。`
      };
    }
    if (current?.status === "received" || current?.received_at) {
      return current;
    }
    return {
      participant_name: name,
      expected_amount: input.perPersonAmount,
      received_at: null,
      received_amount: null,
      status: "open" as const,
      review_note: null
    };
  });
  return { upserts, blockedReason: null };
}
