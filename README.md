# MySQL Test

This is a test to investigate https://github.com/sidorares/node-mysql2/issues/939

If you are using `node-mysql2` and you get this error:

**Error: Can't add new command when connection is in closed state**

Then you've come to the right place.

The code in this repository reproduces the problem.  Read on below for a
solution (or at least a work-around).

## What is the Problem?

You have a long-lived app running with a database connection.  If the
connection sits idle for a while then MySQL will timeout the connection.
The default value (in my version of MySQL at least) is 28800 seconds (8 hours)
It can be changed via the `wait_timeout` variable in the MySQL configuration
file.

After 8 hours (or however long your `wait_timeout` is set to), your app tries
to execute a MySQL query and the connection has gone away.  `node-mysql`
throws the error: **Can't add new command when connection is in closed state**.

## What is the Solution

The TL;DR is to run queries through a pool instead of using a connection
directly.

This works OK:

```js
const pool = await mysql.createPool({
  // configuration options
});
await pool.execute('...your query...');
await pool.end();
```

Whereas this doesn't:

```js
const pool = await mysql.createPool({
  // configuration options
});
const connection = await pool.getConnection();
await connection.execute('...your query...');
await connection.release();
```

The reason is that the pool detects the closed connection, discards it and
creates a new one.

## Reproducing the Problem

These commands creates a MySQL 8 database in a docker container with a 10s
timeout.  You'll need to have [docker](https://www.docker.com/) installed
on yoru system.

There are some scripts in the `bin` directory to help with testing.  They're
mostly just wrappers around the relevant `docker` commands which I tend to
forget.

You first need to build the container then bring it up.

```bash
$ bin/build
$ bin/up
```

Watch the logs.

```bash
$ bin/logs -f
```

Wait until you see `/usr/sbin/mysqld: ready for connections.` then hit
Ctrl-C.

To test it's working you should then be able to run `mysql` from inside
the container.

```bash
$ bin/mysql
Welcome to the MySQL monitor.  ...blah...

foo > show tables;
+---------------+
| Tables_in_foo |
+---------------+
| thing         |
+---------------+
1 row in set (0.00 sec)

foo > exit
```

It should also be proxied to a local port on your machine.  You should also
be able to connect like this:

```bash
$ bin/mysql-proxy
Welcome to the MySQL monitor.  ...blah...

foo proxy > show tables;
+---------------+
| Tables_in_foo |
+---------------+
| thing         |
+---------------+
1 row in set (0.01 sec)

foo proxy > exit
```

When you're done using the container (after running the tests below) you can
bring it down with:

```bash
$ bin/down
```

## Running the Test Scripts

First install the dependencies.

```bash
$ cd jsapp
$ pnpm install
$ cd ..
```

NOTE: you need to run the script from the parent directory so that `dotenv`
can find the `.env` file.s

The first script `01_connection.js` uses a direct connection to the database.

```js
const connection = await mysql.createConnection(config);
await insertThings(connection);
connection.destroy();
```

The `insertThings()` function inserts three records: one immediately, one
after 1 second, and other after 12 seconds.  The third one should fail
because the connection timeout of 10 seconds has been exceeded since the
previous command.

```
$ ./jsapp/01_connection.js
adding thing-1
added thing-1 as #100
adding thing-2
added thing-2 as #101
adding thing-3
Error: Can't add new command when connection is in closed state
    at PromiseConnection.execute (/Users/abw/build/mysql-disconnect/jsapp/node_modules/.pnpm/mysql2@3.2.0/node_modules/mysql2/promise.js:111:22)
    at insertThing (file:///Users/abw/build/mysql-disconnect/jsapp/lib.js:38:20)
    at file:///Users/abw/build/mysql-disconnect/jsapp/lib.js:30:18
    at async insertThings (file:///Users/abw/build/mysql-disconnect/jsapp/lib.js:29:3)
    at async withConnection (file:///Users/abw/build/mysql-disconnect/jsapp/01_connection.js:8:3) {
  code: undefined,
  errno: undefined,
  sql: undefined,
  sqlState: undefined,
  sqlMessage: undefined
}
```

The second script uses a connection pool.  It acquires a connection from the
pool and then performs the same actions as above.

```js
const pool = await mysql.createPool({
  ...config,
  connectionLimit: 1,
});
const connection = await pool.getConnection();
await insertThings(connection);
await connection.release();
```

Again, it fails to insert the third record.

```
$ ./jsapp/02_pool_connection.js
adding thing-1
added thing-1 as #102
adding thing-2
added thing-2 as #103
adding thing-3
Error: Can't add new command when connection is in closed state
    at PromisePoolConnection.execute (/Users/abw/build/mysql-disconnect/jsapp/node_modules/.pnpm/mysql2@3.2.0/node_modules/mysql2/promise.js:111:22)
    at insertThing (file:///Users/abw/build/mysql-disconnect/jsapp/lib.js:38:20)
    at file:///Users/abw/build/mysql-disconnect/jsapp/lib.js:30:18
    at async insertThings (file:///Users/abw/build/mysql-disconnect/jsapp/lib.js:29:3)
    at async withPoolConnection (file:///Users/abw/build/mysql-disconnect/jsapp/02_pool_connection.js:16:3) {
  code: undefined,
  errno: undefined,
  sql: undefined,
  sqlState: undefined,
  sqlMessage: undefined
}
```

The third script executes all commands via the pool.

```js
async function withPool() {
  const pool = await mysql.createPool({
    ...config,
    connectionLimit: 1,
  });
  await insertThings(pool);
  await pool.end();
}
```

This works OK.

```
$ ./jsapp/03_pool.js
adding thing-1
added thing-1 as #104
adding thing-2
added thing-2 as #105
adding thing-3
added thing-3 as #106
```

The fourth script is one using my own database library,
[badger-database](https://www.npmjs.com/package/@abw/badger-database)
which is a wrapper around `mysql2` (and also supports Postgres and sqlite).

This was failing (which is how I came to investigate the problem).  I added
a workaround in version 1.1.26.

## The Solution (or Workaround)

The simple solution is to run queries through the pool object.

In my case I couldn't do that.  The `badger-database` library uses `Pool`
from [tarn](https://www.npmjs.com/package/tarn) for the connection pool.

It supports a `validate()` method which checks if the connection is valid.
If the connection is no longer valid it is removed from the pool and a new
connection is created.

The code looks something like this:

```js
const connectionPool = new Pool({
  create: () => {
    return mysql.createConnection(connectOptions);
  },
  validate: connection => {
    // work-around for https://github.com/sidorares/node-mysql2/issues/939
    return ! connection?.connection?._closing;
  },
  destroy: connection => {
    connection.destroy();
  },
});
```

(It doesn't look exactly like that, but if you want to see for yourself the
generic engine pool code is
[here](https://github.com/abw/badger-database-js/blob/master/src/Engine.js#L37)
and the MySQL specific part is [here](https://github.com/abw/badger-database-js/blob/master/src/Engine/Mysql.js#L15))

The `_closing` flag is set in the `end()` function of `connection.js`
(see [here](https://github.com/sidorares/node-mysql2/blob/master/lib/connection.js#L893)).
The `end()` function is called when the `end` event is emitted.  This happens
when the stream ends, which (I assume) is what happens when the connection
times out.

So if `connection.connection._closing` is true then the connection needs to
be renewed.
