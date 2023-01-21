import express from 'express';
import request from 'request';
import og from 'open-graph';
import { promisify } from 'es6-promisify';
const ogParser = promisify(og);

import { seo, data, account, domain, removeEmpty } from '../util.js';
import { basicUserAuth } from '../basic-auth.js';
import { sendMessage } from '../activitypub.js';

export const router = express.Router();

router.get("/new", basicUserAuth, async (req, res) => {
  let params = req.query.raw ? {} : { seo: seo, ephemeral: false };
  const bookmarksDb = req.app.get('bookmarksDb');

  params.tags = await bookmarksDb.getTags();
  params.title = `New Bookmark`;
  params.creating = true;
  
  return res.render("edit_bookmark", params);
});

router.get("/popup", basicUserAuth, async (req, res) => {
  let params = req.query.raw ? {} : { seo: seo, ephemeral: true };
  const bookmarksDb = req.app.get('bookmarksDb');
  
  if (req.query.url !== undefined) {
    params.bookmark = {
      url: decodeURI(req.query.url),
    };
    
    let meta = await ogParser(decodeURI(req.query.url));
    
    if (req.query?.highlight !== undefined && req.query?.highlight !== '') {
      params.bookmark.description = `"${decodeURI(req.query.highlight)}"`
    } else if (meta.description !== undefined) {
      params.bookmark.description = `"${meta.description}"`;
    }
    params.bookmark.title = meta?.title;
  }

  params.tags = await bookmarksDb.getTags();
  params.title = `New Bookmark`;
  params.layout = 'popup';
  params.creating = true;
  
  return res.render("edit_bookmark", params);
});

router.get("/:id", async (req, res) => {
  /* 
  Params is the data we pass to the client
  - SEO values for front-end UI but not for raw data
  */
  let params = req.query.raw ? {} : { seo: seo };
  const bookmarksDb = req.app.get('bookmarksDb');

  params.tags = await bookmarksDb.getTags();
  
  const bookmark = await bookmarksDb.getBookmark(req.params.id);
  const comments = await bookmarksDb.getVisibleCommentsForBookmark(bookmark.id);
  
  if (!bookmark) {
    params.error = data.errorMessage;
  } else {
    params.title = `Bookmark: ${bookmark.title}`;
    params.bookmark = bookmark;
    params.comments = comments;
  }
  
  return req.query.raw
    ? res.send(params)
    : res.render("bookmark", params);
});

router.get("/:id/edit", basicUserAuth, async (req, res) => {
  /* 
  Params is the data we pass to the client
  - SEO values for front-end UI but not for raw data
  */
  let params = req.query.raw ? {} : { seo: seo, ephemeral: false };
  const bookmarksDb = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  params.tags = await bookmarksDb.getTags();
  
  const bookmark = await bookmarksDb.getBookmark(req.params.id);
  const comments = await bookmarksDb.getAllCommentsForBookmark(req.params.id);
    
  if (!bookmark) {
    params.error = data.errorMessage;
  } else {
    const permissions = await apDb.getPermissionsForBookmark(req.params.id);
    params.allowed = permissions?.allowed;
    params.blocked = permissions?.blocked;
    
    params.title = `Edit Bookmark: ${bookmark.title}`;
    params.bookmark = bookmark;
    params.comments = comments
  }
  
  return req.query.raw
    ? res.send(params)
    : res.render("edit_bookmark", params);
});

router.post("/:id/delete", basicUserAuth, async (req, res) => {
  const params = {};
  const { id } = req.params;
  const bookmarksDb = req.app.get('bookmarksDb');
  
  await bookmarksDb.deleteBookmark(id);
  
  return req.query.raw
    ? res.send(params)
    : res.redirect("/");
});

router.post("/:id/delete_hidden_comments", basicUserAuth, async (req, res) => {
 const params = {};
  const { id } = req.params;
  const bookmarksDb = req.app.get('bookmarksDb');
  
  await bookmarksDb.deleteHiddenCommentsForBookmark(id);
  
  return req.query.raw
    ? res.send(params)
    : res.redirect(`/bookmark/${id}/edit`);
});

router.post("/multiadd", basicUserAuth, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  
  await req.body.urls.split("\n").forEach(async (url) => {
    console.log(url);

    if (url.length < 3) return;
        
    const meta = await ogParser(url); 
    if (meta.description !== undefined) {
      meta.description = `"${meta.description}"`;
    }
    
    await bookmarksDb.createBookmark({url, ...meta});
  });
  
  return req.query.raw ? res.sendStatus(200) : res.redirect("/");
})


router.post("/:id?", basicUserAuth, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  const params = {};
  const { id } = req.params;
  let bookmark;
  
  if (id) {
    const bookmarkToUpdate = await bookmarksDb.getBookmark(id);

    // We have a bookmark we can update
    if (bookmarkToUpdate) {
      bookmark = await bookmarksDb.updateBookmark(id, req.body);
      await apDb.setPermissionsForBookmark(id, req.body.allowed || "", req.body.blocked || "");
      
      sendMessage(bookmark, 'update', apDb, account, domain);
    }
    
  } else {
    const noTitle = req.body.title === '';
    const noDescription = req.body.title === '';
    let meta = {};
    if (noTitle || noDescription) {
      meta = await ogParser(req.body.url);
      if (meta.description !== undefined) {
        meta.description = `"${meta.description}"`;
      }
    }
    
    const mergedObject = {title: meta.title, description: meta.description, ...removeEmpty(req.body)};   
    bookmark = await bookmarksDb.createBookmark(mergedObject);
    
    sendMessage(bookmark, 'create', apDb, account, domain);
  }
  
  params.bookmarks = bookmark;
  params.error = params.bookmarks ? null : data.errorMessage;

  // Return the info to the client
  if (req.query.raw) { 
    res.send(params)
  } else if (req.query.ephemeral === 'true') {
    console.log("sending javascript close");
    res.send("<script>window.close();</script>");
  } else {
    console.log("redirecting");
    res.redirect(`/bookmark/${bookmark.id}`);
  }
});