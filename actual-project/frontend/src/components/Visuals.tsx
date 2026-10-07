import { tilePoint } from "../visuals";

const span = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * A still map cut from OpenStreetMap tiles, with a pin on the place. Used where
 * a beach has no photo: it shows where the beach is instead of a drawn
 * placeholder. It fills its (positioned) parent.
 *
 * `focus` is where the pin sits in the box, as fractions of its width and
 * height. `tile` is the drawn size of one tile. `reach` is the largest box the
 * map has to cover; the tiles fetched always cover it, wherever the pin sits.
 */
export function StaticMap({
  lat,
  lng,
  zoom,
  tile = 256,
  focus = [0.5, 0.5],
  reach,
}: {
  lat: number;
  lng: number;
  zoom: number;
  tile?: number;
  focus?: [number, number];
  reach: [number, number];
}) {
  const { x, y } = tilePoint(lat, lng, zoom);
  const [fx, fy] = focus;
  const cols = span(Math.floor(x - (fx * reach[0]) / tile), Math.floor(x + ((1 - fx) * reach[0]) / tile));
  const rows = span(Math.floor(y - (fy * reach[1]) / tile), Math.floor(y + ((1 - fy) * reach[1]) / tile));
  return (
    <span className="static-map" aria-hidden="true">
      {rows.flatMap((ty) =>
        cols.map((tx) => (
          <img
            key={`${tx}/${ty}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`}
            alt=""
            loading="lazy"
            draggable={false}
            style={{
              width: tile,
              height: tile,
              left: `calc(${fx * 100}% + ${(tx - x) * tile}px)`,
              top: `calc(${fy * 100}% + ${(ty - y) * tile}px)`,
            }}
          />
        )),
      )}
      <i className="map-pin" style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }} />
    </span>
  );
}

/** Row thumbnail: the beach photo when there is one, otherwise its location map. */
export function PlaceThumb({
  image,
  lat,
  lng,
  size = 58,
  focus,
}: {
  image: string | null | undefined;
  lat?: number | null;
  lng?: number | null;
  size?: number;
  /** Where the map pin sits, when something is drawn over the middle of the thumbnail. */
  focus?: [number, number];
}) {
  if (image)
    return (
      <span className="row-thumb place-thumb" style={{ width: size, height: size }}>
        <img src={image} alt="" loading="lazy" />
      </span>
    );
  if (lat != null && lng != null)
    return (
      <span className="row-thumb place-thumb" style={{ width: size, height: size }}>
        <StaticMap lat={lat} lng={lng} zoom={11} tile={size * 2} focus={focus} reach={[size, size]} />
      </span>
    );
  return <span className="row-thumb place-thumb place-thumb-none" style={{ width: size, height: size }} aria-hidden="true" />;
}
