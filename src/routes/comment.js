import express from 'express';
import { isAuthenticated } from '../session-auth.js';

const router = express.Router();

router.post('/:id/toggle', isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');

  await bookmarksDb.toggleCommentVisibility(req.params.id);

  return res.redirect(req.get('Referrer'));
});

export default router;
