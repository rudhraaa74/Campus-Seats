// ─────────────────────────────────────────────────────────────
// backend/src/db/transaction.js
// Executes operations inside an explicit PostgreSQL transaction
// ─────────────────────────────────────────────────────────────

import { pool } from './pool.js';

/**
 * Executes a callback within a managed database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
