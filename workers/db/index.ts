import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof makeDb>;

export function makeDb(env: Env) {
  const client = postgres(env.HYPERDRIVE.connectionString, {
    prepare: false,
    max: 5,
    fetch_types: false,
  });
  return drizzle(client, { schema });
}

export * as schema from "./schema";
