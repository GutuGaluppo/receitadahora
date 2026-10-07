import { describe, expect, it } from "vitest";
import { mealForHour, seasonFor } from "@/lib/context";
import { norm, splitTerms, stem } from "@/lib/text";
import { conditionFromCode } from "@/services/weather";

describe("contexto", () => {
  it("mapeia hora → refeição", () => {
    expect(mealForHour(7)).toBe("breakfast");
    expect(mealForHour(12)).toBe("lunch");
    expect(mealForHour(16)).toBe("snack");
    expect(mealForHour(20)).toBe("dinner");
    expect(mealForHour(2)).toBe("snack");
  });
  it("estação no hemisfério sul", () => {
    expect(seasonFor(new Date(2026, 0, 10))).toBe("summer");
    expect(seasonFor(new Date(2026, 6, 10))).toBe("winter");
  });
  it("códigos WMO → condição", () => {
    expect(conditionFromCode(0)).toBe("clear");
    expect(conditionFromCode(3)).toBe("cloudy");
    expect(conditionFromCode(63)).toBe("rain");
    expect(conditionFromCode(75)).toBe("snow");
    expect(conditionFromCode(96)).toBe("storm");
  });
});

describe("texto", () => {
  it("normaliza acentos e plurais", () => {
    expect(norm("  Camarão ")).toBe("camarao");
    expect(stem("camarões")).toBe("camarao");
    expect(stem("ovos")).toBe("ovo");
  });
  it("separa termos", () => {
    expect(splitTerms("amendoim, camarão;  ovo\n")).toEqual(["amendoim", "camarão", "ovo"]);
  });
});
