import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildSightingPayload,
  getDemoDiveSites,
  getProgressState,
  getRetryMessage,
  getSpeciesForSite,
  validateSighting,
} from "../workflow.js";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const validDraft = {
  profile: "Open Water student",
  site_id: "tioman-demo",
  species_id: "clownfish-demo",
  recognition: "Green turtle (demo suggestion)",
  activity: "Sighting only",
  observed_at: "2026-08-14T10:00",
  note: "Turtle moved calmly over the reef.",
};

test("offers Malaysian demo dive sites when an external catalogue is unavailable", () => {
  assert.deepEqual(getDemoDiveSites().map((site) => site.name), [
    "Tioman reef demonstration zone",
    "Perhentian reef demonstration zone",
  ]);
});

test("shows backend-safe species directory ids", () => {
  assert.deepEqual(getSpeciesForSite("tioman-demo").map((species) => species.id), [
    "clownfish-demo",
    "parrotfish-demo",
    "seahorse-sensitive-demo",
  ]);
});

test("accepts a complete synthetic dive sighting and keeps it clearly labelled", () => {
  assert.deepEqual(validateSighting(validDraft), {});
  assert.deepEqual(buildSightingPayload(validDraft), {
    site_id: "tioman-demo",
    species_id: "clownfish-demo",
    observed_at: "2026-08-14T10:00:00",
    note: "Turtle moved calmly over the reef.",
  });
});

test("requires backend-safe ids and a sighting choice before confirmation", () => {
  const errors = validateSighting({ ...validDraft, site_id: "", species_id: "Unknown", activity: "" });
  assert.equal(errors.site_id, "Choose a dive site.");
  assert.equal(errors.species_id, "Choose a species from the directory.");
  assert.equal(errors.activity, "Choose sighting only or collection.");
});

test("keeps the confirmed draft available after a request failure", () => {
  assert.equal(
    getRetryMessage(),
    "The service is unavailable. Your confirmed demo record is still here; try again or continue with the demo result.",
  );
});

test("tracks the DiveSafe stages without removing the active stage", () => {
  assert.deepEqual(getProgressState("briefing"), {
    profile: "complete",
    site: "complete",
    briefing: "active",
    confirm: "pending",
    record: "pending",
  });
});

test("keeps Leaflet and an accessible species list in the page", () => {
  const html = readFileSync(resolve(frontendDir, "index.html"), "utf8");
  assert.match(html, /id="site-map"/);
  assert.match(html, /id="species-list"/);
  assert.match(html, /leaflet@1\.9\.4/);
});

test("uses the sighting endpoint and never collects precise coordinates", () => {
  const html = readFileSync(resolve(frontendDir, "index.html"), "utf8");
  const app = readFileSync(resolve(frontendDir, "app.js"), "utf8");
  assert.doesNotMatch(html, /name="latitude"|name="longitude"/);
  assert.match(app, /\/api\/sightings/);
  assert.match(app, /\/api\/recognize/);
  assert.doesNotMatch(app, /dive-sightings|latitude:|longitude:/);
});
