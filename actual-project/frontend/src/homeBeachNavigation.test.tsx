import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { StaticRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeachSummary } from "./types";

const state = vi.hoisted(() => ({
  beaches: [] as BeachSummary[],
  loading: true,
  error: null as string | null,
  actions: new Map<string, () => unknown>(),
  getBeaches: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("react-router-dom", async original => ({
  ...await original<typeof import("react-router-dom")>(),
  useNavigate: () => state.navigate,
}));
vi.mock("./api", () => ({ USE_MOCK: false, getBeaches: state.getBeaches, getBeach: vi.fn() }));
vi.mock("./AppContext", () => ({ useApp: () => ({
  user: null, draft: { quantities: {} }, reportsVersion: 1,
  resetDraft: vi.fn(), patchDraft: vi.fn(), setLastSavedReport: vi.fn(),
}) }));
vi.mock("./iteration2Api", () => ({ fetchCleanupEvents: vi.fn() }));
vi.mock("./iteration3Api", () => ({ iteration3Request: vi.fn() }));
vi.mock("./locationPreference", () => ({ getPreferredBeachId: () => null }));
vi.mock("./useAsyncData", () => ({
  useAsyncData: (load: unknown, _dependencies: unknown[], initial: unknown) => ({
    data: load === state.getBeaches ? state.beaches : Array.isArray(initial) ? [] : null,
    loading: load === state.getBeaches && state.loading,
    error: load === state.getBeaches ? state.error : null,
    refresh: state.refresh,
  }),
}));
vi.mock("./components/ui", async original => {
  const components = await original<typeof import("./components/ui")>();
  return {
    ...components,
    GhostButton: (props: { children: ReactNode; onClick: () => unknown; height?: number }) => {
      state.actions.set(String(props.children), props.onClick);
      return <components.GhostButton {...props} />;
    },
  };
});

import HomeScreen from "./screens/HomeScreen";

const renderHome = () => renderToStaticMarkup(<StaticRouter location="/home"><HomeScreen /></StaticRouter>);

const beach = (index: number) => ({
  id: index === 0 ? "morib" : `expanded-${index}`,
  name: index === 0 ? "Pantai Morib" : `Expanded Beach ${index}`,
  area: "Malaysia", lat: null, lng: null, severity: null,
  insufficientData: true, validReports: 0, coverImageUrl: null,
}) as BeachSummary;

beforeEach(() => {
  state.beaches = [];
  state.loading = true;
  state.error = null;
  state.actions.clear();
  state.navigate.mockClear();
  state.refresh.mockClear();
});

describe("home beach browsing", () => {
  it("keeps a beach browsing entry available while the API is still loading", () => {
    const html = renderHome();
    expect(html).toContain("Explore Beaches");
    expect(html).not.toContain("See Other Beaches");
    state.actions.get("Explore Beaches")!();
    expect(state.navigate).toHaveBeenCalledWith("/map?panel=beaches", { state: { fromHome: true } });
  });

  it("keeps the same entry available after a beach request fails", () => {
    state.loading = false;
    state.error = "Beach data is unavailable.";
    const html = renderHome();
    expect(html).toContain("Could not load beaches");
    expect(html).toContain("Explore Beaches");
    state.actions.get("Explore Beaches")!();
    expect(state.navigate).toHaveBeenCalledWith("/map?panel=beaches", { state: { fromHome: true } });
  });

  it("opens the complete beach list directly after the expanded catalogue loads", () => {
    state.beaches = Array.from({ length: 85 }, (_, index) => beach(index));
    state.loading = false;
    const html = renderHome();
    expect(html).toContain("Pantai Morib");
    expect(html).toContain("See Other Beaches");
    expect(html).not.toContain("Explore Beaches");
    state.actions.get("See Other Beaches")!();
    expect(state.navigate).toHaveBeenCalledWith("/map?panel=beaches", { state: { fromHome: true } });
  });

  it("shows one usable beach entry when refreshing a previously loaded beach fails", () => {
    state.beaches = [beach(0)];
    state.loading = false;
    state.error = "Beach data is unavailable.";
    const html = renderHome();
    expect(html).toContain("Explore Beaches");
    expect(html).not.toContain("See Other Beaches");
  });
});
