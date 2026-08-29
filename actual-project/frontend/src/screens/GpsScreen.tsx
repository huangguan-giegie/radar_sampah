import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveBeach } from '../api';
import { MiniMap } from '../components/MiniMap';
import { Pin } from '../components/Icon';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { PrivacySheet } from '../components/PrivacySheet';
import { C } from '../theme';
import { useApp } from '../AppContext';

/** 地图默认落在雪兰莪海岸；用户授权后再按真实坐标平移 */
const FALLBACK: [number, number] = [2.95, 101.42];

export default function GpsScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  async function allowOnce() {
    if (!('geolocation' in navigator)) {
      patchDraft({ locationSource: 'manual', gpsIssue: 'unavailable' });
      nav('/report/confirm');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // DMP §4.2 要求存的是 approx location，界面上也承诺精确坐标不离开这一屏。
        // 所以在采集处就取到小数点后 3 位（约 110m）——
        // 精确值从头到尾没离开过设备，25km 的海滩匹配半径也完全够用。
        const round3 = (n: number) => Math.round(n * 1000) / 1000;
        const coords = { lat: round3(pos.coords.latitude), lng: round3(pos.coords.longitude) };

        // 定位太糙就别猜海滩。海滩之间最近约 10km，
        // 误差超过 2km 的定位挑出来的海滩不比手选可靠。
        if (pos.coords.accuracy > 2000) {
          setBusy(false);
          patchDraft({ locationSource: 'manual', coords: null, gpsIssue: 'inaccurate' });
          nav('/report/confirm');
          return;
        }

        try {
          const beach = await resolveBeach(coords.lat, coords.lng);
          if (beach) {
            patchDraft({ locationSource: 'gps', coords, beachId: beach.id, beachName: beach.name, gpsIssue: null });
          } else {
            patchDraft({ locationSource: 'manual', coords: null, gpsIssue: 'noBeach' });
          }
        } catch {
          patchDraft({ locationSource: 'manual', coords: null, gpsIssue: 'failed' });
        } finally {
          setBusy(false);
          nav('/report/confirm');
        }
      },
      (err) => {
        setBusy(false);
        // 拒绝 / 定不到 / 超时是三件事，不能都说成「权限被拒绝」
        const issue =
          err.code === err.PERMISSION_DENIED ? 'denied'
          : err.code === err.TIMEOUT ? 'timeout'
          : 'unavailable';
        patchDraft({ locationSource: 'manual', gpsIssue: issue, coords: null });
        nav('/report/confirm');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function chooseManually() {
    patchDraft({ locationSource: 'manual', gpsIssue: null, coords: null });
    nav('/report/confirm');
  }

  const center = draft.coords ?? { lat: FALLBACK[0], lng: FALLBACK[1] };

  return (
    <div className="screen" style={{ zIndex: 26, background: C.cloud, overflow: 'hidden' }}>
      <MiniMap lat={center.lat} lng={center.lng} zoom={9} />
      {/* z-index 要压过 Leaflet：地图内部的图层在 400–700，普通元素会被盖住 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 800, pointerEvents: 'none', backdropFilter: 'blur(4px)', background: 'linear-gradient(180deg,rgba(221,227,236,.55) 0%,rgba(221,227,236,.25) 40%,rgba(14,30,64,.45) 100%)' }} />

      <BackButton
        onClick={() => nav(-1)}
        style={{
          position: 'absolute',
          top: 'var(--top-inset)',
          left: 18,
          zIndex: 820,
          background: 'rgba(255,255,255,.85)',
          backdropFilter: 'blur(10px)',
        }}
      />

      <div
        className="anim-sheet-up"
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 'calc(var(--safe-bottom) + 28px)',
          zIndex: 820,
          background: 'rgba(255,255,255,.94)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,.8)',
          borderRadius: 28,
          padding: '24px 22px',
          boxShadow: '0 30px 60px -20px rgba(9,24,52,.5)',
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 26, background: 'rgba(11,33,97,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Pin size={23} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-.5px', marginTop: 14 }}>
          Help us locate the beach
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: C.muted, marginTop: 8 }}>
          Location is used once to suggest which supported beach you're on.
          <br />
          <b style={{ color: C.ink2, fontWeight: 650 }}>Your exact coordinates never appear publicly.</b>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
          <PrimaryButton onClick={allowOnce} disabled={busy} height={54} style={{ borderRadius: 17, boxShadow: 'none' }}>
            {busy ? 'Locating…' : 'Allow Once'}
          </PrimaryButton>
          <GhostButton onClick={chooseManually} height={52} style={{ borderRadius: 17, fontSize: 14.5 }}>
            Choose Beach Manually
          </GhostButton>
          <TextButton
            onClick={() => setSheet(true)}
            style={{ fontSize: 12.5, color: C.dim, textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 400, padding: 6 }}
          >
            Why do we need this?
          </TextButton>
        </div>
      </div>

      {sheet && <PrivacySheet onClose={() => setSheet(false)} />}
    </div>
  );
}
