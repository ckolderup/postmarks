import express from 'express';
import crypto from 'crypto';
import * as linkify from 'linkifyjs';
import * as db from '../../database.js';
import { actorMatchesUsername } from '../../util.js';
import { signAndSend, getInboxFromActorProfile } from '../../activitypub.js';

import { signedGetJSON } from '../../signature.js';

const router = express.Router();

async function sendAcceptMessage(thebody, name, domain, req, res, targetDomain) {
  const guid = crypto.randomBytes(16).toString('hex');
  const message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `https://${domain}/u/${name}/accept/${guid}`,
    type: 'Accept',
    actor: `https://${domain}/u/${name}`,
    object: thebody,
  };

  const inbox = await getInboxFromActorProfile(message.object.actor);

  signAndSend(message, name, domain, targetDomain, inbox);
}

async function handleFollowRequest(req, res) {
  const domain = req.app.get('domain');

  const { hostname: targetDomain } = new URL(req.body.actor);
  const name = req.body.object.replace(`https://${domain}/u/`, '');

  await sendAcceptMessage(req.body, name, domain, req, res, targetDomain);
  const { actor } = req.body;
  await db.run('insert into followers (actor) values ? on conflict (actor) do nothing', actor);

  return res.status(200);
}

async function handleUnfollow(req, res) {
  const domain = req.app.get('domain');
  const myURL = new URL(req.body.actor);
  const targetDomain = myURL.hostname;
  const name = req.body.object.object.replace(`https://${domain}/u/`, '');

  await sendAcceptMessage(req.body, name, domain, req, res, targetDomain);

  const { actor } = req.body;
  await db.run('delete from followers where actor = ?', actor);
  return res.sendStatus(200);
}

async function handleCommentOnBookmark(req, res, inReplyToGuid) {
  const bookmarkId = (await db.get('select bookmark_id from messages where guid = ?', inReplyToGuid))?.bookmark_id;

  if (typeof bookmarkId !== 'number') {
    console.log("couldn't find a bookmark this message is related to");
    return res.sendStatus(400);
  }

  const permissions = await db.all(
    `
      select actor, status
      from permissions
      where (bookmark_id = 0 or bookmark_id = ?)
    `,
    bookmarkId,
  );

  const blocklist = [];
  const allowlist = [];

  permissions.forEach(({ actor, status }) => {
    if (status) {
      allowlist.push(actor);
    } else {
      blocklist.push(actor);
    }
  });

  if (blocklist.some((username) => actorMatchesUsername(req.body.actor, username)).some((x) => x)) {
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
  if (allowlist.some((username) => actorMatchesUsername(req.body.actor, username)).some((x) => x)) {
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
    await db.run('insert into following (actor) values ? on conflict (actor) do nothing', req.body.actor);
    return res.status(200);
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
