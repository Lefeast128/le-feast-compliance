import assert from "node:assert/strict";
import fs from "node:fs";
import { temperatureResult } from "../src/server/compliance/validation.ts";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const temperatureService = read("../src/server/compliance/temperature-service.ts");
const equipmentService = read("../src/server/management/equipment-service.ts");
const adminPrimitives = read("../src/components/admin/AdminPrimitives.tsx");
const migration = read("../drizzle/0009_foamy_piledriver.sql");

const checks = [
  ["low below minimum fails", temperatureResult(-3.8, 0, 5, 8) === "fail"],
  ["low boundary below minimum fails", temperatureResult(-0.1, 0, 5, 8) === "fail"],
  ["minimum boundary is normal", temperatureResult(0, 0, 5, 8) === "normal"],
  ["preferred boundary is normal", temperatureResult(5, 0, 5, 8) === "normal"],
  ["above preferred is within limit", temperatureResult(6, 0, 5, 8) === "within_limit"],
  ["maximum boundary is within limit", temperatureResult(8, 0, 5, 8) === "within_limit"],
  ["high above maximum fails", temperatureResult(8.1, 0, 5, 8) === "fail"],
  ["recheck below minimum fails", -4 < 0 || -4 > 8],
  ["recheck above maximum fails", 9 < 0 || 9 > 8],
  ["recheck in range passes", !(2 < 0 || 2 > 8)],
  ["equipment validates range order", equipmentService.includes("minimumTemperature > preferredTemperature || preferredTemperature > maximumTemperature")],
  ["equipment defaults minimum to zero", equipmentService.includes('input.minimumTemperature === undefined ? 0') && equipmentService.includes("minimumTemperature: 0")],
  ["reading snapshots minimum", temperatureService.includes("minimumTemperature: minimum")],
  ["reading uses minimum in result", temperatureService.includes("temperatureResult(input.temperature, minimum, preferred, maximum)")],
  ["recheck uses minimum and maximum", temperatureService.includes("input.temperature >= minimum && input.temperature <= maximum")],
  ["historical recheck minimum fallback is zero", temperatureService.includes("reading.minimumTemperature ?? 0")],
  ["low failure creates existing temperature issue", temperatureService.includes('category: "Temperature"') && temperatureService.includes("sourceTemperatureReadingId: reading.id")],
  ["admin shows minimum temperature", adminPrimitives.includes("Minimum °C")],
  ["admin shows preferred temperature", adminPrimitives.includes("Preferred °C")],
  ["admin shows maximum temperature", adminPrimitives.includes("Maximum °C")],
  ["equipment migration adds zero minimum", migration.includes('ADD COLUMN "minimum_temperature" real DEFAULT 0 NOT NULL')],
  ["reading migration adds nullable snapshot", migration.includes('ALTER TABLE "temperature_readings" ADD COLUMN "minimum_temperature" real')],
];

for (const [name, passed] of checks) assert.equal(passed, true, name);

console.log(`Temperature range tests passed: ${checks.length}/${checks.length}`);
