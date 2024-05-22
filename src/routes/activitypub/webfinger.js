import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  const { resource } = req.query;
  if (!resource || !resource.includes('acct:')) {
    return res.status(404).send('Not found. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.');
  }

  const name = resource.replace('acct:', '');
  const db = req.app.get('apDb');
  const webfinger = await db.getWebfinger();
  if (webfinger === undefined || webfinger.subject !== resource) {
    return res.status(404).send(`No webfinger record found for ${name}.`);
  }

  res.setHeader('content-type', 'application/jrd+json');
  return res.json(JSON.parse(webfinger));
});

export default router;
