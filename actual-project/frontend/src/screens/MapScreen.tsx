// The map: every beach as a pin, on a real map of the Selangor coast.
//
// TWO LAYERS, NEVER MIXED. "Litter" shows the severity we measured; the
// biodiversity layer shows what lives nearby. They are kept apart on purpose -
// one is evidence collected by volunteers, the other is reference data from
// OBIS and FishBase. Blended into one colour, the user could not tell which
// claim they were looking at, and a wildlife hint would look like a
// measurement we made.
//
// LEAFLET WITH OPENSTREETMAP, not Google Maps: no API key, no billing account,
// no per-load quota to run out of on demo day, and the licence is fine for a
// public non-commercial project.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { getBeaches } from '../api';
import { markerHtml } from '../components/BeachMarker';
import { useLeafletMap } from '../components/useLeafletMap';
import { ArrowRight, Check, Close, Info, WifiOff } from '../components/Icon';
import { attentionStateFor, C, MONO, freshStyle, freshnessLabel, lastReportedLabel, severityLabel } from '../theme';
import { GlassPanel, SeverityBadge } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachSummary, MapLayer } from '../types';


// The opening view: the Selangor coast. Zoom 9 fits all four beaches at once,
// so the user sees the whole project the moment the map opens, rather than
// landing somewhere they have to pan away from.
const CENTER: [number, number] = [2.92, 101.45];
const ZOOM = 9;

// Hand-tuned nudges in screen pixels, keyed by beach id. Morib and Kelanang
// are close together, so at phone width their pins and labels sit on top of
// each other and the one underneath cannot be read or tapped.
//
// This moves only the drawing, not the data. The pin no longer sits exactly on
// its coordinate, which is acceptable here because the map already shows a
// broad area on purpose - the exact GPS point is never published.
const MARKER_OFFSETS: Record<string, [number, number]> = {
  // Separate the two nearby south-coast markers at narrow mobile widths.
  morib: [-45, -45],
  kelanang: [-10, 65],
};


// The two layers. An array, not two booleans, so exactly one can be on.
const LAYERS: MapLayer[] = ['litter', 'bio'];


// The legend. A colour with no key is decoration, not information - without
// this the user has no way to learn what orange means.
//
// The last label goes through severityLabel(), so the map says "VERY HIGH"
// while the data still says 'Severe'. Hard-coding the word here is how a
// legend ends up disagreeing with the pins it explains.
const LEGEND = [
  { label: 'LOW', color: '#7CA98B' },
  { label: 'MODERATE', color: '#D9A24B' },
  { label: 'HIGH', color: '#CE6B45' },
  { label: severityLabel('Severe').toUpperCase(), color: '#B84A3F' },
];

export default function MapScreen() {
  const nav = useNavigate();
  const { offline, setOffline } = useApp();
  const [layer, setLayer] = useState<MapLayer>('litter');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);


  // Named, because the Retry button in the offline bar calls the same code.
  function loadBeaches() {
    setLoading(true);
    setFailed(false);
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  useEffect(loadBeaches, []);
  // Leaflet itself is set up in useLeafletMap - see that file for why the map
  // object lives in a ref instead of state.
  const { elRef, mapRef, ready } = useLeafletMap({ center: CENTER, zoom: ZOOM });
  // The markers are a ref too. React does not own these DOM nodes, Leaflet
  // does; putting them in state would re-render on every pin change and React
  // still could not update them.
  const markersRef = useRef<Record<string, L.Marker>>({});

  const selected = beaches.find((b) => b.id === selectedId) || null;


  // Redraw every pin when the layer, the selection or the data changes.
  //
  // We remove them all and add them again rather than patching each one. With
  // four beaches that is cheap, and it removes a whole class of bug where an
  // old pin survives with the wrong colour or the wrong icon. If this ever grew
  // to hundreds of beaches, this is the first thing to make smarter.
  //
  // Because the DOM nodes are thrown away each run, the keyboard support below
  // has to be attached again every time. That is also why the key handler needs
  // no removal: the element it was added to is gone.
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
          html: markerHtml(b, selectedId === b.id, layer, b.primarySpeciesGlyph, MARKER_OFFSETS[b.id] ?? [0, 0]),
        }),
        // Let Leaflet put the pin in the tab order. Off, and the keyboard
        // support set up below could never be reached.
        keyboard: true,
      });
      marker.on('click', () => setSelectedId(b.id));
      // Lift the selected pin above the others. Two beaches close together
      // would otherwise overlap, and the one the user just chose could end up
      // hidden underneath its neighbour.
      marker.setZIndexOffset(selectedId === b.id ? 1000 : 0);
      marker.addTo(map);
      // Make the pin usable without a touch screen. A pin that only answers to
      // a tap shuts out anyone on a keyboard or a switch device, and the marker
      // is the only way into a beach from this screen.
      //
      // These go on the element Leaflet actually creates, which is the one that
      // takes focus. markerHtml sets the same attributes on the inner div it
      // draws inside this element.
      const markerElement = marker.getElement();
      markerElement?.setAttribute('role', 'button');
      markerElement?.setAttribute('tabindex', '0');
      // Say the severity, not just the name. A screen reader user gets no
      // colour and no bars, so without this the pin reads as a bare place name
      // and the whole point of the map is lost. Same wording as the pin shows.
      markerElement?.setAttribute(
        'aria-label',
        `${b.name} · ${layer === 'litter' ? attentionStateFor(b.severity, b.insufficientData, b.validReports).markerLabel : b.habitatTag}`,
      );
      // Enter and Space are what people expect a button to answer to, so both
      // open the beach. preventDefault stops Space from scrolling the page
      // underneath while the user is still choosing a pin.
      markerElement?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedId(b.id);
        }
      });
      markersRef.current[b.id] = marker;
    });
  }, [ready, beaches, layer, selectedId, mapRef]);

  return (
    <div className="screen" style={{ zIndex: 1, background: '#D9E6EF' }}>
      {/* Leaflet draws into this empty div. Nothing inside it is React's -
          which is exactly why it has no children here. */}
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
          {/* A toggle group, not two separate buttons. aria-pressed is what
              tells a screen reader which layer is on - the only other clue is
              the fill colour, which does not reach someone who cannot see it. */}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.55)',
            fontFamily: MONO,
            fontSize: 8.5,
            letterSpacing: '.08em',
            color: C.slate,
            whiteSpace: 'nowrap',
          }}
        >
          {layer === 'litter' ? (
            <>
              {LEGEND.map((item) => (
                <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i style={{ width: 7, height: 7, borderRadius: 3, background: item.color, display: 'block' }} />
                  {item.label}
                </span>
              ))}
              {/* Colours come only from reports that passed our checks. Without
                  this line the pins read as "all the litter here", when they
                  really say "what people counted here". The app says "counted"
                  everywhere for the same reason - see attentionStateFor. */}
              <span style={{ color: C.muted }}>· COUNTED REPORTS ONLY</span>
            </>
          ) : (
            <>HABITAT CONTEXT · BROAD AREAS ONLY</>
          )}
        </div>
      </div>

      {/* One bar for two different problems: the app is in offline preview, or
          this refresh failed. Both leave the user looking at data that may be
          stale, so both must say so - a map that silently shows old numbers is
          worse than one that shows an error. */}
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

      {/* Only show "loading" when there is nothing on screen yet. During a
          retry the old pins are still there, and covering a usable map with a
          loading message would take away what the user already had. */}
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
          onOpen={() => nav(`/beach/${selected.id}`)}
        />
      )}
    </div>
  );
}

/**
 * The card that slides up when a pin is tapped.
 *
 * It shows different things per layer, and it sits above the map rather than
 * replacing it, so the user keeps their place. Closing it returns them exactly
 * where they were - no navigation, so no back button surprise.
 */
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
  // Worked out once, then used by the badge, the explanation and the icon
  // below. One source, so the card cannot show a severity band in one place and
  // say "Insufficient data" in another.
  const attention = attentionStateFor(beach.severity, beach.insufficientData, beach.validReports);

  // A small label/value row. Written once as a function so the labels line up
  // in one column - a fixed 78px label width, rather than each row guessing.
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
      <GlassPanel style={{ position: 'relative', padding: 18 }}>
        {/* 44 by 44 is the smallest tap target that is reliable on a phone.
            This button sits over a draggable map, so a miss does not do
            nothing - it pans the map instead, which feels broken. */}
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
              {/* Pass null for the band when the reports are too few. The badge
                  then draws its neutral "no data" style instead of a colour
                  that would claim we measured something. The label comes from
                  the same helper, so the badge and the line below always agree. */}
              <SeverityBadge band={attention.hasBand ? beach.severity : null} label={attention.pageLabel} size="lg" />
            </div>

            {/* Say why there is no band. An empty space where a colour belongs
                reads as "nothing wrong here", which is the opposite of what we
                know. The wording is built by attentionStateFor, so it follows
                the required number of reports instead of repeating it here. */}
            {!attention.hasBand && (
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.muted, marginTop: 10 }}>
                {attention.detail}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: 'rgba(11,33,97,.06)', fontSize: 11.5, fontWeight: 600, color: C.ink2 }}>
                {/* A tick beside a number we do not trust yet looks like
                    approval. When there are too few reports for a band, show
                    the info mark instead - same count, honest tone. */}
                {attention.hasBand ? (
                  <Check size={12} color={C.slate} strokeWidth={2} />
                ) : (
                  <Info size={12} color={C.slate} strokeWidth={2} />
                )}
                {beach.validReports} counted reports
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

            {/* The ?. guards against a real backend. The contract now makes
                this field required, but one missing field should degrade the
                card, not blank the whole screen with a crash. */}
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
                {/* The beach page treats this line as required on every
                    species card. These are the same names, so the qualifier
                    comes with them. Dropping it here because space is tight
                    would turn "context" into "we saw these animals". */}
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
