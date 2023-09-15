import express from 'express';
import crypto from 'crypto';
import * as linkify from 'linkifyjs';
import { actorMatchesUsername, parseJSON } from '../../util.js';
import { signAndSend, getInboxFromActorProfile } from '../../activitypub.js';

import { signedGetJSON } from '../../signature.js';

const router = express.Router();

async function sendAcceptMessage(thebody, name, domain, req, res, targetDomain) {
  const db = req.app.get('apDb');
  const guid = crypto.randomBytes(16).toString('hex');
  const message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `https://${domain}/u/${name}/accept/${guid}`,
    type: 'Accept',
    actor: `https://${domain}/u/${name}`,
    object: thebody,
  };

  const inbox = await getInboxFromActorProfile(message.object.actor);

  signAndSend(message, name, domain, db, targetDomain, inbox);
}

async function handleFollowRequest(req, res) {
  const domain = req.app.get('domain');
  const apDb = req.app.get('apDb');

  const myURL = new URL(req.body.actor);
  const targetDomain = myURL.hostname;
  const name = req.body.object.replace(`https://${domain}/u/`, '');

  await sendAcceptMessage(req.body, name, domain, req, res, targetDomain);
  // Add the user to the DB of accounts that follow the account

  // get the followers JSON for the user
  const oldFollowersText = (await apDb.getFollowers()) || '[]';

  // update followers
  let followers = parseJSON(oldFollowersText);
  if (followers) {
    followers.push(req.body.actor);
    // unique items
    followers = [...new Set(followers)];
  } else {
    followers = [req.body.actor];
  }
  const newFollowersText = JSON.stringify(followers);
  try {
    // update into DB
    await apDb.setFollowers(newFollowersText);

    console.log('updated followers!');
  } catch (e) {
    console.log('error storing followers after follow', e);
  }

  return res.status(200);
}

async function handleUnfollow(req, res) {
  const domain = req.app.get('domain');
  const apDb = req.app.get('apDb');

  const myURL = new URL(req.body.actor);
  const targetDomain = myURL.hostname;
  const name = req.body.object.object.replace(`https://${domain}/u/`, '');

  await sendAcceptMessage(req.body, name, domain, req, res, targetDomain);

  // get the followers JSON for the user
  const oldFollowersText = (await apDb.getFollowers()) || '[]';

  // update followers
  const followers = parseJSON(oldFollowersText);
  if (followers) {
    followers.forEach((follower, idx) => {
      if (follower === req.body.actor) {
        followers.splice(idx, 1);
      }
    });
  }

  const newFollowersText = JSON.stringify(followers);

  try {
    await apDb.setFollowers(newFollowersText);
    return res.sendStatus(200);
  } catch (e) {
    console.log('error storing followers after unfollow', e);
    return res.status(500);
  }
}

async function handleFollowAccepted(req, res) {
  const apDb = req.app.get('apDb');

  const oldFollowingText = (await apDb.getFollowing()) || '[]';

  let follows = parseJSON(oldFollowingText);

  if (follows) {
    follows.push(req.body.actor);
    // unique items
    follows = [...new Set(follows)];
  } else {
    follows = [req.body.actor];
  }
  const newFollowingText = JSON.stringify(follows);

  try {
    // update into DB
    await apDb.setFollowing(newFollowingText);

    console.log('updated following!');
    return res.status(200);
  } catch (e) {
    console.log('error storing follows after follow action', e);
    return res.status(500);
  }
}

async function handleCommentOnBookmark(req, res, inReplyToGuid) {
  const apDb = req.app.get('apDb');

  const bookmarkId = await apDb.getBookmarkIdFromMessageGuid(inReplyToGuid);

  if (typeof bookmarkId !== 'number') {
    console.log("couldn't find a bookmark this message is related to");
    return res.sendStatus(400);
  }

  const bookmarkPermissions = await apDb.getPermissionsForBookmark(bookmarkId);
  const globalPermissions = await apDb.getGlobalPermissions();

  const bookmarkBlocks = bookmarkPermissions?.blocked?.split('\n') || [];
  const globalBlocks = globalPermissions?.blocked?.split('\n') || [];

  const bookmarkAllows = bookmarkPermissions?.allowed?.split('\n') || [];
  const globalAllows = globalPermissions?.allowed?.split('\n') || [];

  const blocklist = bookmarkBlocks.concat(globalBlocks).filter((x) => x.match(/^@([^@]+)@(.+)$/));
  const allowlist = bookmarkAllows.concat(globalAllows).filter((x) => x.match(/^@([^@]+)@(.+)$/));

  if (blocklist.length > 0 && blocklist.map((username) => actorMatchesUsername(req.body.actor, username)).some((x) => x)) {
    console.log(`Actor ${req.body.actor} matches a blocklist item, ignoring comment`);
    return res.sendStatus(403);
  }

  const response = await signedGetJSON(req.body.actor);
  const data = await response.json();

  const actorDomain = new URL(req.body.actor)?.hostname;
  const actorUsername = data.preferredUsername;
  const actor = `@${actorUsername}@${actorDomain}`;

  const commentUrl = req.body.object.id;
  let visible = 0;
  if (allowlist.map((username) => actorMatchesUsername(req.body.actor, username)).some((x) => x)) {
    console.log(`Actor ${req.body.actor} matches an allowlist item, marking comment visible`);
    visible = 1;
  }

  const bookmarksDb = req.app.get('bookmarksDb');

  bookmarksDb.createComment(bookmarkId, actor, commentUrl, req.body.object.content, visible);

  return res.status(200);
}

async function handleFollowedPost(req, res) {
  const urls = linkify.find(req.body.object.content);
  if (urls?.length > 0) {
    // store this for now
    // TODO: determine if the actor is in your current follow list!

    const response = await signedGetJSON(`${req.body.actor}.json`);
    const data = await response.json();

    const actorDomain = new URL(req.body.actor)?.hostname;
    const actorUsername = data.preferredUsername;
    const actor = `@${actorUsername}@${actorDomain}`;

    const commentUrl = req.body.object.id;

    const bookmarksDb = req.app.get('bookmarksDb');

    bookmarksDb.createComment(undefined, actor, commentUrl, req.body.object.content, false);
  }

  return res.status(200);
}

async function handleDeleteRequest(req, res) {
  console.log(JSON.stringify(req.body));

  const bookmarksDb = req.app.get('bookmarksDb');

  const commentId = req.body?.object?.id;

  if (commentId) {
    await bookmarksDb.deleteComment(commentId);
  }

  return res.status(200);
}

router.post('/', async function (req, res) {
  // console.log(JSON.stringify(req.body));

  if (typeof req.body.object === 'string' && req.body.type === 'Follow') {
    return handleFollowRequest(req, res);
  }

  if (req.body.type === 'Undo' && req.body.object?.type === 'Follow') {
    return handleUnfollow(req, res);
  }
  if (req.body.type === 'Accept' && req.body.object?.type === 'Follow') {
    return handleFollowAccepted(req, res);
  }
  if (req.body.type === 'Delete') {
    return handleDeleteRequest(req, res);
  }
  if (req.body.type === 'Create' && req.body.object?.type === 'Note') {
    console.log(JSON.stringify(req.body));

    const domain = req.app.get('domain');
    const inReplyToGuid = req.body.object?.inReplyTo?.match(`https://${domain}/m/(.+)`)?.[1];

    if (inReplyToGuid) {
      return handleCommentOnBookmark(req, res, inReplyToGuid);
    }
    return handleFollowedPost(req, res);
  }
  return res.sendStatus(400);
});

export default router;
