import express from 'express';
import { isAuthenticated } from "../session-auth.js";

export const router = express.Router();

router.post("/:id/toggle", isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get("bookmarksDb");

  await bookmarksDb.toggleCommentVisibility(req.params.id);

  return res.redirect(req.get("Referrer"));
});
