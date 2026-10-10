import content from "../content/coastalContent.json";
import photoOverrides from "../content/speciesPhotoOverrides.json";
import { CoastalPage, WhiteCard } from "../components/CoastalUI";
const imageLicenseUrls = Object.fromEntries(
  Object.values(photoOverrides).map((media) => [media.image, media.imageLicenseUrl]),
);
imageLicenseUrls['/images/coastal/coastal-shellfish-clam.jpg'] = 'https://creativecommons.org/licenses/by-sa/3.0/';
const cleanupCredits = [
  ["volunteers", "Petty Officer 1st Class NPASEWest Hawaii", "Public domain"],
  ["gloves", "Roman Kraft", "CC0"],
  ["bags", "Wiki Farazi", "Public domain"],
  ["cutters", "n.raveender", "Public domain"],
  ["water", "Worlds Direction", "CC0"],
  ["shoes", "Nave do Conhecimento", "CC0"],
  ["firstaid", "Beendy234", "CC0"],
  ["foam", "Visviva", "CC0"],
  ["nettop", "Duncan Wright, USFWS", "Public domain"],
  ["bintop", "Wiki Farazi", "CC0"],
  ["bottle", "Echendu Tracy", "CC0"],
];
export default function PhotoCreditsScreen() {
  return (
    <CoastalPage
      title="Photo Credits"
      subtitle="Beach photos show the named places. Habitat photos are illustrations, not site records."
      back="/marine-life"
      tabs={false}
    >
      <WhiteCard>
        {content.photos.map((p) => (
          <div key={p.name} className="coastal-link-row">
            <span className="grow">
              <strong>{p.name}</strong>
              <small>{p.credit}</small>
              <a
                className="species-source"
                href={p.source}
                target="_blank"
                rel="noreferrer"
              >
                Original source ↗
              </a>
              {imageLicenseUrls[p.image ?? ""] && (
                <a
                  className="species-source"
                  href={imageLicenseUrls[p.image ?? ""]}
                  target="_blank"
                  rel="noreferrer"
                >
                  Image license ↗
                </a>
              )}
            </span>
          </div>
        ))}
      </WhiteCard>
      <WhiteCard>
        <h2>Cleanup guide photos</h2>
        {cleanupCredits.map(([name, author, license]) => (
          <div className="coastal-link-row" key={name}>
            <img
              className="row-thumb"
              src={"/images/cleanup/" + name + ".jpg"}
              alt=""
            />
            <span>
              <strong>{name}</strong>
              <small>
                {author} · {license}
              </small>
            </span>
          </div>
        ))}
        <a
          className="species-source"
          href="/images/cleanup/CREDITS.txt"
          target="_blank"
          rel="noreferrer"
        >
          Full credits and original photo links ↗
        </a>
      </WhiteCard>
      <WhiteCard><h2>Marine Life banner</h2><p className="subtle">Image supplied by the project team in the design feedback.</p></WhiteCard>
    </CoastalPage>
  );
}
