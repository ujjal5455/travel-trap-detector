import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, apiJson, DEVICE_ID_HEADER } from "@/lib/client/api";
import { isDeviceId } from "@/lib/client/device-id";

function mockFetch(response: Response) {
  const fn = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("sends the device ID header and keeps caller headers", async () => {
    const fetchMock = mockFetch(new Response("{}"));
    await apiFetch("/api/x", { headers: { accept: "application/json" } });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(isDeviceId(headers.get(DEVICE_ID_HEADER))).toBe(true);
    expect(headers.get("accept")).toBe("application/json");
  });
});

describe("apiJson", () => {
  it("sets a JSON content type for string bodies and parses the response", async () => {
    const fetchMock = mockFetch(Response.json({ ok: true }));
    const data = await apiJson<{ ok: boolean }>("/api/x", { method: "POST", body: "{}" });

    expect(data).toEqual({ ok: true });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("content-type")).toBe("application/json");
  });

  it("leaves the content type alone for FormData uploads", async () => {
    const fetchMock = mockFetch(Response.json({}));
    await apiJson("/api/x", { method: "POST", body: new FormData() });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has("content-type")).toBe(false);
  });

  it("throws ApiError with the route's error message", async () => {
    mockFetch(Response.json({ error: "Too many fare checks this hour" }, { status: 429 }));
    await expect(apiJson("/api/x")).rejects.toEqual(new ApiError("Too many fare checks this hour", 429));
  });

  it("throws a generic ApiError when the body isn't JSON", async () => {
    mockFetch(new Response("oops", { status: 500 }));
    await expect(apiJson("/api/x")).rejects.toMatchObject({ status: 500, message: "Request failed (500)" });
  });
});
