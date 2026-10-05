import { useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { USE_MOCK } from "../api";
import {
  ActionTile,
  CoastalPage,
  DataUnavailable,
  LinkRow,
  Sheet,
  SummaryCard,
  SummaryStats,
  WhiteCard,
} from "../components/CoastalUI";
import {
  BarChart,
  Check,
  CommunityIcon,
  Info,
  Search,
  SpeciesIcon,
} from "../components/Icon";
import { GhostButton, PrimaryButton, Skeleton } from "../components/ui";
import { SeverityBadge } from "../components/ds";
import { INSIGHTS_PREVIEW as preview } from "../content/insightsPreview";
import { C, severityLabel } from "../theme";
import LiveInsightsScreen from './LiveInsightsScreen';

export function MetricBars({ rows }: { rows: [string, number][] }) {
  return (
    <>
      {rows.map(([label, value]) => (
        <div className="metric-bar" key={label}>
          <div>
            <span>{label}</span>
            <strong>{value}%</strong>
          </div>
          <div className="metric-track">
            <i style={{ width: value + "%" }} />
          </div>
        </div>
      ))}
    </>
  );
}
export default function InsightsScreen() {
  return USE_MOCK ? <PreviewInsightsScreen /> : <LiveInsightsScreen />;
}

function PreviewInsightsScreen() {
  const { topic = "", beachId } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(false);
  const state = params.get("region") ?? "";
  const band = params.get("band") ?? "";
  const needOnly = params.get("needs") === "1";
  const search = params.get("q") ?? "";
  const updateFilters = (values: Record<string, string>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    return next;
  }, { replace: true });
  const setState = (value: string) => updateFilters({ region: value });
  const setBand = (value: string) => updateFilters({ band: value });
  const setNeedOnly = (value: boolean) => updateFilters({ needs: value ? "1" : "" });
  const setSearch = (value: string) => updateFilters({ q: value });
  const dataState = USE_MOCK ? params.get("state") : null;
  const titles: Record<string, string> = {
    trends: beachId ? "Beach Trend" : "Beach Trends",
    cleanup: beachId ? "Cleanup History" : "Cleanup Results",
    participation: "Participation",
    wildlife: "Wildlife Nearby",
  };
  const active =
    topic === "participation"
      ? "participation"
      : topic === "cleanup" || topic === "cleanup-history"
        ? "cleanup"
        : "trends";
  const chips = (
    <div className="coastal-segments" aria-label="Insight topics">
      {["trends", "cleanup", "participation"].map((t) => (
        <button
          key={t}
          aria-pressed={active === t}
          onClick={() => nav("/insights/" + t)}
        >
          {t === "trends"
            ? "Trends"
            : t === "cleanup"
              ? "Cleanup"
              : "Participation"}
        </button>
      ))}
    </div>
  );
  const about = (
    <button
      onClick={() => nav("/method")}
      className={topic ? "" : "icon-button navy"}
      aria-label="About data"
    >
      {topic ? "About Data" : <Info color="white" size={22} />}
    </button>
  );
  const demo = (
    <p className="demo-label">
      Preview · example data from the design · as of {preview.asOf}
    </p>
  );
  let body: ReactNode;
  if (dataState === "loading")
    body = (
      <>
        <Skeleton h={215} r={22} />
        <Skeleton h={110} r={22} />
        <Skeleton h={110} r={22} />
      </>
    );
  else if (dataState === "error")
    body = (
      <DataUnavailable
        title="Insights could not load"
        retry={() => setParams({})}
      >
        Please try again in a moment.
      </DataUnavailable>
    );
  else if (!USE_MOCK)
    body = (
      <DataUnavailable title="Insights are not available yet">
        Your reports and cleanups are still available from your account. This
        summary will appear when enough information is available.
      </DataUnavailable>
    );
  else if (!topic)
    body = (
      <>
        <SummaryCard
          eyebrow="Last 90 days · 4 pilot beaches"
          value={preview.reports}
          description="counted reports shape the beach ratings"
        >
          <SummaryStats
            items={[
              { label: "Cleanups", value: preview.cleanups },
              { label: "Joined", value: preview.joined },
              { label: "Need help", value: preview.needHelp },
            ]}
          />
        </SummaryCard>
        <p className="eyebrow" style={{ margin: "2px 0 -4px" }}>
          Beach updates
        </p>
        {preview.beaches
          .filter((b) => b.from && b.from !== b.to)
          .map((b) => (
            <WhiteCard key={b.id} className="update-card">
              <button
                className="coastal-link-row"
                onClick={() =>
                  nav(
                    b.id === "bagan"
                      ? "/insights/trends/bagan"
                      : "/insights/trends",
                  )
                }
              >
                <span className="row-thumb">
                  {b.photo ? (
                    <img src={b.photo} alt="" />
                  ) : (
                    <SpeciesIcon glyph="grass" size={28} />
                  )}
                </span>
                <span className="grow">
                  <strong>{b.name}</strong>
                  <span className="update-bands">
                    <SeverityBadge band={b.from} />
                    <span>→</span>
                    <SeverityBadge band={b.to} />
                  </span>
                  <small>Last 30 days · counted reports</small>
                </span>
                <span>›</span>
              </button>
            </WhiteCard>
          ))}
        <p className="eyebrow" style={{ margin: "2px 0 -4px" }}>
          Explore insights
        </p>
        <div className="action-grid five">
          <ActionTile
            title="Trends"
            subtitle="Band changes"
            icon={<BarChart size={19} />}
            onClick={() => nav("/insights/trends")}
          />
          <ActionTile
            title="Cleanup"
            subtitle="Results"
            icon={<Check color={C.navy} />}
            onClick={() => nav("/insights/cleanup")}
          />
          <ActionTile
            title="Participation"
            subtitle="Who joined"
            icon={<CommunityIcon size={19} />}
            onClick={() => nav("/insights/participation")}
          />
          <ActionTile
            title="Wildlife"
            subtitle="Species nearby"
            icon={<SpeciesIcon glyph="grass" size={20} />}
            onClick={() => nav("/insights/wildlife")}
          />
          <ActionTile
            title="Volunteers"
            subtitle="Beaches needing help"
            icon={<CommunityIcon size={19} />}
            onClick={() => nav("/community/needs-volunteers")}
          />
        </div>
        {demo}
      </>
    );
  else if (topic === "trends" && beachId) {
    const b = preview.beaches.find((x) => x.id === beachId);
    body = b ? (
      <>
        <SummaryCard eyebrow={b.area} description={b.name} />
        <WhiteCard>
          <p className="eyebrow">Band · 30-day change</p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: C.muted,
            }}
          >
            <span>28-08-2026</span>
            <span>27-09-2026</span>
          </div>
          <div className="update-bands" style={{ margin: "14px 0" }}>
            <SeverityBadge band={b.from} />
            <span>→</span>
            <SeverityBadge band={b.to} />
          </div>
          <p className="subtle">
            {b.id === "bagan"
              ? "Up from Moderate. 4 counted reports in the last 30 days, up from 2."
              : "A band describes the reports received, not a verified condition of the whole beach."}
          </p>
        </WhiteCard>
        {b.id === "bagan" && (
          <>
            <WhiteCard>
              <p className="eyebrow">Reports received in the last 12 months</p>
              <p className="subtle">Oct 2025 – Sep 2026</p>
              <div
                className="coastal-bars"
                role="img"
                aria-label={
                  "Monthly counted reports: " +
                  preview.monthlyReports.join(", ")
                }
              >
                {preview.monthlyReports.map((n, i) => (
                  <div key={i}>
                    <small>{n}</small>
                    <i style={{ height: n * 22 }} />
                    <small>{"ONDJFMAMJJAS"[i]}</small>
                  </div>
                ))}
              </div>
              <p className="coastal-footnote">
                Counts reports, not litter items.
              </p>
            </WhiteCard>
            <WhiteCard>
              <p className="eyebrow">Reported litter by category</p>
              <MetricBars rows={preview.composition} />
              <p className="coastal-footnote">
                Share of reported amount, counted reports only.
              </p>
            </WhiteCard>
            <SummaryCard
              eyebrow="Litter recurrence"
              value="9 days"
              description="until the next counted report"
            >
              <SummaryStats
                items={[
                  { label: "Cleaned", value: "15-08-2026" },
                  { label: "Next counted report", value: "24-08-2026" },
                ]}
              />
            </SummaryCard>
          </>
        )}
        <PrimaryButton onClick={() => nav("/community?beach=" + b.id)}>
          Find a Cleanup Here
        </PrimaryButton>
        <GhostButton onClick={() => nav("/beach/" + b.id)}>
          Open Beach Page
        </GhostButton>
        {demo}
      </>
    ) : (
      <DataUnavailable title="Beach trend not found" />
    );
  } else if (topic === "trends") {
    const rows = preview.beaches.filter(
      (b) =>
        (!state || b.area.includes(state)) &&
        (!band ||
          (b.to ? severityLabel(b.to) : "Insufficient Data") === band) &&
        (!needOnly || preview.volunteerBeachIds.includes(b.id)) &&
        b.name.toLowerCase().includes(search.toLowerCase()),
    );
    body = (
      <>
        <SummaryCard
          eyebrow="30-day change · 4 pilot beaches"
          value="2"
          description="beaches changed band"
        >
          <SummaryStats
            items={[
              { label: "Moved up", value: 1 },
              { label: "Moved down", value: 1 },
              { label: "No band yet", value: 1 },
            ]}
          />
        </SummaryCard>
        <div className="search-row">
          <label className="coastal-search">
            <Search />
            <input
              aria-label="Search Beaches"
              placeholder="Search Beaches"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Filters"
            onClick={() => setFilters(true)}
          >
            <BarChart size={19} />
          </button>
        </div>
        <p className="eyebrow">4 pilot beaches · 30-day trend</p>
        {rows.length ? (
          <WhiteCard>
            {rows.map((b) => (
              <LinkRow
                key={b.id}
                title={b.name}
                subtitle={
                  b.to
                    ? b.from === b.to
                      ? severityLabel(b.to) + " · no change in 30 days"
                      : severityLabel(b.to) + " · from " + b.from
                    : "Selangor · 0 counted reports"
                }
                leading={
                  <span className="row-thumb">
                    {b.photo ? (
                      <img alt="" src={b.photo} />
                    ) : (
                      <SpeciesIcon glyph="grass" />
                    )}
                  </span>
                }
                trailing={<SeverityBadge band={b.to} />}
                onClick={() =>
                  nav(
                    b.id === "bagan"
                      ? "/insights/trends/bagan"
                      : "/beach/" + b.id,
                  )
                }
              />
            ))}
          </WhiteCard>
        ) : (
          <DataUnavailable title="No matching beaches">
            No beach matches these filters.
          </DataUnavailable>
        )}
        <GhostButton onClick={() => nav("/map")}>
          See All on the Map
        </GhostButton>
        {dataState === "insufficient" && (
          <DataUnavailable title="More reports needed">
            At least 3 counted reports are needed to calculate a litter band.
          </DataUnavailable>
        )}
        {demo}
      </>
    );
  } else if (topic === "participation") {
    const selection = params.get("beach") ?? "all";
    const values =
      preview.participation[selection] ?? preview.participation.all;
    body = (
      <>
        <div className="filter-chips" style={{ margin: 0 }}>
          {[
            ["all", "All 4 Beaches"],
            ["morib", "Morib"],
            ["bagan", "Bagan Lalang"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={selection === id}
              onClick={() => setParams(id === "all" ? {} : { beach: id })}
            >
              {name}
            </button>
          ))}
        </div>
        <SummaryCard eyebrow="Joining to cleanup · last 90 days">
          {["Joined", "Recorded attendance", "At a recorded cleanup"].map(
            (name, i) => (
              <div className="metric-bar" key={name}>
                <div>
                  <span>{name}</span>
                  <strong style={{ color: C.lime }}>
                    {values[i]}
                    {i > 0
                      ? " · " +
                        Math.round((values[i] / values[i - 1]) * 100) +
                        "%"
                      : ""}
                  </strong>
                </div>
                <div
                  className="metric-track"
                  style={{ background: "#ffffff1a" }}
                >
                  <i
                    style={{
                      background: C.lime,
                      width: (values[i] / values[0]) * 100 + "%",
                    }}
                  />
                </div>
              </div>
            ),
          )}
          <p className="coastal-footnote" style={{ color: "#ffffffb3" }}>
            {selection === "all"
              ? "All 4 pilot beaches"
              : preview.beaches.find((b) => b.id === selection)?.name}{" "}
            · anonymous totals. Each percentage compares a step with the one
            above.
          </p>
        </SummaryCard>
        <GhostButton onClick={() => nav("/community")}>
          Find a Cleanup
        </GhostButton>
        {demo}
      </>
    );
  } else if (topic === "cleanup")
    body =
      dataState === "insufficient" ? (
        <DataUnavailable title="Too few cleanups yet">
          More recorded cleanups are needed to show a pattern.
        </DataUnavailable>
      ) : (
        <>
          <SummaryCard
            eyebrow="Latest cleanup · 19-09-2026 (Sat)"
            description="Pantai Morib"
          >
            <h2 style={{ color: "white" }}>Cleanup Recorded</h2>
            <SummaryStats
              items={[
                { label: "Cleanups in 90 days", value: 8 },
                { label: "Most left", value: "Fishing gear" },
              ]}
            />
          </SummaryCard>
          <WhiteCard>
            <p className="eyebrow">Hardest to clear · 8 cleanups</p>
            <MetricBars rows={preview.remaining} />
            <p className="coastal-footnote">
              Of cleanups with this litter, the share that still had more than
              Small left.
            </p>
          </WhiteCard>
          <WhiteCard>
            <p className="eyebrow">How litter was handled</p>
            <MetricBars rows={preview.handling} />
            <p className="coastal-footnote">As recorded by participants.</p>
          </WhiteCard>
          <WhiteCard>
            <p className="eyebrow">Days until next counted report</p>
            <LinkRow
              title="Pantai Bagan Lalang"
              subtitle="Cleaned 15-08-2026 · 9 days"
              onClick={() => nav("/insights/trends/bagan")}
            />
            <LinkRow
              title="Pantai Morib"
              subtitle="No follow-up report yet · 8 days since cleanup"
              onClick={() => nav("/beach/morib")}
            />
          </WhiteCard>
          <GhostButton onClick={() => nav("/insights/cleanup-history")}>
            View Cleanup History
          </GhostButton>
          {demo}
        </>
      );
  else if (topic === "cleanup-history")
    body = (
      <>
        <SummaryCard
          eyebrow="Cleanup history · 19-09-2026 (Sat)"
          description="Teluk Cempedak"
        >
          <h2 style={{ color: "white" }}>Cleanup Recorded</h2>
        </SummaryCard>
        <WhiteCard>
          <p className="eyebrow">Recorded change</p>
          {[
            ["Plastic", "Very Large → Small"],
            ["Fishing gear", "Large → Small"],
            ["Paper", "Large → Small"],
            ["Glass", "Medium → Small"],
          ].map(([c, b]) => (
            <div className="coastal-link-row" key={c}>
              <strong className="grow">{c}</strong>
              <small>{b}</small>
            </div>
          ))}
        </WhiteCard>
        <GhostButton onClick={() => nav("/beach/teluk-cempedak")}>View Beach</GhostButton>
        {demo}
      </>
    );
  else
    body = (
      <>
        <SummaryCard
          eyebrow="Design preview · OBIS modelled"
          value={2}
          description="species and 3 habitats across the 4 pilot beaches"
        />
        {preview.wildlife.map(item => <button className="wildlife-beach-card" key={item.beachId} onClick={() => nav("/beach/" + item.beachId)}>
          <span><strong>{preview.beaches.find(b => b.id === item.beachId)!.name}</strong><small>{item.habitat}</small></span>
          <span className="wildlife-species">{item.species.map(name => <span key={name}>{name}</span>)}</span>
        </button>)}
        <p className="coastal-footnote">Design preview · OBIS snapshot 09-2026. These are not confirmed sightings.</p>
      </>
    );
  return (
    <CoastalPage
      title={
        titles[topic] ??
        (topic === "cleanup-history" ? "Cleanup History" : "Insights")
      }
      className={!topic ? "insights-hub" : ""}
      eyebrow={
        topic === "wildlife" ? "OBIS · snapshot 09-2026" : USE_MOCK
          ? (topic ? "Insights · as of " : "4 pilot beaches · as of ") +
            preview.asOf
          : undefined
      }
      back={beachId ? "/insights/" + topic : topic ? "/insights" : undefined}
      action={topic === "wildlife" ? <button onClick={() => nav("/marine-life")}>Marine Life</button> : about}
      subtitle={topic === "wildlife" ? "Modelled species and habitats, not sightings." : undefined}
    >
      {topic && topic !== "wildlife" && chips}
      {body}
      {filters && (
        <Sheet title="Filters" onClose={() => setFilters(false)}>
          <button
            onClick={() => {
              updateFilters({ region: "", band: "", needs: "" });
            }}
            style={{ color: C.navy }}
          >
            Reset
          </button>
          <p className="eyebrow" style={{ marginTop: 20 }}>
            State
          </p>
          <div className="filter-chips">
            {["Selangor", "Negeri Sembilan", "Penang", "Johor", "Sabah"].map(
              (s) => (
                <button
                  key={s}
                  aria-pressed={state === s}
                  onClick={() => setState(state === s ? "" : s)}
                >
                  {s}
                </button>
              ),
            )}
          </div>
          <p className="eyebrow">Band</p>
          <div className="filter-chips">
            {["Very high", "High", "Moderate", "Low", "Insufficient Data"].map(
              (s) => (
                <button
                  key={s}
                  aria-pressed={band === s}
                  onClick={() => setBand(band === s ? "" : s)}
                >
                  {s}
                </button>
              ),
            )}
          </div>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            Needs Volunteers Only
            <input
              type="checkbox"
              checked={needOnly}
              onChange={(e) => setNeedOnly(e.target.checked)}
            />
          </label>
          <PrimaryButton onClick={() => setFilters(false)}>
            Show Results
          </PrimaryButton>
        </Sheet>
      )}
    </CoastalPage>
  );
}
