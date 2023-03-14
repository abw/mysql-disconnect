import dotenv from 'dotenv'
import process from 'node:process'
dotenv.config();

const env      = process.env;
const host     = 'localhost'
const port     = env.HOST_DATABASE_PORT;
const database = env.MYSQL_DATABASE
const user     = env.MYSQL_USER
const password = env.MYSQL_PASSWORD

export const config = ({
  host, port, database, user, password
});

export function sleep(s) {
  return new Promise(r => setTimeout(r, s * 1000))
}

export async function insertThings(connection) {
  await connection.execute('DELETE FROM `thing`');

  await insertThing(connection, 1);

  await sleep(1)
    .then( () => insertThing(connection, 2) )
    .catch(console.log);

  await sleep(12)
    .then( () => insertThing(connection, 3) )
    .catch(console.log);
}

export async function insertThing(connection, n) {
  const thing = `thing-${n}`;
  console.log(`adding ${thing}`);

  await connection.execute(
    'INSERT INTO `thing` (`name`) VALUES (?)', [thing]
  );

  const [rows, fields] = await connection.execute(
    'SELECT * FROM `thing` WHERE `name`=?', [thing]
  );
  const id = rows[0].id;
  console.log(`added ${thing} as #${id}`);
}

