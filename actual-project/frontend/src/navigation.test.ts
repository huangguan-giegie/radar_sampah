import { describe, expect, it } from "vitest";
import { backNavigation } from "./navigation";

describe("in-app return navigation", () => {
  it("pops an existing app entry instead of adding a second parent entry", () => {
    expect(backNavigation({ idx: 2 }, "/marine-life")).toEqual({ pop: true });
    expect(backNavigation({ idx: 1 }, "/home")).toEqual({ pop: true });
  });
  it("keeps direct links in the app even when the browser has earlier history", () => {
    for (const state of [null, {}, { idx: 0 }, { idx: -1 }, { idx: "2" }]) {
      expect(backNavigation(state, "/marine-life")).toEqual({
        pop: false, to: "/marine-life", replace: true,
      });
    }
  });
  it("preserves fallback query context and rejects external fallbacks", () => {
    expect(backNavigation(null, "/map?layer=bio")).toMatchObject({ to: "/map?layer=bio" });
    expect(backNavigation(null, "//example.com")).toMatchObject({ to: "/home" });
  });
});
