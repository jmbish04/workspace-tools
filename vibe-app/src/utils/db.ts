import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { drizzle } from "drizzle-orm/d1";

export interface Database {
  test_defs: {
    id: string;
    name: string;
    description: string;
    category: string | null;
    severity: string | null;
    is_active: number;
    error_map: string | null;
    created_at: string;
  };
  test_results: {
    id: string;
    session_uuid: string;
    test_fk: string;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    status: 'pass' | 'fail';
    error_code: string | null;
    raw: string | null;
    ai_human_readable_error_description: string | null;
    ai_prompt_to_fix_error: string | null;
    created_at: string;
  };
}

// Exports a Kysely client wired to D1
export function getKysely(dbBinding: D1Database) {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: dbBinding }),
  });
}

// Exports a Drizzle client wired to D1
export function getDrizzle(dbBinding: D1Database) {
  return drizzle(dbBinding);
}

// Helpers
export async function listActiveTests(dbBinding: D1Database) {
  const db = getKysely(dbBinding);
  return db.selectFrom('test_defs')
    .selectAll()
    .where('is_active', '=', 1)
    .execute();
}

export async function insertTestResult(dbBinding: D1Database, result: any) {
  const db = getKysely(dbBinding);
  return db.insertInto('test_results')
    .values({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...result
    })
    .execute();
}

export async function getLatestSession(dbBinding: D1Database) {
  const db = getKysely(dbBinding);
  // Find the most recent session UUID
  const latestRow = await db.selectFrom('test_results')
    .select('session_uuid')
    .orderBy('started_at', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (!latestRow) return [];

  return db.selectFrom('test_results')
    .selectAll()
    .where('session_uuid', '=', latestRow.session_uuid)
    .execute();
}
