import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ loading: true, error: null as string | null }));
vi.mock("./AppContext", () => ({ useApp: () => ({ user: { participantId: "test" } }) }));
vi.mock("./useAsyncData", () => ({ useAsyncData: () => ({ data: null, ...state, refresh: vi.fn() }) }));
import CheckInScreen from "./screens/CheckInScreen";
import EventResultScreen from "./screens/EventResultScreen";
import CleanupResultScreen from "./screens/CleanupResultScreen";

beforeEach(() => { state.loading = true; state.error = null; });
describe("cleanup and event page exits", () => {
  for (const [name, Screen] of [
    ["check-in", CheckInScreen], ["event result", EventResultScreen], ["cleanup result", CleanupResultScreen],
  ] as const) {
    it(`keeps an exit available while ${name} loads or fails`, () => {
      const render = () => renderToStaticMarkup(<StaticRouter location="/events/missing/result"><Screen /></StaticRouter>);
      expect(render()).toContain('aria-label="Back"');
      state.loading = false;
      state.error = "Request unavailable";
      const failed = render();
      expect(failed).toContain('aria-label="Back"');
      expect(failed).toContain("Request unavailable");
      expect(failed).toMatch(/Try again/i);
    });
  }
});
