import assert from "node:assert/strict";
import { correctiveActionReady, temperatureActionNote } from "../src/lib/temperature-action.ts";

assert.equal(correctiveActionReady("Fridge door checked", ""), true, "standard actions do not require a cause explanation");
assert.equal(correctiveActionReady("Other", ""), false, "Other requires a description of the action taken");
assert.equal(correctiveActionReady("Other", "Food moved to the prep fridge"), true, "Other accepts a described action");
assert.equal(temperatureActionNote("Fridge door checked", ""), "Fridge door checked", "empty notes do not create placeholder text");
assert.equal(temperatureActionNote("Other", "Food moved to the prep fridge"), "Other — Food moved to the prep fridge", "the action and optional detail are stored together");
console.log("Temperature corrective-action tests passed: optional notes, Other validation and no placeholder text");
