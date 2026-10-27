import {
  displayWeight,
  formatThousands,
  formatWeight,
  maxWeight,
  toKg,
} from "@/lib/units";

describe("displayWeight", () => {
  it("shows kilograms as stored", () => {
    expect(displayWeight(62.5, "kg")).toBe(62.5);
    expect(displayWeight(61.23, "kg")).toBe(61.23);
  });

  it("shows pounds to a tenth", () => {
    expect(displayWeight(60, "lb")).toBe(132.3);
    expect(displayWeight(45.36, "lb")).toBe(100);
  });
});

describe("toKg", () => {
  it("keeps kilograms, rounded to what the database stores", () => {
    expect(toKg(62.5, "kg")).toBe(62.5);
    expect(toKg(62.555, "kg")).toBe(62.56);
  });

  it("converts pounds", () => {
    expect(toKg(135, "lb")).toBe(61.23);
    expect(toKg(100, "lb")).toBe(45.36);
  });

  it.each([45, 95, 100, 135, 135.5, 225, 315, 405])(
    "%d lb survives the trip through kilograms",
    (pounds) => {
      expect(displayWeight(toKg(pounds, "lb"), "lb")).toBe(pounds);
    },
  );

  it("gives the same kilograms every time a weight is typed", () => {
    expect(toKg(135, "lb")).toBe(toKg(135, "lb"));
    expect(toKg(displayWeight(toKg(135, "lb"), "lb"), "lb")).toBe(toKg(135, "lb"));
  });
});

describe("maxWeight", () => {
  it("is the database's limit in either unit", () => {
    expect(maxWeight("kg")).toBe(9999);
    expect(maxWeight("lb")).toBe(22044);
    expect(toKg(maxWeight("lb"), "lb")).toBeLessThanOrEqual(9999);
  });
});

describe("formatWeight", () => {
  it.each([
    [60, "kg", "60 kg", "60 kilograms"],
    [60, "lb", "132.3 lb", "132.3 pounds"],
    [1, "kg", "1 kg", "1 kilogram"],
    [toKg(1, "lb"), "lb", "1 lb", "1 pound"],
  ] as const)("%d kg in %s -> %s / %s", (kg, unit, shown, spoken) => {
    expect(formatWeight(kg, unit)).toBe(shown);
    expect(formatWeight(kg, unit, { spoken: true })).toBe(spoken);
  });
});

describe("formatThousands", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [2430, "2,430"],
    [1234567, "1,234,567"],
    [1849.6, "1,850"],
  ])("%d -> %s", (value, shown) => {
    expect(formatThousands(value)).toBe(shown);
  });
});
