import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adjustedTemperature, clampTemperature } from "../src/lib/temperature-gauge.ts";

const component = await readFile(new URL("../src/components/TemperatureGauge.tsx", import.meta.url), "utf8");

assert.equal(adjustedTemperature("4.2", 0.1, 0, -25, 15), "4.3");
assert.equal(adjustedTemperature("4.2", -0.1, 0, -25, 15), "4.1");
assert.equal(adjustedTemperature("", 0.1, 0, -25, 15), "0.1");
assert.equal(adjustedTemperature("", -0.1, 0, -25, 15), "-0.1");
assert.equal(adjustedTemperature("15.0", 0.1, 0, -25, 15), "15.0");
assert.equal(adjustedTemperature("-25.0", -0.1, 0, -25, 15), "-25.0");
assert.equal(clampTemperature(4.26, -25, 15), 4.3);
assert.match(component, /aria-label="Decrease temperature"/);
assert.match(component, /aria-label="Increase temperature"/);
assert.match(component, /type="range"/);
assert.match(component, /type="number"/);
assert.match(component, /outOfRange/);

console.log("Temperature control tests passed: 12/12");
