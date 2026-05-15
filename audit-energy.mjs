import { createClient } from "@supabase/supabase-js";

const URL = "https://mtcthkzvpfctjanehgdr.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y3Roa3p2cGZjdGphbmVoZ2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjA3NjUsImV4cCI6MjA5MTgzNjc2NX0.qk0BV7loi2eGNWtgLomMw8XtZB4gucMY45D-xFipQWw";

const ADMIN = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, ADMIN, { auth: { persistSession: false } });
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const email = `audit+${Date.now()}@example.com`;
const password = "AuditTest!2345";
const { data: created, error: cuErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (cuErr) { console.error("createUser", cuErr); process.exit(1); }
const { error: siErr } = await sb.auth.signInWithPassword({ email, password });
if (siErr) { console.error("signin", siErr); process.exit(1); }
console.log("Authed as", created.user.id);

const probes = [
  ["loa_requests", { status: "requested", customer_legal_name: "Audit Co", utility: "Oncor", service_address: "1 Test St", esi_id: "ESI1", notes: "audit" }],
  ["usage_requests", { status: "pending", esi_id: "ESI2", utility: "Oncor", service_address: "1 Test St", annual_kwh_estimate: 1000, urgency: "normal" }],
  ["pricing_requests", { status: "pending", utility: "Oncor", zone: "North", start_date: "2026-01-01", target_rate: 0.0789, urgency: "normal" }],
  ["contract_requests", { status: "draft", customer_legal_name: "Audit Co", service_address: "1 Test St", billing_address: "1 Test St", contact_email: "c@e.com", term_months: 24, final_rate: 0.0789, start_date: "2026-01-01" }],
  ["energy_suppliers", { is_active: true, commission_type: "upfront", name: "Audit Supplier", contact_name: "X", contact_email: "x@y.com", contact_phone: "555", submission_email: "s@y.com", payment_terms: "Net 30" }],
  ["renewals", { status: "upcoming", current_supplier: "TXU", current_rate: 0.08, contract_end_date: "2026-12-01", renewal_window_start: "2026-08-01", notes: "audit" }],
  ["energy_customers", { status: "active", deal_name: "Audit Deal", agent_closed_name: "Agent X", start_date: "2026-01-01", end_date: "2027-01-01", previous_supplier: "A", current_supplier: "B", service_address: "1 Test St", esi_id: "ESI3", annual_kwh: 1000, term_kwh: 2000, customer_name: "C", customer_email: "c@e.com", customer_phone: "555", notes: "audit" }],
];

const results = [];
for (const [table, payload] of probes) {
  const t0 = Date.now();
  const { data, error } = await sb.from(table).insert(payload).select().single();
  const ms = Date.now() - t0;
  if (error) {
    results.push({ table, ok: false, ms, code: error.code, message: error.message, details: error.details, hint: error.hint });
  } else {
    // verify list
    const { data: list, error: lErr } = await sb.from(table).select("id").limit(5);
    // delete
    const { error: dErr } = await sb.from(table).delete().eq("id", data.id);
    results.push({ table, ok: true, ms, listed: !lErr && list.length > 0, deleted: !dErr });
  }
}
console.log(JSON.stringify(results, null, 2));
