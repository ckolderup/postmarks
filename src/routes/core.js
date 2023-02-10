import express from 'express';
import { data, actorInfo } from '../util.js';

export const router = express.Router();

router.get("/", async (req, res) => {
  let params = {};

  const bookmarksDb = req.app.get('bookmarksDb');

  const limit = Math.max(req.query?.limit || 10, 1);
  const offset = Math.max(req.query?.offset || 0, 0);
  const totalBookmarkCount = await bookmarksDb.getBookmarkCount();
  const currentPage = (limit + offset) / limit;
  const totalPages = Math.ceil(totalBookmarkCount / limit);

  let buildTitle = `Latest bookmarks`;
  if (totalPages > 1) {
    buildTitle += ` (page ${currentPage} of ${totalPages})`;
  }
  const title = buildTitle;

  params.tags = await bookmarksDb.getTags();

  const bookmarks = await bookmarksDb.getBookmarks(limit, offset);

  if (!bookmarks) params.error = data.errorMessage;

  // Check in case the data is empty or not setup yet
  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks;
  }

  params.title = title;
  params.feedLink = `<link rel="alternate" type="application/atom+xml" href="https://${req.app.get('domain')}/index.xml" />`;
  params.pageInfo = { currentPage, totalPages, offset, limit,
                     hasPreviousPage: currentPage > 1,
                     hasNextPage: currentPage < totalPages,
                     nextOffset: Math.min(offset + limit, totalPages * limit - limit),
                     previousOffset: Math.max(offset - limit, 0)
                    };

  // Send the page options or raw JSON data if the client requested it
  return req.query.raw
    ? res.send(params)
    : res.render("index", params);
});

router.get("/about", async (req, res) => {
  res.render("about", { title: 'About', actorInfo, domain: req.app.get('domain')});
});

router.get("/index.xml", async (req, res) => {
  let params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  const bookmarks = await bookmarksDb.getBookmarks(20, 0);
  if (!bookmarks) params.error = data.errorMessage;

  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks.map((bookmark) => {
      const tag_array = bookmark.tags.split(' ').map(b => b.slice(1));
      return {tag_array, ...bookmark};
    });
    params.last_updated = bookmarks[0].created_at;
  }

  params.feedTitle = req.app.get('site_name');
  params.layout = false;

  return res.render("bookmarks-xml", params);
});

router.get("/tagged/:tag.xml", async (req, res) => {
  let params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  const bookmarks = await bookmarksDb.getBookmarksForTag(req.params.tag, 20, 0);

  if (!bookmarks) params.error = data.errorMessage;

  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks.map((bookmark) => {
      const tag_array = bookmark.tags.split(' ').map(b => b.slice(1));
      return {tag_array, ...bookmark};
    });
    params.last_updated = bookmarks[0].created_at;
  }

  params.feedTitle = `${req.app.get('site_name')}: Bookmarks tagged '${req.params.tag}'`;
  params.layout = false;

  return res.render("bookmarks-xml", params);
});

router.get("/tagged/:tag", async (req, res) => {
  let params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  const limit = Math.max(req.query?.limit || 10, 1);
  const offset = Math.max(req.query?.offset || 0, 0);
  const totalBookmarkCount = await bookmarksDb.getBookmarkCountForTag(req.params.tag);
  const currentPage = (limit + offset) / limit;
  const totalPages = Math.ceil(totalBookmarkCount / limit);

  let buildTitle = `Bookmarks tagged ${req.params.tag}`;
  if (totalPages > 1) {
    buildTitle += ` (page ${currentPage} of ${totalPages})`;
  }
  const title = buildTitle;

  params.tags = await bookmarksDb.getTags();

  const bookmarks = await bookmarksDb.getBookmarksForTag(req.params.tag, limit, offset);

  // Check in case the data is empty or not setup yet
  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks;
  }

  params.tag = req.params.tag;
  params.title = title;
  params.feedLink = `<link rel="alternate" type="application/atom+xml" href="https://${req.app.get('domain')}/tagged/${params.tag}.xml" />`;
  params.pageInfo = { currentPage, totalPages, offset, limit,
                     hasPreviousPage: currentPage > 1,
                     hasNextPage: currentPage < totalPages,
                     nextOffset: Math.min(offset + limit, totalPages * limit - limit),
                     previousOffset: Math.max(offset - limit, 0)
                    };

  // Send the page options or raw JSON data if the client requested it
  return req.query.raw
    ? res.send(params)
    : res.render("tagged", params);
});

