import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import { useLeafletMap } from "../components/useLeafletMap";
import { getCoastalBeaches, REGIONS } from "../coastalData";
import { useApp } from "../AppContext";
import { USE_MOCK } from "../api";
import { useAsyncData } from "../useAsyncData";
import {
  DataUnavailable,
  LinkRow,
  Sheet,
} from "../components/CoastalUI";
import { GhostButton, PrimaryButton } from "../components/ui";
import { ChevronLeft as ArrowLeft, Search, SpeciesIcon } from "../components/Icon";
import { SeverityBadge } from "../components/ds";
import { severityLabel, SEVERITY } from "../theme";
import type { SeverityBand } from "../types";
import { BORNEO_VIEW_BOUNDS, getViewBounds, groupMapPoints, PENINSULA_VIEW_BOUNDS } from "../mapGeometry";
import { getLocatedMapBeaches, PRIMARY_MAP_BEACHES } from "../mapCatalogue";
import { placeMapLabels, placeMapPhotos } from "../mapLabels";
import { marineAreaPath, overviewMarinePins, regionalMarinePins } from "../biodiversity";
import { searchBeaches, borneoReportCounts } from "../beachSearch";
const COLORS: Record<string, string> = {
  Low: "#6e9d80",
  Moderate: "#d5a04f",
  High: "#ce6b45",
  Severe: "#b84a3f",
};
function BorneoInset({ onClick, counts }: { onClick: () => void; counts: ReturnType<typeof borneoReportCounts> }) {
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
      <div className="borneo-report-counts" aria-label={`Sabah ${counts.sabah} reports, Sarawak ${counts.sarawak} reports`}>
        <span><b>{counts.sarawak}</b>Sarawak</span><span><b>{counts.sabah}</b>Sabah</span>
      </div>
    </div>
  );
}
export default function MapScreen() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const regionId = params.get("region") ?? "";
  const layer = params.get("marine") === "off" ? "litter" : "bio";
  const region = REGIONS.find((r) => r.id === regionId);
  const { reportsVersion, offline } = useApp();
  const [zoom, setZoom] = useState(6);
  const [minZoom, setMinZoom] = useState(5);
  const [viewSize, setViewSize] = useState("");
  const [viewRevision, setViewRevision] = useState(0);
  const [clusterIds, setClusterIds] = useState<string[] | null>(null);
  const userMoved = useRef(false);
  const fittedRegion = useRef<string | null>(null);
  type Panel = "key" | "beaches" | "regions";
  const panel = params.get("panel");
  const sheet = ["key", "beaches", "regions"].includes(panel ?? "")
    ? panel as Panel : null;
  const search = params.get("q") ?? "";
  const setSheet = (value: Panel | null, ids: string[] | null = null) => {
    setClusterIds(ids);
    setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set("panel", value);
    else next.delete("panel");
    next.delete("record");
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
  useEffect(() => {
    if (panel === 'personal') nav('/insights?panel=personal', { replace: true });
  }, [panel, nav]);
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
  const visible = search.trim() ? searchBeaches(beaches, search) : areaBeaches.filter(b => !clusterIds || clusterIds.includes(b.id));
  const setRegion = useCallback((id: string) => {
    setClusterIds(null);
    setParams({ ...(id ? { region: id } : {}), ...(layer === 'litter' ? { marine: 'off' } : {}) });
  }, [layer, setParams]);
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
    const size = map.getSize();
    const containerRect = map.getContainer().getBoundingClientRect();
    const controls = Array.from(map.getContainer().parentElement?.querySelectorAll(".map-hint, .map-controls, .map-full-overview, .borneo-inset") ?? []).map(el => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left - containerRect.left, y: rect.top - containerRect.top, width: rect.width, height: rect.height };
    });
    const overlays = layer !== 'bio' ? [] : region
      ? marinePins.map(pin => ({ ...pin, name: pin.record.name, image: pin.record.image, speciesId: pin.record.speciesId }))
      : overviewMarinePins(locatedBeaches);
    const countObstacles = region ? [] : REGIONS.filter(r => r.id !== 'borneo').map(r => {
      const point = map.latLngToContainerPoint([r.lat, r.lng]);
      const diameter = size.y < 360 ? 30 : 42;
      return { x: point.x - diameter / 2, y: point.y - diameter / 2, width: diameter, height: diameter };
    });
    const photos = placeMapPhotos(overlays.map(pin => ({ id: pin.id, ...map.latLngToContainerPoint([pin.lat, pin.lng]) })),
      { width: size.x, height: size.y, obstacles: [...controls, ...countObstacles] });
    if (!region) {
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
    } else if (region) {
      const preferred = new Set(PRIMARY_MAP_BEACHES[region.id] ?? []);
      const compactLabels = size.y < 360;
      const obstacles = [...controls, ...photos];
      const labels = placeMapLabels(locatedBeaches
        .filter(b => preferred.has(b.id) || zoom >= region.zoom + 1)
        .map(b => ({ id: b.id, name: b.name, preferred: preferred.has(b.id), ...map.latLngToContainerPoint([b.lat, b.lng]) })),
        { width: size.x, height: size.y, obstacles, compact: compactLabels, labelHeight: compactLabels ? 38 : 42 });
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
        label.style.color = b.severity ? SEVERITY[b.severity].text : "#586070";
        label.style.borderColor = COLORS[b.severity ?? ""] ?? "#98a4b5";
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
    if (layer === 'bio') {
      for (const pin of overlays) {
        const placed = photos.find(photo => photo.id === pin.id);
        if (!placed) continue;
        const point = map.latLngToContainerPoint([pin.lat, pin.lng]);
        L.polyline([[pin.lat, pin.lng], map.containerPointToLatLng([placed.x + 22, placed.y + 22])],
          { color: '#536779', weight: 1, opacity: .6, interactive: false }).addTo(group);
        const node = document.createElement('span');
        node.className = 'marine-overlay-pin';
        if (pin.image) {
          const photo = document.createElement('img'); photo.src = pin.image; photo.alt = ''; node.append(photo);
        } else node.textContent = '≈';
        const destination = pin.speciesId ? '/species/' + pin.speciesId : marineAreaPath(pin.regionId, null);
        const action = pin.speciesId ? 'View introduction' : 'Explore marine life';
        marker(pin.lat, pin.lng, pin.name + ' · ' + action + ' · coastal reference', node.outerHTML,
          () => nav(destination), [44, 44], [point.x - placed.x, point.y - placed.y], 1100);
      }
    }
    return () => {
      group.remove();
    };
  }, [ready, regionId, layer, beaches, zoom, viewSize, viewRevision, nav, setRegion, marinePins]);
  return (
    <main className="screen coastal-map">
      <header className="map-coastal-header design-map-header">
        <div>
          {region && <button className="icon-button" aria-label="Full map" onClick={() => setRegion('')}><ArrowLeft size={18} /></button>}
          <h1>Choose a Beach</h1>
          <button className="map-pill" onClick={() => setSheet('key')}>Key</button>
        </div>
        <form className="map-search-form" role="search" onSubmit={event => { event.preventDefault(); setSheet('beaches'); }}>
          <label className="coastal-search"><Search /><input type="search" aria-label="Search all beaches" placeholder="Search beaches in all regions" value={search} onChange={event => setSearch(event.target.value)} /></label>
        </form>
        <div className="map-overlay-toggle"><button aria-pressed={layer === 'bio'} onClick={() => setParams(previous => {
          const next = new URLSearchParams(previous); if (layer === 'bio') next.set('marine', 'off'); else next.delete('marine'); next.delete('layer'); return next;
        }, { replace: true })}><SpeciesIcon glyph="turtle" size={17} />Marine life overlay <span>{layer === 'bio' ? 'On' : 'Off'}</span></button></div>
      </header>
      {search.trim() && sheet !== 'beaches' && <section className="map-search-results" aria-label="Beach search results">
        {loading ? <p role="status">Loading beaches…</p> : error ? <DataUnavailable title="Could not load beaches" retry={() => void refresh()}>{error}</DataUnavailable> : <>
          <p className="eyebrow">{visible.length} matches · all regions</p>
          {visible.slice(0, 30).map(beach => <button key={beach.id} onClick={() => nav('/beach/' + beach.id)}>
            <span><strong style={{ color: beach.severity ? SEVERITY[beach.severity].text : '#586070' }}>{beach.name}</strong><small>{beach.area}</small></span><SeverityBadge band={beach.severity} />
          </button>)}
          {!visible.length && <p>No matching beaches</p>}
          {visible.length > 30 && <GhostButton height={42} onClick={() => setSheet('beaches')}>View All {visible.length} Results</GhostButton>}
        </>}
      </section>}

      <div className="coastal-map-viewport">
      <div ref={elRef} className="coastal-map-canvas" aria-label="Interactive coast map" />
      <div className="map-hint">{loading ? 'Loading the coast…' : region ? region.name + ' · tap a beach' : 'Report counts · tap a region'}</div>
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
      {!region && <BorneoInset onClick={() => setRegion("borneo")} counts={borneoReportCounts(beaches)} />}
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
            <strong>{region ? (loading ? region.name : `${areaBeaches.length} beaches`) : 'Malaysia’s Coast'}</strong>
            <small>{loading ? 'Loading beaches…' : region ? `${areaBeaches.reduce((n, beach) => n + beach.validReports, 0)} counted reports` : `${beaches.length} beaches · tap a region`}</small>
          </span>
          <PrimaryButton height={44} style={{ width: 'auto', paddingInline: 12, fontSize: 12, boxShadow: 'none' }} onClick={() => setSheet('beaches')}>Search Beaches</PrimaryButton>
        </div>
        {region && locatedBeaches.length < areaBeaches.length && <p className="coastal-footnote">More beaches are available in the list.</p>}
        {layer === 'bio' && <p className="coastal-footnote map-photo-hint">Photos open species guides.</p>}
        {USE_MOCK && <p className="demo-label">Preview · example counts</p>}
      </div>
      {sheet === "key" && (
        <Sheet title="Map Key" onClose={() => setSheet(null)}>
          <p className="subtle">
            Numbers show counted reports in this view. The ring shows the
            highest available attention level in that region. Beach names use their own level. Tap a small photo for its marine-life introduction. Photos show coastal references, not live sightings.
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
            An unrated beach is not necessarily clean. Marine-life references describe
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
        <Sheet title={search.trim() ? "Search All Beaches" : region?.name ?? "All Beaches"} onClose={() => setSheet(null)}>
          <label className="coastal-search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beaches in all regions"
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
                    <button style={{ color: beach.severity ? SEVERITY[beach.severity].text : "#586070" }} onClick={() => nav("/beach/" + beach.id)}>{beach.name}</button>
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
    </main>
  );
}
