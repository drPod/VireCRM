import { Hono } from "hono";
import { z } from "zod";
import {
  createContract,
  decodeCursor,
  deleteContract,
  getContractById,
  listContracts,
  updateContract,
} from "../../db/queries/contracts";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const Uuid = z.string().regex(UUID_RE, "must be a UUID");
// Postgres `numeric` is sent as a string by postgres-js — accept string OR
// number on input and coerce to string before insert. Reject NaN.
const Numeric = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)), "must be numeric");
const DateStr = z.string().regex(ISO_DATE_RE, "must be YYYY-MM-DD");

const PipelineStatus = z.enum(["pending", "active", "expired", "lost"]);

// CRITICAL: `grossTcv`, `netTcv`, `netAq` are GENERATED ALWAYS AS STORED columns
// — Postgres rejects writes. Zod schema OMITS them so a payload that includes
// them fails 400 VALIDATION (`.strict()` rejects unknown keys).
const ContractCreate = z
  .object({
    esiId: Uuid,
    externalSaleId: z.string().min(1).max(255).nullish(),
    supplier: z.string().max(255).nullish(),
    supplyType: z.string().max(64).nullish(),
    startDate: DateStr.nullish(),
    endDate: DateStr.nullish(),
    costPerKwh: Numeric.nullish(),
    agentMils: Numeric.nullish(),
    currency: z.string().length(3).optional(),
    fxRate: Numeric.optional(),
    pipelineStatus: PipelineStatus.optional(),
    isLive: z.boolean().optional(),
    saleType: z.string().max(64).nullish(),
    lostDate: DateStr.nullish(),
    lostReason: z.string().max(1024).nullish(),
    lostBeforeStart: z.boolean().optional(),
    lostAfterLive: z.boolean().optional(),
    completedPostLive: z.boolean().optional(),
    dropDate: DateStr.nullish(),
    dropReason: z.string().max(1024).nullish(),
    nomination: z.string().max(255).nullish(),
    paymentTerm: z.string().max(64).nullish(),
    resoldStatus: z.string().max(64).nullish(),
    isResold: z.boolean().optional(),
    resoldFromContractId: Uuid.nullish(),
    annualUsageKwh: Numeric.nullish(),
    grossTcvXlsx: Numeric.nullish(),
    lostTcv: Numeric.nullish(),
    netTcvXlsx: Numeric.nullish(),
    aqLoss: Numeric.nullish(),
    aqGain: Numeric.nullish(),
    aqCheck: Numeric.nullish(),
    lostPartial: z.boolean().optional(),
  })
  .strict();

const ContractUpdate = ContractCreate.partial().strict();

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  esiId: Uuid.optional(),
});

export const contractsRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      esiId: c.req.query("esiId"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, esiId } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listContracts(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      esiId: esiId ?? null,
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUID → 404 (not 400). Matches customers convention: caller
    // can't distinguish "wrong format" from "no such row," so we don't leak.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getContractById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return jsonError(c, 400, "VALIDATION", { body: "must be JSON" });
    }
    const parsed = ContractCreate.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const row = await createContract(getDb(c), c.get("tenantId"), parsed.data);
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return jsonError(c, 400, "VALIDATION", { body: "must be JSON" });
    }
    const parsed = ContractUpdate.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const row = await updateContract(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteContract(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
