import { CoastalPage, SummaryCard, WhiteCard } from "../components/CoastalUI";
import { DataUnavailable } from "../components/CoastalUI";
import { iteration3Request } from "../iteration3Api";
import type { WildlifeGuidance } from "../iteration3Personal";
import { useAsyncData } from "../useAsyncData";
import { PHOTOS } from "../visuals";
export default function WildlifeHelpScreen() {
  const { data: guidance, loading, error, refresh } = useAsyncData(
    () => iteration3Request<WildlifeGuidance>('/wildlife-guidance'), [], null,
  );
  return (
    <CoastalPage title="Animal Hurt or Stranded" back="/community">
      <figure className="page-cover" style={{ margin: 0 }}>
        <img src={PHOTOS.turtle} alt="Green sea turtle swimming" />
        <figcaption>Green sea turtle · Christoph Schuetzenhofer · CC BY-SA 3.0</figcaption>
      </figure>
      <WhiteCard>
        <div className="guide-emergency" style={{ padding: 0 }}>
          <strong>Is a person hurt? Call 999 first.</strong>
          <a href="tel:999">Call 999</a>
        </div>
      </WhiteCard>
      {loading ? <p role="status">Loading official contacts…</p> : error || !guidance ? (
        <DataUnavailable title="Official contacts could not be loaded" retry={() => void refresh()}>
          Do not handle the animal. Keep people and dogs back.
        </DataUnavailable>
      ) : <>
      <WhiteCard>
        {[guidance.incident].map((t, i) => (
          <div key={t} className="wildlife-rule">
            <span>{i + 1}</span>
            <p>{t}</p>
          </div>
        ))}
      </WhiteCard>
      {guidance.authorities.map(authority => <SummaryCard key={authority.url} eyebrow={authority.name}>
        {authority.phone && <h2 style={{ color: 'white', fontSize: 28 }}>{authority.phone}</h2>}
        {authority.hours && <p style={{ color: '#ffffffb3' }}>{authority.hours}</p>}
        {authority.telephoneUri && <a className="lime-button" href={authority.telephoneUri}>Call authority</a>}
        <p className="coastal-footnote">Checked {authority.lastChecked} · <a href={authority.url} target="_blank" rel="noreferrer">Official contact details ↗</a></p>
      </SummaryCard>)}
      <p className="coastal-footnote">
        {guidance.note}
      </p>
      </>}
    </CoastalPage>
  );
}
