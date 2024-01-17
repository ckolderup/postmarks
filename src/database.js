import fs from 'fs';
import sqlite3 from 'sqlite3';

export const PUBLIC_KEY = 'publicKey';
export const PRIVATE_KEY = 'privateKey';

const schema = fs.readFileSync('./src/schema.sql').toString();
const connect = new Promise((resolve, reject) => {
  const result = new sqlite3.Database('./.data/application.db', (error) => {
    if (error) {
      reject(error);
    } else {
      result.exec(schema, (execError) => {
        if (execError) {
          reject(execError);
        } else {
          resolve(result);
        }
      });
    }
  });
});

const query =
  (method) =>
  async (...args) => {
    const db = await connect;
    return new Promise((resolve, reject) => {
      db[method](...args, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  };

export const run = query('run');
export const get = query('get');
export const all = query('all');

export const settings = {
  all: async (names) => {
    // TODO: There must be a way to get node-sqlite3 to accept parameters for an
    // `IN` clause but I cannot find it. For now let's naïvely assume that every
    // name matches this pattern. This probably isn't a requirement that's worth
    // enforcing elsewhere in business logic, and this exact bit of code will
    // likely lead to weird bugs in the future, but for now it's maybe better to
    // be safe!
    if (!names.every((name) => name.match(/^[a-z0-9-_ ./]+$/i))) {
      throw new Error('Names contain unexpected characters');
    }

    const rows = await all(`
      select name, value
      from settings
      where name in (${names.map((n) => `'${n}'`).join(',')})
    `);

    // For the caller of this function, a setting that isn't actually written to
    // the database should be indistinguishable from a value that is set to
    // `null`, so we backfill any missing settings to our results.
    return {
      ...Object.fromEntries(names.map((name) => [name, null])),
      ...Object.fromEntries(rows.map(({ name, value }) => [name, JSON.parse(value)])),
    };
  },
  get: (name) => settings.all([name])[0],
  set: async (obj) => {
    // TODO: See caveat in settings.all
    if (!Object.keys(obj).every((name) => name.match(/^[a-z0-9-_ ./]+$/i))) {
      throw new Error('Names contain unexpected characters');
    }

    const values = Object.entries(obj).map(
      ([name, value]) =>
        // TODO: Escape this properly
        `('${name}', '${JSON.stringify(value).replace("'", "\\'")}')`,
    );

    await run(`
      insert into settings
      (name, value)
      values ${values.join(',')}
      on conflict (name) do update set value = excluded.value
    `);
  },
};

export const getPublicKey = () => settings.get(PUBLIC_KEY);
export const getPrivateKey = () => settings.get(PRIVATE_KEY);

// Returns an array with two items: a string and an array of values. The string
// is a fragment of an SQL insert statement that comes after
// `insert into table_name` and includes columns and placeholder values; the
// array is a flat list of values that correspond to the placeholders.
export const buildInsert = (records) => {
  const recordsArray = records instanceof Array ? records : [records];

  if (!recordsArray.every((r) => typeof r === 'object')) {
    throw new Error('`records` must be either an object or an array of objects');
  }

  if (!recordsArray.length) {
    throw new Error('No records provided');
  }

  // Get a unique, sorted list of all the keys in all the records
  const columns = recordsArray
    .map(Object.keys)
    .flat()
    .filter((m, i, a) => a.indexOf(m) === i)
    .sort();

  const keysTest = columns.join(',');

  if (!recordsArray.every((r) => Object.keys(r).sort().join(',') === keysTest)) {
    throw new Error('Every object in `records` must contain exactly the same keys');
  }

  // This check is naïve but should prevent SQL injections
  columns.forEach((column) => {
    if (!column.match(/^[a-z][a-z_]*$/)) {
      throw new Error(`Invalid column name "${column}"`);
    }
  });

  // Creates a string like '(?,?,?)' where each `?` corresponds to one string in
  // `columns`
  const recordString = `(${new Array(columns.length).fill('?').join(',')})`;

  return [
    `(${columns.join(',')}) values ${new Array(records.length).fill(recordString).join(',')}`,
    records.map((r) => columns.map((c) => r[c])).flat(),
  ];
};
