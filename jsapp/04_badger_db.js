#!/usr/bin/env node
import connect from '@abw/badger-database'
import { config, sleep } from './lib.js'

async function badgerDatabase() {
  const db = connect({
    database: {
      ...config,
      engine: 'mysql',
    },
    pool: {
      min: 1,
      max: 1
    }
  });
  await insertThings(db);
  db.disconnect();
}

export async function insertThings(db) {
  await db.run('DELETE FROM `thing`');

  await insertThing(db, 1);

  await sleep(1)
    .then( () => insertThing(db, 2) )
    .catch(console.log);

  await sleep(12)
    .then( () => insertThing(db, 3) )
    .catch(console.log);
}

export async function insertThing(db, n) {
  const thing = `thing-${n}`;
  console.log(`adding ${thing}`);

  await db.run(
    'INSERT INTO `thing` (`name`) VALUES (?)', [thing]
  );

  const row = await db.one(
    'SELECT * FROM `thing` WHERE `name`=?', [thing]
  );
  const id = row.id;
  console.log(`added ${thing} as #${id}`);
}


badgerDatabase();
