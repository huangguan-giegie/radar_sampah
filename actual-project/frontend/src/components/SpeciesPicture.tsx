import { useState } from "react";
import { SpeciesIcon } from "./Icon";
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
  return image && !failed ? (
    <img
      className={className}
      src={image}
      alt={name}
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
