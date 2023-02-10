/**
 * Module handles activitypub data management
 *
 * Server API calls the methods in here to query and update the SQLite database
 */

// Utilities we need
import * as path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";
import { account, domain, actorInfo } from "./util.js";

// Initialize the database
const dbFile = "./.data/activitypub.db";
const exists = fs.existsSync(dbFile);
let db;

function actorJson(name, domain, actorInfo, pubkey) {
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],

    id: `https://${domain}/u/${name}`,
    type: "Person",
    preferredUsername: `${name}`,
    name: actorInfo.displayName,
    summary: actorInfo.description,
    icon: {
      type: "Image",
      mediaType: `image/${path.extname(actorInfo.avatar).slice(1)}`,
      url: actorInfo.avatar,
    },
    inbox: `https://${domain}/api/inbox`,
    followers: `https://${domain}/u/${name}/followers`,

    publicKey: {
      id: `https://${domain}/u/${name}#main-key`,
      owner: `https://${domain}/u/${name}`,
      publicKeyPem: pubkey,
    },
  };
}

function webfingerJson(name, domain) {
  return {
    subject: `acct:${name}@${domain}`,

    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${domain}/u/${name}`,
      },
    ],
  };
}

open({
  filename: dbFile,
  driver: sqlite3.Database,
}).then(async (dBase) => {
  db = dBase;

  const actorName = `${account}@${domain}`;
  let publicKey = null;

  try {
    if (!exists) {
      const newDb = new sqlite3.Database(
        dbFile,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            console.log(`unable to open or create database: ${err}`);
            process.exit(1);
          }
        }
      );

      newDb.close();

      // now do it again, using the async/await library
      await open({
        filename: dbFile,
        driver: sqlite3.Database,
      }).then(async (dBase) => {
        db = dBase;
      });

      await db.run(
        "CREATE TABLE IF NOT EXISTS accounts (name TEXT PRIMARY KEY, privkey TEXT, pubkey TEXT, webfinger TEXT, actor TEXT, followers TEXT, messages TEXT)"
      );
      // if there is no `messages` table in the DB, create an empty table
      // TODO: index messages on bookmark_id
      await db.run(
        "CREATE TABLE IF NOT EXISTS messages (guid TEXT PRIMARY KEY, message TEXT, bookmark_id INTEGER)"
      );
      await db.run(
        "CREATE TABLE IF NOT EXISTS permissions (bookmark_id INTEGER NOT NULL UNIQUE, allowed TEXT, blocked TEXT)"
      );

      crypto.generateKeyPair(
        "rsa",
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        },
        async (err, generatedPublicKey, generatedPrivateKey) => {
          try {
            publicKey = generatedPublicKey;
            const actorRecord = actorJson(account, domain, actorInfo, publicKey);
            const webfingerRecord = webfingerJson(account, domain);

            await db.run(
              `INSERT OR REPLACE INTO accounts (name, actor, pubkey, privkey, webfinger) VALUES (?, ?, ?, ?, ?)`,
              actorName,
              JSON.stringify(actorRecord),
              generatedPublicKey,
              generatedPrivateKey,
              JSON.stringify(webfingerRecord)
            );
          } catch (e) {
            console.log(e);
          }
        }
      );
    }

    // re-run the profile portion of the actor setup every time in case the avatar, description, etc have changed
    const actorRecord = actorJson(account, domain, actorInfo, publicKey);
    await db.run(`UPDATE accounts SET name = ?, actor = ?`, actorName, JSON.stringify(actorRecord));
  } catch (dbError) {
    console.error(dbError);
  }
});

export async function getFollowers(name) {
  const followers = await db.get("select followers from accounts limit 1",)
  return followers || [];
}

export async function setFollowers(followersJson, name) {
  return await db.run(
    "update accounts set followers=?",
    followersJson
  );
}

export async function getActor(name) {
  return (await db.get("select actor from accounts limit 1"))[0];
}

export async function getWebfinger(name) {
  return (await db.get("select webfinger from accounts limit 1"))[0];
}

export async function getGuidForBookmarkId(id) {
  return (await db.get("select guid from messages where bookmark_id = ?", id))
    ?.guid;
}

export async function getBookmarkIdFromMessageGuid(guid) {
  return (await db.get("select bookmark_id from messages where guid = ?", guid))
    ?.bookmark_id;
}

export async function getMessage(guid) {
  return await db.get("select message from messages where guid = ?", guid);
}

export async function getPrivateKey(name) {
  return (await db.get("select privkey from accounts limit 1"))[0];
}

export async function getGlobalPermissions() {
  return await db.get("select * from permissions where bookmark_id = 0");
}

export async function setGlobalPermissions(allowed, blocked) {
  return await setPermissionsForBookmark(0, allowed, blocked);
}

export async function setPermissionsForBookmark(id, allowed, blocked) {
  return await db.run(
    "insert or replace into permissions(bookmark_id, allowed, blocked) values (?, ?, ?)",
    id,
    allowed,
    blocked
  );
}

export async function getPermissionsForBookmark(id) {
  return await db.get("select * from permissions where bookmark_id = ?", id);
}

export async function insertMessage(guid, bookmarkId, json) {
  return await db.run(
    "insert or replace into messages(guid, bookmark_id, message) values(?, ?, ?)",
    guid,
    bookmarkId,
    json
  );
}
