// implementation of http://nodeinfo.diaspora.software/
// TODO: activeMonth and activeHalfyear should be dynamic, currently static
// TODO: enable override of nodeName and nodeDescription from settings
// homepage and repository may want to be updated for user-specific forks
// NB openRegistrations will always be false for a single-instance server

import express from 'express';
import { instanceType, instanceVersion } from '../../util.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const domain = req.app.get('domain');

  if (req.originalUrl === '/.well-known/nodeinfo') {
    const thisNode = {
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: `https://${domain}/nodeinfo/2.0`,
        },
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
          href: `https://${domain}/nodeinfo/2.1`,
        },
      ],
    };
    res.json(thisNode);
  }

  if (req.originalUrl === '/nodeinfo/2.0') {
    const bookmarksDb = req.app.get('bookmarksDb');
    const bookmarkCount = await bookmarksDb.getBookmarkCount();

    const nodeInfo = {
      version: 2.0,
      software: {
        name: instanceType,
        version: instanceVersion,
      },
      protocols: ['activitypub'],
      services: {
        outbound: ['atom1.0'],
        inbound: [],
      },
      usage: {
        users: {
          total: 1,
          activeMonth: 1,
          activeHalfyear: 1,
        },
        localPosts: bookmarkCount,
      },
      openRegistrations: false,
      metadata: {},
    };

    // spec says servers *should* set this, majority of implementations
    // appear to not bother with this detail, but we'll do right by the spec
    res.type('application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"');
    res.json(nodeInfo);
  }

  if (req.originalUrl === '/nodeinfo/2.1') {
    const bookmarksDb = req.app.get('bookmarksDb');
    const bookmarkCount = await bookmarksDb.getBookmarkCount();

    const nodeInfo = {
      version: 2.1,
      software: {
        name: instanceType,
        version: instanceVersion,
        repository: 'https://github.com/ckolderup/postmarks',
        homepage: 'https://postmarks.glitch.me',
      },
      protocols: ['activitypub'],
      services: {
        outbound: ['atom1.0'],
        inbound: [],
      },
      usage: {
        users: {
          total: 1,
          activeMonth: 1,
          activeHalfyear: 1,
        },
        localPosts: bookmarkCount,
      },
      openRegistrations: false,
      metadata: {
        nodeName: 'Postmarks',
        nodeDescription: 'A single-user bookmarking website designed to live on the Fediverse.',
      },
    };

    res.type('application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"');
    res.json(nodeInfo);
  }
});

export default router;
