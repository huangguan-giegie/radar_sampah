import { useEffect, useState } from "react";
import coastalContent from "../content/coastalContent.json";

/**
 * Marine-model species imagery.
 * - Reuse an existing project photograph when its scientific identity is documented.
 * - Otherwise request an exact-taxon, openly licensed iNaturalist photograph.
 * - If no suitable photo is available (or the network is offline), show an
 *   AI-authored vector illustration of the relevant animal group. It is not a
 *   scientific reconstruction or a sighting at the selected beach.
 */
export type SpeciesPhoto = {
  url: string;
  credit: string;
  licence: string;
  sourceUrl: string | null;
  kind: "project" | "open_photo";
};

type Taxon = {
  id: number;
  name: string;
  default_photo?: {
    id?: number;
    medium_url?: string;
    url?: string;
    license_code?: string | null;
    attribution?: string;
  } | null;
};

export const OPEN_PHOTO_LICENCES = new Set(["cc0", "cc-by", "cc-by-sa"]);

export function selectOpenTaxonPhoto(results: readonly Taxon[], scientificName: string): SpeciesPhoto | null {
  const taxon = results.find((item) => item.name.toLowerCase() === scientificName.toLowerCase());
  const photo = taxon?.default_photo;
  const licence = photo?.license_code?.toLowerCase() ?? "";
  const url = photo?.medium_url ?? photo?.url;
  if (!photo || !url || !url.startsWith("https://") || !OPEN_PHOTO_LICENCES.has(licence)) return null;
  return {
    url,
    credit: photo.attribution || "iNaturalist community photographer",
    licence: licence.toUpperCase(),
    sourceUrl: typeof photo.id === "number" ? "https://www.inaturalist.org/photos/" + photo.id : null,
    kind: "open_photo",
  };
}

const photoCache = new Map<string, Promise<SpeciesPhoto | null>>();

export function speciesPhotoForModel(scientificName: string): Promise<SpeciesPhoto | null> {
  const key = scientificName.trim().toLowerCase();
  const existing = photoCache.get(key);
  if (existing) return existing;
  const matchingLocal = coastalContent.species.find(
    (item) => item.image && (item.subtitle ?? "").toLowerCase().includes(key),
  );
  if (matchingLocal?.image) {
    const found = Promise.resolve<SpeciesPhoto | null>({
      url: matchingLocal.image,
      credit: "Existing Radar Sampah species guide · see Photo Credits",
      licence: "Project photo",
      sourceUrl: "/photo-credits",
      kind: "project",
    });
    photoCache.set(key, found);
    return found;
  }
  // A short timeout keeps this a progressive enhancement rather than blocking a beach.
  const requested = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(
          "https://api.inaturalist.org/v1/taxa/autocomplete?q=" + encodeURIComponent(scientificName) + "&per_page=10",
          { signal: controller.signal },
        );
        if (!response.ok) return null;
        const body = await response.json() as { results?: Taxon[] };
        return selectOpenTaxonPhoto(body.results ?? [], scientificName);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return null;
    }
  })();
  photoCache.set(key, requested);
  return requested;
}

type AnimalGroup =
  | "turtle" | "dolphin" | "ray" | "starfish" | "urchin" | "cucumber"
  | "snail" | "clam" | "bird" | "eel" | "puffer" | "lionfish"
  | "cuttlefish" | "nudibranch" | "shrimp" | "anemone" | "coral"
  | "sponge" | "lobster" | "snake" | "fish";

export function modelSpeciesGroup(scientificName: string): AnimalGroup {
  const genus = scientificName.split(" ")[0].toLowerCase();
  if (genus === "chelonia") return "turtle";
  if (["orcaella", "neophocaena"].includes(genus)) return "dolphin";
  if (genus === "taeniura") return "ray";
  if (["linckia", "protoreaster"].includes(genus)) return "starfish";
  if (["diadema", "echinothrix"].includes(genus)) return "urchin";
  if (["holothuria", "stichopus"].includes(genus)) return "cucumber";
  if (["paratectonatica", "cypraea"].includes(genus)) return "snail";
  if (genus === "tridacna") return "clam";
  if (["calidris", "onychoprion"].includes(genus)) return "bird";
  if (genus === "gymnothorax") return "eel";
  if (genus === "arothron") return "puffer";
  if (genus === "pterois") return "lionfish";
  if (genus === "ascarosepion") return "cuttlefish";
  if (["chromodoris", "phyllidia"].includes(genus)) return "nudibranch";
  if (genus === "stenopus") return "shrimp";
  if (genus === "radianthus") return "anemone";
  if (genus === "galaxea") return "coral";
  if (genus === "xestospongia") return "sponge";
  if (genus === "panulirus") return "lobster";
  if (genus === "laticauda") return "snake";
  return "fish";
}

function AIGroupIllustration({ scientificName }: { scientificName: string }) {
  const group = modelSpeciesGroup(scientificName);
  const ordinal = Array.from(scientificName).reduce((n, c) => n + c.charCodeAt(0), 0);
  const tone = ["#eea35b", "#69c2b0", "#e8c356", "#7bbaeb", "#d6a5d8"][ordinal % 5];
  const dark = "#215670";
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color = tone) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} stroke={dark} strokeWidth="2" />;
  const body = (() => {
    if (group === "turtle") return <>{ellipse(95, 63, 35, 25)}{ellipse(135, 62, 14, 10)}<path d="M70 48 Q40 22 49 53 L69 65 M75 79 Q49 106 76 94 L93 82 M112 42 Q131 14 121 49 M110 83 Q128 103 126 79" fill={tone} stroke={dark} strokeWidth="3"/><path d="M70 60 L95 40 L119 60 L95 84 Z M95 40 V84 M70 60 H119" fill="none" stroke={dark} strokeWidth="2"/><circle cx="141" cy="59" r="2.5" fill={dark}/></>;
    if (group === "dolphin") return <path d="M27 71 Q70 25 116 44 L144 61 L162 68 L143 70 Q98 94 52 76 L28 98 L37 71 L20 60 Z M91 47 L97 25 L112 43" fill={tone} stroke={dark} strokeWidth="3"/>;
    if (group === "ray") return <path d="M22 58 Q67 13 94 56 Q126 14 172 58 Q126 90 100 78 L93 108 L88 77 Q58 93 22 58 Z" fill={tone} stroke={dark} strokeWidth="3"/>;
    if (group === "starfish") return <polygon points="96,14 110,47 145,43 119,69 130,104 96,84 62,104 73,69 47,43 82,47" fill={tone} stroke={dark} strokeWidth="3"/>;
    if (group === "urchin") return <>{Array.from({length:20},(_,i)=>{const a=i*Math.PI/10;return <line key={i} x1={96+21*Math.cos(a)} y1={60+21*Math.sin(a)} x2={96+48*Math.cos(a)} y2={60+48*Math.sin(a)} stroke={dark} strokeWidth="2.5"/>})}{ellipse(96,60,27,24)}</>;
    if (group === "cucumber") return <path d="M32 75 Q46 45 86 55 Q135 48 156 69 Q150 92 106 86 Q62 98 32 75 Z" fill={tone} stroke={dark} strokeWidth="3"/>;
    if (group === "snail" || group === "clam") return <>{ellipse(96,67,48,34)}<path d={group==="clam" ? "M60 89 L97 34 L132 89 M73 95 L97 34 L116 94 M82 97 L97 34 L105 98" : "M103 77 C148 44 98 28 83 56 C67 83 121 98 118 58"} fill="none" stroke={dark} strokeWidth="3"/></>;
    if (group === "bird") return <>{ellipse(90,61,30,18)}<path d="M104 57 L156 43 L120 65 M84 76 L79 99 M94 77 L96 99 M67 55 Q41 22 32 46 L66 66" fill={tone} stroke={dark} strokeWidth="3"/><circle cx="113" cy="56" r="2" fill={dark}/></>;
    if (group === "eel" || group === "snake") return <path d="M22 75 Q40 28 68 58 Q84 95 111 66 Q126 45 169 54 Q140 74 131 81 Q107 112 80 80 Q55 42 43 84 Z" fill={tone} stroke={dark} strokeWidth="3"/>;
    if (group === "coral" || group === "anemone" || group === "sponge") return <>{Array.from({length:9},(_,i)=>{const x=42+i*13;return <path key={i} d={group==="sponge"?`M${x} 102 L${x-2} ${48-i%3*10} Q${x+3} ${40-i%3*10} ${x+7} ${48-i%3*10} L${x+8} 102 Z`:`M96 109 Q${x} 77 ${x} ${35+i%4*8} M${x} 78 l-8 -15`} fill={group==="sponge"?tone:"none"} stroke={dark} strokeWidth="5"/>})}</>;
    if (["shrimp","lobster","cuttlefish","nudibranch"].includes(group)) return <>{ellipse(94,70,45,21)}<path d="M52 65 L25 43 M55 70 L28 75 M110 83 L121 107 M91 85 L95 108 M72 83 L68 104 M135 62 L160 45" fill="none" stroke={dark} strokeWidth="3"/><circle cx="121" cy="62" r="3" fill={dark}/></>;
    return <><path d="M36 62 L16 38 L16 86 Z M39 62 C73 25 124 30 155 62 C123 96 74 101 39 62 Z M86 41 L96 21 L109 42 M81 84 L94 105 L106 83" fill={tone} stroke={dark} strokeWidth="3"/><circle cx="132" cy="57" r="4" fill={dark}/>{group==="lionfish"&&<path d="M60 41 L44 13 M76 37 L69 8 M97 38 L105 10" stroke={dark} strokeWidth="3"/>}{group==="puffer"&&Array.from({length:5},(_,i)=><circle key={i} cx={66+i*14} cy={67} r="3.5" fill={dark}/>)}</>;
  })();
  return (
    <svg viewBox="0 0 192 120" role="img" aria-label={`AI-generated generic ${group} illustration; not a verified species photograph`} style={{ display: "block", width: "100%", background: "linear-gradient(160deg,#d5eef2,#8ecbd8)", borderRadius: 12 }}>
      <path d="M0 95 Q48 75 95 94 T192 92 V120 H0 Z" fill="#6ba8ac" opacity=".3"/>
      <circle cx="158" cy="22" r="17" fill="#ffffff" opacity=".16"/>
      {body}
    </svg>
  );
}

export function ModelSpeciesPicture({ name, scientificName, compact = false }: {
  name: string;
  scientificName: string;
  compact?: boolean;
}) {
  const [photo, setPhoto] = useState<SpeciesPhoto | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setPhoto(null);
    setFailed(false);
    void speciesPhotoForModel(scientificName).then((result) => {
      if (active) setPhoto(result);
    });
    return () => { active = false; };
  }, [scientificName]);
  return (
    <div className="model-species-media">
      {photo && !failed
        ? <img src={photo.url} alt={name} loading="lazy" onError={() => setFailed(true)}
          style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: 12 }} />
        : <AIGroupIllustration scientificName={scientificName} />}
      {!compact && <small className="coastal-footnote" style={{ display: "block", marginTop: 5 }}>
        {photo && !failed
          ? <>{photo.credit} · {photo.licence}{photo.sourceUrl?.startsWith("https://") && <> · <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Photo source ↗</a></>}</>
          : "AI-generated group illustration · not a verified species photo"}
      </small>}
    </div>
  );
}
