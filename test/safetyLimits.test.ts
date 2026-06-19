import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clampShelfLife, isHighRisk } from "../src/engine/safetyLimits";

describe("clampShelfLife — category ceilings (the food-poisoning guardrail)", () => {
  test("raw poultry/seafood is capped at 2 days no matter what the model says", () => {
    assert.equal(clampShelfLife("Organic Chicken Breast", "fridge", 10), 2);
    assert.equal(clampShelfLife("Fresh Salmon Fillet", "fridge", 7), 2);
    assert.equal(clampShelfLife("Raw Shrimp", "fridge", 14), 2);
  });

  test("ground meat is capped at 2 days (matched before the red-meat rule)", () => {
    assert.equal(clampShelfLife("Ground Beef", "fridge", 9), 2);
    assert.equal(clampShelfLife("Ground Pork", "fridge", 9), 2);
  });

  test("whole-cut red meat / deli / berries capped at 5 days", () => {
    assert.equal(clampShelfLife("Ribeye Steak", "fridge", 12), 5);
    assert.equal(clampShelfLife("Sliced Deli Ham", "fridge", 12), 5);
    assert.equal(clampShelfLife("Strawberries", "fridge", 12), 5);
  });

  test("leftovers capped at 4, dairy at 7, eggs at 35", () => {
    assert.equal(clampShelfLife("Leftover Pasta", "fridge", 10), 4);
    assert.equal(clampShelfLife("Whole Milk", "fridge", 30), 7);
    assert.equal(clampShelfLife("Eggs", "fridge", 60), 35);
  });

  test("non-perishables keep long life but never exceed the zone ceiling", () => {
    assert.equal(clampShelfLife("Canned Black Beans", "pantry", 1000), 365);
    assert.equal(clampShelfLife("White Rice", "pantry", 5000), 365);
    assert.equal(clampShelfLife("Frozen Peas", "freezer", 800), 365);
    // unmatched item in the fridge is still bounded by the fridge ceiling
    assert.equal(clampShelfLife("Ketchup", "fridge", 200), 60);
  });

  test("a value already below the ceiling is left alone", () => {
    assert.equal(clampShelfLife("Chicken", "fridge", 1), 1);
    assert.equal(clampShelfLife("Apple", "pantry", 14), 14);
  });

  test("rounds down and never returns less than 1", () => {
    assert.equal(clampShelfLife("Rice", "pantry", 3.9), 3);
    assert.equal(clampShelfLife("Rice", "pantry", 0), 1);
    assert.equal(clampShelfLife("Rice", "pantry", -5), 1);
    assert.equal(clampShelfLife("Rice", "pantry", NaN), 1);
  });
});

describe("isHighRisk", () => {
  test("true for raw meat/seafood/ground; false otherwise", () => {
    assert.equal(isHighRisk("Raw Chicken"), true);
    assert.equal(isHighRisk("Salmon"), true);
    assert.equal(isHighRisk("Ground Turkey"), true);
    assert.equal(isHighRisk("Whole Milk"), false);
    assert.equal(isHighRisk("Ribeye Steak"), false);
    assert.equal(isHighRisk("Apple"), false);
  });
});
