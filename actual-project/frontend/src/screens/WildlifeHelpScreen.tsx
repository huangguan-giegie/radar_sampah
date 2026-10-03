import { CoastalPage, SummaryCard, WhiteCard } from "../components/CoastalUI";
export default function WildlifeHelpScreen() {
  return (
    <CoastalPage title="Animal Hurt or Stranded" back="/community">
      <WhiteCard>
        <div className="guide-emergency" style={{ padding: 0 }}>
          <strong>Is a person hurt? Call 999 first.</strong>
          <a href="tel:999">Call 999</a>
        </div>
      </WhiteCard>
      <WhiteCard>
        {[
          "Don’t touch or move it",
          "Keep people and dogs back",
          "Call the wildlife hotline",
        ].map((t, i) => (
          <div key={t} className="wildlife-rule">
            <span>{i + 1}</span>
            <p>{t}</p>
          </div>
        ))}
      </WhiteCard>
      <SummaryCard eyebrow="PERHILITAN · Peninsular Malaysia">
        <h2 style={{ color: "white", fontSize: 28 }}>1-800-88-5151</h2>
        <p style={{ fontSize: 13, color: "#ffffffb3" }}>
          Daily · 8:00 AM – 6:00 PM
        </p>
        <a className="lime-button" href="tel:1800885151">
          Call PERHILITAN
        </a>
      </SummaryCard>
      <WhiteCard>
        {[
          [
            "In Sabah",
            "Sabah Wildlife Department",
            "https://wildlife.sabah.gov.my",
          ],
          ["In Sarawak", "Sarawak Forestry", "https://sfc.sarawak.gov.my"],
          [
            "Turtle or dolphin?",
            "Department of Fisheries",
            "https://www.dof.gov.my",
          ],
        ].map(([title, subtitle, url]) => (
          <a
            key={title}
            className="coastal-link-row"
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none" }}
          >
            <span className="grow">
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
            <span>↗</span>
          </a>
        ))}
      </WhiteCard>
      <p className="coastal-footnote">
        Radar Sampah does not report incidents for you. PERHILITAN contact
        checked on 03-10-2026.{" "}
        <a
          href="https://www.wildlife.gov.my/en/hubungi-kami/"
          target="_blank"
          rel="noreferrer"
        >
          Official contact details ↗
        </a>
      </p>
    </CoastalPage>
  );
}
