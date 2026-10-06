import { useState } from "react";
import { SpeciesIcon } from "./Icon";
import photoOverrides from "../content/speciesPhotoOverrides.json";
export function SpeciesPicture({
  image,
  name,
  className = "species-image",
}: {
  image: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const media = Object.values(photoOverrides).find((item) => item.image === image);
  return image && !failed ? (
    <img
      className={className}
      src={image}
      alt={media?.imageAlt ?? name}
      style={media && "objectFit" in media && media.objectFit === "contain"
        ? { objectFit: "contain", backgroundColor: "#e7f1ed" }
        : undefined}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="species-placeholder">
      <span>
        <SpeciesIcon glyph="grass" size={40} />
        <small style={{ display: "block", textAlign: "center", marginTop: 8 }}>
          Photo unavailable
        </small>
      </span>
    </div>
  );
}
