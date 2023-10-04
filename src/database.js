import fs from 'fs';
import sqlite3 from 'sqlite3';

const schema = fs.readFileSync('./src/schema.sql').toString();
const connect = new Promise((resolve, reject) => {
  const result = new sqlite3.Database('./.data/application.db', (error) => {
    if (error) {
      reject(error);
    } else {
      console.log('i have hereby connected :)')
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

const query = (method) => async (...args) => {
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
}

const run = query('run');
const get = query('get');
const all = query('all');

export const getSetting = async (name) => {
  const result = await get('select value from settings where name = ?', name);

  if (!result) {
    return null;
  }

  const { value } = result;

  if (typeof value === 'string') {
    return JSON.parse(value);
  }

  return null;
}

export const getSettings = async (names) => {
  // TODO: There must be a way to get node-sqlite3 to accept parameters for an
  // `IN` clause but I cannot find it. For now let's naïvely assume that every
  // name matches this pattern. This probably isn't a requirement that's worth
  // enforcing elsewhere in business logic, and this exact bit of code will
  // likely like to weird bugs in the future, but for now it's maybe better to
  // be safe!
  if (!names.every(name => name.match(/^[a-z0-9-_ .\/]+$/i))) {
    throw new Error('Names contain unexpected characters');
  }

  const rows = await all(`
    select name, value
    from settings
    where name in (${names.map(n => `'${n}'`).join(',')})
  `);

  return Object.fromEntries(rows.map(({ name, value }) => [name, JSON.parse(value)]));
}

export const setSetting = async (name, value) => {
  const serializedValue = JSON.stringify(value);

  return run(
    `
      insert into settings (name, value)
      values (?, ?)
      on conflict (name) do update set value = ?
    `,
    name,
    serializedValue,
    serializedValue
  );
};
