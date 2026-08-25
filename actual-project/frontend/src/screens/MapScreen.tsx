import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { getBeaches } from '../api';
import { markerHtml } from '../components/BeachMarker';
import { useLeafletMap } from '../components/useLeafletMap';
import { ArrowRight, Check, Close, WifiOff } from '../components/Icon';
import { C, MONO, SEVERITY, freshStyle, freshnessLabel, lastReportedLabel } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary, MapLayer } from '../types';

// 地图初始视角：雪兰莪海岸
const CENTER: [number, number] = [2.92, 101.45];
const ZOOM = 9;

// 两个图层：垃圾严重度 / 生物多样性
const LAYERS: MapLayer[] = ['litter', 'bio'];

// 图例上的四个色块
const LEGEND = [
  { label: 'LOW', color: '#7CA98B' },
  { label: 'MOD', color: '#D9A24B' },
  { label: 'HIGH', color: '#CE6B45' },
  { label: 'SEVERE', color: '#B84A3F' },
];

export default function MapScreen() {
  const nav = useNavigate();
  const { offline, setOffline } = useApp();
  const [layer, setLayer] = useState<MapLayer>('litter');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // 去拿海滩列表。写成函数是因为「离线」提示条上的 Retry 也要用。
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

  // 图层、选中项或数据变化时整体重画标记
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
          html: markerHtml(b, selectedId === b.id, layer, b.primarySpeciesGlyph),
        }),
        keyboard: false,
      });
      marker.on('click', () => setSelectedId(b.id));
      marker.setZIndexOffset(selectedId === b.id ? 1000 : 0);
      marker.addTo(map);
      markersRef.current[b.id] = marker;
    });
  }, [ready, beaches, layer, selectedId, mapRef]);

  return (
    <div className="screen" style={{ zIndex: 1, background: '#D9E6EF' }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />

      {/* 图层切换 */}
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

      {/* 图例 */}
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
              <span style={{ color: C.dim }}>· VALID RECORDS ONLY</span>
            </>
          ) : (
            <>HABITAT CONTEXT · BROAD AREAS ONLY</>
          )}
        </div>
      </div>

      {(offline || failed) && (
        <div
          className="anim-fade-up"
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
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>You're offline</div>
            <div style={{ fontSize: 11, color: C.mist }}>
              Showing last synced verified data. New reports queue until you reconnect.
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
          onOpen={() => nav(`/beach/${selected.id}`)}
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
  const sev = beach.severity ? SEVERITY[beach.severity] : null;
  const fs = freshStyle(beach.freshnessKind);

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
      className="anim-sheet-up"
      style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(var(--bottom-inset) + 84px)', zIndex: 880 }}
    >
      <div
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,.9)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(255,255,255,.7)',
          borderRadius: 24,
          padding: 18,
          boxShadow: '0 24px 50px -16px rgba(14,30,64,.4)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: 14,
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
                <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{beach.area}</div>
              </div>
              {sev ? (
                <div style={{ padding: '7px 12px', borderRadius: 12, background: sev.tint, color: sev.text, fontSize: 12, fontWeight: 750, letterSpacing: '.1em' }}>
                  {beach.severity?.toUpperCase()}
                </div>
              ) : (
                <div style={{ padding: '7px 12px', borderRadius: 12, background: 'rgba(30,36,44,.06)', border: '1px dashed rgba(30,36,44,.2)', color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: '.08em' }}>
                  INSUFFICIENT DATA
                </div>
              )}
            </div>

            {beach.insufficientData && (
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.muted, marginTop: 10 }}>
                Fewer than three valid reports — no severity band is shown. This does not mean the
                beach is clean.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: 'rgba(11,33,97,.06)', fontSize: 11.5, fontWeight: 600, color: C.ink2 }}>
                <Check size={12} color={C.slate} strokeWidth={2} />
                {beach.validReports} valid reports
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: fs.bg, fontSize: 11.5, fontWeight: 600, color: fs.c }}>
                <i style={{ width: 6, height: 6, borderRadius: 3, background: fs.dot, display: 'block' }} />
                {freshnessLabel(beach.freshnessKind, beach.lastReportedAt)}
              </div>
            </div>

            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10, fontFamily: MONO, letterSpacing: '.04em' }}>
              LAST REPORTED {lastReportedLabel(beach.lastReportedAt)} · BROAD AREA SHOWN — EXACT GPS IS PRIVATE
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
      </div>
    </div>
  );
}
