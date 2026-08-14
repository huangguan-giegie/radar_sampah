import { buildSightingPayload, getDemoDiveSites, getProgressState, getRetryMessage, getSpeciesForSite, validateSighting } from "./workflow.js";

const API_BASE = window.DIVESAFE_API_BASE || (
  location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://team04-marine-observation-api.onrender.com"
);
const state = { step: "profile", draft: null, payload: null, map: null, markers: null };
const form = document.querySelector("#dive-form");
const panels = Object.fromEntries(["profile", "site", "briefing", "confirm", "record"].map((name) => [name, document.querySelector(`#${name}-step`)]));
const siteSelect = form.elements.namedItem("site_id");
const speciesSelect = form.elements.namedItem("species_id");
const reviewList = document.querySelector("#review-list");
const formMessage = document.querySelector("#form-message");
const retryButton = document.querySelector("#retry-button");

function readDraft() { return Object.fromEntries(new FormData(form)); }
function setStep(step) {
  state.step = step;
  Object.entries(panels).forEach(([name, panel]) => panel.classList.toggle("is-hidden", name !== step));
  const progress = getProgressState(step);
  document.querySelectorAll("[data-progress]").forEach((item) => {
    item.classList.toggle("is-active", progress[item.dataset.progress] === "active");
    item.classList.toggle("is-complete", progress[item.dataset.progress] === "complete");
  });
  panels[step].focus({ preventScroll: true });
  panels[step].scrollIntoView({ behavior: "smooth", block: "start" });
}
function clearErrors() {
  form.querySelectorAll("[data-error-for]").forEach((node) => { node.textContent = ""; node.previousElementSibling?.removeAttribute("aria-invalid"); });
}
function showErrors(errors) {
  clearErrors();
  Object.entries(errors).forEach(([name, message]) => {
    const input = form.elements.namedItem(name);
    const target = form.querySelector(`[data-error-for="${name}"]`);
    if (input && target) { input.setAttribute("aria-invalid", "true"); target.textContent = message; }
  });
}
function renderSites() {
  const list = document.querySelector("#site-list");
  list.replaceChildren(); siteSelect.replaceChildren();
  getDemoDiveSites().forEach((site) => {
    siteSelect.add(new Option(site.name, site.id));
    const item = document.createElement("li"); item.textContent = `${site.name}: ${site.briefing}`; list.append(item);
  });
}
function renderSpecies() {
  const site = getDemoDiveSites().find((item) => item.id === siteSelect.value) || getDemoDiveSites()[0];
  document.querySelector("#briefing-copy").textContent = site.briefing;
  speciesSelect.replaceChildren();
  const list = document.querySelector("#species-list"); list.replaceChildren();
  getSpeciesForSite(site.id).forEach((species) => {
    speciesSelect.add(new Option(species.name, species.id));
    const item = document.createElement("li"); item.textContent = `${species.name} · ${species.note}`; list.append(item);
  });
}
function renderMap() {
  const mapElement = document.querySelector("#site-map");
  const message = document.querySelector("#map-message");
  if (!window.L) { mapElement.classList.add("is-map-unavailable"); message.textContent = "Map unavailable. Use the accessible dive-site list above."; return; }
  if (!state.map) {
    state.map = window.L.map(mapElement, { scrollWheelZoom: false });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(state.map);
    state.markers = window.L.layerGroup().addTo(state.map);
  }
  state.markers.clearLayers();
  const pins = getDemoDiveSites();
  pins.forEach((site) => window.L.circleMarker([site.map_latitude, site.map_longitude], { radius: 8, color: "#0c5f69", fillColor: "#54c3ba", fillOpacity: .9 }).bindPopup(site.name).addTo(state.markers));
  state.map.fitBounds(pins.map((site) => [site.map_latitude, site.map_longitude]), { padding: [28, 28], maxZoom: 6 });
  message.textContent = "Demo pins use OpenStreetMap. The accessible list has the same site details.";
}
function renderReview(draft) {
  reviewList.replaceChildren();
  const site = getDemoDiveSites().find((item) => item.id === draft.site_id);
  const species = getSpeciesForSite(draft.site_id).find((item) => item.id === draft.species_id);
  [["Profile", draft.profile], ["Site", site?.name], ["Species", species?.name], ["Activity", draft.activity]].forEach(([label, value]) => {
    const term = document.createElement("dt"); const detail = document.createElement("dd"); term.textContent = label; detail.textContent = value; reviewList.append(term, detail);
  });
}
function validateCurrent() {
  const errors = validateSighting(readDraft());
  showErrors(errors);
  return errors;
}
function move(next) {
  const draft = readDraft();
  if (next === "site" && !draft.profile) return;
  if (next === "briefing" && !draft.site_id) { validateCurrent(); return; }
  if (next === "confirm") { renderReview(draft); }
  setStep(next);
  if (next === "site") window.setTimeout(renderMap, 60);
}
async function submitRecord() {
  const draft = readDraft(); const errors = validateSighting(draft);
  if (Object.keys(errors).length) { showErrors(errors); formMessage.textContent = "Check the highlighted fields."; return; }
  state.draft = draft; state.payload = buildSightingPayload(draft); formMessage.textContent = "Saving your demo record…";
  retryButton.classList.add("is-hidden");
  try {
    if (!API_BASE) throw new Error("Demo mode");
    const response = await fetch(`${API_BASE}/api/sightings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.payload) });
    if (!response.ok) throw new Error("Service rejected record");
    document.querySelector("#record-summary").textContent = `${draft.activity}: ${draft.species_id} at ${draft.site_id}. Saved with the connected service.`;
  } catch {
    document.querySelector("#record-summary").textContent = `${draft.activity}: ${draft.species_id} at ${draft.site_id}. Shown as a local demo result because no service was available.`;
    retryButton.classList.remove("is-hidden"); formMessage.textContent = getRetryMessage();
  }
  setStep("record");
}

async function recogniseOptionalImage() {
  const imageUrl = form.elements.namedItem("image_url").value.trim();
  const message = document.querySelector("#recognition-message");
  if (!imageUrl) { message.textContent = "Add an approved image URL first."; return; }
  const fallback = () => {
    message.textContent = `Demo suggestion: ${speciesSelect.selectedOptions[0]?.textContent || "selected species"}. Not AI identification.`;
  };
  if (!API_BASE) { fallback(); return; }
  try {
    const response = await fetch(`${API_BASE}/api/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, species_hint: speciesSelect.value }),
    });
    const result = await response.json();
    if (!response.ok || !result.recognition?.species_id) throw new Error("Recognition unavailable");
    speciesSelect.value = result.recognition.species_id;
    message.textContent = `Demo suggestion: ${speciesSelect.selectedOptions[0]?.textContent || result.recognition.species_id}. Not verified.`;
  } catch { fallback(); }
}

async function loadDemoProfile() {
  if (!API_BASE) return;
  try { await fetch(`${API_BASE}/api/profile`); } catch { /* 本地演示不需要个人资料。 */ }
}

document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => move(button.dataset.next)));
document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => setStep(button.dataset.back)));
siteSelect.addEventListener("change", renderSpecies);
document.querySelector("#recognize-button").addEventListener("click", recogniseOptionalImage);
form.addEventListener("submit", (event) => { event.preventDefault(); submitRecord(); });
retryButton.addEventListener("click", submitRecord);
document.querySelector("#new-record-button").addEventListener("click", () => { form.reset(); renderSpecies(); clearErrors(); formMessage.textContent = ""; setStep("profile"); });

renderSites(); renderSpecies(); setStep("profile"); loadDemoProfile();
