// Step 2 of the report: which beach are you on?
//
// The user is asked for their location ONCE, and it is used once, to suggest a
// beach. There is no tracking, and no background location. The screen says
// this before the browser prompt appears, because a permission dialog with no
// explanation is the one most people refuse.
//
// Every path out of this screen goes to /report/confirm, where the user
// confirms or changes the beach. Location never chooses on its own - the
// person always gets the last word.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveBeach } from '../api';
import { MiniMap } from '../components/MiniMap';
import { Pin } from '../components/Icon';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { PrivacySheet } from '../components/PrivacySheet';
import { C } from '../theme';
import { useApp } from '../AppContext';


/** Where the little map sits before we know anything: the Selangor coast.
 *  Once the user allows location, it pans to where they actually are. */
const FALLBACK: [number, number] = [2.95, 101.42];

export default function GpsScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  async function allowOnce() {
    // Some browsers have no geolocation at all, and any page served over
    // plain http does not get it either. Fall through to picking by hand
    // rather than crashing on an undefined API.
    if (!('geolocation' in navigator)) {
      patchDraft({ locationSource: 'manual', gpsIssue: 'unavailable' });
      nav('/report/confirm');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Round the coordinates the moment we receive them.
        //
        // DMP section 4.2 says we store an approximate location, and the
        // screen promises the exact position never leaves the device. Three
        // decimal places is about 110 metres. We round HERE, at the point of
        // collection, so the precise value is never put in a variable that
        // could be sent anywhere - a promise kept by the shape of the code,
        // not by remembering to strip it later.
        //
        // 110 m is plenty: the nearest two beaches are about 10 km apart.
        //
        // This rounding is also what makes the bold line in the card below
        // true - "Your exact coordinates never appear publicly." That line is
        // bold because it is the sentence that decides whether the user
        // presses Allow, so it has to stay true here.
        const round3 = (n: number) => Math.round(n * 1000) / 1000;
        const coords = { lat: round3(pos.coords.latitude), lng: round3(pos.coords.longitude) };

        // A rough fix is worse than no fix. accuracy is the radius the browser
        // itself is confident about; past 2 km the answer is little better
        // than a guess, and a guessed beach becomes a wrong report that counts
        // towards a real score. So we hand it back to the user instead.
        if (pos.coords.accuracy > 2000) {
          setBusy(false);
          patchDraft({ locationSource: 'manual', coords: null, gpsIssue: 'inaccurate' });
          nav('/report/confirm');
          return;
        }

        try {
          const beach = await resolveBeach(coords.lat, coords.lng);
          // A beach was found: pre-select it, and remember this came from GPS.
          // The backend needs that flag for its duplicate check.
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
        // "You refused", "your device cannot get a fix" and "it timed out" are
        // three different problems. Reporting all of them as "permission
        // denied" sends people into their settings to fix something that was
        // never broken. The confirm screen prints a different line for each.
        const issue =
          err.code === err.PERMISSION_DENIED ? 'denied'
          : err.code === err.TIMEOUT ? 'timeout'
          : 'unavailable';
        patchDraft({ locationSource: 'manual', gpsIssue: issue, coords: null });
        nav('/report/confirm');
      },
      // 10 seconds, then give up. Without a timeout this call can hang for
      // ever indoors, leaving the button stuck on "Locating..." with no way
      // out. high accuracy because 100 metres decides which beach it is.
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Skip location entirely. This is offered as an equal choice next to Allow,
  // not hidden as a fallback: some volunteers simply will not share location,
  // and their reports are worth just as much.
  function chooseManually() {
    patchDraft({ locationSource: 'manual', gpsIssue: null, coords: null });
    nav('/report/confirm');
  }

  const center = draft.coords ?? { lat: FALLBACK[0], lng: FALLBACK[1] };

  return (
    // Layering note for everything below. Leaflet's own layers sit between
    // z-index 400 and 700, so the tint overlay and the card that sit on top of
    // the map use 800 and 820. Anything below 400 is swallowed by the map,
    // however late it appears in the markup.
    <div className="screen" style={{ zIndex: 26, background: C.cloud, overflow: 'hidden' }}>
      <MiniMap lat={center.lat} lng={center.lng} zoom={9} />

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
        className="anim-sheet-up measure"
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
            // "Why do we need this?" opens the full explanation without
            // leaving the page. Asked at the moment the question occurs, which
            // is not the same as a privacy policy in a footer.
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
