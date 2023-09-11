// implementation of http://nodeinfo.diaspora.software/protocol.html

import express from "express";
import { instanceType, instanceVersion } from "../../util.js";

export const router = express.Router();

router.get("/", async function (req, res) {
  let domain = req.app.get("domain");

  if (req.originalUrl == "/.well-known/nodeinfo") {
    let thisNode = {
      links: [
        {
          rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
          href: `https://${domain}/nodeinfo/2.0`,
        },
      ],
    };
    res.json(thisNode);
  }

  if (req.originalUrl == "/nodeinfo/2.0") {

    const bookmarksDb = req.app.get("bookmarksDb");
    let bookmarkCount = await bookmarksDb.getBookmarkCount();

    const repository = process.env.REPOSITORY || 'https://github.com/ckolderup/postmarks';

    // TODO: activeMonth and activeHalfyear should be dynamic, currently static
    let nodeInfo = {
      version: 2.0,
      software: {
        name: instanceType,
        version: instanceVersion,
        repository
      },
      protocols: [
        "activitypub"
      ],
      services: {
        outbound: ["atom1.0"],
        inbound: []
      },
      usage: {
        users: {
          total: 1,
          activeMonth: 1,
          activeHalfyear: 1
        },
        localPosts: bookmarkCount,
      },
      openRegistrations: false,
      metadata: {}
    };

    // spec requires setting this, majority of implementations
    // appear to not bother with it?
    res.type('application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"')

    res.json(nodeInfo);

  }
});
