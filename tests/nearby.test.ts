import { describe, expect, it } from "vitest";
import { toNearbyReports } from "@/lib/nearby";

const HERE = { lat: 26.1823701, lng: 91.7501234 };
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const row = (id: string, metersNorth: number, createdAt: string, overrides: object = {}) => ({
  id,
  device_id: OTHER,
  service_type: "auto" as const,
  session_type: null,
  distance_km: 6.8,
  quoted_price: 400,
  paid_price: null,
  felt_fair: false,
  is_scam: true,
  scam_tags: ["inflated_tourist_price" as const],
  description: "Asked for far more than usual",
  photo_path: "x/evidence.jpg",
  pickup_lat: HERE.lat + metersNorth / 111_320,
  pickup_lng: HERE.lng,
  created_at: createdAt,
  ...overrides,
});

describe("toNearbyReports", () => {
  const rows = [
    row("old", 100, "2026-09-01T10:00:00Z"),
    row("new", 300, "2026-10-09T10:00:00Z", { device_id: ME, photo_path: null }),
    row("far", 1500, "2026-10-10T10:00:00Z"),
  ];
  const votes = [
    { report_id: "old", device_id: ME },
    { report_id: "old", device_id: OTHER },
  ];
  const result = toNearbyReports(rows, votes, HERE, ME, 1, 20);

  it("keeps reports within the radius, newest first", () => {
    expect(result.map((r) => r.id)).toEqual(["new", "old"]);
    expect(result[0].metersAway).toBe(300);
  });

  it("counts votes and marks the viewer's own votes and reports", () => {
    expect(result[1]).toMatchObject({ votes: 2, votedByMe: true, isMine: false });
    expect(result[0]).toMatchObject({ votes: 0, votedByMe: false, isMine: true });
  });

  it("never exposes device IDs or photo paths, only whether evidence exists", () => {
    const json = JSON.stringify(result);
    expect(json).not.toContain(ME);
    expect(json).not.toContain(OTHER);
    expect(json).not.toContain("evidence.jpg");
    expect(result[1].hasEvidence).toBe(true);
    expect(result[0].hasEvidence).toBe(false);
  });

  it("treats an anonymous viewer as owning nothing", () => {
    expect(toNearbyReports(rows, votes, HERE, null, 1, 20).every((r) => !r.isMine && !r.votedByMe)).toBe(true);
  });

  it("respects the limit", () => {
    expect(toNearbyReports(rows, votes, HERE, ME, 1, 1)).toHaveLength(1);
  });
});
