import { useNavigate } from "react-router-dom";
import { marineRecordDetails, withBeach, type MarineRecord } from "../biodiversity";
import { SpeciesPicture } from "./SpeciesPicture";

export function MarineRecordCard({ record, records, name, beachId, preview = false }: {record: MarineRecord; records?: MarineRecord[]; name?: string; beachId?: string; preview?: boolean}) {
  const nav = useNavigate();
  const item = marineRecordDetails(record);
  const locations = (records ?? [record]).map(marineRecordDetails);
  const title = name ?? item.name;
  const introduction = () => item.speciesId && nav("/species/" + item.speciesId);
  return <section className="coastal-card marine-record-card">
    <button className="marine-record-main" onClick={introduction} aria-label={`Meet ${title}`}>
      <SpeciesPicture image={item.image} name={title} />
      <span className="marine-record-body">
        <strong>{title}</strong>
        {locations.map((location, index) => <span className="marine-record-location" key={index}><small>{location.place}</small><span>{location.description}</span></span>)}
        <b>View Introduction →</b>
      </span>
    </button>
    {!preview && locations.filter(location => location.habitatId).map((location, index) => <button key={index} className="marine-record-habitat" onClick={() => nav(withBeach("/habitats/" + location.habitatId, beachId))}>{locations.length > 1 ? location.place + " · View Habitat →" : "View Habitat →"}</button>)}
  </section>;
}
