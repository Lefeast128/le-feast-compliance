export type CalendarStatus = "green" | "amber" | "red" | "grey";

export function storeLocalDateKey(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
}

export function createStoreDayTracker(timeZone: string, timestamp = Date.now()) {
  let currentDate = storeLocalDateKey(timestamp, timeZone);
  return {
    get currentDate() { return currentDate; },
    refresh(timestamp = Date.now()) {
      const nextDate = storeLocalDateKey(timestamp, timeZone);
      if (nextDate === currentDate) return false;
      currentDate = nextDate;
      return true;
    },
  };
}

export function calendarStatusLabel(status: CalendarStatus | string) {
  if (status === "green") return "Complete";
  if (status === "amber") return "Corrective action recorded";
  if (status === "grey") return "Future or non-operating date";
  return "Incomplete scheduled work";
}
