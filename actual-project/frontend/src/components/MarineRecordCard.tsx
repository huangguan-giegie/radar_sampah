import { useNavigate } from "react-router-dom";
import { marineRecordDetails, withBeach, type MarineRecord } from "../biodiversity";
import { SpeciesPicture } from "./SpeciesPicture";

export function MarineRecordCard({ record, beachId, preview = false }: {record: MarineRecord; beachId?: string; preview?: boolean}) {
  const nav = useNavigate();
  const item = marineRecordDetails(record);
  const introduction = () => item.speciesId && nav("/species/" + item.speciesId);
  return <section className="coastal-card marine-record-card">
    <button className="marine-record-main" onClick={introduction} aria-label={`Meet ${item.name}`}>
      <SpeciesPicture image={item.image} name={item.name} />
      <span className="marine-record-body">
        <strong>{item.name}</strong><span>{item.place}</span><span>{item.description}</span>
        {(preview || !item.habitatId) && <b>View Introduction →</b>}
      </span>
    </button>
    {!preview && item.habitatId && <button className="marine-record-habitat" onClick={() => nav(withBeach("/habitats/" + item.habitatId, beachId))}>View Habitat →</button>}
  </section>;
}
