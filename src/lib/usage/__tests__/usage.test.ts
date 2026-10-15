import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUsageDoc = vi.fn();
const incrementUsage = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  getUsageDoc: (...args: unknown[]) => getUsageDoc(...args),
  incrementUsage: (...args: unknown[]) => incrementUsage(...args),
}));

import { PLAN_CREDITS, getUsage, recordUsage } from "../index";

describe("getUsage limits", () => {
  const ORIGINAL = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    getUsageDoc.mockReset();
    incrementUsage.mockReset();
    process.env.ADMIN_EMAILS = "automake0ff@gmail.com";
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it("applies the plan limit to an ordinary user (free = 20)", async () => {
    getUsageDoc.mockResolvedValue({ creditsUsed: 20 });
    const usage = await getUsage("u1", "free", "someone@example.com");
    expect(usage).toMatchObject({ used: 20, limit: PLAN_CREDITS.free, unlimited: false });
    expect(usage.used >= usage.limit).toBe(true); // the routes' blocking check
  });

  it("never blocks an admin email, however much they have used", async () => {
    getUsageDoc.mockResolvedValue({ creditsUsed: 5000 });
    const usage = await getUsage("u1", "free", "automake0ff@gmail.com");
    expect(usage.unlimited).toBe(true);
    expect(usage.limit).toBe(Number.POSITIVE_INFINITY);
    expect(usage.used).toBe(5000); // still counted and reported
    expect(usage.used >= usage.limit).toBe(false);
  });

  it("matches the admin email ignoring case and surrounding spaces", async () => {
    getUsageDoc.mockResolvedValue(null);
    process.env.ADMIN_EMAILS = " Other@x.com , AUTOMAKE0FF@gmail.com ";
    expect((await getUsage("u1", "free", " automake0ff@Gmail.com ")).unlimited).toBe(true);
  });

  it("does not make anyone else unlimited, and a missing email is treated as a normal user", async () => {
    getUsageDoc.mockResolvedValue({ creditsUsed: 3 });
    expect((await getUsage("u1", "free", "automake0ff@gmail.com.evil.com")).unlimited).toBe(false);
    expect((await getUsage("u1", "free", null)).unlimited).toBe(false);
    expect((await getUsage("u1", "free")).unlimited).toBe(false);
  });

  it("is not unlimited for anyone when ADMIN_EMAILS is unset", async () => {
    getUsageDoc.mockResolvedValue(null);
    delete process.env.ADMIN_EMAILS;
    expect((await getUsage("u1", "free", "automake0ff@gmail.com")).unlimited).toBe(false);
  });

  it("keeps paid plan limits for ordinary users", async () => {
    getUsageDoc.mockResolvedValue(null);
    expect((await getUsage("u1", "pro", "a@b.com")).limit).toBe(300);
    expect((await getUsage("u1", "pro_plus", "a@b.com")).limit).toBe(1000);
    expect((await getUsage("u1", "unknown-plan", "a@b.com")).limit).toBe(PLAN_CREDITS.free);
  });
});

describe("recordUsage", () => {
  it("still counts usage (admins included, since recordUsage takes no email)", async () => {
    incrementUsage.mockReset();
    await recordUsage("u1", 3);
    expect(incrementUsage).toHaveBeenCalledWith("u1", expect.stringMatching(/^\d{4}-\d{2}$/), 3);
  });
});
