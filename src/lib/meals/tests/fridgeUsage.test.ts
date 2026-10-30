import type { FridgeEntry } from "../meals";
import { applyFridgeUses, sameUnit, suggestedAmount } from "../fridgeUsage";

const fridge = (): Map<string, FridgeEntry> =>
  new Map([
    ["milk", { quantity: 2, unit: "cup" }],
    ["oats", { quantity: 1.5, unit: "cups" }],
    ["butter", { quantity: 8, unit: "oz" }],
  ]);

describe("applyFridgeUses", () => {
  it("subtracts the amount used", () => {
    const next = applyFridgeUses(fridge(), [{ ingredientId: "milk", amount: 1 }]);
    expect(next.get("milk")).toEqual({ quantity: 1, unit: "cup" });
  });

  it("removes items that are used up or go below zero", () => {
    const next = applyFridgeUses(fridge(), [
      { ingredientId: "milk", amount: 2 },
      { ingredientId: "butter", amount: 10 },
    ]);
    expect(next.has("milk")).toBe(false);
    expect(next.has("butter")).toBe(false);
  });

  it("rounds to hundredths so repeated decimals don't drift", () => {
    const next = applyFridgeUses(fridge(), [{ ingredientId: "oats", amount: 0.1 }]);
    expect(next.get("oats")?.quantity).toBe(1.4);
  });

  it("adds up several uses of the same item", () => {
    const next = applyFridgeUses(fridge(), [
      { ingredientId: "butter", amount: 3 },
      { ingredientId: "butter", amount: 2 },
    ]);
    expect(next.get("butter")?.quantity).toBe(3);
  });

  it("ignores items not in the fridge and non-positive amounts", () => {
    const start = fridge();
    const next = applyFridgeUses(start, [
      { ingredientId: "eggs", amount: 2 },
      { ingredientId: "milk", amount: 0 },
      { ingredientId: "milk", amount: Number.NaN },
    ]);
    expect(next).toEqual(start);
  });

  it("doesn't change the map it was given", () => {
    const start = fridge();
    applyFridgeUses(start, [{ ingredientId: "milk", amount: 2 }]);
    expect(start.get("milk")?.quantity).toBe(2);
  });
});

describe("suggestedAmount", () => {
  it("suggests the recipe amount when units match, ignoring case and plurals", () => {
    expect(suggestedAmount({ quantity: 1, unit: "Cups" }, { quantity: 2, unit: "cup" })).toBe("1");
  });

  it("suggests nothing when units differ, the amount is unset, or it isn't in the fridge", () => {
    expect(suggestedAmount({ quantity: 1, unit: "cup" }, { quantity: 8, unit: "oz" })).toBe("");
    expect(suggestedAmount({ quantity: null, unit: "cup" }, { quantity: 2, unit: "cup" })).toBe("");
    expect(suggestedAmount({ quantity: 1, unit: "cup" }, undefined)).toBe("");
  });
});

describe("sameUnit", () => {
  it("treats blank and missing units as the same", () => {
    expect(sameUnit(null, "")).toBe(true);
  });

  it("doesn't strip the s from short units", () => {
    expect(sameUnit("lbs", "lb")).toBe(true);
    expect(sameUnit("os", "o")).toBe(false);
  });
});
