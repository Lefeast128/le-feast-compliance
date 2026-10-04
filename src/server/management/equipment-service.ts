import { eq } from "drizzle-orm";
import { equipment } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { db, audit, finite, id, locationFor, text } from "./shared.js";

const orderFor = async (locationId: string) => {
  const rows = await db().select().from(equipment).where(eq(equipment.locationId, locationId));
  return rows.length;
};

export async function addEquipment(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const name = input.name === undefined ? `Fridge ${(await orderFor(location.id)) + 1}` : text(input.name, "Name");
  const type = input.type === undefined ? "Food fridge" : text(input.type, "Type");
  const minimumTemperature = input.minimumTemperature === undefined ? 0 : finite(input.minimumTemperature, "minimumTemperature");
  const preferredTemperature = input.preferredTemperature === undefined ? 5 : finite(input.preferredTemperature, "preferredTemperature");
  const maximumTemperature = input.maximumTemperature === undefined ? 8 : finite(input.maximumTemperature, "maximumTemperature");
  if (minimumTemperature > preferredTemperature || preferredTemperature > maximumTemperature) throw new ApiError(422, "Temperature range must satisfy minimum <= preferred <= maximum");
  return db().transaction(async tx => {
    const [row] = await tx.insert(equipment).values({ locationId: location.id, name, type, minimumTemperature, preferredTemperature, maximumTemperature, order: await orderFor(location.id), active: true }).returning();
    await audit(tx, location.id, context.user.id, "equipment_added", name);
    return row;
  });
}

export async function updateEquipment(context: AuthContext, equipmentId: string, input: Record<string, unknown>) {
  const idValue = id(equipmentId, "equipmentId");
  const [item] = await db().select().from(equipment).where(eq(equipment.id, idValue)).limit(1);
  if (!item) throw new ApiError(404, "Equipment not found");
  const location = await locationFor(context, item.locationId);
  if (!item.active) throw new ApiError(409, "This configuration version is no longer active");
  const minimumTemperature = input.minimumTemperature === undefined ? item.minimumTemperature : finite(input.minimumTemperature, "minimumTemperature");
  const preferredTemperature = finite(input.preferredTemperature, "preferredTemperature");
  const maximumTemperature = finite(input.maximumTemperature, "maximumTemperature");
  if (minimumTemperature > preferredTemperature || preferredTemperature > maximumTemperature) throw new ApiError(422, "Temperature range must satisfy minimum <= preferred <= maximum");
  return db().transaction(async tx => {
    const at = new Date();
    await tx.update(equipment).set({ active: false, deactivatedAt: at }).where(eq(equipment.id, item.id));
    const [replacement] = await tx.insert(equipment).values({ locationId: location.id, name: item.name, type: item.type, order: item.order, minimumTemperature, preferredTemperature, maximumTemperature, active: true }).returning();
    await audit(tx, location.id, context.user.id, "equipment_limits_updated", `${item.name}: minimum ${minimumTemperature}°C, preferred ${preferredTemperature}°C, maximum ${maximumTemperature}°C`);
    return replacement;
  });
}

export async function setFridgeCount(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const count = finite(input.count, "count");
  if (!Number.isInteger(count) || count < 0) throw new ApiError(422, "count must be a whole number of at least 0");
  return db().transaction(async tx => {
    const rows = await tx.select().from(equipment).where(eq(equipment.locationId, location.id));
    const active = rows.filter(row => row.active).sort((a, b) => a.order - b.order);
    const at = new Date();
    for (let i = 0; i < active.length; i++) await tx.update(equipment).set(i < count ? { name: `Fridge ${i + 1}`, active: true } : { name: `Fridge ${i + 1}`, active: false, deactivatedAt: at }).where(eq(equipment.id, active[i].id));
    for (let i = active.length; i < count; i++) await tx.insert(equipment).values({ locationId: location.id, name: `Fridge ${i + 1}`, type: "Food fridge", minimumTemperature: 0, preferredTemperature: 5, maximumTemperature: 8, order: i, active: true });
    await audit(tx, location.id, context.user.id, "fridge_count_changed", `Active fridges set to ${count}`);
    return { count };
  });
}
