import { useEffect } from 'react';
import L from 'leaflet';
import { MINI_PIN_HTML } from './BeachMarker';
import { useLeafletMap } from './useLeafletMap';

/** 定位/确认页背景上的静态小地图（不可拖动，只是氛围 + 位置示意） */
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
