import express from 'express';
// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import { stringify as csvStringify } from 'csv-stringify/sync'; // https://github.com/adaltas/node-csv/issues/323
import { domain, getActorInfo, parseJSON } from '../util.js';
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

  const apDb = req.app.get('apDb');

  const { actorInfo } = await getActorInfo();
  // TODO
  if (actorInfo.disabled) {
    return res.render('nonfederated', params);
  }

  const permissions = await apDb.getGlobalPermissions();

  try {
    const followers = await apDb.getFollowers();
    params.followers = JSON.parse(followers || '[]');
  } catch (e) {
    console.log('Error fetching followers for admin page');
  }

  try {
    const blocks = await apDb.getBlocks();
    params.blocks = JSON.parse(blocks || '[]');
  } catch (e) {
    console.log('Error fetching blocks for admin page');
  }

  params.allowed = permissions?.allowed || '';
  params.blocked = permissions?.blocked || '';

  return res.render('admin/followers', params);
});

router.get('/following', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Federated follows' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;

  const apDb = req.app.get('apDb');

  const { actorInfo } = await getActorInfo();
  // TODO
  if (actorInfo.disabled) {
    return res.render('nonfederated', params);
  }

  try {
    const following = await apDb.getFollowing();
    params.following = JSON.parse(following || '[]');
  } catch (e) {
    console.log('Error fetching followers for admin page');
  }

  return res.render('admin/following', params);
});

router.get('/data', isAuthenticated, async (req, res) => {
  const params = req.query.raw ? {} : { title: 'Data export' };
  params.adminLinks = ADMIN_LINKS;
  params.currentPath = req.originalUrl;

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

  res.setHeader('Content-Type', 'application/vnd.sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename="activitypub.db"');

  res.download(filePath);
});

router.post('/followers/block', isAuthenticated, async (req, res) => {
  const db = req.app.get('apDb');

  const oldFollowersText = (await db.getFollowers()) || '[]';

  // update followers
  const followers = parseJSON(oldFollowersText);
  if (followers) {
    followers.forEach((follower, idx) => {
      if (follower === req.body.actor) {
        followers.splice(idx, 1);
      }
    });
  }

  const newFollowersText = JSON.stringify(followers);

  try {
    await db.setFollowers(newFollowersText);
  } catch (e) {
    console.log('error storing followers after unfollow', e);
  }

  const oldBlocksText = (await db.getBlocks()) || '[]';

  let blocks = parseJSON(oldBlocksText);

  if (blocks) {
    blocks.push(req.body.actor);
    // unique items
    blocks = [...new Set(blocks)];
  } else {
    blocks = [req.body.actor];
  }
  const newBlocksText = JSON.stringify(blocks);
  try {
    // update into DB
    await db.setBlocks(newBlocksText);

    console.log('updated blocks!');
  } catch (e) {
    console.log('error storing blocks after block action', e);
  }

  res.redirect('/admin/followers');
});

router.post('/followers/unblock', isAuthenticated, async (req, res) => {
  const db = req.app.get('apDb');

  const oldBlocksText = (await db.getBlocks()) || '[]';

  const blocks = parseJSON(oldBlocksText);
  if (blocks) {
    blocks.forEach((block, idx) => {
      if (block === req.body.actor) {
        blocks.splice(idx, 1);
      }
    });
  }

  const newBlocksText = JSON.stringify(blocks);

  try {
    await db.setBlocks(newBlocksText);
  } catch (e) {
    console.log('error storing blocks after unblock action', e);
  }

  res.redirect('/admin/followers');
});

router.post('/following/follow', isAuthenticated, async (req, res) => {
  const db = req.app.get('apDb');
  const { username: account } = await getActorInfo();

  const canonicalUrl = await lookupActorInfo(req.body.actor);

  try {
    const inbox = await getInboxFromActorProfile(canonicalUrl);

    if (inbox) {
      const followMessage = await createFollowMessage(account, domain, canonicalUrl, db);
      signAndSend(followMessage, account, domain, db, req.body.actor.split('@').slice(-1), inbox);
    }

    return res.redirect('/admin/following');
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Couldn't process follow request");
  }
});

router.post('/following/unfollow', isAuthenticated, async (req, res) => {
  const db = req.app.get('apDb');
  const { username: account } = await getActorInfo();

  const oldFollowsText = (await db.getFollowing()) || '[]';

  const follows = parseJSON(oldFollowsText);
  if (follows) {
    follows.forEach((follow, idx) => {
      if (follow === req.body.actor) {
        follows.splice(idx, 1);
      }
    });

    const inbox = await getInboxFromActorProfile(req.body.actor);

    const unfollowMessage = createUnfollowMessage(account, domain, req.body.actor, db);

    signAndSend(unfollowMessage, account, domain, db, new URL(req.body.actor).hostname, inbox);

    const newFollowsText = JSON.stringify(follows);

    try {
      await db.setFollowing(newFollowsText);
    } catch (e) {
      console.log('error storing follows after unfollow action', e);
    }
    return res.redirect('/admin/following');
  }
  return res.status(500).send('Encountered an error processing existing following list');
});

router.post('/permissions', isAuthenticated, async (req, res) => {
  const apDb = req.app.get('apDb');

  await apDb.setGlobalPermissions(req.body.allowed, req.body.blocked);

  res.redirect('/admin');
});

router.post('/reset', isAuthenticated, async (req, res) => {
  const db = req.app.get('bookmarksDb');

  await db.deleteAllBookmarks();
  res.redirect('/admin');
});

export default router;
