import { dateFromKey, formatDateKey } from "@/lib/date-key";

export type ReportRange = { start: string; end: string };

const addDays = (value: Date, amount: number) => {
  const result = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  result.setDate(result.getDate() + amount);
  return result;
};

export const currentMonthRange = (now = new Date()): ReportRange => ({
  start: formatDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
  end: formatDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
});

export const previousMonthRange = (now = new Date()): ReportRange => ({
  start: formatDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  end: formatDateKey(new Date(now.getFullYear(), now.getMonth(), 0)),
});

export const last30DaysRange = (now = new Date()): ReportRange => ({
  start: formatDateKey(addDays(now, -29)),
  end: formatDateKey(now),
});

export const reportRangeLabel = ({ start, end }: ReportRange) => `${dateFromKey(start).toLocaleDateString("en-GB")} – ${dateFromKey(end).toLocaleDateString("en-GB")}`;

