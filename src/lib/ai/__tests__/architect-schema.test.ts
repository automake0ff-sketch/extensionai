import { describe, expect, it } from "vitest";
import { architectPlanSchema } from "../schemas";

const base = {
  name: "n",
  description: "d",
  permissions: ["storage"],
  host_permissions: [],
  components: { background: true, content_script: false, popup: true, options_page: false },
  files_plan: ["manifest.json"],
  notes: "n",
};

describe("architectPlanSchema message_passing", () => {
  it("keeps message_passing when the model provides it (so it reaches the Coder)", () => {
    const parsed = architectPlanSchema.parse({ ...base, message_passing: "popup -> background: save" });
    expect(parsed.message_passing).toBe("popup -> background: save");
  });

  it("does not fail the plan when a smaller model omits it", () => {
    expect(architectPlanSchema.parse(base).message_passing).toBeUndefined();
  });

  it("accepts an empty string for extensions with no messaging", () => {
    expect(architectPlanSchema.parse({ ...base, message_passing: "" }).message_passing).toBe("");
  });
});
