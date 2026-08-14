import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildObservationPayload,
  getContextMarkers,
  getProgressState,
  getRetryMessage,
  normaliseApiResult,
  validateObservation,
} from "../workflow.js";

const validDraft = {
  category: "Plastic packaging",
  area: "Selected Malaysian coastal area",
  observed_at: "2026-08-14T10:00",
  latitude: "3.1390",
  longitude: "101.6869",
  image_url: "/assets/demo-plastic.jpg",
  note: "Synthetic demonstration record",
};

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("accepts a complete synthetic observation and converts coordinates to numbers", () => {
  assert.deepEqual(validateObservation(validDraft), {});
  assert.deepEqual(buildObservationPayload(validDraft), {
    category: "Plastic packaging",
    area: "Selected Malaysian coastal area",
    observed_at: "2026-08-14T10:00:00",
    latitude: 3.139,
    longitude: 101.6869,
    image_url: "/assets/demo-plastic.jpg",
    note: "Synthetic demonstration record",
  });
});

test("rejects a category outside the agreed demonstration list", () => {
  assert.equal(
    validateObservation({ ...validDraft, category: "Organic waste" }).category,
    "Choose one of the five demonstration categories.",
  );
});

test("rejects unsafe sample image addresses", () => {
  assert.equal(
    validateObservation({ ...validDraft, image_url: "http://example.com/photo.jpg" }).image_url,
    "Use an HTTPS link or a local /assets/ demo image.",
  );
});

test("rounds sensitive marine context locations before they are used as map markers", () => {
  assert.deepEqual(
    getContextMarkers([
      {
        label: "Sensitive marine-life context",
        latitude: 3.14159,
        longitude: 101.69876,
        sensitive: true,
        source: "OBIS example",
      },
    ]),
    [
      {
        label: "Sensitive marine-life context",
        latitude: 3.1,
        longitude: 101.7,
        sensitive: true,
        source: "OBIS example",
      },
    ],
  );
});

test("normalises the backend OBIS context shape for the map and source list", () => {
  assert.deepEqual(
    getContextMarkers([
      {
        source: "OBIS",
        approximate_location: { latitude: 3.14, longitude: 101.69 },
        taxon_or_context_label: "Public marine-life context sample",
        sensitivity: "aggregated",
      },
    ]),
    [
      {
        source: "OBIS",
        approximate_location: { latitude: 3.14, longitude: 101.69 },
        taxon_or_context_label: "Public marine-life context sample",
        sensitivity: "aggregated",
        label: "Public marine-life context sample",
        sensitive: false,
        latitude: 3.14,
        longitude: 101.69,
      },
    ],
  );
});

test("keeps the submitted draft available when the API cannot be reached", () => {
  assert.equal(
    getRetryMessage(),
    "The API could not be reached. Your confirmed input is still here; try again when the service is available.",
  );
});

test("uses safe illustrative defaults when an older API returns only an observation", () => {
  assert.deepEqual(
    normaliseApiResult({
      id: "demo-8",
      category: "Metal",
      area: "Selected Malaysian coastal area",
      latitude: 3.139,
      longitude: 101.6869,
    }, [{ label: "OBIS example" }]),
    {
      observation: {
        id: "demo-8",
        category: "Metal",
        area: "Selected Malaysian coastal area",
        latitude: 3.139,
        longitude: 101.6869,
      },
      classification: {
        label: "Metal",
        method: "Fixed demonstration category selected by the reporter.",
      },
      priority: {
        level: "medium",
        reason: "Illustrative clean-up priority only; it is not a pollution-source finding or enforcement decision.",
      },
      context: [{ label: "OBIS example" }],
      source: "Synthetic/public demonstration data",
      data_version: "demo-v1",
      demo: true,
    },
  );
});

test("marks earlier stages complete without removing the active stage", () => {
  assert.deepEqual(getProgressState("results"), {
    report: "complete",
    review: "complete",
    results: "active",
  });
});

test("includes accessible decorative liquid effect hooks without changing the workflow", () => {
  const html = readFileSync(resolve(frontendDir, "index.html"), "utf8");
  const css = readFileSync(resolve(frontendDir, "styles.css"), "utf8");

  assert.match(html, /class="liquid-layer" aria-hidden="true"/);
  assert.match(html, /class="liquid-orb\b[^\"]*" aria-hidden="true"/);
  assert.match(css, /@keyframes liquid-drift/);
  assert.match(css, /prefers-reduced-motion/);
});
