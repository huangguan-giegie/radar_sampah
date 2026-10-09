import { describe, expect, it } from "vitest";
import { applyConfirmedCleanupBands } from "./cleanupFlow";

describe("cleanup band updates", () => {
  it("keeps every category update when one cleanup records multiple litter types", () => {
    expect(applyConfirmedCleanupBands(
      { Plastic: "Large", Metal: "Medium" },
      { Plastic: "Small", Metal: "Small" },
    )).toEqual({ Plastic: "Small", Metal: "Small" });
  });
  it("records None as an explicit cleared category while keeping the other band", () => {
    expect(applyConfirmedCleanupBands(
      { Plastic: "Large", Metal: "Medium" },
      { Plastic: "None", Metal: "Small" },
    )).toEqual({ Plastic: "None", Metal: "Small" });
  });
});
