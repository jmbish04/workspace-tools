import { getKysely, insertTestResult } from "../utils/db";
import { analyzeFailure } from "../utils/ai";
import { DEFAULT_TESTS } from "./defs";
import type { Env } from "../types";

export async function runAllTests(env: Env, session_uuid: string) {
  const db = getKysely(env.DB);

  // Seed if empty
  let activeTests = await db.selectFrom('test_defs').selectAll().where('is_active', '=', 1).execute();
  if (activeTests.length === 0) {
    for (const test of DEFAULT_TESTS) {
      await db.insertInto('test_defs').values({
        ...test,
        created_at: new Date().toISOString()
      }).execute();
    }
    activeTests = await db.selectFrom('test_defs').selectAll().where('is_active', '=', 1).execute();
  }

  const concurrency = 3;
  const running: Promise<void>[] = [];

  for (const testDef of activeTests) {
    if (running.length >= concurrency) {
      await Promise.race(running);
    }

    const p = (async () => {
      const start = Date.now();
      let status: 'pass' | 'fail' = 'pass';
      let errCode = null;
      let raw = null;
      let aiDesc = null;
      let aiPrompt = null;

      try {
        // MOCK execution logic (replace with real checks)
        const passed = Math.random() > 0.3; // 30% fail rate for demo
        if (!passed) {
          throw new Error("MOCK_FAIL_RANDOM");
        }
        raw = JSON.stringify({ message: "OK" });
      } catch (e: any) {
        status = 'fail';
        errCode = "RUNTIME_ERR";
        raw = JSON.stringify({ error: e.message || String(e) });

        // AI Analysis
        const analysis = await analyzeFailure(env, testDef.name, raw);
        aiDesc = analysis.description;
        aiPrompt = analysis.prompt;
      }

      const duration = Date.now() - start;

      await insertTestResult(env.DB, {
        session_uuid,
        test_fk: testDef.id,
        started_at: new Date(start).toISOString(),
        finished_at: new Date(start + duration).toISOString(),
        duration_ms: duration,
        status,
        error_code: errCode,
        raw,
        ai_human_readable_error_description: aiDesc,
        ai_prompt_to_fix_error: aiPrompt,
      });
    })();

    running.push(p);
    p.finally(() => {
      running.splice(running.indexOf(p), 1);
    });
  }

  await Promise.all(running);
  return { success: true, session_uuid };
}
