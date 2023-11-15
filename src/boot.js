import crypto from 'crypto';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { readFile } from 'fs/promises';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import * as db from './database.js';
import { ACTOR_SETTING_NAMES } from './util.js';

dotenv.config();

const IS_ACTIVITYPUB_DB_IMPORTED = 'isActivitypubDbImported';
const IS_ACCOUNT_FILE_IMPORTED = 'isAccountFileImported';

// If we don't have public and private keys, generate them
const generateKeys = async () => {
  const { PUBLIC_KEY, PRIVATE_KEY } = db;

  const existingKeys = await db.settings.all([PUBLIC_KEY, PRIVATE_KEY]);

  if (existingKeys[PUBLIC_KEY] && existingKeys[PRIVATE_KEY]) {
    return;
  }

  await new Promise((resolve, reject) => {
    crypto.generateKeyPair(
      'rsa',
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      },
      async (err, publicKey, privateKey) => {
        if (err) {
          return reject(err);
        }

        await db.settings.set({
          [PUBLIC_KEY]: publicKey,
          [PRIVATE_KEY]: privateKey,
        });

        return resolve();
      },
    );
  });
};

// If a legacy activitypub.db database exists and hasn't already been added to
// application.db, import it and inform the user
const importActivitypubDb = async () => {
  const dbFile = './.data/activitypub.db';

  if (!fs.existsSync(dbFile)) {
    return;
  }

  const isActivitypubDbImported = await db.settings.get(IS_ACTIVITYPUB_DB_IMPORTED);

  if (isActivitypubDbImported) {
    console.log('Postmarks detected an activitypub.db file that will no longer be read. You should remove this file.');
    return;
  }

  const legacyApDb = await open({ filename: dbFile, driver: sqlite3.Database });
  const legacyAccount = await legacyApDb.get(`
    select
      name,
      actor as actorJson,
      privkey as privateKey,
      pubkey as publicKey,
      followers,
      following,
      blocks
    from accounts
    limit 1
  `);

  // There is theoretically an edge case where there's no account record in
  // activitypub.db but there are messages and permissions. Let's choose to not
  // preserve the data in that edge case.
  if (!legacyAccount) {
    return;
  }

  let newSettings = {
    username: legacyAccount.username,
    publicKey: legacyAccount.publicKey,
    privateKey: legacyAccount.privateKey,
  };

  if (legacyAccount.actorJson) {
    const actor = JSON.parse(legacyAccount.actorJson);
    newSettings = {
      ...newSettings,
      displayName: actor.name,
      description: actor.summary,
      avatar: actor.icon.url,
    };
  }

  newSettings = Object.fromEntries(Object.entries(newSettings).filter(([, value]) => Boolean(value)));

  newSettings[IS_ACTIVITYPUB_DB_IMPORTED] = true;

  if (Object.keys(newSettings).length) {
    await db.settings.set(newSettings);
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const key of ['followers', 'following', 'blocks']) {
    const records = JSON.parse(legacyAccount[key] || '[]').map((actor) => ({ actor }));

    if (records.length) {
      const [insert, values] = db.buildInsert(records);
      // eslint-disable-next-line no-await-in-loop
      await db.run(`insert into ${key} ${insert}`, values);
    }
  }

  const messages = await legacyApDb.all('select guid, message, bookmark_id from messages');

  if (messages.length) {
    const [insert, values] = db.buildInsert(messages);
    await db.run(`insert into messages ${insert}`, values);
  }

  const legacyPermissions = await legacyApDb.all('select bookmark_id, allowed, blocked from permissions');

  const permissions = [];

  legacyPermissions.forEach(({ bookmark_id: bookmarkId, allowed, blocked }) => {
    JSON.parse(allowed).forEach((actor) => {
      permissions.push({ bookmark_id: bookmarkId, actor, status: 1 });
    });

    JSON.parse(blocked).forEach((actor) => {
      permissions.push({ bookmark_id: bookmarkId, actor, status: 0 });
    });
  });

  if (permissions.length) {
    const [insert, values] = db.buildInsert(permissions);
    await db.run(`insert into permissions ${insert}`, values);
  }

  await db.settings.set({
    [IS_ACTIVITYPUB_DB_IMPORTED]: true,
  });

  console.log('Your activitypub.db file has been imported to the database. You should now remove this file.');
};

// If a legacy account.json database exists and hasn't already been added to
// application.db, import it and inform the user
const importAccountJson = async () => {
  const jsonPath = new URL('../account.json', import.meta.url);

  if (!fs.existsSync(jsonPath)) {
    return;
  }

  const isAccountFileImported = await db.settings.get(IS_ACCOUNT_FILE_IMPORTED);

  if (isAccountFileImported) {
    console.log('Postmarks detected an account.json file that will no longer be read. You should remove this file.');
    return;
  }

  const accountFile = await readFile(jsonPath);
  const accountFileData = JSON.parse(accountFile);

  await db.settings.set({
    ...Object.fromEntries(Object.entries(accountFileData).filter(([name]) => ACTOR_SETTING_NAMES.includes(name))),
    [IS_ACCOUNT_FILE_IMPORTED]: true,
  });

  console.log('Your account.json file has been imported to the database. You should now remove this file.');
};

const boot = async () => {
  await generateKeys();
  await importActivitypubDb();
  await importAccountJson();
};

await boot();
