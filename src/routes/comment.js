import express from 'express';
import request from 'request';
import og from 'open-graph';
import { promisify } from 'es6-promisify';
const ogParser = promisify(og);

import { seo, data, account, domain, removeEmpty } from '../util.js';
import { basicUserAuth } from '../basic-auth.js';
import { sendMessage } from '../activitypub.js';

export const router = express.Router();

router.post('/:id/toggle', basicUserAuth, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  
  const comment = await bookmarksDb.toggleCommentVisibility(req.params.id);
  
  return res.redirect(req.get('Referrer'));
});