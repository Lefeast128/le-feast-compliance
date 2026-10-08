export type AdditionalNumericField = {
  key: string;
  label: string;
  type: string;
  minimum?: number;
  maximum?: number;
};

export function additionalFieldFailed(field: AdditionalNumericField, value: string | undefined) {
  if (field.type === "yes_no") return value === "no";
  if (field.type !== "number" && field.type !== "temperature") return false;
  if (value === undefined || value.trim() === "") return false;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  return (field.minimum !== undefined && numeric < field.minimum) || (field.maximum !== undefined && numeric > field.maximum);
}

export function additionalCheckHasFailure(fields: AdditionalNumericField[], values: Record<string, string | undefined>) {
  return fields.some(field => additionalFieldFailed(field, values[field.key]));
}
