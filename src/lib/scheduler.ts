export type ReviewResult = "known" | "vague" | "forgot";

export type ScheduleState = {
  intervalDays: number;
  reviewCount: number;
  easeScore: number;
  lastResult?: ReviewResult | null;
};

export type ScheduleUpdate = {
  intervalDays: number;
  reviewCount: number;
  easeScore: number;
  nextReviewAt: Date;
  lastResult: ReviewResult;
};

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function createInitialSchedule(now = new Date()): ScheduleUpdate {
  return {
    intervalDays: 0,
    reviewCount: 0,
    easeScore: 2.5,
    nextReviewAt: now,
    lastResult: "vague",
  };
}

export function calculateNextSchedule(
  current: ScheduleState,
  result: ReviewResult,
  now = new Date(),
): ScheduleUpdate {
  const safeInterval = Math.max(0, current.intervalDays || 0);
  const safeReviewCount = Math.max(0, current.reviewCount || 0);
  let nextInterval = 0;
  let nextEase = current.easeScore || 2.5;

  if (result === "forgot") {
    nextInterval = 1;
    nextEase = Math.max(1.3, nextEase - 0.2);
  }

  if (result === "vague") {
    nextInterval = safeInterval <= 1 ? 2 : Math.max(2, Math.round(safeInterval * 1.5));
    nextEase = Math.max(1.3, nextEase - 0.05);
  }

  if (result === "known") {
    if (safeInterval < 1) {
      nextInterval = 4;
    } else if (safeInterval < 4) {
      nextInterval = 7;
    } else {
      nextInterval = Math.max(4, Math.round(safeInterval * nextEase));
    }

    nextEase = Math.min(3.2, nextEase + 0.05);
  }

  return {
    intervalDays: nextInterval,
    reviewCount: safeReviewCount + 1,
    easeScore: Number(nextEase.toFixed(2)),
    nextReviewAt: addDays(now, nextInterval),
    lastResult: result,
  };
}
