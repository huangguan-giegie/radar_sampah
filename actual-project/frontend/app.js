const API_BASE = window.MARINE_API_BASE ||
  (location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://team04-marine-observation-api.onrender.com");
const list = document.querySelector("#observations");
const message = document.querySelector("#form-message");

function renderObservations(items) {
  list.replaceChildren();
  for (const item of items) {
    const row = document.createElement("li");
    row.textContent = `${item.category} · ${item.area} (${item.latitude}, ${item.longitude})`;
    list.append(row);
  }
}

async function loadObservations() {
  try {
    const response = await fetch(`${API_BASE}/api/observations`);
    if (!response.ok) throw new Error("Could not load observations");
    renderObservations((await response.json()).observations);
  } catch (error) {
    message.textContent = "The demo API is not connected yet. The form is still available for local testing.";
  }
}

document.querySelector("#report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const response = await fetch(`${API_BASE}/api/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("The report was not accepted");
    message.textContent = "Saved as a synthetic demo report.";
    await loadObservations();
  } catch (error) {
    message.textContent = "The demo API is unavailable. Please try again after starting the backend.";
  }
});

loadObservations();
