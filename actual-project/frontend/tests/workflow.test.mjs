import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildLitterReport,
  getDemoDetection,
  getDemoHotspots,
  getProgressState,
  getRetryMessage,
  validateCleanupMission,
  validateLitterReport,
} from "../workflow.js";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const report = {
  area_id: "tioman-coast",
  litter_type: "Plastic packaging",
  description: "Several bottles gathered near the public shoreline.",
};

test("accepts a broad-area litter report and never requires coordinates", () => {
  assert.deepEqual(validateLitterReport(report), {});
  assert.deepEqual(buildLitterReport(report), {
    area_id: "tioman-coast",
    litter_type: "Plastic packaging",
    description: "Several bottles gathered near the public shoreline.",
  });
});

test("requires a report before detection can be confirmed", () => {
  const errors = validateLitterReport({ ...report, area_id: "", litter_type: "", description: "" });
  assert.equal(errors.area_id, "Choose a broad reporting area.");
  assert.equal(errors.litter_type, "Choose the main litter type.");
  assert.equal(errors.description, "Describe what needs attention.");
});

test("uses a labelled demo fallback when detection is unavailable", () => {
  assert.deepEqual(getDemoDetection(report), {
    label: "Likely plastic packaging",
    confidence: 82,
    source: "Demo fallback",
  });
  assert.equal(getRetryMessage(), "Detection is unavailable. Your report is saved locally; retry or continue with the demo result.");
});

test("keeps hotspot context broad and list-accessible", () => {
  assert.deepEqual(getDemoHotspots().map((hotspot) => hotspot.area), [
    "Tioman coastal area",
    "Kuala Selangor coastal area",
    "Terengganu coastal area",
  ]);
  assert.ok(getDemoHotspots().every((hotspot) => !Object.hasOwn(hotspot, "latitude") && !Object.hasOwn(hotspot, "longitude")));
});

test("does not allow a cleanup mission until the detection is confirmed", () => {
  const errors = validateCleanupMission({ team_size: 2, equipment: "", confirmed: false });
  assert.equal(errors.equipment, "Choose the equipment plan.");
  assert.equal(errors.confirmed, "Confirm the detection before starting a mission.");
});

test("tracks all TideTrace stages without removing the active step", () => {
  assert.deepEqual(getProgressState("mission"), {
    report: "complete",
    detection: "complete",
    context: "complete",
    mission: "active",
    impact: "pending",
    progress: "pending",
  });
});

test("renders an accessible workflow without a coordinate capture or legacy branding", () => {
  const html = readFileSync(resolve(frontendDir, "index.html"), "utf8");
  assert.match(html, /id="hotspot-list"/);
  assert.match(html, /id="impact-list"/);
  assert.doesNotMatch(html, /DiveSafe|latitude|longitude/i);
});

test("uses the planned report and recognition requests without a precise location payload", () => {
  const app = readFileSync(resolve(frontendDir, "app.js"), "utf8");
  assert.match(app, /\/api\/litter-reports/);
  assert.match(app, /\/api\/litter-recognize/);
  assert.doesNotMatch(app, /latitude:|longitude:/i);
});

test("includes a decorative liquid shader with safe fallbacks", () => {
  const html = readFileSync(resolve(frontendDir, "index.html"), "utf8");
  const css = readFileSync(resolve(frontendDir, "styles.css"), "utf8");
  const shader = readFileSync(resolve(frontendDir, "liquid-shader.js"), "utf8");

  assert.match(html, /id="liquid-canvas"/);
  assert.match(html, /liquid-shader\.js/);
  assert.match(css, /\.liquid-canvas/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(shader, /u_time/);
  assert.match(shader, /u_resolution/);
  assert.match(shader, /prefers-reduced-motion/);
  assert.match(shader, /requestAnimationFrame/);
  assert.match(shader, /canvas\.hidden\s*=\s*true/);
});
