#!/usr/bin/env node
import mysql from 'mysql2/promise';
import { config, insertThings } from './lib.js'

async function withPoolConnection() {
  const pool = await mysql.createPool({
    ...config,
    connectionLimit: 1,
  });
  const connection = await pool.getConnection();
  await insertThings(connection);
  await connection.release();
}

withPoolConnection();
