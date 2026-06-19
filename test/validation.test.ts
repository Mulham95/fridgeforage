import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toInventoryItem, toInventoryItems, buildInventoryItem } from "../src/engine/validation";

const NOW = 1_700_000_000_000; // fixed epoch for deterministic expires_at
const DAY = 86_400_000;

describe("toInventoryItem — coercing untrusted model output to DB-safe values", () => {
  test("coerces off-enum storage_zone so the DB CHECK can never fail", () => {
    assert.equal(toInventoryItem({ normalized_name: "Milk", storage_zone: "Fridge", estimated_shelf_life_days: 5 })!.storage_zone, "fridge");
    assert.equal(toInventoryItem({ normalized_name: "Peas", storage_zone: "in the freezer", estimated_shelf_life_days: 30 })!.storage_zone, "freezer");
    assert.equal(toInventoryItem({ normalized_name: "Beans", storage_zone: "cupboard", estimated_shelf_life_days: 200 })!.storage_zone, "pantry");
    // unknown zone defaults to fridge (safest for an unknown perishable)
    assert.equal(toInventoryItem({ normalized_name: "Mystery", storage_zone: "???", estimated_shelf_life_days: 3 })!.storage_zone, "fridge");
  });

  test("maps unit aliases and falls back to pcs", () => {
    assert.equal(toInventoryItem({ normalized_name: "Beef", unit: "lb", storage_zone: "fridge", estimated_shelf_life_days: 3 })!.unit, "lbs");
    assert.equal(toInventoryItem({ normalized_name: "Beef", unit: "POUNDS", storage_zone: "fridge", estimated_shelf_life_days: 3 })!.unit, "lbs");
    assert.equal(toInventoryItem({ normalized_name: "Eggs", unit: "each", storage_zone: "fridge", estimated_shelf_life_days: 20 })!.unit, "pcs");
    assert.equal(toInventoryItem({ normalized_name: "Eggs", unit: "weirdunit", storage_zone: "fridge", estimated_shelf_life_days: 20 })!.unit, "pcs");
    assert.equal(toInventoryItem({ normalized_name: "Oil", unit: "oz", storage_zone: "pantry", estimated_shelf_life_days: 200 })!.unit, "oz");
  });

  test("sanitizes quantity and gtin", () => {
    const a = toInventoryItem({ normalized_name: "Avocado", quantity: 3, storage_zone: "pantry", estimated_shelf_life_days: 5 })!;
    assert.equal(a.quantity, 3);
    const b = toInventoryItem({ normalized_name: "Avocado", quantity: -2, storage_zone: "pantry", estimated_shelf_life_days: 5 })!;
    assert.equal(b.quantity, 1); // invalid -> default 1
    const c = toInventoryItem({ normalized_name: "Milk", barcode_gtin: "0012000042457", storage_zone: "fridge", estimated_shelf_life_days: 5 })!;
    assert.equal(c.barcode_gtin, "0012000042457");
    const d = toInventoryItem({ normalized_name: "Milk", barcode_gtin: "12-bad", storage_zone: "fridge", estimated_shelf_life_days: 5 })!;
    assert.equal(d.barcode_gtin, null); // too short / non-numeric -> null
  });

  test("returns null for junk with no name", () => {
    assert.equal(toInventoryItem({ storage_zone: "fridge", estimated_shelf_life_days: 3 }), null);
    assert.equal(toInventoryItem({ normalized_name: "   ", estimated_shelf_life_days: 3 } as any), null);
  });

  test("applies the safety clamp to the model's shelf life", () => {
    const item = toInventoryItem(
      { normalized_name: "Raw Chicken", storage_zone: "fridge", estimated_shelf_life_days: 10, unit: "lbs" },
      NOW
    )!;
    assert.equal(item.estimated_shelf_life_days, 2); // clamped from 10
    assert.equal(item.expires_at, NOW + 2 * DAY); // expires_at derived from clamped value
    assert.equal(item.added_at, NOW);
  });

  test("mints a string id and a name within 80 chars", () => {
    const long = "X".repeat(200);
    const item = toInventoryItem({ normalized_name: long, storage_zone: "pantry", estimated_shelf_life_days: 10 })!;
    assert.equal(typeof item.id, "string");
    assert.ok(item.id.length > 0);
    assert.equal(item.normalized_name.length, 80);
  });
});

describe("toInventoryItems", () => {
  test("filters out the unparseable rows", () => {
    const items = toInventoryItems([
      { normalized_name: "Milk", storage_zone: "fridge", estimated_shelf_life_days: 5 },
      { storage_zone: "fridge", estimated_shelf_life_days: 5 }, // no name -> dropped
      { normalized_name: "Eggs", storage_zone: "fridge", estimated_shelf_life_days: 20 },
    ]);
    assert.equal(items.length, 2);
    assert.deepEqual(items.map((i) => i.normalized_name), ["Milk", "Eggs"]);
  });

  test("returns [] for non-array input", () => {
    assert.deepEqual(toInventoryItems(null), []);
    assert.deepEqual(toInventoryItems("nope" as any), []);
  });
});

describe("buildInventoryItem — trusted (FoodKeeper/barcode) path", () => {
  test("keeps trusted days but still passes them through the clamp", () => {
    const milk = buildInventoryItem({ name: "Milk", zone: "fridge", days: 5, gtin: "0012000042457" }, NOW);
    assert.equal(milk.estimated_shelf_life_days, 5);
    assert.equal(milk.expires_at, NOW + 5 * DAY);
    assert.equal(milk.unit, "pcs"); // default
    assert.equal(milk.barcode_gtin, "0012000042457");

    // even a "trusted" 5-day chicken is clamped to 2
    const chicken = buildInventoryItem({ name: "Chicken", zone: "fridge", days: 5 }, NOW);
    assert.equal(chicken.estimated_shelf_life_days, 2);
  });

  test("generates unique ids", () => {
    const a = buildInventoryItem({ name: "Rice", zone: "pantry", days: 300 });
    const b = buildInventoryItem({ name: "Rice", zone: "pantry", days: 300 });
    assert.notEqual(a.id, b.id);
  });
});
