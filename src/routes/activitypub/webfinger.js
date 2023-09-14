import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  const { resource } = req.query;
  if (!resource || !resource.includes('acct:')) {
    return res.status(400).send('Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.');
  }

  const name = resource.replace('acct:', '');
  const db = req.app.get('apDb');
  const webfinger = await db.getWebfinger();
  if (webfinger === undefined) {
    return res.status(404).send(`No webfinger record found for ${name}.`);
  }

  return res.json(JSON.parse(webfinger));
});

export default router;
