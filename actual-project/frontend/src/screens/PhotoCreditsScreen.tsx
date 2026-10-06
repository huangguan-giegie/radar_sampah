import content from "../content/coastalContent.json";
import { CoastalPage, WhiteCard } from "../components/CoastalUI";
import { PrimaryButton } from '../components/ui';
import { useAppBack } from '../navigation';
import '../styles/reference-pages.css';
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
  const goBack = useAppBack('/marine-life');
  return (
    <CoastalPage
      title="Photo Credits"
      subtitle="Beach photos show the named places. Habitat photos are illustrations, not site records."
      back="/marine-life"
      tabs={false}
      className="reference-credits"
    >
      {content.photos.slice(0, 6).map(photo => <WhiteCard key={photo.name} className="reference-photo-credit">
        {photo.image && <img src={photo.image} alt="" loading="lazy" />}
        <span>
          <strong>{photo.name}</strong>
          <small>{photo.credit}</small>
          {photo.source && <a className="species-source" href={photo.source} target="_blank" rel="noreferrer">Original source ↗</a>}
        </span>
      </WhiteCard>)}
      <WhiteCard>
        <h2>More Photo Sources</h2>
        {content.photos.slice(6).map((p) => (
          <div key={p.name} className="coastal-link-row">
            <span className="grow">
              <strong>{p.name}</strong>
              <small>{p.credit}</small>
              {p.source && (
                <a
                  className="species-source"
                  href={p.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original source ↗
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
      <div className="reference-credits-done"><PrimaryButton onClick={goBack}>Done</PrimaryButton></div>
    </CoastalPage>
  );
}
