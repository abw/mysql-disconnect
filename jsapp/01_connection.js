#!/usr/bin/env node
import mysql from 'mysql2/promise';
import { config, insertThings } from './lib.js'

async function withConnection() {
  const connection = await mysql.createConnection(config);
  await insertThings(connection);
  connection.destroy();
}

withConnection();
