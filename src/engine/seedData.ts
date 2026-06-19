/**
 * Curated offline shelf-life seed (~50 common groceries) so the app works the
 * moment it's installed — no network, no download. Values are conservative
 * (shortest-safe), consistent with safetyLimits.ts.
 *
 * To ship the FULL USDA FoodKeeper dataset instead, run the ETL
 * (etl/build_shelf_life.mjs) and paste its shelf_life_rules.sql output here, or
 * load it as a bundled asset. The schema matches exactly.
 */
export const SHELF_LIFE_SEED_SQL = `
DROP TABLE IF EXISTS shelf_life_rules;
CREATE TABLE shelf_life_rules (
  id               INTEGER PRIMARY KEY,
  category         TEXT NOT NULL,
  name             TEXT NOT NULL,
  name_lc          TEXT NOT NULL,
  refrigerate_days INTEGER,
  pantry_days      INTEGER,
  freeze_days      INTEGER,
  default_zone     TEXT NOT NULL CHECK(default_zone IN ('fridge','pantry','freezer'))
);
CREATE INDEX idx_shelf_life_name_lc ON shelf_life_rules(name_lc);
BEGIN TRANSACTION;
INSERT INTO shelf_life_rules VALUES (1,'Dairy','Milk','milk',7,NULL,90,'fridge');
INSERT INTO shelf_life_rules VALUES (2,'Dairy','Whole Milk','whole milk',7,NULL,90,'fridge');
INSERT INTO shelf_life_rules VALUES (3,'Dairy','Eggs','eggs',35,NULL,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (4,'Dairy','Butter','butter',30,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (5,'Dairy','Cheese','cheese',21,NULL,180,'fridge');
INSERT INTO shelf_life_rules VALUES (6,'Dairy','Cheddar Cheese','cheddar cheese',21,NULL,180,'fridge');
INSERT INTO shelf_life_rules VALUES (7,'Dairy','Yogurt','yogurt',14,NULL,60,'fridge');
INSERT INTO shelf_life_rules VALUES (8,'Dairy','Cream','cream',7,NULL,120,'fridge');
INSERT INTO shelf_life_rules VALUES (9,'Poultry','Chicken','chicken',2,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (10,'Poultry','Chicken Breast','chicken breast',2,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (11,'Poultry','Turkey','turkey',2,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (12,'Meat','Ground Beef','ground beef',2,NULL,120,'fridge');
INSERT INTO shelf_life_rules VALUES (13,'Meat','Beef','beef',4,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (14,'Meat','Steak','steak',4,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (15,'Meat','Pork','pork',4,NULL,180,'fridge');
INSERT INTO shelf_life_rules VALUES (16,'Meat','Bacon','bacon',7,NULL,30,'fridge');
INSERT INTO shelf_life_rules VALUES (17,'Meat','Sausage','sausage',2,NULL,60,'fridge');
INSERT INTO shelf_life_rules VALUES (18,'Meat','Ham','ham',5,NULL,60,'fridge');
INSERT INTO shelf_life_rules VALUES (19,'Meat','Deli Meat','deli meat',4,NULL,30,'fridge');
INSERT INTO shelf_life_rules VALUES (20,'Meat','Hot Dogs','hot dogs',7,NULL,30,'fridge');
INSERT INTO shelf_life_rules VALUES (21,'Seafood','Salmon','salmon',2,NULL,90,'fridge');
INSERT INTO shelf_life_rules VALUES (22,'Seafood','Fish','fish',2,NULL,180,'fridge');
INSERT INTO shelf_life_rules VALUES (23,'Seafood','Shrimp','shrimp',2,NULL,90,'fridge');
INSERT INTO shelf_life_rules VALUES (24,'Seafood','Tuna','tuna',2,NULL,90,'fridge');
INSERT INTO shelf_life_rules VALUES (25,'Produce','Lettuce','lettuce',7,NULL,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (26,'Produce','Spinach','spinach',5,NULL,240,'fridge');
INSERT INTO shelf_life_rules VALUES (27,'Produce','Tomato','tomato',7,5,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (28,'Produce','Carrot','carrot',21,NULL,300,'fridge');
INSERT INTO shelf_life_rules VALUES (29,'Produce','Potato','potato',NULL,30,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (30,'Produce','Onion','onion',NULL,30,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (31,'Produce','Garlic','garlic',NULL,90,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (32,'Produce','Apple','apple',30,7,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (33,'Produce','Banana','banana',NULL,5,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (34,'Produce','Orange','orange',21,7,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (35,'Produce','Strawberries','strawberries',5,NULL,240,'fridge');
INSERT INTO shelf_life_rules VALUES (36,'Produce','Blueberries','blueberries',7,NULL,240,'fridge');
INSERT INTO shelf_life_rules VALUES (37,'Produce','Avocado','avocado',5,4,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (38,'Produce','Broccoli','broccoli',5,NULL,300,'fridge');
INSERT INTO shelf_life_rules VALUES (39,'Produce','Bell Pepper','bell pepper',7,NULL,240,'fridge');
INSERT INTO shelf_life_rules VALUES (40,'Produce','Mushrooms','mushrooms',7,NULL,270,'fridge');
INSERT INTO shelf_life_rules VALUES (41,'Produce','Cucumber','cucumber',7,NULL,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (42,'Produce','Grapes','grapes',7,NULL,300,'fridge');
INSERT INTO shelf_life_rules VALUES (43,'Produce','Lemon','lemon',21,7,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (44,'Bakery','Bread','bread',NULL,7,90,'pantry');
INSERT INTO shelf_life_rules VALUES (45,'Pantry','Rice','rice',NULL,720,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (46,'Pantry','Pasta','pasta',NULL,720,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (47,'Pantry','Flour','flour',NULL,365,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (48,'Pantry','Cereal','cereal',NULL,180,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (49,'Pantry','Canned Beans','canned beans',NULL,365,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (50,'Pantry','Canned Tomatoes','canned tomatoes',NULL,365,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (51,'Pantry','Peanut Butter','peanut butter',NULL,180,NULL,'pantry');
INSERT INTO shelf_life_rules VALUES (52,'Condiments','Ketchup','ketchup',180,30,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (53,'Beverages','Orange Juice','orange juice',7,NULL,NULL,'fridge');
INSERT INTO shelf_life_rules VALUES (54,'Protein','Tofu','tofu',5,NULL,150,'fridge');
COMMIT;
`;
