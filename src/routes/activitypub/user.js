import express from 'express';

export const router = express.Router();

router.get('/:name', async function (req, res) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  else {
    const db = req.app.get('apDb');
    const domain = req.app.get('domain');
    const username = name;
    name = `${name}@${domain}`;

    const actor = await db.getActor(name);

    if (actor === undefined) {
      return res.status(404).send(`No actor record found for ${name}.`);
    }
    else {
      let tempActor = JSON.parse(actor);
      // Added this followers URI for Pleroma compatibility, see https://github.com/dariusk/rss-to-activitypub/issues/11#issuecomment-471390881
      // New Actors should have this followers URI but in case of migration from an old version this will add it in on the fly
      if (tempActor.followers === undefined) {
        tempActor.followers = `https://${domain}/u/${username}/followers`;
      }
      res.json(tempActor);
    }
  }
});

router.get('/:name/followers', async function (req, res) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  else {
    let db = req.app.get('apDb');
    let domain = req.app.get('domain');

    let followers = await db.getFollowers(`${name}@${domain}`);

    if (followers === undefined) {
      followers = [];
    } else {
      followers = JSON.parse(followers);
    }

    let followersCollection = {
      "type":"OrderedCollection",
      "totalItems":followers.length,
      "id":`https://${domain}/u/${name}/followers`,
      "first": {
        "type":"OrderedCollectionPage",
        "totalItems":followers.length,
        "partOf":`https://${domain}/u/${name}/followers`,
        "orderedItems": followers,
        "id":`https://${domain}/u/${name}/followers?page=1`
      },
      "@context":["https://www.w3.org/ns/activitystreams"]
    };
    res.json(followersCollection);
  }
});
