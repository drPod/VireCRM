import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now().toString(36);
const email = `qa+energy-${stamp}@genesisx.test`;
const password = "Aa1!" + Math.random().toString(36).slice(2, 14) + "Zz9@";

const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { is_test_account: true, full_name: "QA Energy" },
});
if (cErr) { console.error(cErr); process.exit(1); }
const uid = created.user.id;

// Wait briefly so the handle_new_user trigger settles
await new Promise(r => setTimeout(r, 500));

const { data: prof } = await admin.from("profiles").select("organization_id").eq("user_id", uid).maybeSingle();
const ORG = prof?.organization_id;
console.log("test user org:", ORG);

const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
await client.auth.signInWithPassword({ email, password });

const inserts = [
  ["loa_requests",       { customer_legal_name: "QA Acme", utility: "Oncor", service_address: "1 Main", esi_id: "ESI-1", status: "requested" }],
  ["usage_requests",     { esi_id: "ESI-1", utility: "Oncor", service_address: "1 Main", status: "pending" }],
  ["pricing_requests",   { utility: "Oncor", zone: "North", status: "pending" }],
  ["contract_requests",  { customer_legal_name: "QA Acme", service_address: "1 Main", contact_email: "x@y.com", term_months: 24, status: "draft" }],
  ["energy_suppliers",   { name: "QA Supplier", commission_type: "upfront" }],
  ["renewals",           { current_supplier: "TXU", contract_end_date: "2027-01-01", status: "upcoming" }],
  ["energy_customers",   { deal_name: "QA Deal", status: "active" }],
];

console.log("\n=== INSERT PROBES ===");
const created_ids = [];
for (const [table, payload] of inserts) {
  const t0 = performance.now();
  const { data, error } = await client.from(table).insert({ ...payload, organization_id: ORG }).select("id").maybeSingle();
  const ms = Math.round(performance.now() - t0);
  if (error) {
    console.log(`❌ ${table.padEnd(20)} ${ms}ms  code=${error.code} msg=${error.message}${error.details ? ` | details=${error.details}` : ""}`);
  } else {
    console.log(`✅ ${table.padEnd(20)} ${ms}ms  inserted id=${data?.id?.slice(0,8)}…`);
    if (data?.id) created_ids.push([table, data.id]);
  }
}

for (const [table, id] of created_ids) await admin.from(table).delete().eq("id", id);
await admin.auth.admin.deleteUser(uid);
console.log("\nCleaned up.");
