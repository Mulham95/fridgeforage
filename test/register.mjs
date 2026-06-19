// Registers the .ts-extension resolver hook before the test files load.
// Used via: node --import ./test/register.mjs --test ...
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
