// implementation of http://nodeinfo.diaspora.software/protocol.html

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
      ],
    };
    res.json(thisNode);
  }

  if (req.originalUrl === '/nodeinfo/2.0') {
    const bookmarksDb = req.app.get('bookmarksDb');
    const bookmarkCount = await bookmarksDb.getBookmarkCount();

    // TODO: activeMonth and activeHalfyear should be dynamic, currently static
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

    // spec requires setting this, majority of implementations
    // appear to not bother with it?
    res.type('application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"');

    res.json(nodeInfo);
  }
});

export default router;
