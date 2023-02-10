import express from 'express';

export const router = express.Router();

router.get('/', async function (req, res) {
  let resource = req.query.resource;
  if (!resource || !resource.includes('acct:')) {
    return res.status(400).send('Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.');
  }
  else {
    let name = resource.replace('acct:','');
    let db = req.app.get('apDb');
    const webfinger = await db.getWebfinger(name);
    if (webfinger === undefined) {
      return res.status(404).send(`No webfinger record found for ${name}.`);
    }
    else {
      res.json(JSON.parse(webfinger));
    }
  }
});
