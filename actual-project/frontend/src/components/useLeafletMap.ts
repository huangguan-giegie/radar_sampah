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

    /*
     * Leaflet 把容器的像素尺寸缓存下来，之后不会自己再量一次。挂载时那一次
     * 刷新过了，容器再改大小它就不知道了 —— 拖动浏览器窗口改变宽度，地图会
     * 留一条没画的灰边，标记也停在错误的屏幕位置，直到离开页面再回来。
     *
     * pan:false 是必须的：外壳是 100dvh，手机浏览器地址栏收起时高度会一直变，
     * 默认的 pan:true 会在用户滚动时不停地推动地图。这里也不重设视野，
     * 不然用户拖到哪都会被拽回初始位置。
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
    // center/zoom 只作为初始视图，后续变化由调用方自行 setView
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { elRef, mapRef, ready };
}
