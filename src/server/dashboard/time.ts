const dateParts = (timestamp: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return { year: Number(value("year")), month: Number(value("month")), day: Number(value("day")) };
};

export const localDateKey = (timestamp: number, timeZone: string) => {
  const parts = dateParts(timestamp, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
};

const offsetMinutes = (timestamp: number, timeZone: string) => {
  const value = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date(timestamp)).find(part => part.type === "timeZoneName")?.value ?? "GMT";
  const match = value.match(/^GMT(?:(?<sign>[+-])(?<hours>\d{2}):?(?<minutes>\d{2})?)?$/);
  if (!match?.groups?.sign) return 0;
  const minutes = Number(match.groups.hours) * 60 + Number(match.groups.minutes ?? 0);
  return match.groups.sign === "+" ? minutes : -minutes;
};

export const localDayRange = (timestamp: number, timeZone: string) => {
  const parts = dateParts(timestamp, timeZone);
  const utcForParts = (year: number, month: number, day: number) => {
    const naiveUtc = Date.UTC(year, month - 1, day);
    const firstOffset = offsetMinutes(naiveUtc, timeZone);
    const firstStart = naiveUtc - firstOffset * 60_000;
    return naiveUtc - offsetMinutes(firstStart, timeZone) * 60_000;
  };
  return {
    start: utcForParts(parts.year, parts.month, parts.day),
    end: utcForParts(parts.year, parts.month, parts.day + 1),
  };
};

export const localWeekday = (timestamp: number, timeZone: string) => {
  const value = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(new Date(timestamp));
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(value) + 1;
};
