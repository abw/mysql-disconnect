#!/usr/bin/env node
import mysql from 'mysql2/promise';
import { config, insertThings } from './lib.js'

async function withPool() {
  const pool = await mysql.createPool({
    ...config,
    connectionLimit: 1,
  });
  await insertThings(pool);
  await pool.end();
}

withPool();
