import express from 'express';

const router = express.Router();

router.get('/:guid', async (req, res) => {
  const { guid } = req.params;
  if (!guid) {
    return res.status(400).send('Bad request.');
  }

  const db = req.app.get('apDb');
  const result = await db.getMessage(guid);

  if (result === undefined) {
    return res.status(404).send(`No message found for ${guid}.`);
  }

  return res.json(JSON.parse(result.message));
});

export default router;
