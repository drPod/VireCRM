CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"house_split_pct" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "aggregator_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"aggregator_name" text NOT NULL,
	"aggregator_comm_pct" numeric(5, 2),
	"period_start" date,
	"period_end" date,
	"amount" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aggregator_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commission_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"statement_batch_id" uuid,
	"supplier" text,
	"period_start" date,
	"period_end" date,
	"pdf_storage_path" text,
	"billing_aq_kwh" numeric(20, 4),
	"mils" numeric(12, 3),
	"expected_amount" numeric(20, 2) GENERATED ALWAYS AS (COALESCE("commission_statements"."billing_aq_kwh", 0) * COALESCE("commission_statements"."mils", 0) / 1000) STORED,
	"received_amount" numeric(20, 2),
	"outstanding_amount" numeric(20, 2),
	"net_outstanding" numeric(20, 2),
	"agent_comms_paid" numeric(20, 2),
	"agent_comms_outstanding" numeric(20, 2),
	"reconciliation_status" text GENERATED ALWAYS AS (CASE
        WHEN "commission_statements"."received_amount" IS NULL THEN 'pending'
        WHEN ABS(COALESCE("commission_statements"."received_amount", 0) - (COALESCE("commission_statements"."billing_aq_kwh", 0) * COALESCE("commission_statements"."mils", 0) / 1000)) < 0.01 THEN 'matched'
        WHEN COALESCE("commission_statements"."received_amount", 0) < (COALESCE("commission_statements"."billing_aq_kwh", 0) * COALESCE("commission_statements"."mils", 0) / 1000) THEN 'short'
        ELSE 'over'
      END) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commission_statements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"esi_id" uuid NOT NULL,
	"supplier" text,
	"supply_type" text,
	"start_date" date,
	"end_date" date,
	"cost_per_kwh" numeric(12, 6),
	"agent_mils" numeric(12, 3),
	"currency" text DEFAULT 'USD' NOT NULL,
	"fx_rate" numeric(12, 6) DEFAULT '1.0' NOT NULL,
	"pipeline_status" text DEFAULT 'pending' NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"sale_type" text,
	"lost_date" date,
	"lost_reason" text,
	"lost_before_start" boolean DEFAULT false NOT NULL,
	"lost_after_live" boolean DEFAULT false NOT NULL,
	"completed_post_live" boolean DEFAULT false NOT NULL,
	"drop_date" date,
	"drop_reason" text,
	"nomination" text,
	"payment_term" text,
	"resold_status" text,
	"is_resold" boolean DEFAULT false NOT NULL,
	"resold_from_contract_id" uuid,
	"annual_usage_kwh" numeric(20, 4),
	"gross_tcv" numeric(20, 2) GENERATED ALWAYS AS (COALESCE("contracts"."annual_usage_kwh", 0) * COALESCE(("contracts"."end_date" - "contracts"."start_date")::numeric / 365.25, 0) * COALESCE("contracts"."agent_mils", 0) / 1000) STORED,
	"lost_tcv" numeric(20, 2),
	"net_tcv" numeric(20, 2) GENERATED ALWAYS AS (COALESCE("contracts"."annual_usage_kwh", 0) * COALESCE(("contracts"."end_date" - "contracts"."start_date")::numeric / 365.25, 0) * COALESCE("contracts"."agent_mils", 0) / 1000 - COALESCE("contracts"."lost_tcv", 0)) STORED,
	"aq_loss" numeric(20, 4),
	"aq_gain" numeric(20, 4),
	"net_aq" numeric(20, 4) GENERATED ALWAYS AS (COALESCE("contracts"."aq_gain", 0) - COALESCE("contracts"."aq_loss", 0)) STORED,
	"aq_check" numeric(20, 4),
	"lost_partial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"external_customer_id" text,
	"primary_contact_name" text,
	"primary_title" text,
	"primary_email" text,
	"primary_phone" text,
	"notes" text,
	"sic_code" text,
	"business_type" text,
	"category" text,
	"region" text,
	"county" text,
	"credit_score" numeric(6, 0),
	"annual_revenue" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"primary_agent_id" uuid,
	"secondary_agent_id" uuid,
	"contract_id" uuid,
	"name" text,
	"external_sale_id" text,
	"sale_date" date,
	"stage" text DEFAULT 'Lead' NOT NULL,
	"sale_status" text,
	"objection_status" text,
	"objection_type" text,
	"source_of_lead" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "esis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_address_id" uuid NOT NULL,
	"esi_id" text NOT NULL,
	"physical_meter_serial" text,
	"eac_kwh" numeric(20, 4),
	"billing_aq_kwh" numeric(20, 4),
	"annual_usage_kwh" numeric(20, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "service_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"street_no" text,
	"street_name" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"govt_area" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "loas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"pdf_storage_path" text,
	"signed_date" date,
	"expiration_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_payouts" ADD CONSTRAINT "aggregator_payouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_payouts" ADD CONSTRAINT "aggregator_payouts_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_statements" ADD CONSTRAINT "commission_statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_statements" ADD CONSTRAINT "commission_statements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_esi_id_esis_id_fk" FOREIGN KEY ("esi_id") REFERENCES "public"."esis"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_resold_from_contract_id_contracts_id_fk" FOREIGN KEY ("resold_from_contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_primary_agent_id_agents_id_fk" FOREIGN KEY ("primary_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_secondary_agent_id_agents_id_fk" FOREIGN KEY ("secondary_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esis" ADD CONSTRAINT "esis_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esis" ADD CONSTRAINT "esis_service_address_id_service_addresses_id_fk" FOREIGN KEY ("service_address_id") REFERENCES "public"."service_addresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addresses" ADD CONSTRAINT "service_addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addresses" ADD CONSTRAINT "service_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loas" ADD CONSTRAINT "loas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loas" ADD CONSTRAINT "loas_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_tenant_idx" ON "agents" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "aggregator_payouts_tenant_idx" ON "aggregator_payouts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "aggregator_payouts_tenant_contract_idx" ON "aggregator_payouts" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE INDEX "commission_statements_tenant_idx" ON "commission_statements" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "commission_statements_tenant_contract_idx" ON "commission_statements" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE INDEX "commission_statements_tenant_period_idx" ON "commission_statements" USING btree ("tenant_id","period_start");--> statement-breakpoint
CREATE INDEX "contracts_tenant_idx" ON "contracts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "contracts_tenant_esi_idx" ON "contracts" USING btree ("tenant_id","esi_id");--> statement-breakpoint
CREATE INDEX "contracts_tenant_status_idx" ON "contracts" USING btree ("tenant_id","pipeline_status");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_external_idx" ON "customers" USING btree ("tenant_id","external_customer_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_idx" ON "deals" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "deals_tenant_customer_idx" ON "deals" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_stage_idx" ON "deals" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "deals_tenant_external_sale_idx" ON "deals" USING btree ("tenant_id","external_sale_id");--> statement-breakpoint
CREATE INDEX "esis_tenant_idx" ON "esis" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "esis_tenant_esi_id_idx" ON "esis" USING btree ("tenant_id","esi_id");--> statement-breakpoint
CREATE INDEX "esis_tenant_service_address_idx" ON "esis" USING btree ("tenant_id","service_address_id");--> statement-breakpoint
CREATE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "service_addresses_tenant_idx" ON "service_addresses" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "service_addresses_tenant_customer_idx" ON "service_addresses" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "loas_tenant_idx" ON "loas" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "loas_tenant_customer_expiration_idx" ON "loas" USING btree ("tenant_id","customer_id","expiration_date");--> statement-breakpoint
CREATE POLICY "agents_tenant_isolation" ON "agents" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "aggregator_payouts_tenant_isolation" ON "aggregator_payouts" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "commission_statements_tenant_isolation" ON "commission_statements" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "contracts_tenant_isolation" ON "contracts" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "customers_tenant_isolation" ON "customers" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "deals_tenant_isolation" ON "deals" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "esis_tenant_isolation" ON "esis" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "service_addresses_tenant_isolation" ON "service_addresses" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));--> statement-breakpoint
CREATE POLICY "loas_tenant_isolation" ON "loas" AS PERMISSIVE FOR ALL TO "authenticated" USING (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)) WITH CHECK (tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid));