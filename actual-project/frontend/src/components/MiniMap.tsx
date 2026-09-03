import { useEffect } from 'react';
import L from 'leaflet';
import { MINI_PIN_HTML } from './BeachMarker';
import { useLeafletMap } from './useLeafletMap';

/**
 * The small static map behind the location and confirm screens.
 *
 * It cannot be dragged or zoomed. It is there to show roughly where we think
 * the user is, and it is behind a card they are meant to be reading - a map
 * that moved under their thumb would just eat their scrolling.
 *
 * Unlike the main map screen, this one calls setView when its coordinates
 * change, because the parent moves the view as GPS resolves rather than
 * rebuilding the map.
 */
export function MiniMap({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const { elRef, mapRef, ready } = useLeafletMap({
    center: [lat, lng],
    zoom,
    interactive: false,
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setView([lat, lng], zoom);
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', iconSize: [0, 0], html: MINI_PIN_HTML }),
      keyboard: false,
    }).addTo(map);
    return () => {
      map.removeLayer(marker);
    };
  }, [ready, lat, lng, zoom, mapRef]);

  return <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />;
}
