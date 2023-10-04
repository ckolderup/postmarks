import fs from 'fs';
import { readFile } from 'fs/promises';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import * as db from './database.js';

dotenv.config();

const ACTOR_SETTING_NAMES = ['username', 'avatar', 'displayName', 'description'];
const IS_ACCOUNT_FILE_IMPORTED = 'isAccountFileImported';

export const data = {
  errorMessage: 'Whoops! Error connecting to the database–please try again!',
  setupMessage: "🚧 Whoops! Looks like the database isn't setup yet! 🚧",
};

try {
  const accountFile = await readFile(new URL('../account.json', import.meta.url));
  const accountFileData = JSON.parse(accountFile);
  const isAccountFileImported = await db.getSetting(IS_ACCOUNT_FILE_IMPORTED);
  if (isAccountFileImported) {
    console.log('Postmarks detected an account.json file that will no longer be read. You should remove this file.');
  } else {
    await db.setSettings({
      ...Object.fromEntries(Object.entries(accountFileData).filter(([name]) => ACTOR_SETTING_NAMES.includes(name))),
      [IS_ACCOUNT_FILE_IMPORTED]: true,
    });
    console.log('Your account.json file has been imported to the database. You should now remove this file.');
  }
} catch (e) {
  // TODO: Check for existence of account.json instead of catching error
  console.log('Failed to read account.json', e);
}

export const getActorInfo = () => db.getSettings(ACTOR_SETTING_NAMES);

export const domain = (() => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  if (process.env.PROJECT_DOMAIN) {
    return `${process.env.PROJECT_DOMAIN}.glitch.me`;
  }

  console.log("didn't find a PUBLIC_BASE_URL or PROJECT_DOMAIN in env, assuming localhost");
  return 'localhost';
})();

let instanceData = {};
try {
  const pkgFile = await readFile('package.json');
  instanceData = JSON.parse(pkgFile);
} catch (e) {
  console.log('unable to read package info');
}

export const instanceType = instanceData.name || 'postmarks';
export const instanceVersion = instanceData.version || 'undefined';

export function timeSince(ms) {
  const timestamp = new Date(ms);
  const now = new Date(new Date().toUTCString());
  const secondsPast = (now - timestamp) / 1000;
  if (secondsPast < 60) {
    return `${parseInt(secondsPast, 10)}s ago`;
  }
  if (secondsPast < 3600) {
    return `${parseInt(secondsPast / 60, 10)}m ago`;
  }
  if (secondsPast <= 86400) {
    return `${parseInt(secondsPast / 3600, 10)}h ago`;
  }
  if (secondsPast > 86400) {
    const day = timestamp.getDate();
    const month = timestamp
      .toDateString()
      .match(/ [a-zA-Z]*/)[0]
      .replace(' ', '');
    const year = timestamp.getFullYear() === now.getFullYear() ? '' : ` ${timestamp.getFullYear()}`;
    return `${day} ${month}${year}`;
  }
  return undefined;
}

const getActualRequestDurationInMilliseconds = (start) => {
  const NS_PER_SEC = 1e9; //  convert to nanoseconds
  const NS_TO_MS = 1e6; // convert to milliseconds
  const diff = process.hrtime(start);
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

export function removeEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));
}

export function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// I like being able to refer to people like I would on Mastodon
// i.e. @username@instance.tld. But lots of activitypub stuff treats the
// identifier for an actor as the URL that represents their profile,
// i.e https://instance.tld/user/username.
// this function takes the two and tries to determine via some terrifying
// and brittle regex work if they're the same.
export function actorMatchesUsername(actor, username) {
  if (!username) {
    return false;
  }
  const result = username.match(/^@([^@]+)@(.+)$/);
  if (result?.length !== 3) {
    console.log(`match on ${username} isn't parseable. Blocks should be specified as @username@domain.tld.`);
    return false;
  }
  const actorAccount = result[1];
  const actorDomain = result[2];

  const actorResult = actor.match(/^https?:\/\/([^/]+)\/u(ser)?s?\/(.+)$/);
  if (actorResult?.length !== 4) {
    console.log(`found an unparseable actor: ${actor}. Report this to https://github.com/ckolderup/postmarks/issues !`);
  }

  return actorAccount === actorResult[3] && actorDomain === actorResult[1];
}

export function replaceEmptyText(currentValue, defaultValue) {
  if (!currentValue || currentValue?.trim().replace(/\n/g, '') === '') {
    return defaultValue;
  }
  return currentValue;
}

export function simpleLogger(req, res, next) {
  // middleware function
  const currentDatetime = new Date();
  const formattedDate = `${currentDatetime.getFullYear()}-${
    currentDatetime.getMonth() + 1
  }-${currentDatetime.getDate()} ${currentDatetime.getHours()}:${currentDatetime.getMinutes()}:${currentDatetime.getSeconds()}`;
  const { method } = req;
  const { url } = req;
  const status = res.statusCode;
  const start = process.hrtime();
  const durationInMilliseconds = getActualRequestDurationInMilliseconds(start);

  const log = `[${chalk.blue(formattedDate)}] ${method}:${url} ${status} ${chalk.red(`${durationInMilliseconds.toLocaleString()}ms`)}`;
  console.log(log);
  if (process.env.LOGGING_ENABLED === 'true') {
    fs.appendFile('request_logs.txt', `${log}\n`, (err) => {
      if (err) {
        console.log(err);
      }
    });
  }
  next();
}
