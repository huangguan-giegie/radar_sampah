import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  section: "" as string,
  cursor: 0,
  nickname: "TideWatcher",
  validation: "",
  profile: { nickname: "TideWatcher", joinedLeaderboard: true },
  contributions: {
    points: 6, countedReports: 1, recordedAttendances: 1,
    history: [
      { kind: "attendance", points: 5, beachName: "Pantai Morib", createdAt: "2026-10-04T12:00:00Z", eventId: "event-1" },
      { kind: "report", points: 1, beachName: "Pantai Morib", createdAt: "2026-10-03T12:00:00Z", reportId: "report-1" },
    ],
  },
  rows: [{ rank: 1, nickname: "TideWatcher", points: 6 }],
  actions: new Map<string, () => unknown>(),
  loaders: [] as (() => Promise<unknown>)[],
  request: vi.fn(),
  setProfile: vi.fn(),
  refreshBoard: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const value = typeof initial === "function" ? initial() : initial;
    if (value === "") return [state.validation, (updated: string) => { state.validation = updated; }];
    return [value === "TideWatcher" ? state.nickname : value, vi.fn()];
  },
}));
vi.mock("react-router-dom", async (original) => ({
  ...await original<typeof import("react-router-dom")>(),
  useNavigate: () => state.navigate,
  useParams: () => ({ section: state.section }),
}));
vi.mock("./AppContext", () => ({
  useApp: () => ({ user: { participantId: "1234" }, reportsVersion: 1, signOut: vi.fn(), showToast: state.toast }),
}));
vi.mock("./api", () => ({
  USE_MOCK: false,
  apiRequest: (...args: unknown[]) => state.request(...args),
  getMyReports: async () => [],
  getMyReportCounts: vi.fn(),
  storedRecoveryToken: () => null,
}));
vi.mock("./iteration2Api", () => ({ fetchCleanupEvents: vi.fn() }));
vi.mock("./useAsyncData", () => ({
  useAsyncData: (load: () => Promise<unknown>) => {
    const index = state.cursor++;
    state.loaders.push(load);
    const data = [null, [], [], state.profile, state.contributions, state.rows][index];
    return { data, setData: index === 3 ? state.setProfile : vi.fn(), loading: false, error: null, refresh: index === 5 ? state.refreshBoard : vi.fn() };
  },
}));
vi.mock("./components/CoastalUI", async (original) => ({
  ...await original<typeof import("./components/CoastalUI")>(),
  CoastalPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("./components/ui", async (original) => {
  const actual = await original<typeof import("./components/ui")>();
  const button = ({ children, onClick }: { children: ReactNode; onClick?: () => unknown }) => {
    const label = renderToStaticMarkup(<>{children}</>);
    if (onClick) state.actions.set(label, onClick);
    return <button>{children}</button>;
  };
  return { ...actual, PrimaryButton: button, GhostButton: button };
});

import AccountScreen from "./screens/AccountScreen";

beforeEach(() => {
  vi.clearAllMocks();
  state.cursor = 0;
  state.section = "";
  state.nickname = "TideWatcher";
  state.validation = "";
  state.profile = { nickname: "TideWatcher", joinedLeaderboard: true };
  state.actions.clear();
  state.loaders = [];
  state.request.mockResolvedValue(state.profile);
  state.refreshBoard.mockResolvedValue(state.rows);
});

describe("live contribution account", () => {
  it("loads the authenticated backend preferences and contributions", async () => {
    renderToStaticMarkup(<AccountScreen />);
    await state.loaders[3]();
    await state.loaders[4]();
    expect(state.request).toHaveBeenCalledWith("/profile");
    expect(state.request).toHaveBeenCalledWith("/contributions");
  });

  it("uses backend awarded points and history instead of calculating attendance points", () => {
    state.section = "history";
    const markup = renderToStaticMarkup(<AccountScreen />);
    expect(markup).toContain("6");
    expect(markup).toContain("Recorded attendance");
    expect(markup).toContain("+5");
    expect(markup).toContain("Counted report");
    expect(markup).not.toContain("Preview");
  });

  it("shows consented backend leaderboard rows with backend ranks", async () => {
    state.section = "leaderboard";
    state.rows = [{ rank: 2, nickname: "TideWatcher", points: 6 }];
    const markup = renderToStaticMarkup(<AccountScreen />);
    await state.loaders[5]();
    expect(state.request).toHaveBeenCalledWith("/leaderboard");
    expect(markup).toContain("#2");
    expect(markup).toContain("TideWatcher");
    expect(markup).not.toContain("PenyuPal");
    expect(markup).not.toContain("Not Available Yet");
  });

  it("updates only nickname when saving the profile", async () => {
    state.section = "nickname";
    renderToStaticMarkup(<AccountScreen />);
    await state.actions.get("Save Nickname")?.();
    expect(state.request).toHaveBeenCalledWith("/profile", "PATCH", { nickname: "TideWatcher" });
    expect(state.setProfile).toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalledWith("/account");
  });

  it("withdraws consent while preserving the saved nickname", async () => {
    state.section = "leaderboard";
    renderToStaticMarkup(<AccountScreen />);
    await state.actions.get("Leave Leaderboard")?.();
    expect(state.request).toHaveBeenCalledWith("/profile", "PATCH", { joinedLeaderboard: false });
    expect(state.refreshBoard).toHaveBeenCalledTimes(1);
  });

  it("rejects private contact information before a profile mutation", async () => {
    state.section = "nickname";
    state.nickname = "user@example.com";
    renderToStaticMarkup(<AccountScreen />);
    await state.actions.get("Save Nickname")?.();
    expect(state.request).not.toHaveBeenCalled();
  });

  it("keeps consent and shows an error when withdrawal cannot be persisted", async () => {
    state.section = "leaderboard";
    state.request.mockRejectedValue(new Error("Could not save your preference."));
    renderToStaticMarkup(<AccountScreen />);
    await state.actions.get("Leave Leaderboard")?.();
    expect(state.profile.joinedLeaderboard).toBe(true);
    expect(state.setProfile).not.toHaveBeenCalled();
    expect(state.refreshBoard).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
    state.cursor = 0;
    const markup = renderToStaticMarkup(<AccountScreen />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Could not save your preference.");
    expect(markup).toContain("Leave Leaderboard");
  });
});
