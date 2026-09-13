import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

type Options = {
  center: [number, number];
  zoom: number;
  interactive?: boolean;
};

/**
 * Put a Leaflet map into a div, and tear it down when the component goes away.
 *
 * WHY A HOOK - the map screen and the small background maps both need exactly
 * this setup, including the resize handling below, which is fiddly and easy to
 * get wrong. Written twice, one copy would eventually be fixed and the other
 * would not.
 *
 * The tiles come from OpenStreetMap, so nothing here depends on our backend -
 * the map still draws when our API is down.
 *
 * NOTE ON REFS - the map object lives in a ref, not in state. Leaflet owns
 * those DOM nodes and mutates them itself. Putting it in state would re-render
 * this component on every pan and zoom, for no benefit, and React still could
 * not manage what is inside.
 */
export function useLeafletMap({ center, zoom, interactive = true }: Options) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

    // Every interaction is switched on or off by one flag, so the background
    // maps on the location screens are truly static: a user swiping up the
    // page must not accidentally drag a decorative map instead.
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: interactive,
    });

    // The attribution is required by the OpenStreetMap licence. It is not
    // optional, and it is not decoration - leaving it off would breach the
    // terms we are using the tiles under.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.setView(center, zoom);
    mapRef.current = map;
    setReady(true);

    // One extra refresh after the entry animation has settled. At the moment
    // the map is created the container is still being animated, so Leaflet
    // measures a size that is about to change and draws the tiles in the
    // wrong place.
    const t = window.setTimeout(() => {
      map.invalidateSize(true);
      map.setView(center, zoom);
    }, 300);

    /*
     * Leaflet caches the pixel size of its container and never measures again
     * on its own. That is fine in a phone app, where the window cannot change
     * size. In a browser it is a real bug: drag the window wider and the map
     * leaves a grey unpainted strip, with every pin frozen at the wrong screen
     * position, until you navigate away and come back.
     *
     * pan:false is required, not a preference. Our shell is 100dvh, and on a
     * mobile browser that height changes constantly as the address bar hides
     * and reappears - the default pan:true would shove the map sideways every
     * time the user scrolled.
     *
     * We also do not setView here. Doing so would drag the user back to the
     * starting position every time they resized the window, throwing away
     * wherever they had panned to.
     *
     * The requestAnimationFrame is a debounce: a drag fires ResizeObserver
     * dozens of times a second, and each invalidateSize forces a re-layout.
     */
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    ro.observe(el);

    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(frame);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Empty dependency list on purpose: center and zoom are the INITIAL view
    // only. If they were dependencies, the whole map would be destroyed and
    // rebuilt every time the caller passed new coordinates. Callers move the
    // map with setView instead - see MiniMap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { elRef, mapRef, ready };
}
