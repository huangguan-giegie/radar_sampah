import {
  buildLitterReport,
  getDemoDetection,
  getDemoHotspots,
  getProgressState,
  getRetryMessage,
  validateCleanupMission,
  validateLitterReport,
} from "./workflow.js";

// Radar Sampah 是现行配置名；保留旧变量以兼容已部署的 TideTrace 配置。
const API_BASE = window.RADAR_SAMPAH_API_BASE || window.TIDETRACE_API_BASE || (location.hostname === "localhost" ? "http://localhost:5000" : "");
const state = { step: "report", report: null, detection: null, saved: false };
const form = document.querySelector("#litter-form");
const panels = Object.fromEntries(["report", "detection", "context", "mission", "impact", "progress"].map((name) => [name, document.querySelector(`#${name}-step`)]));

function readDraft() { return Object.fromEntries(new FormData(form)); }
function fieldError(name, message = "") {
  const input = form.elements.namedItem(name);
  const target = form.querySelector(`[data-error-for="${name}"]`);
  if (input) input.toggleAttribute("aria-invalid", Boolean(message));
  if (target) target.textContent = message;
}
function clearErrors() { form.querySelectorAll("[data-error-for]").forEach((node) => fieldError(node.dataset.errorFor)); }
function showErrors(errors) { clearErrors(); Object.entries(errors).forEach(([name, message]) => fieldError(name, message)); }
function setStep(step) {
  state.step = step;
  Object.entries(panels).forEach(([name, panel]) => panel.classList.toggle("is-hidden", name !== step));
  const progress = getProgressState(step);
  document.querySelectorAll("[data-progress]").forEach((item) => {
    item.classList.toggle("is-active", progress[item.dataset.progress] === "active");
    item.classList.toggle("is-complete", progress[item.dataset.progress] === "complete");
  });
  panels[step].focus({ preventScroll: true });
}
function renderAreas() {
  const select = form.elements.namedItem("area_id");
  select.replaceChildren(new Option("Choose a broad area", ""));
  getDemoHotspots().forEach((hotspot) => select.add(new Option(hotspot.area, hotspot.id)));
}
function renderContext() {
  const list = document.querySelector("#hotspot-list");
  list.replaceChildren();
  getDemoHotspots().forEach((hotspot) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${hotspot.area} · ${hotspot.level}</strong><span>${hotspot.context}</span>`;
    list.append(item);
  });
}
function renderDetection(detection) {
  document.querySelector("#detection-source").textContent = detection.source || "Connected service";
  document.querySelector("#detection-label").textContent = detection.label || detection.category || "Litter review available";
  document.querySelector("#detection-confidence").textContent = detection.confidence
    ? `${detection.confidence} confidence`
    : detection.needs_user_confirmation ? "Please confirm this demo suggestion" : "Review before continuing";
}
async function requestDetection() {
  const draft = readDraft();
  const errors = validateLitterReport(draft);
  if (Object.keys(errors).length) { showErrors(errors); setStep("report"); return false; }
  state.report = buildLitterReport(draft);
  const message = document.querySelector("#detection-message");
  message.textContent = "Checking the report...";
  try {
    const imageUrl = draft.image_url?.trim();
    if (!API_BASE || !imageUrl) throw new Error("Demo mode");
    const response = await fetch(`${API_BASE}/api/litter-recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, category_hint: state.report.litter_type }),
    });
    if (!response.ok) throw new Error("Detection unavailable");
    const result = await response.json();
    const recognition = result.recognition || result.detection || result;
    state.detection = {
      ...recognition,
      label: recognition.label || recognition.category || recognition.candidates?.[0] || "Litter review available",
      source: recognition.source || (recognition.provider === "demo" ? "Local demo fallback" : "Connected recognition"),
    };
    message.textContent = "Connected detection returned a result. Review it before planning a mission.";
  } catch {
    state.detection = getDemoDetection(state.report);
    message.textContent = getRetryMessage();
  }
  renderDetection(state.detection);
  return true;
}
async function submitReport() {
  if (!API_BASE || state.saved) return;
  try {
    const response = await fetch(`${API_BASE}/api/litter-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area_id: state.report.area_id,
        category: state.report.litter_type,
        quantity: Number(form.elements.namedItem("quantity").value) || 1,
        observed_at: form.elements.namedItem("observed_at").value || new Date().toISOString().slice(0, 16),
        image_url: form.elements.namedItem("image_url").value.trim() || undefined,
        note: state.report.description,
        detection_confirmed: true,
      }),
    });
    if (!response.ok) throw new Error("Report unavailable");
    state.saved = true;
  } catch { state.saved = false; }
}
async function move(next) {
  if (next === "detection" && !(await requestDetection())) return;
  if (next === "context") {
    if (!form.elements.namedItem("detection_confirmed").checked) { fieldError("detection_confirmed", "Confirm the detection before continuing."); return; }
    fieldError("detection_confirmed");
  }
  if (next === "impact") {
    const errors = validateCleanupMission(readDraft());
    if (Object.keys(errors).length) { showErrors(errors); return; }
  }
  if (next === "progress") {
    await submitReport();
    renderProgress();
  }
  setStep(next);
}
function renderProgress() {
  const draft = readDraft();
  const hotspot = getDemoHotspots().find((item) => item.id === state.report.area_id);
  document.querySelector("#before-summary").textContent = `${state.report.litter_type} reported in ${hotspot?.area || "the selected area"}.`;
  document.querySelector("#progress-summary").textContent = state.saved
    ? "Your confirmed demo report was shared with the connected service."
    : "Your confirmed report remains available as a local demo result.";
  const rows = [["Area", hotspot?.area], ["Detected", state.detection?.label], ["Removed", `${draft.bags_removed || 0} bag(s) or container(s)`], ["Next step", "Share the broad-area result with an organised local cleanup."]];
  const list = document.querySelector("#impact-list"); list.replaceChildren();
  rows.forEach(([label, value]) => { const item = document.createElement("li"); item.innerHTML = `<strong>${label}</strong><span>${value}</span>`; list.append(item); });
}

document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => move(button.dataset.next)));
document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => setStep(button.dataset.back)));
document.querySelector("#retry-detection").addEventListener("click", requestDetection);
document.querySelector("#new-report-button").addEventListener("click", () => { form.reset(); state.report = null; state.detection = null; state.saved = false; clearErrors(); setStep("report"); });

renderAreas(); renderContext(); setStep("report");
