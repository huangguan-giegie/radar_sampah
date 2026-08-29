import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBeaches } from '../api';
import { MiniMap } from '../components/MiniMap';
import { Alert, Check, Pin, Search } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, Skeleton, TextButton } from '../components/ui';
import { C, MONO } from '../theme';
import { OverlayChip, SeverityBadge } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachSummary } from '../types';
import type { ReportDraft } from '../AppContext';

/**
 * 定位没成时说什么。
 * 之前六种情况共用一句「权限被拒绝」—— 用户会去翻一个他根本没关过的开关。
 */
const GPS_MESSAGE: Record<NonNullable<ReportDraft['gpsIssue']>, string> = {
  denied: 'Location permission was declined — choose your beach below.',
  unavailable: "Your device couldn't provide a location — choose your beach below.",
  timeout: 'Locating took too long — choose your beach below.',
  inaccurate: 'The location was too rough to pick a beach from — choose it below.',
  noBeach: 'No supported beach within 25 km — choose the closest one below.',
  failed: "Couldn't check your location just now — choose your beach below.",
};

export default function ConfirmBeachScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
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
  const [query, setQuery] = useState('');

  const suggested = beaches.find((b) => b.id === draft.beachId) || null;

  const manual = draft.locationSource !== 'gps' || !suggested;

  // 搜索框：按名字或地区过滤
  const q = query.trim().toLowerCase();
  const filtered = q
    ? beaches.filter(
        (b) => b.name.toLowerCase().includes(q) || b.area.toLowerCase().includes(q),
      )
    : beaches;

  const center = draft.coords ?? (suggested ? { lat: suggested.lat, lng: suggested.lng } : { lat: 2.95, lng: 101.42 });

  return (
    <div className="screen" style={{ zIndex: 26, background: C.cloud, overflow: 'hidden' }}>
      <MiniMap lat={center.lat} lng={center.lng} zoom={manual ? 9 : 12} />
      {/* z-index 要压过 Leaflet：地图内部的图层在 400–700，普通元素会被盖住 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 800, background: 'linear-gradient(180deg,rgba(221,227,236,.3) 0%,transparent 30%,rgba(12,28,58,.4) 100%)', pointerEvents: 'none' }} />

      <BackButton
        onClick={() => nav(-1)}
        style={{ position: 'absolute', top: 'var(--top-inset)', left: 18, zIndex: 820, background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(10px)' }}
      />
      <OverlayChip
        tone="light"
        style={{ position: 'absolute', top: 'var(--top-inset)', left: '50%', transform: 'translateX(-50%)', zIndex: 820 }}
      >
        {manual ? 'MANUAL BEACH SELECTION' : 'GPS USED ONCE · PRIVATE'}
      </OverlayChip>

      <div
        className="anim-sheet-up measure"
        style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-bottom) + 28px)', zIndex: 820 }}
      >
        {draft.gpsIssue && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              background: 'rgba(217,162,75,.95)',
              borderRadius: 16,
              padding: '12px 14px',
              marginBottom: 10,
              boxShadow: '0 14px 30px -12px rgba(90,60,20,.5)',
            }}
          >
            <Alert size={15} color="#4A3208" strokeWidth={2} />
            <div style={{ fontSize: 12.5, fontWeight: 640, color: '#3D2A08', lineHeight: 1.4 }}>
              {GPS_MESSAGE[draft.gpsIssue]}
            </div>
          </div>
        )}

        <div
          style={{
            background: 'rgba(255,255,255,.94)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,.8)',
            borderRadius: 28,
            padding: 22,
            boxShadow: '0 30px 60px -20px rgba(9,24,52,.5)',
          }}
        >
          {!manual && suggested ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.dim }}>
                SUGGESTED FROM YOUR LOCATION
              </div>
              <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-.4px', marginTop: 8 }}>
                Is this the correct beach?
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 20,
                  background: C.tint,
                  border: `1px solid ${C.line}`,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 16, background: 'linear-gradient(160deg,#4E9EC9,#1C4A85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pin color={C.lime} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 650 }}>{suggested.name}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{suggested.area}</div>
                </div>
                <SeverityBadge band={suggested.severity} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                <PrimaryButton onClick={() => nav('/report/details')} height={54} style={{ borderRadius: 17, boxShadow: 'none' }}>
                  <Check />
                  Yes, Confirm
                </PrimaryButton>
                <TextButton
                  onClick={() =>
                    patchDraft({ locationSource: 'manual', coords: null, beachId: null, beachName: null })
                  }
                >
                  Choose Another Beach
                </TextButton>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-.4px' }}>Choose your beach</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 15,
                  background: C.tint,
                  border: `1px solid ${C.line}`,
                }}
              >
                <Search />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={failed ? 'Beach list unavailable' : `Search the ${beaches.length || 4} supported beaches`}
                  style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13.5, color: C.ink }}
                />
              </div>
              <div className="scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 250 }}>
                {loading && <Skeleton h={58} r={16} />}
                {filtered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      patchDraft({ beachId: b.id, beachName: b.name, locationSource: 'manual', coords: null });
                      nav('/report/details');
                    }}
                    className="chip-hover"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '12px 13px',
                      borderRadius: 16,
                      border: '1px solid transparent',
                      width: '100%',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(11,33,97,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Pin size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 640 }}>{b.name}</div>
                      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>{b.area}</div>
                    </div>
                    <SeverityBadge band={b.severity} />
                  </button>
                ))}
                {!loading && failed && (
                  <ErrorNote
                    title="Couldn't load the beach list"
                    body="Your photo is safe — this is just the connection."
                    onRetry={loadBeaches}
                  />
                )}
                {!loading && !failed && filtered.length === 0 && (
                  <div style={{ fontSize: 12.5, color: C.dim, padding: '10px 4px' }}>
                    {q ? `No supported beach matches “${query}”.` : 'No beaches available right now.'}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 8, textAlign: 'center' }}>
                Selecting a beach confirms your report location.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
