export const clampTemperature = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value * 10) / 10));

export const adjustedTemperature = (
  value: string,
  delta: number,
  safeMin: number,
  min: number,
  max: number,
) => {
  const current = value === "" || !Number.isFinite(Number(value)) ? safeMin : Number(value);
  return clampTemperature(current + delta, min, max).toFixed(1);
};
