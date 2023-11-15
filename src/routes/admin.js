import express from 'express';
import fs from 'fs';
// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import { stringify as csvStringify } from 'csv-stringify/sync'; // https://github.com/adaltas/node-csv/issues/323
import { domain, getActorInfo } from '../util.js';
import * as db from '../database.js';
import { isAuthenticated } from '../session-auth.js';
import { lookupActorInfo, createFollowMessage, createUnfollowMessage, signAndSend, getInboxFromActorProfile } from '../activitypub.js';

const DATA_PATH = '/app/.data';

const ADMIN_LINKS = [
  { href: '/admin', label: 'Bookmarklet' },
  { href: '/admin/bookmarks', label: 'Import bookmarks' },
  { href: '/admin/followers', label: 'Permissions & followers' },
  { href: '/admin/following', label: 'Federated follows' },
  { href: '/admin/data', label: 'Data export' },
];

const router = express.Router();

router.get('/', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Bookmarklet' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;
  params.bookmarklet = `javascript:(function(){w=window.open('https://${domain}/bookmark/popup?url='+encodeURIComponent(window.location.href)+'&highlight='+encodeURIComponent(window.getSelection().toString()),'postmarks','scrollbars=yes,width=550,height=600');})();`;
  params.bookmarkletTruncated = `${params.bookmarklet.substr(0, 30)}…`;

  return res.render('admin', params);
});

router.get('/bookmarks', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Import bookmarks' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;

  return res.render('admin/bookmarks', params);
});

router.get('/followers', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Permissions & followers' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;

  const { actorInfo } = await getActorInfo();
  // TODO
  if (actorInfo.disabled) {
    return res.render('nonfederated', params);
  }

  params.followers = (await db.all('select actor from followers')).map(({ actor }) => actor);

  params.blocks = (await db.all('select actor from blocks')).map(({ actor }) => actor);

  const permissions = await db.get('select actor, status from permissions where bookmark_id = 0');

  params.blocked = [];
  params.allowed = [];

  permissions.forEach(({ actor, status }) => {
    if (status) {
      params.blocked.push(actor);
    } else {
      params.allowed.push(actor);
    }
  });

  return res.render('admin/followers', params);
});

router.get('/following', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Federated follows' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;

  const { actorInfo } = await getActorInfo();

  // TODO
  if (actorInfo.disabled) {
    return res.render('nonfederated', params);
  }

  params.following = (await db.all('select actor from following')).map(({ actor }) => actor);

  return res.render('admin/following', params);
});

router.get('/data', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Data export' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;
  params.hasLegacyActivitypubDb = fs.existsSync(`${DATA_PATH}/activitypub.db`);

  return res.render('admin/data', params);
});

router.get('/bookmarks.db', isAuthenticated, async (req, res) => {
  const filePath = `${DATA_PATH}/bookmarks.db`;

  res.setHeader('Content-Type', 'application/vnd.sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.db"');

  res.download(filePath);
});

router.get('/bookmarks.csv', isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  const bookmarks = await bookmarksDb.getBookmarksForCSVExport();
  const result = csvStringify(bookmarks, { quoted: true });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.csv"');

  res.send(result);
});

router.get('/activitypub.db', isAuthenticated, async (req, res) => {
  const filePath = `${DATA_PATH}/activitypub.db`;

  if (!fs.existsSync(filePath)) {
    res.status(404).send('This Postmarks instance does not include a legacy actiivtypub.db file.');
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename="activitypub.db"');

  res.download(filePath);
});

router.post('/followers/block', isAuthenticated, async (req, res) => {
  const { actor } = req.body;

  if (!actor) {
    return res.status(400).send('No actor specified');
  }

  await db.run('delete from followers where actor = ?', actor);

  await db.run('insert into blocks (actor) values ? on conflict (actor) do nothing', actor);

  return res.redirect('/admin/followers');
});

router.post('/followers/unblock', isAuthenticated, async (req, res) => {
  await db.run('delete from blocks where actor = ?', req.body.actor);
  res.redirect('/admin/followers');
});

router.post('/following/follow', isAuthenticated, async (req, res) => {
  const { username: account } = await getActorInfo();

  const canonicalUrl = await lookupActorInfo(req.body.actor);

  try {
    const inbox = await getInboxFromActorProfile(canonicalUrl);

    if (inbox) {
      const followMessage = await createFollowMessage(account, domain, canonicalUrl);
      signAndSend(followMessage, account, domain, req.body.actor.split('@').slice(-1), inbox);
    }

    return res.redirect('/admin/following');
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Couldn't process follow request");
  }
});

router.post('/following/unfollow', isAuthenticated, async (req, res) => {
  const { username: account } = await getActorInfo();
  const { actor } = req.body;

  await db.run('delete from followers where actor = ?', actor);
  const inbox = await getInboxFromActorProfile(actor);
  const unfollowMessage = createUnfollowMessage(account, domain, actor);
  signAndSend(unfollowMessage, account, domain, new URL(actor).hostname, inbox);
  return res.redirect('/admin/following');
});

router.post('/permissions', isAuthenticated, async (req, res) => {
  const { allowed, blocked } = req.body;

  const records = JSON.parse(allowed)
    .map((actor) => ({ bookmark_id: 0, actor, status: 1 }))
    .concat(JSON.parse(blocked).map((actor) => ({ bookmark_id: 0, actor, status: 0 })));

  if (records.length) {
    const [insert, values] = db.buildInsert(records);

    await db.run(
      `
      insert into permissions
      ${insert}
      on conflict (bookmark_id, actor) do update set status = excluded.status
    `,
      values,
    );
  }

  res.redirect('/admin');
});

router.post('/reset', isAuthenticated, async (req, res) => {
  const bookmarksDb = req.app.get('bookmarksDb');
  await bookmarksDb.deleteAllBookmarks();
  res.redirect('/admin');
});

export default router;
