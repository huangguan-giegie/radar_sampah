import { describe, expect, it } from "vitest";
import { hasSeenWelcome, markWelcomeSeen, shouldShowWelcomeBeforeHome } from "./welcomeEntry";

function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("welcome first-entry gate", () => {
  it("sends a fresh direct /home visit to the Figma Welcome screen", () => {
    expect(shouldShowWelcomeBeforeHome("/home", memoryStore())).toBe(true);
  });

  it("does not intercept normal entry routes or a Home visit after Welcome", () => {
    const store = memoryStore();
    expect(shouldShowWelcomeBeforeHome("/", store)).toBe(false);
    expect(shouldShowWelcomeBeforeHome("/map", store)).toBe(false);
    markWelcomeSeen(store);
    expect(hasSeenWelcome(store)).toBe(true);
    expect(shouldShowWelcomeBeforeHome("/home", store)).toBe(false);
  });

  it("fails open when session storage is unavailable", () => {
    expect(shouldShowWelcomeBeforeHome("/home", null)).toBe(false);
    expect(() => markWelcomeSeen(null)).not.toThrow();
  });
});
