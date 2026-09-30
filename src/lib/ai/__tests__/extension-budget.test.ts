import { describe, expect, it, vi } from "vitest";
import { remainingBudgetMs } from "../extension";

describe("remainingBudgetMs", () => {
  it("returns close to the full budget right after starting", () => {
    const startedAt = Date.now();
    const remaining = remainingBudgetMs(startedAt);
    expect(remaining).toBeGreaterThan(270_000);
    expect(remaining).toBeLessThanOrEqual(280_000);
  });

  it("gives the coder call most of the budget when the architect call was fast", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 15_000); // architect took 15s
    const remaining = remainingBudgetMs(now);
    expect(remaining).toBeGreaterThan(260_000); // nowhere near the old fixed 140s cap
    vi.restoreAllMocks();
  });

  it("never returns less than the minimum call timeout, even if the budget is exhausted", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 400_000); // well past the 280s budget
    expect(remainingBudgetMs(now)).toBe(20_000);
    vi.restoreAllMocks();
  });
});
