import { describe, expect, it } from "vitest";
import { reportRequestSchema } from "@/lib/validation";

const pickup = { lat: 26.18, lng: 91.75 };
const drop = { lat: 26.16, lng: 91.7 };
const PHOTO = "5eedc0de-0000-4000-8000-00000000c0de/0f8fad5b-d9cb-469f-a165-70867728950e.jpg";

const ok = (body: object) => reportRequestSchema.safeParse(body).success;
const issue = (body: object) => reportRequestSchema.safeParse(body).error?.issues[0]?.message;

describe("reportRequestSchema", () => {
  it("accepts a fair-fare report", () => {
    expect(ok({ serviceType: "auto", pickup, drop, paidPrice: 160, quotedPrice: 180, feltFair: true, isScam: false })).toBe(true);
  });

  it("accepts a scam report without a paid price, with tags and a photo", () => {
    expect(
      ok({ serviceType: "taxi", pickup, drop, quotedPrice: 1500, isScam: true, scamTags: ["meter_refusal"], photoPath: PHOTO }),
    ).toBe(true);
  });

  it("accepts a guide report with a session and no drop", () => {
    expect(ok({ serviceType: "guide", pickup, sessionType: "full_day", paidPrice: 1500, isScam: false })).toBe(true);
  });

  it("requires a paid price unless it is a scam report", () => {
    expect(issue({ serviceType: "auto", pickup, drop, isScam: false })).toBe("enter what you paid");
  });

  it("requires at least one tag on a scam report, and none otherwise", () => {
    expect(issue({ serviceType: "auto", pickup, drop, isScam: true })).toBe("choose at least one kind of problem");
    expect(issue({ serviceType: "auto", pickup, drop, paidPrice: 100, isScam: false, scamTags: ["other"] })).toBe("only for scam reports");
  });

  it("requires a drop for trips and a session for guides", () => {
    expect(issue({ serviceType: "taxi", pickup, paidPrice: 100, isScam: false })).toBe("choose a drop point");
    expect(issue({ serviceType: "guide", pickup, paidPrice: 100, isScam: false })).toBe("choose half day or full day");
  });

  it("limits the description to 280 characters and rejects unknown tags", () => {
    expect(ok({ serviceType: "auto", pickup, drop, paidPrice: 100, isScam: false, description: "x".repeat(281) })).toBe(false);
    expect(ok({ serviceType: "auto", pickup, drop, isScam: true, scamTags: ["driver_name"] })).toBe(false);
  });

  it("only accepts photo paths in the shape the server issues", () => {
    const base = { serviceType: "auto", pickup, drop, paidPrice: 100, isScam: false };
    expect(ok({ ...base, photoPath: "../other-bucket/x.jpg" })).toBe(false);
    expect(ok({ ...base, photoPath: "someone-else/../../x.jpg" })).toBe(false);
  });
});
