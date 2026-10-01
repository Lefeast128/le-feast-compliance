import { ApiError } from "./errors.ts";
import { localDateKey, localDayRange } from "../dashboard/time.ts";

export { localDateKey, localDayRange };

export const requireUuid = (value: unknown, name: string) => {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) throw new ApiError(400, `${name} must be a valid identifier`);
  return value;
};

export const requireString = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${name} is required`);
  return value.trim();
};

export const requireFiniteNumber = (value: unknown, name: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiError(400, `${name} must be a valid number`);
  return value;
};

export const requireEnum = <T extends string>(value: unknown, name: string, allowed: readonly T[]): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new ApiError(400, `${name} is invalid`);
  return value as T;
};

export const requirePositiveNumberString = (value: unknown) => {
  const text = requireString(value, "quantity");
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) throw new ApiError(422, "Wastage quantity must be greater than 0");
  return text;
};

export const temperatureResult = (temperature: number, preferred: number, maximum: number) =>
  temperature > maximum ? "fail" : temperature > preferred ? "within_limit" : "normal";

export const probeResult = (temperature: number, minimum: number) => temperature >= minimum ? "pass" : "fail";

export const equipmentApplicableAtRound = (createdAt: Date, deactivatedAt: Date | null, startedAt: Date) =>
  createdAt <= startedAt && (!deactivatedAt || deactivatedAt >= startedAt);
