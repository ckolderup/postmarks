import express from 'express';
import { synthesizeActivity } from '../../activitypub.js';

const router = express.Router();

router.get('/:guid', async (req, res) => {
  let { guid } = req.params;
  let isActivity = false;

  if (guid.startsWith('a-')) {
    guid = guid.slice(2);
    isActivity = true;
  }

  if (!guid) {
    return res.status(400).send('Bad request.');
  }

  const db = req.app.get('apDb');

  if (!req.headers.accept?.includes('json')) {
    const bookmarkId = await db.getBookmarkIdFromMessageGuid(guid);
    return res.redirect(`/bookmark/${bookmarkId}`);
  }

  const result = await db.getMessage(guid);

  if (result === undefined) {
    return res.status(404).send(`No message found for ${guid}.`);
  }

  let object = JSON.parse(result.message);
  if (isActivity) {
    object = synthesizeActivity(object);
  }

  return res.json(object);
});

export default router;
