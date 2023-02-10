import express from 'express';
import og from 'open-graph';
import { promisify } from 'es6-promisify';
const ogParser = promisify(og);

import { data, account, domain, removeEmpty } from '../util.js';
import { basicUserAuth } from '../basic-auth.js';
import { sendMessage } from '../activitypub.js';

export const router = express.Router();

router.get("/new", basicUserAuth, async (req, res) => {
  let params = req.query.raw ? {} : { ephemeral: false };
  const bookmarksDb = req.app.get('bookmarksDb');

  params.tags = await bookmarksDb.getTags();
  params.title = `New Bookmark`;
  params.creating = true;

  return res.render("edit_bookmark", params);
});

router.get("/popup", basicUserAuth, async (req, res) => {
  let params = req.query.raw ? {} : { ephemeral: true };
  const bookmarksDb = req.app.get('bookmarksDb');

  if (req.query.url !== undefined) {
    params.bookmark = {
      url: decodeURI(req.query.url),
    };

    try {
      let meta = await ogParser(decodeURI(req.query.url));



      if (req.query?.highlight !== undefined && req.query?.highlight !== '') {
        params.bookmark.description = `"${decodeURI(req.query.highlight)}"`
      } else if (meta.description !== undefined) {
        params.bookmark.description = `"${meta.description}"`;
      }
      params.bookmark.title = meta?.title;
    } catch (e) {
      console.log(`error fetching opengraph tags: ${e}`);
    }
  }

  params.tags = await bookmarksDb.getTags();
  params.title = `New Bookmark`;
  params.layout = 'popup';
  params.creating = true;

  return res.render("edit_bookmark", params);
});

router.get("/:id", async (req, res) => {
  let params = {};
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
  let params = req.query.raw ? {} : { ephemeral: false };
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
    try {
      //use the constructor to do a rough URL validity check
      new URL(url);
    } catch (e) {
      console.log(`unable to parse url ${url}`);
    }

    if (url.length < 3) return;

    let meta = {};
    try {
      meta = await ogParser(url);
      if (meta.description !== undefined) {
        meta.description = `"${meta.description}"`;
      }
    } catch (e) {
       console.log(`couldn't fetch opengraph data for ${url}`);
    }

    await bookmarksDb.createBookmark({ url, ...meta });
  });

  return req.query.raw ? res.sendStatus(200) : res.redirect("/");
})


router.post("/:id?", basicUserAuth, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  const params = {};
  const { id } = req.params;
  let bookmark;

  // TODO: lol this pattern is so horrible
  try {
    new URL(req.body.url);
  } catch {
    res.send("error: invalid URL")
    return;
  }

  const hashtagFormat = new RegExp(/^(#[a-zA-Z0-9.\-_]+ )*#[a-zA-Z0-9.\-_]+\s*$/gm);
  if (!hashtagFormat.test(req.body.tags)) {
    res.send("invalid tag format: must be in #hashtag #format, tag name supports a-z, A-Z, 0-9 and the following word separators: -_.");
    return;
  }

  if (id) {
    const bookmarkToUpdate = await bookmarksDb.getBookmark(id);

    // We have a bookmark we can update
    if (bookmarkToUpdate) {

      bookmark = await bookmarksDb.updateBookmark(id, {
        url: req.body.url.trim(),
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        tags: req.body.tags.trim()
      });
      await apDb.setPermissionsForBookmark(id, req.body.allowed || "", req.body.blocked || "");

      sendMessage(bookmark, 'update', apDb, account, domain);
    }

  } else {
    const noTitle = req.body.title === '';
    const noDescription = req.body.title === '';
    let meta = {};
    if (noTitle || noDescription) {
      try {
        meta = await ogParser(req.body.url);
        if (meta.description !== undefined) {
          meta.description = `"${meta.description}"`;
        }
      } catch (e) {
        console.log(`couldn't fetch opengraph data for ${req.body.url}: ${e}`);
      }
    }

    const mergedObject = { title: meta?.title, description: meta?.description, ...removeEmpty(req.body) };
    bookmark = await bookmarksDb.createBookmark({ // STRONG PARAMETERS
      url: mergedObject.url.trim(),
      title: mergedObject.title?.trim() || 'Untitled',
      description: mergedObject.description?.trim() || '',
      tags: mergedObject.tags?.trim()
    });

    sendMessage(bookmark, 'create', apDb, account, domain);
  }

  params.bookmarks = bookmark;
  params.error = params.bookmarks ? null : data.errorMessage;

  // Return the info to the client
  if (req.query.raw) {
    res.send(params)
  } else if (req.query.ephemeral === 'true') {
    res.send("<script>window.close();</script>");
  } else {
    res.redirect(`/bookmark/${bookmark.id}`);
  }
});
