import fs from 'fs';
import { readFile } from 'fs/promises';
import chalk from 'chalk';
import * as dotenv from "dotenv";

dotenv.config();

export const data = {
  "errorMessage": "Whoops! Error connecting to the database–please try again!",
  "setupMessage": "🚧 Whoops! Looks like the database isn't setup yet! 🚧"
}

let actorFileData = {};
try {
  const accountFile = await readFile(new URL('../account.json', import.meta.url));
  actorFileData = JSON.parse(accountFile);
  actorFileData.disabled = false;
} catch (e) {
  console.log("no account.json file found, assuming non-fediverse mode for now. restart the app to check again");
  actorFileData = { disabled: true };
}

export const actorInfo = actorFileData;
export const account = actorInfo.username || 'bookmarks';
export const domain = process.env.PROJECT_DOMAIN ? `${process.env.PROJECT_DOMAIN}.topher.social` : 'localhost'; // edit this if you have a custom domain

let instanceData = {};
try {
  const pkgFile = await readFile('package.json');
  instanceData = JSON.parse(pkgFile);
} catch (e) {
  console.log("unable to read package info");
}

export const instanceType = instanceData.name || 'postmarks';
export const instanceVersion = instanceData.version || 'undefined';

export function timeSince(ms)  {
  var timestamp = new Date(ms);
  var now = new Date(),
    secondsPast = (now.getTime() - timestamp) / 1000;
  if (secondsPast < 60) {
    return parseInt(secondsPast) + 's ago';
  }
  if (secondsPast < 3600) {
    return parseInt(secondsPast / 60) + 'm ago';
  }
  if (secondsPast <= 86400) {
    return parseInt(secondsPast / 3600) + 'h ago';
  }
  if (secondsPast > 86400) {
    const day = timestamp.getDate();
    const month = timestamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(" ", "");
    const year = timestamp.getFullYear() == now.getFullYear() ? "" : " " + timestamp.getFullYear();
    return day + " " + month + year;
  }
}

const getActualRequestDurationInMilliseconds = start => {
  const NS_PER_SEC = 1e9; //  convert to nanoseconds
  const NS_TO_MS = 1e6; // convert to milliseconds
  const diff = process.hrtime(start);
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

export function removeEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v !== ''));
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
    const account = result[1];
    const domain = result[2];

    const actorResult = actor.match(/^https?:\/\/([^\/]+)\/u(ser)?s?\/(.+)$/)
    if (actorResult?.length !== 4) {
      console.log(`found an unparseable actor: ${actor}. Report this to https://github.com/ckolderup/postmarks/issues !`);
    }

    return (account == actorResult[3] && domain == actorResult[1]);
}

export function simpleLogger(req, res, next) { //middleware function
  let current_datetime = new Date();
  let formatted_date =
    current_datetime.getFullYear() +
    "-" +
    (current_datetime.getMonth() + 1) +
    "-" +
    current_datetime.getDate() +
    " " +
    current_datetime.getHours() +
    ":" +
    current_datetime.getMinutes() +
    ":" +
    current_datetime.getSeconds();
  let method = req.method;
  let url = req.url;
  let status = res.statusCode;
  const start = process.hrtime();
  const durationInMilliseconds = getActualRequestDurationInMilliseconds(start);

  let log = `[${chalk.blue(formatted_date)}] ${method}:${url} ${status} ${chalk.red(durationInMilliseconds.toLocaleString() + "ms")}`;
  console.log(log);
  if (process.env.LOGGING_ENABLED === "true") {
    fs.appendFile("request_logs.txt", log + "\n", err => {
      if (err) {
        console.log(err);
      }
    });
  }
  next();
};
