import express from 'express';
import { seo, data, domain } from '../util.js';
import { basicUserAuth } from '../basic-auth.js';
import fs from 'fs';
const DATA_PATH = '/app/.data';

export const router = express.Router();

router.get('/', basicUserAuth, async (req, res) => {
  let params = req.query.raw ? {} : { seo: seo, title: 'Admin'  };
  const db = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  const permissions = await apDb.getGlobalPermissions();
  
  params.allowed = permissions?.allowed || "";
  params.blocked = permissions?.blocked || "";
   
  params.tags = await db.getTags();
  
  params.bookmarklet = `javascript:(function(){w=window.open('https://${domain}/bookmark/popup?url='+encodeURIComponent(window.location.href)+'&highlight='+encodeURIComponent(window.getSelection().toString()),'fedimarks','scrollbars=yes,width=550,height=600');})();`;


  // Get the log history from the db
  params.bookmarks = await db.getBookmarks();

  // Let the user know if there's an error
  params.error = params.bookmarks ? null : data.errorMessage;

  // Send the editable bookmark list
  return req.query.raw
    ? res.send(params)
    : res.render("admin", params);
});

router.get("/bookmarks.db", basicUserAuth, async (req, res) => {
  const filePath = `${DATA_PATH}/bookmarks.db`;
  
  res.setHeader('Content-Type', 'application/vnd.sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.db"');

  res.download(filePath)
});

router.get("/activitypub.db", basicUserAuth, async (req, res) => {
  const filePath = `${DATA_PATH}/activitypub.db`;
  
  res.setHeader('Content-Type', 'application/vnd.sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename="activitypub.db"');

  res.download(filePath)
});

router.post("/permissions", basicUserAuth, async (req, res) => {
  const apDb = req.app.get('apDb');
  
  await apDb.setGlobalPermissions(req.body.allowed, req.body.blocked);
  
  res.redirect("/admin");
});

router.post("/reset", basicUserAuth, async (req, res) => {
  const db = req.app.get('bookmarksDb');
  
  await db.deleteAllBookmarks();
res.redirect("/admin");
});