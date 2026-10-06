import { useEffect, useRef, useState, type ReactNode } from 'react';
import { resolveBeach } from '../api';
import { hasChosenLocation, rememberLocationChoice } from '../locationPreference';
import { MiniMap } from './MiniMap';
import { Pin } from './Icon';
import { GhostButton, PrimaryButton } from './ui';
import { C } from '../theme';
import '../styles/location-prompt.css';

export function LocationPrompt({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(hasChosenLocation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [why, setWhy] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const finish = (beachId: string | null) => {
    if (!active.current) return;
    rememberLocationChoice(beachId);
    setDone(true);
  };
  const allowLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is unavailable on this device. You can keep exploring and choose a beach yourself.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (!active.current) return;
      if (coords.accuracy > 2000) {
        setBusy(false);
        setError('This location is too approximate to choose a beach. Try again or choose Not Now.');
        return;
      }
      try {
        const beach = await resolveBeach(coords.latitude, coords.longitude);
        finish(beach?.id ?? null);
      } catch {
        if (active.current) {
          setBusy(false);
          setError('We could not match your location to a beach. Try again or choose Not Now.');
        }
      }
    }, () => {
      if (!active.current) return;
      setBusy(false);
      setError('We could not get your location. You can keep exploring and choose a beach yourself.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  if (done) return children;
  return <div className="screen location-prompt">
    <MiniMap lat={2.9} lng={101.35} zoom={9} />
    <div className="location-map-wash" />
    <a className="location-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    <section className="location-prompt-card" aria-labelledby="location-title">
      <span className="location-prompt-icon"><Pin size={28} color={C.navy} /></span>
      <h1 id="location-title">Find Beaches Near You</h1>
      <p>Allow location so we can show the nearest beach and help you choose a beach when you report litter. <strong>Your exact coordinates never appear publicly.</strong></p>
      {error && <p role="alert">{error}</p>}
      <PrimaryButton onClick={allowLocation} disabled={busy}>{busy ? 'Finding your beach...' : 'Allow Location'}</PrimaryButton>
      <GhostButton onClick={() => finish(null)}>Not Now</GhostButton>
      <button className="location-why" onClick={() => setWhy(!why)} aria-expanded={why}>Why Do We Need This?</button>
      {why && <p role="status">Location is optional. It is sent to our API to find a beach within 25 km. This device keeps only the matched beach name, and you can choose a different beach before reporting.</p>}
    </section>
  </div>;
}
