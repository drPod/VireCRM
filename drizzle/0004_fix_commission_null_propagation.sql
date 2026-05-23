ALTER TABLE "commission_statements" drop column "expected_amount";--> statement-breakpoint
ALTER TABLE "commission_statements" ADD COLUMN "expected_amount" numeric(20, 2) GENERATED ALWAYS AS ("commission_statements"."billing_aq_kwh" * "commission_statements"."mils" / 1000) STORED;--> statement-breakpoint
ALTER TABLE "commission_statements" drop column "reconciliation_status";--> statement-breakpoint
ALTER TABLE "commission_statements" ADD COLUMN "reconciliation_status" text GENERATED ALWAYS AS (CASE
        WHEN "commission_statements"."billing_aq_kwh" IS NULL OR "commission_statements"."mils" IS NULL THEN 'unknown'
        WHEN "commission_statements"."received_amount" IS NULL THEN 'pending'
        WHEN ABS("commission_statements"."received_amount" - ("commission_statements"."billing_aq_kwh" * "commission_statements"."mils" / 1000)) < 0.01 THEN 'matched'
        WHEN "commission_statements"."received_amount" < ("commission_statements"."billing_aq_kwh" * "commission_statements"."mils" / 1000) THEN 'short'
        ELSE 'over'
      END) STORED;