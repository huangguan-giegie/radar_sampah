import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { getBeaches } from '../api';
import { markerHtml } from '../components/BeachMarker';
import { useLeafletMap } from '../components/useLeafletMap';
import { ArrowRight, Check, Close, Info, WifiOff } from '../components/Icon';
import { attentionStateFor, C, freshnessLabel, freshStyle, lastReportedLabel, MONO, reportWord, severityLabel } from '../theme';
import { GlassPanel, SeverityBadge } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachSummary, MapLayer } from '../types';


const CENTER: [number, number] = [2.92, 101.45];
const ZOOM = 9;

const LAYER_KEY = 'rs_map_layer';

// Below this the four beaches are close enough that the full pills collide, so
// the pins drop to a compact dot. Nothing is hidden - it stays tappable.
const COMPACT_ZOOM = 8;

const MARKER_OFFSETS: Record<string, [number, number]> = {
  // Separate the two nearby south-coast markers at narrow mobile widths.
  morib: [-45, -45],
  kelanang: [-10, 65],
};


const LAYERS: MapLayer[] = ['litter', 'bio'];


const LEGEND = [
  { label: 'LOW', color: '#7CA98B' },
  { label: 'MODERATE', color: '#D9A24B' },
  { label: 'HIGH', color: '#CE6B45' },
  { label: severityLabel('Severe').toUpperCase(), color: '#B84A3F' },
  // The grey pin was on the map with nothing in the legend to explain it, so
  // "no evidence yet" looked like a fifth, milder severity. Same grey as
  // BeachMarker uses when severity is null - dashed there, dashed here.
  { label: 'NO DATA', color: '#98A4B5', dashed: true },
];

export default function MapScreen() {
  const nav = useNavigate();
  const { offline, setOffline } = useApp();
  // Remembered per tab. Opening a beach and coming back used to drop the user
  // on the litter layer again, so anyone browsing biodiversity had to re-pick
  // it after every single beach.
  const [layer, setLayer] = useState<MapLayer>(() => {
    try {
      return sessionStorage.getItem(LAYER_KEY) === 'bio' ? 'bio' : 'litter';
    } catch {
      return 'litter';
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(LAYER_KEY, layer);
    } catch {
      // Storage off: the layer just will not be remembered. Not worth an error.
    }
  }, [layer]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);

  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);


  function loadBeaches() {
    setLoading(true);
    setFailed(false);
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  useEffect(loadBeaches, []);
  const { elRef, mapRef, ready } = useLeafletMap({ center: CENTER, zoom: ZOOM });
  const markersRef = useRef<Record<string, L.Marker>>({});

  const selected = beaches.find((b) => b.id === selectedId) || null;


  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    beaches.forEach((b) => {
      const marker = L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: markerHtml(b, selectedId === b.id, layer, b.primarySpeciesGlyph, compact ? [0, 0] : MARKER_OFFSETS[b.id] ?? [0, 0], compact),
        }),
        keyboard: true,
      });
      marker.on('click', () => setSelectedId(b.id));
      marker.setZIndexOffset(selectedId === b.id ? 1000 : 0);
      marker.addTo(map);
      const markerElement = marker.getElement();
      markerElement?.setAttribute('role', 'button');
      markerElement?.setAttribute('tabindex', '0');
      markerElement?.setAttribute(
        'aria-label',
        `${b.name} · ${layer === 'litter' ? attentionStateFor(b.severity, b.insufficientData, b.validReports).markerLabel : b.habitatTag}`,
      );
      markerElement?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedId(b.id);
        }
      });
      markersRef.current[b.id] = marker;
    });
  }, [ready, beaches, layer, selectedId, compact, mapRef]);

  // Follow the zoom so the pins can switch to dots when they would collide.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const sync = () => setCompact(map.getZoom() < COMPACT_ZOOM);
    sync();
    map.on('zoomend', sync);
    return () => {
      map.off('zoomend', sync);
    };
  }, [ready, mapRef]);

  return (
    <div className="screen" style={{ zIndex: 1, background: '#D9E6EF' }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />


      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--top-inset) + 12px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 850,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: 'rgba(255,255,255,.78)',
            backdropFilter: 'blur(16px) saturate(150%)',
            WebkitBackdropFilter: 'blur(16px) saturate(150%)',
            border: '1px solid rgba(255,255,255,.6)',
            boxShadow: '0 10px 30px -10px rgba(14,30,64,.35)',
          }}
        >
          {LAYERS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setLayer(k)}
              aria-pressed={layer === k}
              style={{
                padding: '9px 20px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                background: layer === k ? C.navy : 'transparent',
                color: layer === k ? C.white : C.slate,
              }}
            >
              {k === 'litter' ? 'Litter' : 'Biodiversity'}
            </button>
          ))}
        </div>
      </div>


      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--top-inset) + 66px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 840,
          pointerEvents: 'none',
          padding: '0 12px',
        }}
      >
        {/* The legend wraps rather than running off the screen. It needs 419px
            on one line, and almost every phone is narrower than that: 17px of
            it was cut at 390 (this project's reference width), 24 at 375 and
            52 at 320, always from the right - so "· COUNTED REPORTS ONLY", the
            line that says which reports the colours are counting, was the part
            nobody could read. nowrap made it unwrappable and the pill has no
            scroller, so the text was simply gone rather than reachable. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 8,
            rowGap: 3,
            maxWidth: '100%',
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.82)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.55)',
            fontFamily: MONO,
            fontSize: 8.5,
            letterSpacing: '.08em',
            color: C.slate,
          }}
        >
          {layer === 'litter' ? (
            <>
              {LEGEND.map((item) => (
                <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                  <i style={{ width: 7, height: 7, borderRadius: 3, background: item.color, display: 'block' }} />
                  {item.label}
                </span>
              ))}
              <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>· COUNTED REPORTS ONLY</span>
            </>
          ) : (
            <>HABITAT CONTEXT · BROAD AREAS ONLY</>
          )}
        </div>
      </div>

      {(offline || failed) && (
        <div
          className="anim-fade-up measure"
          style={{
            position: 'absolute',
            top: 'calc(var(--top-inset) + 106px)',
            left: 24,
            right: 24,
            zIndex: 860,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '11px 14px',
            borderRadius: 16,
            background: 'rgba(30,36,44,.88)',
            backdropFilter: 'blur(10px)',
            color: C.bg,
          }}
        >
          <WifiOff />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>
              {offline ? 'Offline preview' : 'Map refresh failed'}
            </div>
            <div style={{ fontSize: 11, color: C.mist }}>
              {offline
                ? 'Cached map data may be outdated. Real API submissions require a connection.'
                : 'Could not refresh map data. Check your connection and retry.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOffline(false);
              loadBeaches();
            }}
            style={{ fontSize: 11, color: C.lime, fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && beaches.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 830,
            pointerEvents: 'none',
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: '.14em',
            color: C.slate,
          }}
        >
          LOADING BEACHES…
        </div>
      )}

      {selected && (
        <SelectedCard
          beach={selected}
          layer={layer}
          onClose={() => setSelectedId(null)}
          // From the biodiversity layer the button says Learn More, so it has
          // to land on the species cards. It used to open the beach at the top
          // and leave the user to find them.
          onOpen={() =>
            nav(`/beach/${selected.id}`, layer === 'bio' ? { state: { focus: 'species' } } : undefined)
          }
        />
      )}
    </div>
  );
}

function SelectedCard({
  beach,
  layer,
  onClose,
  onOpen,
}: {
  beach: BeachSummary;
  layer: MapLayer;
  onClose: () => void;
  onOpen: () => void;
}) {
  const fs = freshStyle(beach.freshnessKind);
  const attention = attentionStateFor(beach.severity, beach.insufficientData, beach.validReports);

  const metaRow = (k: string, v: string, color: string = C.ink2, weight = 400) => (
    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', color: C.faint, width: 78, flex: 'none' }}>
        {k}
      </span>
      <span style={{ fontSize: 13, color, fontWeight: weight }}>{v}</span>
    </div>
  );

  return (
    <div
      className="anim-sheet-up measure"
      style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(var(--bottom-inset) + 84px)', zIndex: 880 }}
    >
      <GlassPanel className="ds-glass-solid" style={{ position: 'relative', padding: 18 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 44,
            height: 44,
            borderRadius: 22,
            background: 'rgba(11,33,97,.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Close />
        </button>

        {layer === 'litter' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingRight: 28 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 650, letterSpacing: '-.3px' }}>{beach.name}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{beach.area}</div>
              </div>
              <SeverityBadge band={attention.hasBand ? beach.severity : null} label={attention.pageLabel} size="lg" />
            </div>

            {!attention.hasBand && (
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.muted, marginTop: 10 }}>
                {attention.detail}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: 'rgba(11,33,97,.06)', fontSize: 11.5, fontWeight: 600, color: C.ink2 }}>
                {attention.hasBand ? (
                  <Check size={12} color={C.slate} strokeWidth={2} />
                ) : (
                  <Info size={12} color={C.slate} strokeWidth={2} />
                )}
                {beach.validReports} counted {reportWord(beach.validReports)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: fs.bg, fontSize: 11.5, fontWeight: 600, color: fs.c }}>
                <i style={{ width: 6, height: 6, borderRadius: 3, background: fs.dot, display: 'block' }} />
                {freshnessLabel(beach.freshnessKind, beach.lastReportedAt)}
              </div>
            </div>

            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10, fontFamily: MONO, letterSpacing: '.04em' }}>
              {beach.lastReportedAt ? `LAST REPORTED ${lastReportedLabel(beach.lastReportedAt)}` : lastReportedLabel(null)} · BROAD AREA SHOWN — EXACT GPS IS PRIVATE
            </div>
          </>
        ) : (
          <>
            <div style={{ paddingRight: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 650, letterSpacing: '-.3px' }}>{beach.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.14em', color: C.dim, marginTop: 3 }}>
                BIODIVERSITY NEARBY
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {metaRow('HABITAT', beach.habitat, C.ink2, 600)}
              {metaRow('RELEVANCE', beach.sensitivity, '#2B4EA2', 600)}
            </div>

            {beach.speciesNames?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
                {beach.speciesNames.map((n) => (
                  <span
                    key={n}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.ink2,
                      background: 'rgba(11,33,97,.06)',
                      borderRadius: 999,
                      padding: '5px 10px',
                    }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}

            {beach.speciesNames?.length > 0 && (
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.dim, marginTop: 10, lineHeight: 1.5 }}>
                CONTEXT ONLY · NOT PROOF OF CURRENT PRESENCE
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onOpen}
          className="btn-primary press"
          style={{
            marginTop: 14,
            height: 50,
            width: '100%',
            borderRadius: 16,
            background: C.navy,
            color: C.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14.5,
            fontWeight: 600,
          }}
        >
          <span>{layer === 'litter' ? 'View Beach' : 'Learn More'}</span>
          <ArrowRight size={14} />
        </button>
      </GlassPanel>
    </div>
  );
}
