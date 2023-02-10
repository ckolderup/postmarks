import express from 'express';

export const router = express.Router();

router.get('/:guid', async function (req, res) {
  let guid = req.params.guid;
  if (!guid) {
    return res.status(400).send('Bad request.');
  }
  else {
    let db = req.app.get('apDb');
    const result = await db.getMessage(guid);

    if (result === undefined) {
      return res.status(404).send(`No message found for ${guid}.`);
    }
    else {
      res.json(JSON.parse(result.message));
    }
  }
});
