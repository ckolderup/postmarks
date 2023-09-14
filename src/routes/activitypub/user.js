import express from 'express';
import { createNoteObject } from '../../activitypub.js';

const router = express.Router();

router.get('/:name', async (req, res) => {
  let { name } = req.params;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  if (!req.headers.accept?.includes('json')) {
    return res.redirect('/');
  }

  const db = req.app.get('apDb');
  const domain = req.app.get('domain');
  const username = name;
  name = `${name}@${domain}`;

  const actor = await db.getActor();

  if (actor === undefined) {
    return res.status(404).send(`No actor record found for ${name}.`);
  }
  const tempActor = JSON.parse(actor);
  // Added this followers URI for Pleroma compatibility, see https://github.com/dariusk/rss-to-activitypub/issues/11#issuecomment-471390881
  // New Actors should have this followers URI but in case of migration from an old version this will add it in on the fly
  if (tempActor.followers === undefined) {
    tempActor.followers = `https://${domain}/u/${username}/followers`;
  }
  if (tempActor.outbox === undefined) {
    tempActor.outbox = `https://${domain}/u/${username}/outbox`;
  }
  return res.json(tempActor);
});

router.get('/:name/followers', async (req, res) => {
  const { name } = req.params;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  const db = req.app.get('apDb');
  const domain = req.app.get('domain');

  let followers = await db.getFollowers();

  if (followers === undefined) {
    followers = [];
  } else {
    followers = JSON.parse(followers);
  }

  const followersCollection = {
    type: 'OrderedCollection',
    totalItems: followers?.length || 0,
    id: `https://${domain}/u/${name}/followers`,
    first: {
      type: 'OrderedCollectionPage',
      totalItems: followers?.length || 0,
      partOf: `https://${domain}/u/${name}/followers`,
      orderedItems: followers,
      id: `https://${domain}/u/${name}/followers?page=1`,
    },
    '@context': ['https://www.w3.org/ns/activitystreams'],
  };
  return res.json(followersCollection);
});

router.get('/:name/following', async (req, res) => {
  const { name } = req.params;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  const db = req.app.get('apDb');
  const domain = req.app.get('domain');

  const followingText = (await db.getFollowing()) || '[]';
  const following = JSON.parse(followingText);

  const followingCollection = {
    type: 'OrderedCollection',
    totalItems: following?.length || 0,
    id: `https://${domain}/u/${name}/following`,
    first: {
      type: 'OrderedCollectionPage',
      totalItems: following?.length || 0,
      partOf: `https://${domain}/u/${name}/following`,
      orderedItems: following,
      id: `https://${domain}/u/${name}/following?page=1`,
    },
    '@context': ['https://www.w3.org/ns/activitystreams'],
  };
  return res.json(followingCollection);
});

router.get('/:name/outbox', async (req, res) => {
  const domain = req.app.get('domain');
  const account = req.app.get('account');
  const bookmarksDb = req.app.get('bookmarksDb');

  const page = req.params.page || 1;
  if (page < 1) return res.status(400);

  const limit = 20;
  const offset = (page - 1) * limit;
  const totalBookmarkCount = await bookmarksDb.getBookmarkCount();

  const bookmarks = await bookmarksDb.getBookmarks(limit, offset);
  const messages = bookmarks.map((b) => createNoteObject(b, account, domain));

  const outboxCollection = {
    type: 'OrderedCollection',
    totalItems: totalBookmarkCount,
    id: `https://${domain}/u/${account}/outbox`,
    first: {
      type: 'OrderedCollectionPage',
      totalItems: messages.length,
      partOf: `https://${domain}/u/${account}/outbox`,
      orderedItems: messages,
      id: `https://${domain}/u/${account}/outbox?page=${page}`,
      next: `https://${domain}/u/${account}/outbox?page=${page + 1}`,
    },
    '@context': ['https://www.w3.org/ns/activitystreams'],
  };
  return res.json(outboxCollection);
});

export default router;
