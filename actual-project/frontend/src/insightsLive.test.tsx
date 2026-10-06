import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  topic: "",
  loading: false,
  error: null as string | null,
  data: null as any,
  actions: new Map<string, () => unknown>(),
  refresh: vi.fn(),
  request: vi.fn(),
}));

vi.mock("react-router-dom", async (original) => ({
  ...await original<typeof import("react-router-dom")>(),
  useNavigate: () => vi.fn(),
  useParams: () => ({ topic: state.topic }),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock("./AppContext", () => ({ useApp: () => ({ reportsVersion: 1 }) }));
vi.mock("./iteration3Api", () => ({ iteration3Request: (...args: unknown[]) => state.request(...args) }));
vi.mock("./useAsyncData", () => ({
  useAsyncData: () => ({ data: state.data, loading: state.loading, error: state.error, refresh: state.refresh }),
}));
vi.mock("./components/CoastalUI", async (original) => ({
  ...await original<typeof import("./components/CoastalUI")>(),
  CoastalPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  DataUnavailable: ({ title, retry }: { title: string; retry?: () => unknown }) => {
    if (retry) state.actions.set("Retry", retry);
    return <section>{title}{retry && <button>Retry</button>}</section>;
  },
}));
vi.mock("./components/ui", async (original) => ({
  ...await original<typeof import("./components/ui")>(),
  Skeleton: () => <span>Loading placeholder</span>,
}));

import LiveInsightsScreen from "./screens/LiveInsightsScreen";

function summary() {
  const beach = {
    id: "morib", name: "Pantai Morib", area: "Selangor", severity: "High",
    eligibleReportCount: 3, latestContributingReportAt: "2026-10-04T12:00:00Z",
    trend: { eligible: false, currentBand: "High", previousBand: null, direction: null, previousAsOf: "2026-09-05", message: "Insufficient data to compare" },
    composition: [{ category: "Plastic", percentage: 100, band: "Very Large" }],
    leadingCategories: ["Plastic"], evidence: { sufficiency: "Sufficient data", freshnessLabel: "Recently reported" },
    needsVolunteers: { flag: false, reasons: [], nextEventJoinedCount: "Fewer than 3", href: "/beach/morib", eventMessage: null },
  };
  return {
    asOf: "2026-10-05", overview: { countedReports: 3, recordedCleanups: 0, joinedParticipants: "Fewer than 3", sufficientBeaches: 1, needsVolunteers: 0 },
    headlines: [], headlinesEmptyState: "Not enough recent reports to generate insights yet.", beaches: [beach],
    trends: { monthlyReports: { months: ["2026-09", "2026-10"], beaches: [{ beachId: "morib", counts: [0, 3] }], caption: "Report counts reflect reporting activity, not the true amount of litter. Zero means no reports, not zero litter." } },
    cleanup: {
      recent: [], emptyState: "Not enough cleanups recorded yet.",
      hardestToClear: { eligible: false, categories: [], emptyState: "Not enough cleanups recorded yet." },
      handling: { eligible: false, statuses: [], label: "Participant-recorded handling; this does not verify disposal or recycling.", emptyState: "Not enough cleanups recorded yet." },
      recurrence: { beaches: [], emptyState: "Not enough cleanups recorded yet." },
    },
    participation: {
      steps: [{ key: "joined", label: "Joined participants", count: "Fewer than 3" }, { key: "recordedAttendance", label: "Recorded attendances", count: "Fewer than 3" }],
      conversions: [{ from: "joined", to: "recordedAttendance", percentage: null }],
      caption: "Recorded attendance does not prove cleanup work was completed.",
    },
    evidence: { sufficientBeachCount: 1, countedNote: "Counted is community evidence, not expert verification.", beaches: [{ beachId: "morib", statuses: { countedActive: 3, countedResolved: 2, duplicate: 1, incomplete: 0 } }] },
    wildlife: { beaches: [{ beachId: "morib", beachName: "Pantai Morib", species: [{ id: "green-sea-turtle", name: "Green Sea Turtle", relativeOccurrenceScore: 0.73, locationMatchScore: 0.91, source: { label: "OBIS model", url: "https://obis.org/" }, reviewDate: "2026-10-05", destination: "/species/green-sea-turtle" }], sourceStatus: "ready", coordinateContext: { requestedLatitude: 2.746, requestedLongitude: 101.44, usedLatitude: 2.75, usedLongitude: 101.35, method: 'nearest_marine_grid', moved: true, distanceKm: 10, maxDistanceKm: 15, requestedInsideMalaysianEez: false } }] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.topic = "";
  state.loading = false;
  state.error = null;
  state.data = summary();
  state.actions.clear();
});

describe("live Insights acceptance display", () => {
  it("uses a neutral empty headline state without substituting design fixtures", () => {
    state.data.overview.countedReports = 0;
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Not enough recent reports to generate insights yet.");
    expect(markup).not.toContain("Preview");
    expect(markup).toContain("Counted reports are accepted community evidence");
  });

  it("renders placeholders while the summary is pending", () => {
    state.loading = true;
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Loading placeholder");
    expect(markup).not.toContain("Pantai Morib");
    expect(markup).not.toContain("Insights could not be loaded");
  });

  it("shows a Retry action after a summary error", () => {
    state.error = "Connection unavailable";
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Insights could not be loaded");
    expect(markup).toContain("Retry");
    state.actions.get("Retry")?.();
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(markup).not.toContain("Pantai Morib");
  });

  it("keeps insufficient trend comparison separate from available composition and report activity", () => {
    state.topic = "trends";
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Insufficient data to compare");
    expect(markup).toContain("Plastic");
    expect(markup).toContain("100%");
    expect(markup).toContain("2026-09: 0 reports");
    expect(markup).toContain("Zero means no reports, not zero litter");
  });

  it("offers the five current insight tiles and removes the evidence-quality entry", () => {
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup.match(/class="action-tile press"/g)).toHaveLength(5);
    expect(markup).toContain('action-grid five');
    expect(markup).toContain('Volunteers');
    expect(markup).toContain('Wildlife');
    expect(markup).not.toContain('Evidence Quality');
    expect(markup).not.toContain('Evidence coverage');
    expect(markup).toContain("not expert verification");
  });

  it("displays suppressed small participation counts without inferring conversion percentages", () => {
    state.topic = "participation";
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Fewer than 3");
    expect(markup).toContain("Insufficient data");
    expect(markup.replace(/<[^>]*>/g, "")).not.toContain("100%");
  });

  it("shows confirmed before-and-after bands without displaying cleanup scores", () => {
    state.topic = "cleanup";
    state.data.cleanup.recent = [{ beachId: "morib", beachName: "Pantai Morib", date: "2026-10-04", categories: [{ category: "Plastic", beforeBand: "Large", afterBand: "Small" }], cleanupScore: 2, handling: "Not recorded", status: "Resolved — source report kept in history" }];
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Cleanup Recorded");
    expect(markup).toContain("Large → Small");
    expect(markup).toContain("Resolved — source report kept in history");
    expect(markup).not.toContain("Cleanup Score");
  });

  it("distinguishes location match from raw wildlife scores and discloses the nearby reference", () => {
    state.topic = "wildlife";
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup).toContain("Location match: 91/100");
    expect(markup).toContain("Raw relative model score: 0.73");
    expect(markup).not.toContain("73%");
    expect(markup).not.toContain("91%");
    expect(markup).toContain("not confirmed sightings");
    expect(markup).toContain("an occurrence probability");
    expect(markup).toContain("Marine-grid reference: 2.7500, 101.3500");
    expect(markup).toContain("10.0 km from the beach");
    expect(markup).toContain("15 km search limit");
    expect(markup).toContain('href="https://obis.org/"');
  });

  it("preserves the supplied wildlife order instead of sorting species by raw score", () => {
    state.topic = "wildlife";
    const first = state.data.wildlife.beaches[0].species[0];
    first.relativeOccurrenceScore = 0.01;
    state.data.wildlife.beaches[0].species.push({ ...first, id: 'moorish-idol', name: 'Moorish idol', relativeOccurrenceScore: 0.99, locationMatchScore: 0.85, destination: '/species/moorish-idol' });
    const markup = renderToStaticMarkup(<LiveInsightsScreen />);
    expect(markup.indexOf('Green Sea Turtle')).toBeLessThan(markup.indexOf('Moorish idol'));
    expect(markup).toContain('Raw relative model score: 0.01');
    expect(markup).toContain('Location match: 85/100');
  });
});
