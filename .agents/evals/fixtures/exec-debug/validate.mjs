import assert from "node:assert/strict";
import { addPlacedYards } from "./src/placed-yards.mjs";

assert.equal(addPlacedYards(12, 3), 15, "placed yards must add");
assert.equal(addPlacedYards(0, 7), 7, "zero plus placement must remain placement");
console.log("PASS exec-debug");
