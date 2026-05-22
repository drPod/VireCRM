DROP INDEX "deals_tenant_external_sale_idx";--> statement-breakpoint
DROP INDEX "esis_tenant_esi_id_idx";--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "gross_tcv_xlsx" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "net_tcv_xlsx" numeric(20, 2);--> statement-breakpoint
CREATE UNIQUE INDEX "deals_tenant_external_sale_idx" ON "deals" USING btree ("tenant_id","external_sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "esis_tenant_esi_id_idx" ON "esis" USING btree ("tenant_id","esi_id");--> statement-breakpoint
-- Seed greenergiai tenant row (idempotent via subdomain unique constraint)
INSERT INTO "tenants" ("name", "subdomain")
VALUES ('greenergiai', 'greenenergiai')
ON CONFLICT ("subdomain") DO NOTHING;