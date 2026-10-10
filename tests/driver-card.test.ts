import { describe, expect, it } from "vitest";
import {
  DRIVER_CARD_KEYS,
  DRIVER_LANGUAGES,
  driverCardLanguages,
  driverLine,
  driverText,
  isDriverLanguage,
  NEEDS_REVIEW,
} from "@/lib/i18n/driver-card";

describe("driver-card.json", () => {
  it("has exactly English, Assamese, Bengali and Hindi", () => {
    expect(driverCardLanguages.map((l) => l.code)).toEqual([...DRIVER_LANGUAGES]);
  });

  it("has every string in every language, none empty", () => {
    for (const lang of driverCardLanguages) {
      for (const key of DRIVER_CARD_KEYS) {
        expect(lang.strings[key]?.text?.trim(), `${lang.code}.${key}`).toBeTruthy();
      }
    }
  });

  it("marks every non-English string as needing native speaker review (until someone signs it off)", () => {
    for (const lang of driverCardLanguages.filter((l) => l.code !== "en")) {
      for (const key of DRIVER_CARD_KEYS) {
        const review = lang.strings[key].review;
        expect(review === NEEDS_REVIEW || review.startsWith("reviewed by "), `${lang.code}.${key}: ${review}`).toBe(true);
      }
    }
  });

  it("keeps both price placeholders in every polite line", () => {
    for (const lang of driverCardLanguages) {
      expect(lang.strings.line.text).toContain("{min}");
      expect(lang.strings.line.text).toContain("{max}");
    }
  });

  it("uses the right script for each language", () => {
    const bengaliScript = /[ঀ-৿]/;
    const devanagari = /[ऀ-ॿ]/;
    expect(driverText("as", "title")).toMatch(bengaliScript);
    expect(driverText("bn", "title")).toMatch(bengaliScript);
    expect(driverText("hi", "title")).toMatch(devanagari);
    // Assamese uses ৰ and ৱ, which Bengali doesn't
    expect(driverText("as", "title")).toMatch(/[ৰৱ]/);
  });
});

describe("driverLine", () => {
  const visible = (s: string) => s.replaceAll("⁠", "");

  it("fills in the fair range with Indian-format rupees", () => {
    expect(visible(driverLine("en", 150, 1900))).toBe("The usual fare for this trip is ₹150–₹1,900. Can we agree on this?");
    expect(visible(driverLine("hi", 150, 190))).toContain("₹150–₹190");
    expect(driverLine("as", 150, 190)).not.toContain("{");
  });

  it("keeps the range from breaking across lines", () => {
    for (const code of ["en", "as", "bn", "hi"] as const) {
      expect(driverLine(code, 150, 190)).toContain("₹150⁠–⁠₹190");
    }
  });
});

it("isDriverLanguage", () => {
  expect(isDriverLanguage("bn")).toBe(true);
  expect(isDriverLanguage("fr")).toBe(false);
});
