import { useNavigate } from "react-router-dom";
import { CLEANUP_GUIDE as guide } from "../content/cleanupGuide";
import { WhiteCard } from "./CoastalUI";
import { iteration3Request } from "../iteration3Api";
import type { WildlifeGuidance } from "../iteration3Personal";
import { useAsyncData } from "../useAsyncData";
export function CleanupGuide({ recorded = false, imageFree = false }: { recorded?: boolean; imageFree?: boolean }) {
  return (
    <section>
      <p className="eyebrow">{recorded ? "Last step" : "Before you go"}</p>
      <article className="cleanup-guide">
        {!recorded && (
          <>
            <div className="guide-photo">
              {!imageFree && <img
                src="/images/cleanup/volunteers.jpg"
                alt="Volunteers gathering litter on a beach"
              />}
              <div>
                <span>No organiser on site</span>
                <h2>Everyone runs it together</h2>
              </div>
            </div>
            <section>
              <h3>
                <b>1</b>Prepare
              </h3>
              <div className="guide-equipment">
                {guide.equipment.map(([image, label]) => (
                  <div key={image}>
                    {!imageFree && <img src={"/images/cleanup/" + image + ".jpg"} alt="" />}
                    <span>{label === "Two bags" || label === "Closed shoes" ? <>{label.split(" ")[0]}<br />{label.split(" ")[1]}</> : label}</span>
                  </div>
                ))}
              </div>
              <div className="guide-reminders">
                {guide.reminders.map((text) => (
                  <span key={text}>{text}</span>
                ))}
              </div>
            </section>
            <section>
              <h3>
                <b>2</b>Sort as you go
              </h3>
              <div className="guide-sorting">
                {guide.sorting.map((item) => (
                  <div key={item.title}>
                    {!imageFree && <img
                      src={"/images/cleanup/" + item.image + ".jpg"}
                      alt=""
                    />}
                    <small>{item.eyebrow}</small>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        <section>
          <h3>
            {!recorded && <b>3</b>}
            {recorded ? "Drop off your bags" : "Drop off"}
          </h3>
          <div className="guide-dropoff">
            {!imageFree && <img src="/images/cleanup/bintop.jpg" alt="Litter bin" />}
            <div>
              <strong>{guide.dropOffName ?? "Drop-off point not confirmed"}</strong>
              <small>{guide.checkedDate
                ? `Checked by Radar Sampah · ${guide.checkedDate}`
                : "No confirmed drop-off or recycling details are available."}</small>
            </div>
          </div>
          <p className="subtle">
            Tie every bag. {guide.recyclingName
              ? `Recycling goes to ${guide.recyclingName}.`
              : "A recycling point has not been confirmed. Check disposal arrangements with the local council."}{" "}
            If no suitable bin is available or it is full, take your bags with you.
          </p>
          {guide.mapsUrl ? (
            <a
              className="lime-button"
              href={guide.mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in Maps
            </a>
          ) : null}
        </section>
        <div className="guide-emergency">
          <div>
            <strong>In an emergency, call 999</strong>
            <small>Police, ambulance, fire and rescue</small>
          </div>
          <a href="tel:999">Call 999</a>
        </div>
      </article>
    </section>
  );
}
export function WildlifeGuide() {
  const nav = useNavigate();
  const { data: guidance } = useAsyncData(() => iteration3Request<WildlifeGuidance>('/wildlife-guidance'), [], null);
  return (
    <section>
      <p className="eyebrow">Wildlife-friendly cleanup</p>
      <WhiteCard>
        {(guidance?.tips ?? guide.wildlife).slice(0, 3).map((text, i) => (
          <div key={text} className="wildlife-rule">
            <span>{i + 1}</span>
            <p>{text}</p>
          </div>
        ))}
        {guidance && <p className="coastal-footnote">Reviewed {guidance.reviewDate} · {guidance.note}</p>}
        <button
          className="coastal-link-row"
          onClick={() => nav("/community/wildlife-help")}
        >
          <strong className="grow" style={{ fontSize: 13 }}>
            Hurt or stranded animal? See who to call
          </strong>
          <span>›</span>
        </button>
      </WhiteCard>
    </section>
  );
}
