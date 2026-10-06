import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import { useLeafletMap } from "../components/useLeafletMap";
import { getCoastalBeaches, REGIONS } from "../coastalData";
import { useApp } from "../AppContext";
import { USE_MOCK } from "../api";
import { iteration3Request } from "../iteration3Api";
import { canAutoShowPersonalPopup, personalPopupKey, readSessionValue, saveSessionValue, type PersonalInsights } from "../iteration3Personal";
import { useAsyncData } from "../useAsyncData";
import {
  DataUnavailable,
  LinkRow,
  Sheet,
  WhiteCard,
} from "../components/CoastalUI";
import { GhostButton, PrimaryButton } from "../components/ui";
import { ChevronLeft as ArrowLeft, Search, SpeciesIcon } from "../components/Icon";
import { SeverityBadge } from "../components/ds";
import { severityLabel } from "../theme";
import type { SeverityBand } from "../types";
import content from "../content/coastalContent.json";
import { BORNEO_VIEW_BOUNDS, getViewBounds, groupMapPoints, PENINSULA_VIEW_BOUNDS } from "../mapGeometry";
import { getLocatedMapBeaches, PRIMARY_MAP_BEACHES } from "../mapCatalogue";
import { placeMapLabels } from "../mapLabels";
import { originBeachId, overviewMarinePins, regionalMarinePins, withBeach } from "../biodiversity";
import { MarineRecordCard } from "../components/MarineRecordCard";
const COLORS: Record<string, string> = {
  Low: "#6e9d80",
  Moderate: "#d5a04f",
  High: "#ce6b45",
  Severe: "#b84a3f",
};
function BorneoInset({ onClick, onHabitat }: { onClick: () => void; onHabitat?: () => void }) {
  const { elRef, mapRef, ready } = useLeafletMap({
    center: [4, 114.5],
    zoom: 4,
    interactive: false,
    zoomSnap: 0.25,
  });
  useEffect(() => {
    if (ready) mapRef.current?.fitBounds(BORNEO_VIEW_BOUNDS, { padding: [8, 8], animate: false });
  }, [ready]);
  return (
    <div className="borneo-inset">
      <div ref={elRef} />
      <button className="borneo-inset-open" aria-label="Sabah & Sarawak" onClick={onClick}><strong>Sabah & Sarawak ↗</strong></button>
      {onHabitat && <span className="borneo-habitats">
        <button aria-label="Kuching Wetlands · Mangrove" onClick={onHabitat}><SpeciesIcon glyph="mangrove" size={18} /></button>
        <button aria-label="Lawas · Seagrass" onClick={onHabitat}><SpeciesIcon glyph="grass" size={18} /></button>
        <button aria-label="Sandakan · Mangrove" onClick={onHabitat}><SpeciesIcon glyph="mangrove" size={18} /></button>
      </span>}
    </div>
  );
}
export default function MapScreen() {
  const nav = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const regionId = params.get("region") ?? "";
  const layer = params.get("layer") === "bio" ? "bio" : "litter";
  const region = REGIONS.find((r) => r.id === regionId);
  const { user, reportsVersion, offline } = useApp();
  const [zoom, setZoom] = useState(6);
  const [minZoom, setMinZoom] = useState(5);
  const [viewSize, setViewSize] = useState("");
  const [viewRevision, setViewRevision] = useState(0);
  const [clusterIds, setClusterIds] = useState<string[] | null>(null);
  const userMoved = useRef(false);
  const fittedRegion = useRef<string | null>(null);
  const beachId = originBeachId(params.get("beach"), regionId || undefined);
  type Panel = "key" | "beaches" | "regions" | "personal" | "about" | "record";
  const panel = params.get("panel");
  const sheet = ["key", "beaches", "regions", "personal", "about", "record"].includes(panel ?? "")
    ? panel as Panel : null;
  const search = params.get("q") ?? "";
  const setSheet = (value: Panel | null, ids: string[] | null = null) => {
    setClusterIds(ids);
    setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set("panel", value);
    else next.delete("panel");
    if (value !== "record") next.delete("record");
    if (ids) next.delete("q");
    return next;
    }, { replace: true });
  };
  const setSearch = (value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set("q", value);
    else next.delete("q");
    return next;
  }, { replace: true });
  const {
    data: beaches,
    loading,
    error,
    refresh,
  } = useAsyncData(getCoastalBeaches, [reportsVersion], []);
  const { data: personal, loading: personalLoading, error: personalError, refresh: refreshPersonal } = useAsyncData(
    () => (user ? iteration3Request<PersonalInsights>('/personal-insights') : Promise.resolve(null)),
    [user?.participantId, reportsVersion],
    null,
  );
  useEffect(() => {
    if (!user) return;
    const key = personalPopupKey(user.participantId);
    if (canAutoShowPersonalPopup(location.state?.fromHome === true, readSessionValue(key) === '1')) {
      saveSessionValue(key, '1');
      setSheet('personal');
    }
  }, [user?.participantId, location.key]);
  const { elRef, mapRef, ready } = useLeafletMap({
    center: region ? [region.lat, region.lng] : [4.05, 102],
    zoom: region?.zoom ?? 6,
    zoomSnap: 0.25,
    // Keep marker regrouping synchronous; a zoom transition must not outlive route teardown.
    zoomAnimation: false,
  });
  const areaBeaches = useMemo(() => region
    ? beaches.filter((b) => b.region === region.id)
    : beaches, [beaches, regionId]);
  const locatedBeaches = useMemo(() => getLocatedMapBeaches(areaBeaches, USE_MOCK), [areaBeaches]);
  const marinePins = useMemo(() => regionalMarinePins(regionId, locatedBeaches), [regionId, locatedBeaches]);
  const selectedRecord = marinePins.find(p => p.id === params.get("record"));
  const visible = areaBeaches.filter((b) =>
    (!clusterIds || clusterIds.includes(b.id)) &&
    (b.name + " " + b.area).toLowerCase().includes(search.toLowerCase()),
  );
  const setRegion = useCallback((id: string) => {
    setClusterIds(null);
    setParams({
      ...(layer === "bio" ? { layer: "bio" } : {}),
      ...(id ? { region: id } : {}),
      ...(layer === "bio" && originBeachId(beachId ?? null, id || undefined) ? { beach: beachId! } : {}),
    });
  }, [layer, setParams, beachId]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (fittedRegion.current !== regionId) {
      userMoved.current = false;
      fittedRegion.current = regionId;
    }
    const fit = () => {
      map.stop();
      map.invalidateSize({ pan: false });
      const size = map.getSize();
      setViewSize(`${size.x}x${size.y}`);
      // Reserve room for the hint and for labels anchored above beach locations.
      const padding = L.point(96, 96);
      const bounds = getViewBounds(regionId, regionId ? locatedBeaches : []);
      // getBoundsZoom respects existing limits; a smaller viewport may need a lower floor.
      map.setMinZoom(0);
      const floor = Math.min(
        map.getBoundsZoom(PENINSULA_VIEW_BOUNDS, false, padding),
        map.getBoundsZoom(bounds, false, padding),
      );
      map.setMinZoom(floor);
      map.setMaxZoom(18);
      setMinZoom(floor);
      if (!userMoved.current) map.fitBounds(bounds, {
        paddingTopLeft: [48, 60], paddingBottomRight: [48, 36], animate: false,
      });
      setZoom(map.getZoom());
    };
    const trackZoom = () => {
      setZoom(map.getZoom());
    };
    const trackMove = () => setViewRevision(value => value + 1);
    const trackDrag = () => { userMoved.current = true; };
    const container = map.getContainer();
    container.addEventListener("wheel", trackDrag, { passive: true });
    container.addEventListener("touchmove", trackDrag, { passive: true });
    container.addEventListener("keydown", trackDrag);
    container.addEventListener("dblclick", trackDrag);
    map.on("zoomend", trackZoom);
    map.on("moveend", trackMove);
    map.on("dragstart", trackDrag);
    fit();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      map.off("zoomend", trackZoom);
      map.off("moveend", trackMove);
      map.off("dragstart", trackDrag);
      container.removeEventListener("wheel", trackDrag);
      container.removeEventListener("touchmove", trackDrag);
      container.removeEventListener("keydown", trackDrag);
      container.removeEventListener("dblclick", trackDrag);
    };
  }, [ready, regionId, locatedBeaches]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const group = L.layerGroup().addTo(map);
    const marker = (
      lat: number,
      lng: number,
      label: string,
      html: string,
      onClick: () => void,
      size: [number, number],
      anchor: [number, number] = [size[0] / 2, size[1] / 2],
      priority = 0,
    ) => {
      const pin = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "coastal-map-marker",
          html,
          iconSize: size,
          iconAnchor: anchor,
        }),
        title: label,
        alt: label,
        keyboard: true,
        zIndexOffset: priority,
      })
        .addTo(group)
        .on("click", onClick);
      pin.getElement()?.setAttribute("aria-label", label);
      return pin;
    };
    if (layer === "bio") {
      const pins = region ? marinePins.map(p => ({ ...p, name: p.record.name, place: p.record.place, image: p.record.image }))
        : overviewMarinePins(locatedBeaches).map(p => ({ ...p, place: "" }));
      const size = map.getSize();
      const compact = size.y < 360;
      const containerRect = map.getContainer().getBoundingClientRect();
      const obstacles = Array.from(map.getContainer().parentElement?.querySelectorAll(".map-hint, .map-controls, .map-full-overview, .borneo-inset") ?? []).map(el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left - containerRect.left, y: rect.top - containerRect.top, width: rect.width, height: rect.height };
      });
      const labels = placeMapLabels(pins.map(p => ({ id: p.id, name: p.name, preferred: true, ...map.latLngToContainerPoint([p.lat, p.lng]) })),
        { width: size.x, height: size.y, obstacles, compact, labelHeight: compact ? 54 : region ? 94 : 74 });
      const openPin = (id: string, destination: string) => {
        if (!region) { nav(withBeach("/marine-area/" + destination, originBeachId(beachId ?? null, destination))); return; }
        setParams(previous => {
          const next = new URLSearchParams(previous);
          next.set("panel", "record"); next.set("record", id);
          return next;
        }, { replace: true });
      };
      // Keep all source locations tappable even where a short viewport cannot fit every label.
      for (const p of pins) marker(p.lat, p.lng, p.name + (p.place ? " · " + p.place : ""),
        '<span class="marine-coast-dot"></span>', () => openPin(p.id, p.regionId), [22, 22]);
      for (const placed of labels) {
        const p = pins.find(pin => pin.id === placed.id)!;
        const point = map.latLngToContainerPoint([p.lat, p.lng]);
        const end = L.point(Math.max(placed.x, Math.min(point.x, placed.x + placed.width)), Math.max(placed.y, Math.min(point.y, placed.y + placed.height)));
        L.polyline([[p.lat, p.lng], map.containerPointToLatLng(end)], { color: "#536779", weight: 1, opacity: .6, interactive: false }).addTo(group);
        const node = document.createElement("div");
        node.className = "marine-map-pin" + (region ? " regional" : "") + (compact ? " compact" : "");
        const photo = document.createElement(p.image ? "img" : "span");
        photo.className = "marine-map-photo";
        if (photo instanceof HTMLImageElement) { photo.src = p.image!; photo.alt = ""; }
        else photo.textContent = "≈";
        const text = document.createElement("span"); text.className = "marine-map-text";
        const name = document.createElement("b"); name.textContent = p.name;
        text.append(name);
        if (p.place) { const place = document.createElement("small"); place.textContent = p.place; text.append(place); }
        node.append(photo, text);
        marker(p.lat, p.lng, p.name + (p.place ? " · " + p.place : ""), node.outerHTML, () => openPin(p.id, p.regionId),
          [placed.width, placed.height], [point.x - placed.x, point.y - placed.y], 1000);
      }
    } else if (!region) {
      for (const r of REGIONS) {
        if (r.id === "borneo") continue; // Borneo has its own inset in the overview.
        const rows = beaches.filter((b) => b.region === r.id);
        if (!rows.length && layer === "litter") continue;
        const count = rows.reduce((n, b) => n + b.validReports, 0);
        const levels = ["Low", "Moderate", "High", "Severe"];
        const highest = rows.reduce(
          (n, b) => Math.max(n, levels.indexOf(b.severity ?? "")),
          -1,
        );
        const colour = COLORS[levels[highest]] ?? "#98a4b5";
        const label = count;
        const diameter = map.getSize().y < 360 ? 30 : 42;
        marker(
          r.lat,
          r.lng,
          r.name,
          `<div class="region-map-pin" style="width:${diameter}px;height:${diameter}px;font-size:${diameter === 30 ? 11 : 15}px;line-height:${diameter - 8}px;border-color:` +
            colour +
            '"><b>' +
            label +
            '</b></div>',
          () => setRegion(r.id),
          [diameter, diameter],
        );
      }
    } else if (layer === "litter") {
      const preferred = new Set(PRIMARY_MAP_BEACHES[region.id] ?? []);
      const size = map.getSize();
      const compactLabels = size.y < 360;
      const containerRect = map.getContainer().getBoundingClientRect();
      const obstacles = Array.from(map.getContainer().parentElement?.querySelectorAll(".map-hint, .map-controls, .map-full-overview") ?? []).map(el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left - containerRect.left, y: rect.top - containerRect.top, width: rect.width, height: rect.height };
      });
      const labels = placeMapLabels(locatedBeaches
        .filter(b => preferred.has(b.id) || zoom >= region.zoom + 1)
        .map(b => ({ id: b.id, name: b.name, preferred: preferred.has(b.id), ...map.latLngToContainerPoint([b.lat, b.lng]) })),
        { width: size.x, height: size.y, obstacles, compact: compactLabels });
      const labelled = new Set(labels.map(label => label.id));
      const displayDot = (b: typeof locatedBeaches[number]) => marker(b.lat, b.lng, b.name,
        `<span class="beach-coast-dot" style="background:${COLORS[b.severity ?? ""] ?? "#98a4b5"}"></span>`,
        () => nav("/beach/" + b.id), [24, 24]);

      // Main prototype beaches always keep their own coastal dots and names.
      for (const b of locatedBeaches.filter(b => preferred.has(b.id) || labelled.has(b.id))) displayDot(b);
      const clusters = groupMapPoints(locatedBeaches.filter(b => !preferred.has(b.id) && !labelled.has(b.id)),
        (lat, lng) => map.project([lat, lng], zoom), { width: 22, height: 22 });
      for (const cluster of clusters) {
        if (cluster.points.length > 1) {
          marker(cluster.lat, cluster.lng, `${cluster.points.length} nearby beaches`,
            `<div class="beach-cluster-pin">+${cluster.points.length}</div>`,
            () => {
              userMoved.current = true;
              const samePlace = cluster.points.every(p => p.lat === cluster.lat && p.lng === cluster.lng);
              if (map.getZoom() >= map.getMaxZoom() || samePlace) {
                setSheet("beaches", cluster.points.map(p => p.id));
              } else {
                const bounds = L.latLngBounds(cluster.points.map(p => [p.lat, p.lng]));
                const size = map.getSize();
                const padding = L.point(Math.min(180, size.x / 2), Math.min(160, size.y / 2));
                const fitZoom = map.getBoundsZoom(bounds, false, padding);
                const nextZoom = Math.max(map.getZoom() + 1, Number.isFinite(fitZoom) ? fitZoom : map.getZoom() + 1);
                map.setView(bounds.getCenter(), Math.min(nextZoom, map.getMaxZoom()));
              }
            }, [28, 28]);
          continue;
        }
        displayDot(cluster.points[0]);
      }
      for (const placed of labels) {
        const b = locatedBeaches.find(beach => beach.id === placed.id)!;
        const point = map.latLngToContainerPoint([b.lat, b.lng]);
        const end = L.point(Math.max(placed.x, Math.min(point.x, placed.x + placed.width)),
          Math.max(placed.y, Math.min(point.y, placed.y + placed.height)));
        L.polyline([[b.lat, b.lng], map.containerPointToLatLng(end)], {
          color: "#51657c", weight: 1, opacity: 0.7, interactive: false,
        }).addTo(group);
        const node = document.createElement("div");
        node.className = "beach-map-label" + (compactLabels ? " compact" : "");
        const label = document.createElement("span");
        label.textContent = b.name;
        if (b.name.length > 24) label.style.fontSize = "9px";
        const band = document.createElement("small");
        band.textContent = b.severity ? severityLabel(b.severity) : "Insufficient data";
        const dot = document.createElement("i");
        dot.style.background = COLORS[b.severity ?? ""] ?? "#98a4b5";
        band.prepend(dot);
        node.append(band, label);
        marker(
          b.lat,
          b.lng,
          b.name,
          node.outerHTML,
          () => nav("/beach/" + b.id),
          [placed.width, placed.height],
          [point.x - placed.x, point.y - placed.y],
          1000,
        );
      }
    }
    return () => {
      group.remove();
    };
  }, [ready, regionId, layer, beaches, zoom, viewSize, viewRevision, nav, setRegion, marinePins, beachId]);
  return (
    <main className="screen coastal-map">
      <header className="map-coastal-header">
        <div>
          {region && (
            <button
              className="icon-button"
              aria-label="Full map"
              onClick={() => setRegion("")}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1>{layer === "bio" ? "Explore the Coast" : "Choose a Beach"}</h1>
          {user && <button className="map-pill" onClick={() => setSheet("personal")}>
            Insights
          </button>}
        </div>
        <div>
          <div className="coastal-segments">
            {["litter", "bio"].map((l) => (
              <button
                key={l}
                aria-pressed={layer === l}
                onClick={() => {
                  if (l === "litter" && layer === "bio" && beachId) { nav("/beach/" + beachId); return; }
                  setParams({
                    ...(regionId ? { region: regionId } : {}),
                    ...(l === "bio" ? { layer: "bio" } : {}),
                    ...(beachId ? { beach: beachId } : {}),
                  });
                }}
              >
                {l === "litter" ? "Litter" : "Biodiversity"}
              </button>
            ))}
          </div>
          {layer === "litter" && <button className="map-pill" onClick={() => setSheet("key")}>
            Key
          </button>}
          {layer === "bio" && <button className="map-pill" onClick={() => setSheet("about")}>About</button>}
        </div>
      </header>
      <div className="coastal-map-viewport">
      <div ref={elRef} className="coastal-map-canvas" aria-label="Interactive coast map" />
      <div className="map-hint">
        {loading
          ? "Loading the coast…"
          : region
            ? region.name +
              " · " +
              (layer === "bio" ? "tap a record" : "tap a beach")
            : layer === "bio" ? "Published records · tap to explore" : "Report counts · tap a region"}
      </div>
      <div className="map-controls">
        <button className="map-pill" onClick={() => setSheet("regions")}>
          Regions
        </button>
        <button
          className="icon-button"
          aria-label="Zoom in"
          disabled={zoom >= 18}
          onClick={() => { userMoved.current = true; mapRef.current?.zoomIn(); }}
        >
          +
        </button>
        <button
          className="icon-button"
          aria-label="Zoom out"
          disabled={zoom <= minZoom}
          onClick={() => { userMoved.current = true; mapRef.current?.zoomOut(); }}
        >
          −
        </button>
      </div>
      {!region && <BorneoInset onClick={() => setRegion("borneo")} onHabitat={layer === "bio" ? () => nav("/marine-area/borneo") : undefined} />}
      {region && <button className="map-pill map-full-overview" onClick={() => setRegion("")}>Full Map</button>}
      </div>
      <div className="map-bottom-card">
        {(error || offline) && (
          <p className="coastal-footnote" role="alert">
            {error
              ? "Could not load beach data."
              : "You are viewing cached data."}{" "}
            <button onClick={() => void refresh()}>Retry</button>
          </p>
        )}
        <div>
          <span>
            <strong>
              {region?.name ??
                (layer === "bio"
                  ? "Marine Life by Area"
                  : "Report Counts View")}
            </strong>
            <small>
              {loading ? "Loading beaches…" : layer === "bio"
                ? (region ? (content.regions.find(r => r.id === region.id)?.records.length ?? 0) + " records · " : "Published records · ") + "not live sightings"
                : region
                  ? areaBeaches.length +
                    " beaches · " +
                    areaBeaches.reduce((n, b) => n + b.validReports, 0) +
                    " reports"
                  : "Explore Malaysia’s coast"}
            </small>
          </span>
          <PrimaryButton
            height={43}
            onClick={() =>
              layer === "bio"
                ? nav(withBeach("/marine-area/" + (regionId || ""), beachId))
                : region
                  ? setSheet("beaches")
                  : nav("/insights/trends")
            }
          >
            {layer === "bio"
              ? "See Marine Life"
              : region
                ? "See Beaches"
                : "View Insights"}
          </PrimaryButton>
        </div>
        {region &&
          layer === "litter" &&
          locatedBeaches.length < areaBeaches.length && (
            <p className="coastal-footnote">
              {locatedBeaches.length ? "More beaches in the list. Pins show available locations." : "Beach locations pending. Browse the beach list."}
            </p>
          )}
        {USE_MOCK && layer === "litter" && <p className="demo-label">Preview · example counts</p>}
      </div>
      {sheet === "record" && selectedRecord && <Sheet title="Marine record" onClose={() => setSheet(null)}>
        <MarineRecordCard record={selectedRecord.record} beachId={beachId} preview />
        <p className="coastal-footnote">{selectedRecord.caption}</p>
        <PrimaryButton onClick={() => nav(withBeach("/marine-area/" + regionId, beachId))}>See Marine Life in This Area</PrimaryButton>
        <GhostButton onClick={() => setSheet(null)}>Back to Map</GhostButton>
      </Sheet>}
      {sheet === "about" && <Sheet title="About this map" onClose={() => setSheet(null)}>
        <p className="subtle">Explore published species and habitat records around Malaysia’s coast. Photos illustrate species; pins show the area of a record, not live animal locations.</p>
        <PrimaryButton onClick={() => setSheet(null)}>Got It</PrimaryButton>
      </Sheet>}
      {sheet === "key" && layer === "litter" && (
        <Sheet title="Map Key" onClose={() => setSheet(null)}>
          <p className="subtle">
            Numbers show counted reports in this view. The ring shows the
            highest available litter band in that region.
          </p>
          {Object.entries(COLORS).map(([label, color]) => (
            <div className="legend-row" key={label}>
              <i style={{ background: color }} />
              {severityLabel(label as SeverityBand)}
            </div>
          ))}
          <div className="legend-row">
            <i style={{ background: "#98a4b5" }} />
            Insufficient data
          </div>
          <p className="subtle">
            No band does not mean a clean beach. Biodiversity records describe
            published sources, not live sightings.
          </p>
          <PrimaryButton
            style={{ marginTop: 18 }}
            onClick={() => setSheet(null)}
          >
            Got It
          </PrimaryButton>
        </Sheet>
      )}
      {sheet === "regions" && (
        <Sheet title="Choose a Region" onClose={() => setSheet(null)}>
          {REGIONS.map((r) => (
            <LinkRow
              key={r.id}
              title={r.name}
              subtitle={
                beaches.filter((b) => b.region === r.id).length + " beaches"
              }
              onClick={() => setRegion(r.id)}
            />
          ))}
        </Sheet>
      )}
      {sheet === "beaches" && (
        <Sheet title={region?.name ?? "Beaches"} onClose={() => setSheet(null)}>
          <label className="coastal-search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beaches"
              aria-label="Search beaches"
            />
          </label>
          {loading ? (
            <p className="subtle" role="status">Loading beaches…</p>
          ) : error ? (
            <DataUnavailable title="Could not load beaches" retry={() => void refresh()}>{error}</DataUnavailable>
          ) : (
            <>
              {visible.map((beach) => (
                <section key={beach.id} className="map-beach-list-row">
                  <div>
                    <button onClick={() => nav("/beach/" + beach.id)}>{beach.name}</button>
                    <SeverityBadge band={beach.severity} label={beach.severity ? undefined : "Insufficient Data"} />
                  </div>
                  <p className="coastal-footnote">{beach.area} · {beach.validReports} counted reports</p>
                </section>
              ))}
              {!visible.length && <DataUnavailable title="No matching beaches" />}
            </>
          )}
        </Sheet>
      )}
      {sheet === "personal" && user && (
        <Sheet title="Your Insights" onClose={() => {
          saveSessionValue(personalPopupKey(user.participantId), '1');
          setSheet(null);
        }}>
          <p className="eyebrow">Private · only you see this</p>
          {personalLoading ? <p role="status">Loading your insights…</p> : personalError ? (
            <DataUnavailable title="Your insights could not be loaded" retry={() => void refreshPersonal()} />
          ) : personal?.sections.length ? personal.sections.map(section => (
            <WhiteCard key={section.id}>
              <p className="eyebrow">{section.title}</p>
              {section.aiAssisted && <p className="coastal-footnote">AI-assisted</p>}
              <p className="subtle">{section.text}</p>
              {section.sources.map(source => <p className="coastal-footnote" key={source.url}>
                <a href={source.url} target={source.url.startsWith('https://') ? '_blank' : undefined} rel="noreferrer">{source.label}</a>
                {section.reviewDate && ' · Reviewed ' + section.reviewDate}
              </p>)}
              <PrimaryButton onClick={() => nav(section.action.path)}>{section.action.label}</PrimaryButton>
            </WhiteCard>
          )) : (
            <DataUnavailable title="Your Insights">
              {personal?.emptyStateMessage ?? 'Report litter or finish a cleanup to unlock personal insights.'}
            </DataUnavailable>
          )}
          <GhostButton onClick={() => { setSheet(null); nav('/insights'); }}>View Beach Insights</GhostButton>
          <GhostButton
            style={{ marginTop: 16 }}
            onClick={() => nav('/reports')}
          >
            My Reports
          </GhostButton>
        </Sheet>
      )}
    </main>
  );
}
