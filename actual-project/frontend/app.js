import {
  buildObservationPayload,
  getAreaSuggestions,
  getCategoryExamples,
  getContextMarkers,
  getProgressState,
  getRetryMessage,
  normaliseApiResult,
  normaliseContextItem,
  validateObservation,
} from "./workflow.js";

const API_BASE = window.MARINE_API_BASE || (location.hostname === "localhost"
  ? "http://localhost:5000"
  : "https://team04-marine-observation-api.onrender.com");

const state = {
  context: [],
  draft: null,
  lastPayload: null,
  map: null,
  markers: null,
  result: null,
  optionCatalog: null,
};

const form = document.querySelector("#report-form");
const panels = {
  report: document.querySelector("#report-step"),
  review: document.querySelector("#review-step"),
  results: document.querySelector("#results-step"),
};
const reviewList = document.querySelector("#review-list");
const resultSummary = document.querySelector("#result-summary");
const contextList = document.querySelector("#context-list");
const formMessage = document.querySelector("#form-message");
const confirmMessage = document.querySelector("#confirm-message");
const retryButton = document.querySelector("#retry-button");
const confirmButton = document.querySelector("#confirm-button");
const categorySelect = form.elements.namedItem("category");
const categoryHint = document.querySelector("#category-hint");
const areaOptions = document.querySelector("#area-options");
const areaHint = document.querySelector("#area-hint");

function updateCategoryHint() {
  const examples = getCategoryExamples(state.optionCatalog, categorySelect.value);
  categoryHint.textContent = `Examples from the public litter vocabulary: ${examples}.`;
}

function renderOptionCatalog(catalog) {
  state.optionCatalog = catalog;
  areaOptions.replaceChildren();
  getAreaSuggestions(catalog).forEach((area) => {
    const option = document.createElement("option");
    option.value = area;
    areaOptions.append(option);
  });
  updateCategoryHint();
  if (catalog.area_source?.scope_note) areaHint.textContent = catalog.area_source.scope_note;
}

function setStep(step) {
  Object.entries(panels).forEach(([name, panel]) => panel.classList.toggle("is-hidden", name !== step));
  const progress = getProgressState(step);
  document.querySelectorAll("[data-progress]").forEach((item) => {
    item.classList.toggle("is-active", progress[item.dataset.progress] === "active");
    item.classList.toggle("is-complete", progress[item.dataset.progress] === "complete");
  });
  panels[step].focus({ preventScroll: true });
  panels[step].scrollIntoView({ behavior: "smooth", block: "start" });
}

function readDraft() {
  return Object.fromEntries(new FormData(form));
}

function clearErrors() {
  form.querySelectorAll("[data-error-for]").forEach((message) => {
    message.textContent = "";
    message.previousElementSibling?.removeAttribute("aria-invalid");
  });
}

function showErrors(errors) {
  clearErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const input = form.elements.namedItem(field);
    const error = form.querySelector(`[data-error-for="${field}"]`);
    if (input && error) {
      input.setAttribute("aria-invalid", "true");
      error.textContent = message;
    }
  });
}

function appendReviewRow(label, value) {
  const term = document.createElement("dt");
  const detail = document.createElement("dd");
  term.textContent = label;
  detail.textContent = value || "Not provided";
  reviewList.append(term, detail);
}

function renderReview(draft) {
  reviewList.replaceChildren();
  appendReviewRow("Litter category", draft.category);
  appendReviewRow("Approximate area", draft.area);
  appendReviewRow("Observation date and time", draft.observed_at.replace("T", " "));
  appendReviewRow("Latitude", draft.latitude);
  appendReviewRow("Longitude", draft.longitude);
  appendReviewRow("Sample image URL", draft.image_url);
  appendReviewRow("Short field note", draft.note);
}

function createFact(label, value) {
  const box = document.createElement("article");
  const heading = document.createElement("p");
  const text = document.createElement("strong");
  box.className = "fact-card";
  heading.textContent = label;
  text.textContent = value;
  box.append(heading, text);
  return box;
}

function renderResult(result) {
  resultSummary.replaceChildren();
  const classification = document.createElement("article");
  classification.className = "result-card classification-card";
  classification.innerHTML = "<p class=\"section-kicker\">Recorded category</p>";
  const category = document.createElement("h3");
  const method = document.createElement("p");
  category.textContent = result.classification.label;
  method.textContent = result.classification.method;
  classification.append(category, method);

  const priority = document.createElement("article");
  priority.className = "result-card priority-card";
  priority.innerHTML = "<p class=\"section-kicker\">Illustrative clean-up priority</p>";
  const level = document.createElement("p");
  level.className = "priority-level";
  level.textContent = `${result.priority.level} priority`;
  const reason = document.createElement("p");
  reason.textContent = result.priority.reason;
  priority.append(level, reason);

  const record = document.createElement("section");
  record.className = "record-facts";
  record.setAttribute("aria-label", "Submitted observation");
  record.append(
    createFact("Area", result.observation.area),
    createFact("Coordinates", `${result.observation.latitude}, ${result.observation.longitude}`),
    createFact("Data label", result.demo ? "Synthetic / public demo" : "Public context"),
  );
  resultSummary.append(classification, priority, record);
}

function renderContextList(context) {
  contextList.replaceChildren();
  if (!context.length) {
    const item = document.createElement("li");
    item.textContent = "No additional context is available from the API yet. The submitted observation is still saved.";
    contextList.append(item);
    return;
  }
  context.forEach((item) => {
    const row = document.createElement("li");
    const title = document.createElement("strong");
    const description = document.createElement("span");
    title.textContent = item.label || item.taxon || "Marine context record";
    description.textContent = `${item.source || "OBIS public example"}${item.sensitive ? " · approximate location shown" : ""}`;
    row.append(title, description);
    if (item.source_url) {
      const link = document.createElement("a");
      link.href = item.source_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "View source";
      row.append(link);
    }
    contextList.append(row);
  });
}

function renderMap(result) {
  const fallback = document.querySelector("#map-fallback-message");
  const mapElement = document.querySelector("#map");
  if (!window.L) {
    mapElement.classList.add("is-map-unavailable");
    fallback.textContent = "Map tiles are unavailable. Use the accessible source list below for the same context.";
    return;
  }
  const observation = result.observation;
  const markers = [
    { label: "Submitted observation", latitude: Number(observation.latitude), longitude: Number(observation.longitude), sensitive: false },
    ...getContextMarkers(result.context),
  ].filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  if (!markers.length) return;
  if (!state.map) {
    state.map = window.L.map(mapElement, { scrollWheelZoom: false, zoomControl: true });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(state.map);
    state.markers = window.L.layerGroup().addTo(state.map);
  }
  state.markers.clearLayers();
  const bounds = [];
  markers.forEach((marker, index) => {
    const point = window.L.circleMarker([marker.latitude, marker.longitude], {
      radius: index === 0 ? 9 : 7,
      color: index === 0 ? "#075f65" : "#c9802a",
      fillColor: index === 0 ? "#1d9a99" : "#f6bf76",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(state.markers);
    point.bindPopup(marker.label);
    bounds.push([marker.latitude, marker.longitude]);
  });
  state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  fallback.textContent = "Map markers use OpenStreetMap. Sensitive context is shown at an approximate location; the accessible source list below remains available.";
}

async function loadContext() {
  try {
    const response = await fetch(`${API_BASE}/api/context`);
    if (!response.ok) return;
    const data = await response.json();
    state.context = (data.context || data.items || []).map(normaliseContextItem);
  } catch {
    state.context = [];
  }
}

async function loadOptionCatalog() {
  try {
    const response = await fetch(`${API_BASE}/api/options`);
    if (!response.ok) return;
    renderOptionCatalog(await response.json());
  } catch {
    // 保留 HTML 中的安全默认选项，API 不可用时表单仍可提交。
  }
}

async function submitConfirmedObservation() {
  if (!state.lastPayload) return;
  confirmButton.disabled = true;
  retryButton.classList.add("is-hidden");
  confirmMessage.textContent = "Submitting the confirmed synthetic observation…";
  try {
    const response = await fetch(`${API_BASE}/api/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.lastPayload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The observation was not accepted.");
    state.result = normaliseApiResult(result, state.context);
    renderResult(state.result);
    renderContextList(state.result.context);
    setStep("results");
    window.setTimeout(() => renderMap(state.result), 100);
  } catch (error) {
    confirmMessage.textContent = getRetryMessage();
    formMessage.textContent = getRetryMessage();
    retryButton.classList.remove("is-hidden");
    setStep("results");
    resultSummary.replaceChildren();
    const failure = document.createElement("article");
    failure.className = "result-card failure-card";
    failure.textContent = "The confirmed observation was not submitted. Your input has been kept unchanged so you can retry it.";
    resultSummary.append(failure);
    renderContextList(state.context);
  } finally {
    confirmButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const draft = readDraft();
  const errors = validateObservation(draft);
  if (Object.keys(errors).length) {
    showErrors(errors);
    formMessage.textContent = "Check the highlighted fields before reviewing the observation.";
    return;
  }
  clearErrors();
  formMessage.textContent = "";
  state.draft = draft;
  renderReview(draft);
  setStep("review");
});

form.addEventListener("input", () => {
  if (state.draft) {
    state.draft = null;
    state.lastPayload = null;
    formMessage.textContent = "Changes detected. Review and confirm the updated observation before it is submitted.";
  }
});

document.querySelector("#edit-button").addEventListener("click", () => setStep("report"));
confirmButton.addEventListener("click", () => {
  state.lastPayload = buildObservationPayload(state.draft);
  submitConfirmedObservation();
});
retryButton.addEventListener("click", submitConfirmedObservation);
document.querySelector("#new-observation-button").addEventListener("click", () => {
  form.reset();
  state.draft = null;
  state.lastPayload = null;
  state.result = null;
  clearErrors();
  formMessage.textContent = "";
  setStep("report");
});

loadContext();
categorySelect.addEventListener("change", updateCategoryHint);
loadOptionCatalog();
