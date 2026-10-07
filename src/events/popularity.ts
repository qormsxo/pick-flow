import { HOT_WINDOW_DAYS } from '../queue/queue.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export function popularityDayKey(date: Date): string {
  return `pop:products:${date.toISOString().slice(0, 10)}`;
}

export function popularityWindow(now: Date, days = HOT_WINDOW_DAYS): Array<{ key: string; ageDays: number }> {
  return Array.from({ length: days }, (_, ageDays) => ({
    key: popularityDayKey(new Date(now.getTime() - ageDays * DAY_MS)),
    ageDays,
  }));
}

/** 14일마다 무게가 절반이 된다. */
export function decayedScore(score: number, ageDays: number): number {
  return score * Math.pow(0.5, ageDays / HOT_WINDOW_DAYS);
}

/** 날짜별 점수를 감소시켜 합친 뒤 높은 순으로 자른다. */
export function rankPopularity(
  days: Array<{ ageDays: number; rows: Array<{ member: string; score: number }> }>,
  limit: number,
): string[] {
  const totals = new Map<string, number>();

  for (const day of days) {
    for (const row of day.rows) {
      totals.set(row.member, (totals.get(row.member) ?? 0) + decayedScore(row.score, day.ageDays));
    }
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([id]) => id);
}
