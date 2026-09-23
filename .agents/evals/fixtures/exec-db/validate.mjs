import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./migrations/", import.meta.url));
const files = readdirSync(dir).filter((name) => /^002_.*\.sql$/.test(name));
if (files.length !== 1) throw new Error(`Expected exactly one 002 migration, found ${files.length}.`);

const baseline = readFileSync(join(dir, "001_create_pour_records.sql"), "utf8");
if (!baseline.includes("enable row level security")) throw new Error("Baseline RLS was altered.");
if (!baseline.includes("pour_records_company_select")) throw new Error("Baseline tenant policy was altered.");

const sql = readFileSync(join(dir, files[0]), "utf8");
if (!/alter\s+table\s+pour_records[\s\S]*add\s+column\s+if\s+not\s+exists\s+concrete_condition_id\s+uuid\s+references\s+concrete_conditions\s*\(\s*id\s*\)/i.test(sql)) {
  throw new Error("Migration must add nullable concrete_condition_id FK with IF NOT EXISTS.");
}
if (!/create\s+index\s+if\s+not\s+exists[\s\S]*concrete_condition_id/i.test(sql)) {
  throw new Error("Migration must add an idempotent index for concrete_condition_id.");
}
const destructive = ["dr" + "op", "trun" + "cate", "del" + "ete"];
if (destructive.some((word) => new RegExp("\\b" + word + "\\b", "i").test(sql))) throw new Error("Destructive SQL is forbidden.");
if (/disable\s+row\s+level\s+security/i.test(sql)) throw new Error("RLS must remain enabled.");
if (/concrete_condition_id\s+uuid\s+not\s+null/i.test(sql)) throw new Error("New FK must remain nullable for existing rows.");
console.log("PASS exec-db");
