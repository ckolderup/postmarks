import express from 'express';
import * as linkify from 'linkifyjs';
import { data, actorInfo } from '../util.js';
import { isAuthenticated } from '../session-auth.js';

const router = express.Router();
export default router;

router.get('/', async (req, res) => {
  const params = {};

  const bookmarksDb = req.app.get('bookmarksDb');

  const limit = Math.max(req.query?.limit || 10, 1);
  const offset = Math.max(req.query?.offset || 0, 0);
  const totalBookmarkCount = await bookmarksDb.getBookmarkCount();
  const currentPage = (limit + offset) / limit;
  const totalPages = Math.ceil(totalBookmarkCount / limit);

  let buildTitle = 'Latest bookmarks';
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
  params.pageInfo = {
    currentPage,
    totalPages,
    offset,
    limit,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    nextOffset: Math.min(offset + limit, totalPages * limit - limit),
    previousOffset: Math.max(offset - limit, 0),
  };

  // Send the page options or raw JSON data if the client requested it
  return req.query.raw ? res.send(params) : res.render('index', params);
});

router.get('/about', async (req, res) => {
  res.render('about', {
    title: 'About',
    actorInfo,
    domain: req.app.get('domain'),
  });
});

router.get('/network', isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');

  const posts = await bookmarksDb.getNetworkPosts();

  // TODO: make quickadd able to select from list of links in post
  const linksInPosts = posts.map((post) => ({
    ...post,
    href: linkify.find(post.content)?.[0]?.href,
  }));

  return res.render('network', { posts: linksInPosts });
});

router.get('/index.xml', async (req, res) => {
  const params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  const bookmarks = await bookmarksDb.getBookmarks(20, 0);
  if (!bookmarks) params.error = data.errorMessage;

  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks.map((bookmark) => {
      const tagArray = bookmark.tags?.split(' ').map((b) => b.slice(1)) ?? [];
      const createdAt = new Date(`${bookmark.created_at}Z`);
      return {
        tag_array: tagArray,
        ...bookmark,
        created_at: createdAt.toISOString(),
      };
    });
    const lastUpdated = new Date(bookmarks[0].created_at);
    params.last_updated = lastUpdated.toISOString();
  }

  params.feedTitle = req.app.get('site_name');
  params.layout = false;

  res.type('application/atom+xml');
  return res.render('bookmarks-xml', params);
});

router.get('/tagged/*.xml', async (req, res) => {
  const tags = req.params[0].split('/');

  const params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  const bookmarks = await bookmarksDb.getBookmarksForTags(tags, 20, 0);

  if (!bookmarks) params.error = data.errorMessage;

  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks.map((bookmark) => {
      const tagArray = bookmark.tags.split(' ').map((b) => b.slice(1));
      return { tag_array: tagArray, ...bookmark };
    });
    params.last_updated = bookmarks[0].created_at;
  }

  params.feedTitle = `${req.app.get('site_name')}: Bookmarks tagged '${tags.join(' and ')}'`;
  params.layout = false;

  res.type('application/atom+xml');
  return res.render('bookmarks-xml', params);
});

router.get('/tagged/*', async (req, res) => {
  const tags = req.params[0].split('/');

  const params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  let buildTitle = `Bookmarks tagged ${tags.join(' and ')}`;

  const title = buildTitle;

  const limit = Math.max(req.query?.limit || 10, 1);
  const offset = Math.max(req.query?.offset || 0, 0);
  const bookmarks = await bookmarksDb.getBookmarksForTags(tags, limit, offset);

  const totalBookmarkCount = await bookmarksDb.getBookmarkCountForTags(tags);
  const currentPage = (limit + offset) / limit;
  const totalPages = Math.ceil(totalBookmarkCount / limit);
  if (totalPages > 1) {
    buildTitle += ` (page ${currentPage} of ${totalPages})`;
  }

  // Check in case the data is empty or not setup yet
  if (bookmarks && bookmarks.length < 1) {
    params.setup = data.setupMessage;
  } else {
    params.bookmarks = bookmarks;
  }

  params.tags = await bookmarksDb.getTags();
  params.feed = req.path;
  params.title = title;
  params.pageInfo = {
    currentPage,
    totalPages,
    offset,
    limit,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    nextOffset: Math.min(offset + limit, totalPages * limit - limit),
    previousOffset: Math.max(offset - limit, 0),
  };

  params.path = req.path;
  params.pathTags = req.path.split('/').slice(2);

  // Send the page options or raw JSON data if the client requested it
  return req.query.raw ? res.send(params) : res.render('tagged', params);
});

router.get('/search', async (req, res) => {
  try {
    const bookmarksDb = req.app.get('bookmarksDb');
    const params = { title: 'Search Bookmarks' };
    if (req.query.query) {
      params.keywords = req.query.query;
      params.bookmarks = await bookmarksDb.searchBookmarks(req.query.query);
      if (params.bookmarks.length === 0) {
        params.error = 'No matches...';
      }
    }
    params.tags = await bookmarksDb.getTags();
    return res.render('search', params);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Internal Server Error');
  }
});
