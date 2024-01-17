import express from 'express';

import { getActorInfo, domain } from '../../util.js';

const ERROR_MESSAGE = 'Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.';

const router = express.Router();

router.get('/', async (req, res) => {
  const { resource } = req.query;
  if (!resource || !resource.includes('acct:')) {
    return res.status(400).send(ERROR_MESSAGE);
  }

  const name = resource.replace('acct:', '');
  const { username } = await getActorInfo();
  const actorName = `${username}@${domain}`;

  if (name !== actorName) {
    return res.status(404).send(`No webfinger record found for ${name}.`);
  }

  return res.json({
    subject: `acct:${actorName}`,
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: `https://${domain}/u/${username}`,
      },
    ],
  });
});

export default router;
