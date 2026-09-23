import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("./release-manifest.json", import.meta.url), "utf8"));
if (manifest.expected !== "clean") throw new Error("Release manifest is not clean.");
console.log("PASS exec-release-go");
