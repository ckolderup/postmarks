import express from 'express';
import path from 'path';
import { synthesizeActivity } from '../../activitypub.js';
import { getActorInfo, domain } from '../../util.js';
import * as db from '../../database.js';

const router = express.Router();

router.get('/:name', async (req, res) => {
  const { name } = req.params;

  if (!req.headers.accept?.includes('json')) {
    return res.redirect('/');
  }

  const { username, avatar, displayName, description, publicKey } = await getActorInfo();

  if (username !== name) {
    return res.status(404).send(`No actor record found for ${name}.`);
  }

  return res.json({
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],

    id: `https://${domain}/u/${username}`,
    type: 'Person',
    preferredUsername: username,
    name: displayName,
    summary: description,
    icon: {
      type: 'Image',
      mediaType: `image/${path.extname(avatar).slice(1)}`,
      url: avatar,
    },
    inbox: `https://${domain}/api/inbox`,
    outbox: `https://${domain}/u/${username}/outbox`,
    followers: `https://${domain}/u/${username}/followers`,
    following: `https://${domain}/u/${username}/following`,

    publicKey: {
      id: `https://${domain}/u/${username}#main-key`,
      owner: `https://${domain}/u/${username}`,
      publicKeyPem: publicKey,
    },
  });
});

router.get('/:name/followers', async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).send('Bad request.');
  }

  const followers = (await db.all('select actor from followers')).map(({ actor }) => actor);

  return res.json({
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
  });
});

router.get('/:name/following', async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).send('Bad request.');
  }

  const following = (await db.all('select actor from following')).map(({ actor }) => actor);

  return res.json({
    type: 'OrderedCollection',
    totalItems: following.length,
    id: `https://${domain}/u/${name}/following`,
    first: {
      type: 'OrderedCollectionPage',
      totalItems: following.length,
      partOf: `https://${domain}/u/${name}/following`,
      orderedItems: following,
      id: `https://${domain}/u/${name}/following?page=1`,
    },
    '@context': ['https://www.w3.org/ns/activitystreams'],
  });
});

router.get('/:name/outbox', async (req, res) => {
  const { username: account } = await getActorInfo();

  function pageLink(p) {
    return `https://${domain}/u/${account}/outbox?page=${p}`;
  }

  const pageSize = 20;
  const totalCount = (await db.get('select count(message) as count from messages')).count;
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
  const notes = await db.all(
    `
      select message
      from messages
      order by bookmark_id desc
      limit ?
      offset ?
    `,
    pageSize,
    offset,
  );
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
