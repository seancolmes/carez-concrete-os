import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./src/pour-status.js", import.meta.url), "utf8");
if (!source.includes('return "Ready for pour";')) throw new Error("Expected approved label.");
if (source.includes("Pending pour")) throw new Error("Stale label remains.");
console.log("PASS exec-bounded");
