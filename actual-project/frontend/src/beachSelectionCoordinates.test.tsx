import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  beaches: [] as any[],
  map: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [Array.isArray(initial) ? state.beaches : initial === true ? false : initial, vi.fn()],
}));
vi.mock("react-router-dom", async (original) => ({
  ...await original<typeof import("react-router-dom")>(),
  useNavigate: () => vi.fn(),
}));
vi.mock("./navigation", () => ({ useAppBack: () => vi.fn() }));
vi.mock("./AppContext", () => ({
  useApp: () => ({ draft: { beachId: "selected", coords: null, locationSource: "manual" }, patchDraft: vi.fn() }),
}));
vi.mock("./api", () => ({ getBeaches: vi.fn() }));
vi.mock("./components/MiniMap", () => ({
  MiniMap: (props: unknown) => { state.map(props); return null; },
}));

import ConfirmBeachScreen from "./screens/ConfirmBeachScreen";

beforeEach(() => {
  vi.clearAllMocks();
  state.beaches = [{ id: "selected", name: "Selected beach", area: "Malaysia", lat: null, lng: null, severity: null, insufficientData: true, validReports: 0 }];
});

describe("manual beach selection coordinates", () => {
  it("uses the broad default view when the selected beach has no verified coordinates", () => {
    const markup = renderToStaticMarkup(<ConfirmBeachScreen />);
    expect(state.map).toHaveBeenCalledWith({ lat: 4.05, lng: 109.5, zoom: 4 });
    expect(markup).toContain("Selected beach");
  });

  it("keeps a supported beach's verified coordinates", () => {
    state.beaches[0].lat = 2.746;
    state.beaches[0].lng = 101.44;
    renderToStaticMarkup(<ConfirmBeachScreen />);
    expect(state.map).toHaveBeenCalledWith({ lat: 2.746, lng: 101.44, zoom: 9 });
  });
});
