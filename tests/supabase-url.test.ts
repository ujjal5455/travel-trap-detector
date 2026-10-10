import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

describe("normalizeSupabaseUrl", () => {
  it("keeps a bare project URL", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });

  it("strips the REST endpoint and trailing slashes pasted from the dashboard", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl(" https://abc.supabase.co/ ")).toBe("https://abc.supabase.co");
  });

  it("rejects other paths and plain http", () => {
    expect(() => normalizeSupabaseUrl("https://abc.supabase.co/project/xyz")).toThrow(/just the project URL/);
    expect(() => normalizeSupabaseUrl("http://abc.supabase.co")).toThrow(/https/);
  });
});
