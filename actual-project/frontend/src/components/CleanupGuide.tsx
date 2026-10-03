import { useNavigate } from "react-router-dom";
import { CLEANUP_GUIDE as guide } from "../content/cleanupGuide";
import { WhiteCard } from "./CoastalUI";
export function CleanupGuide({ recorded = false }: { recorded?: boolean }) {
  return (
    <section>
      <p className="eyebrow">{recorded ? "Last step" : "Before you go"}</p>
      <article className="cleanup-guide">
        {!recorded && (
          <>
            <div className="guide-photo">
              <img
                src="/images/cleanup/volunteers.jpg"
                alt="Volunteers gathering litter on a beach"
              />
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
                    <img src={"/images/cleanup/" + image + ".jpg"} alt="" />
                    <span>{label}</span>
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
                    <img
                      src={"/images/cleanup/" + item.image + ".jpg"}
                      alt=""
                    />
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
            <img src="/images/cleanup/bintop.jpg" alt="Litter bin" />
            <div>
              <strong>{guide.dropOffName}</strong>
              <small>Checked by Radar Sampah · {guide.checkedDate}</small>
            </div>
          </div>
          <p className="subtle">
            Tie every bag. Recycling goes to {guide.recyclingName}. Bin full?
            Take it home.
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
          ) : (
            <button
              className="lime-button"
              disabled
              title="A drop-off point has not been set"
            >
              Open in Maps
            </button>
          )}
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
  return (
    <section>
      <p className="eyebrow">Wildlife-friendly cleanup</p>
      <WhiteCard>
        {guide.wildlife.map((text, i) => (
          <div key={text} className="wildlife-rule">
            <span>{i + 1}</span>
            <p>{text}</p>
          </div>
        ))}
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
