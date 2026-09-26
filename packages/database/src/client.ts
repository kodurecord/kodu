/**
 * KODU Database Client
 *
 * Thin wrapper around the D1Database binding.
 * Workers access D1 through the Cloudflare runtime — there is no connection
 * string. This module creates a typed client that repositories can depend on.
 *
 * All Workers in the KODU ecosystem receive `env.DB` via their wrangler.jsonc
 * binding. Pass it here to get a client; the client is then injected into
 * repository constructors.
 *
 * Why a wrapper? It lets us swap the underlying storage engine in tests or
 * future migrations without touching repository code.
 */

export interface KoduD1Client {
  /** Execute a single query and return rows. */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | boolean | null)[]
  ): Promise<T[]>;

  /** Execute a query and return the first row, or null. */
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | boolean | null)[]
  ): Promise<T | null>;

  /** Execute a write statement; returns changes count and last_row_id. */
  run(
    sql: string,
    params?: (string | number | boolean | null)[]
  ): Promise<{ changes: number; last_row_id: number }>;

  /** Execute multiple statements as a batch (atomic). */
  batch(
    statements: Array<{
      sql: string;
      params?: (string | number | boolean | null)[];
    }>
  ): Promise<void>;
}

/**
 * Create a KoduD1Client from a Cloudflare D1Database binding.
 *
 * Usage in a Worker:
 *   import { createClient } from '@kodu/database';
 *   const db = createClient(env.DB);
 */
export function createClient(d1: D1Database): KoduD1Client {
  return {
    async query<T>(
      sql: string,
      params: (string | number | boolean | null)[] = []
    ): Promise<T[]> {
      const stmt = d1.prepare(sql);
      const bound = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await bound.all<T>();
      return result.results ?? [];
    },

    async queryOne<T>(
      sql: string,
      params: (string | number | boolean | null)[] = []
    ): Promise<T | null> {
      const stmt = d1.prepare(sql);
      const bound = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await bound.first<T>();
      return result ?? null;
    },

    async run(
      sql: string,
      params: (string | number | boolean | null)[] = []
    ): Promise<{ changes: number; last_row_id: number }> {
      const stmt = d1.prepare(sql);
      const bound = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await bound.run();
      return {
        changes: result.meta?.changes ?? 0,
        last_row_id: result.meta?.last_row_id ?? 0,
      };
    },

    async batch(
      statements: Array<{
        sql: string;
        params?: (string | number | boolean | null)[];
      }>
    ): Promise<void> {
      const prepared = statements.map(({ sql, params = [] }) => {
        const stmt = d1.prepare(sql);
        return params.length > 0 ? stmt.bind(...params) : stmt;
      });
      await d1.batch(prepared);
    },
  };
}
