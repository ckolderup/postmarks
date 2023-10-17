import express from 'express';
import ogScraper from 'open-graph-scraper';

import { data, account, domain, removeEmpty } from '../util.js';
import { broadcastMessage } from '../activitypub.js';
import { isAuthenticated } from '../session-auth.js';

const router = express.Router();
export default router;

router.get('/new', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { ephemeral: false };
  const bookmarksDb = req.app.get('bookmarksDb');

  if (req.query.url !== undefined) {
    params.bookmark = {
      url: decodeURI(req.query.url),
      description: '',
    };

    if (req.query?.highlight !== undefined && req.query?.highlight !== '') {
      params.bookmark.description += `"${decodeURI(req.query.highlight)}"`;
    }
    try {
      const meta = await ogScraper({ url: decodeURI(req.query.url) });

      if (meta?.result?.ogDescription !== undefined) {
        params.bookmark.description += `"${meta?.result?.ogDescription}"`;
      }
      params.bookmark.title = meta?.result?.ogTitle;
    } catch (e) {
      console.log(`error fetching opengraph tags: ${e}`);
    }
  }

  if (req.query?.via !== undefined) {
    if (params.bookmark.description !== '') {
      params.bookmark.description += '\n\n';
    }
    params.bookmark.description += `(via ${req.query.via})`;
  }

  params.tags = await bookmarksDb.getTags();
  params.title = 'New Bookmark';
  params.creating = true;

  return res.render('edit_bookmark', params);
});

router.get('/popup', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { ephemeral: true };
  const bookmarksDb = req.app.get('bookmarksDb');

  if (req.query.url !== undefined) {
    params.bookmark = {
      url: decodeURI(req.query.url),
    };

    try {
      const meta = await ogScraper({ url: decodeURI(req.query.url) });

      if (req.query?.highlight !== undefined && req.query?.highlight !== '') {
        params.bookmark.description = `"${decodeURI(req.query.highlight)}"`;
      } else if (meta?.result?.ogDescription !== undefined) {
        params.bookmark.description = `"${meta?.result?.ogDescription}"`;
      }
      params.bookmark.title = meta?.result?.ogTitle;
    } catch (e) {
      console.log(`error fetching opengraph tags: ${e}`);
    }
  }

  params.tags = await bookmarksDb.getTags();
  params.title = 'New Bookmark';
  params.layout = 'popup';
  params.creating = true;

  return res.render('edit_bookmark', params);
});

router.get('/:id', async (req, res) => {
  const params = {};
  const bookmarksDb = req.app.get('bookmarksDb');

  const bookmark = await bookmarksDb.getBookmark(req.params.id);
  const comments = await bookmarksDb.getVisibleCommentsForBookmark(bookmark.id);

  if (!bookmark) {
    params.error = data.errorMessage;
  } else {
    params.title = bookmark.title;
    params.hideTitle = true;
    params.bookmark = bookmark;
    params.comments = comments;
  }

  return req.query.raw ? res.send(params) : res.render('bookmark', params);
});

router.get('/:id/edit', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { ephemeral: false };
  const bookmarksDb = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  const bookmark = await bookmarksDb.getBookmark(req.params.id);
  bookmark.tagsArray = encodeURIComponent(JSON.stringify(bookmark.tags?.split(' ').map((b) => b.slice(1)) || []));
  const comments = await bookmarksDb.getAllCommentsForBookmark(req.params.id);

  if (!bookmark) {
    params.error = data.errorMessage;
  } else {
    const permissions = await apDb.getPermissionsForBookmark(req.params.id);
    params.allowed = permissions?.allowed;
    params.blocked = permissions?.blocked;

    params.title = 'Edit Bookmark';
    params.bookmark = bookmark;
    params.comments = comments;
  }

  return req.query.raw ? res.send(params) : res.render('edit_bookmark', params);
});

router.post('/:id/delete', isAuthenticated, async (req, res) => {
  const params = {};
  const { id } = req.params;
  const bookmarksDb = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  await bookmarksDb.deleteBookmark(id);

  broadcastMessage({ id }, 'delete', apDb, account, domain);

  return req.query.raw ? res.send(params) : res.redirect('/');
});

router.post('/:id/delete_hidden_comments', isAuthenticated, async (req, res) => {
  const params = {};
  const { id } = req.params;
  const bookmarksDb = req.app.get('bookmarksDb');

  await bookmarksDb.deleteHiddenCommentsForBookmark(id);

  return req.query.raw ? res.send(params) : res.redirect(`/bookmark/${id}/edit`);
});

router.post('/multiadd', isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');

  await req.body.urls.split('\n').forEach(async (url) => {
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch (e) {
      console.log(`unable to parse url ${url}`);
    }

    if (url.length < 3) return;
    // remove line break from URL value
    const link = url.replace(/(\r\n|\n|\r)/gm, '');

    let meta = {};
    try {
      meta = await ogScraper({ url: link });
      if (meta?.result?.ogDescription !== undefined) {
        meta.result.ogDescription = `"${meta.result.ogDescription}"`;
      }
    } catch (e) {
      console.log(`couldn't fetch opengraph data for ${url}`);
    }

    await bookmarksDb.createBookmark({
      url: link,
      title: meta.result?.ogTitle,
      description: (meta.result && meta.result.ogDescription) || ' ', // add *something*, even if ogDesc is empty (keeps Atom feed validation happy)
    });
  });

  return req.query.raw ? res.sendStatus(200) : res.redirect('/');
});

router.post('/:id?', isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  const apDb = req.app.get('apDb');

  const params = {};
  const { id } = req.params;
  let bookmark;

  // TODO: lol this pattern is so horrible
  try {
    // eslint-disable-next-line no-new
    new URL(req.body.url);
  } catch {
    res.send('error: invalid URL');
    return;
  }

  console.log(req.body.tags);
  let tags = JSON.parse(decodeURIComponent(req.body.tags) || '[]')
    ?.map((x) => `#${x}`)
    .join(' ');
  const hashtagFormat = /^(#[a-zA-Z0-9.\-_:]+ )*#[a-zA-Z0-9.\-_:]+\s*$/gm;
  if (tags.length > 0) {
    if (!hashtagFormat.test(tags)) {
      res.send(`invalid tags: ${tags}\nmust be in #hashtag #format, tag name supports a-z, A-Z, 0-9 and the following word separators: -_.`);
      return;
    }
  } else {
    tags = null;
  }

  if (id) {
    const bookmarkToUpdate = await bookmarksDb.getBookmark(id);

    // We have a bookmark we can update
    if (bookmarkToUpdate) {
      bookmark = await bookmarksDb.updateBookmark(id, {
        url: req.body.url.trim(),
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        tags,
      });
      await apDb.setPermissionsForBookmark(id, req.body.allowed || '', req.body.blocked || '');

      broadcastMessage(bookmark, 'update', apDb, account, domain);
    }
  } else {
    const noTitle = req.body.title === '';
    const noDescription = req.body.title === '';
    let meta = {};
    if (noTitle || noDescription) {
      try {
        meta = await ogScraper({ url: req.body.url });
        if (meta.result?.ogDescription !== undefined) {
          meta.result.ogDescription = `"${meta.result.ogDescription}"`;
        }
      } catch (e) {
        console.log(`couldn't fetch opengraph data for ${req.body.url}: ${e}`);
      }
    }

    const mergedObject = {
      title: meta?.result?.ogTitle,
      description: meta?.result?.ogDescription,
      ...removeEmpty(req.body),
    };
    bookmark = await bookmarksDb.createBookmark({
      // STRONG PARAMETERS
      url: mergedObject.url.trim(),
      title: mergedObject.title?.trim() || '',
      description: mergedObject.description?.trim() || '',
      tags,
    });

    broadcastMessage(bookmark, 'create', apDb, account, domain);
  }

  params.bookmarks = bookmark;
  params.error = params.bookmarks ? null : data.errorMessage;

  // Return the info to the client
  if (req.query.raw) {
    res.send(params);
  } else if (req.query.ephemeral === 'true') {
    res.send('<script>window.close();</script>');
  } else {
    res.redirect(`/bookmark/${bookmark.id}`);
  }
});
