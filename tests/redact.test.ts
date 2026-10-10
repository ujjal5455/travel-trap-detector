import { describe, expect, it } from "vitest";
import { redactPersonalDetails, REDACTED } from "@/lib/redact";

const r = (s: string) => redactPersonalDetails(s).text;

describe("phone numbers", () => {
  it.each([
    "Call 9864012345 for a ride",
    "Call +91 98640 12345 for a ride",
    "Call +91-98640-12345 for a ride",
    "Call 098640 12345 for a ride",
    "Call 0361-2345678 for a ride",
    "Call (0361) 234 5678 for a ride",
  ])("removes %s", (text) => {
    expect(r(text)).toBe(`Call ${REDACTED} for a ride`);
  });
});

describe("vehicle registration numbers", () => {
  it.each([
    ["Taxi AS 01 AB 1234 overcharged", `Taxi ${REDACTED} overcharged`],
    ["Taxi AS01AB1234 overcharged", `Taxi ${REDACTED} overcharged`],
    ["taxi ml-05-c-1234 overcharged", `taxi ${REDACTED} overcharged`],
    ["Jeep SK 04 P 5678 to Nathula", `Jeep ${REDACTED} to Nathula`],
    ["Car 22 BH 1234 AA was rude", `Car ${REDACTED} was rude`],
  ])("removes %s", (text, expected) => {
    expect(r(text)).toBe(expected);
  });
});

describe("leaves ordinary text alone", () => {
  it.each([
    "Paid ₹1,500 for 22 km, felt fair",
    "Asked ₹600 as 12 km 1500 was the usual",
    "Waited 15 min at Paltan Bazaar, 2 bags",
    "Quoted 2500, paid 1800 after bargaining",
    "Left at 10 pm, arrived 11.30",
    "Taxi from AS Road to Kamakhya",
  ])("keeps %s", (text) => {
    expect(redactPersonalDetails(text)).toEqual({ text, redacted: false });
  });
});

it("reports whether anything was removed", () => {
  expect(redactPersonalDetails("Driver 9864012345 asked ₹800").redacted).toBe(true);
});
