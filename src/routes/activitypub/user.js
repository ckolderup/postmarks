import express from 'express';
import { synthesizeActivity } from '../../activitypub.js';

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
  const apDb = req.app.get('apDb');

  function pageLink(p) {
    return `https://${domain}/u/${account}/outbox?page=${p}`;
  }

  const pageSize = 20;
  const totalCount = await apDb.getMessageCount();
  const lastPage = Math.ceil(totalCount / pageSize);

  if (req.query?.page === undefined) {
    // Send collection
    const outboxCollection = {
      type: 'OrderedCollection',
      totalItems: totalCount,
      id: `https://${domain}/u/${account}/outbox`,
      first: pageLink(1),
      last: pageLink(lastPage),
      '@context': ['https://www.w3.org/ns/activitystreams'],
    };

    return res.json(outboxCollection);
  }

  if (!/^\d+$/.test(req.query.page)) {
    return res.status(400).send('Invalid page number');
  }

  const page = parseInt(req.query.page, 10);
  if (page < 1 || page > lastPage) return res.status(400).send('Invalid page number');

  const offset = (page - 1) * pageSize;
  const notes = await apDb.getMessages(offset, pageSize);
  const activities = notes.map((n) => synthesizeActivity(JSON.parse(n.message)));

  const collectionPage = {
    type: 'OrderedCollectionPage',
    partOf: `https://${domain}/u/${account}/outbox`,
    orderedItems: activities,
    id: pageLink(page),
    first: pageLink(1),
    last: pageLink(lastPage),
  };

  if (page + 1 <= lastPage) {
    collectionPage.next = pageLink(page + 1);
  }

  if (page > 1) {
    collectionPage.prev = pageLink(page - 1);
  }

  return res.json(collectionPage);
});

export default router;
