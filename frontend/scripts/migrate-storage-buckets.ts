// Run with: bun run frontend/scripts/migrate-storage-buckets.ts
//
// One-time copy from request-attachments -> ticket-attachments.
// Requires SUPABASE_SERVICE_ROLE_KEY in the environment.
// Idempotent: re-running with upsert: true will catch any objects written
// between the first run and the code switch.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const FROM = "request-attachments";
const TO = "ticket-attachments";

async function listAll(prefix = ""): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await supabase.storage.from(FROM).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.id === null) {
      const nested = await listAll(prefix ? `${prefix}/${item.name}` : item.name);
      out.push(...nested);
    } else {
      out.push(prefix ? `${prefix}/${item.name}` : item.name);
    }
  }
  return out;
}

async function copyOne(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(FROM).download(path);
  if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
  const { error: upErr } = await supabase.storage.from(TO).upload(path, data, { upsert: true });
  if (upErr) throw new Error(`upload ${path}: ${upErr.message}`);
}

async function main() {
  const paths = await listAll();
  console.log(`Migrating ${paths.length} objects from ${FROM} → ${TO}…`);
  for (const p of paths) {
    process.stdout.write(`  ${p} … `);
    await copyOne(p);
    process.stdout.write("ok\n");
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
