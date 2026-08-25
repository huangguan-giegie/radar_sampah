import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

type Options = {
  center: [number, number];
  zoom: number;
  interactive?: boolean;
};

/**
 * 在给定的 div 上挂一张 Leaflet 地图，组件卸载时销毁。
 * 换后端不影响这里 —— 底图是 OpenStreetMap 公共瓦片。
 */
export function useLeafletMap({ center, zoom, interactive = true }: Options) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.setView(center, zoom);
    mapRef.current = map;
    setReady(true);

    // 容器在动画/布局稳定后尺寸才正确，补一次刷新
    const t = window.setTimeout(() => {
      map.invalidateSize(true);
      map.setView(center, zoom);
    }, 300);

    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // center/zoom 只作为初始视图，后续变化由调用方自行 setView
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { elRef, mapRef, ready };
}
