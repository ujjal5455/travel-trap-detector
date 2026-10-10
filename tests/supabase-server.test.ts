import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getSupabase", () => {
  it("throws a helpful error when env vars are missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const { getSupabase } = await import("@/lib/supabase-server");
    expect(() => getSupabase()).toThrow(/SUPABASE_URL and SUPABASE_SECRET_KEY/);
  });

  it("creates one client and reuses it", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    const { getSupabase } = await import("@/lib/supabase-server");
    expect(getSupabase()).toBe(getSupabase());
  });
});
