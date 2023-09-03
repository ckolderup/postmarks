import express from "express";
import fetch from "node-fetch";
import { domain, actorInfo, parseJSON } from "../util.js";
import { isAuthenticated } from "../session-auth.js";
import {
  lookupActorInfo,
  createFollowMessage,
  createUnfollowMessage,
  signAndSend,
  getInboxFromActorProfile
} from "../activitypub.js";
const DATA_PATH = "/app/.data";

export const router = express.Router();

router.get("/", isAuthenticated, async (req, res) => {
  let params = req.query.raw ? {} : { title: "Admin" };
  params.layout = "admin";

  params.bookmarklet = `javascript:(function(){w=window.open('https://${domain}/bookmark/popup?url='+encodeURIComponent(window.location.href)+'&highlight='+encodeURIComponent(window.getSelection().toString()),'postmarks','scrollbars=yes,width=550,height=600');})();`;

  return res.render("admin", params);
});

router.get("/bookmarks", isAuthenticated, async (req, res) => {
  let params = req.query.raw ? {} : { title: "Admin: Import bookmarks" };
  params.layout = "admin";

  return res.render("admin/bookmarks", params);
});

router.get("/followers", isAuthenticated, async (req, res) => {
  let params = req.query.raw ? {} : { title: "Admin: Permissions & followers" };
  params.layout = "admin";

  const apDb = req.app.get("apDb");

  if (actorInfo.disabled) {
    return res.render("nonfederated", params);
  }

  const permissions = await apDb.getGlobalPermissions();

  try {
    const followers = await apDb.getFollowers();
    params.followers = JSON.parse(followers || "[]");
  } catch (e) {
    console.log("Error fetching followers for admin page");
  }

  try {
    const blocks = await apDb.getBlocks();
    params.blocks = JSON.parse(blocks || "[]");
  } catch (e) {
    console.log("Error fetching blocks for admin page");
  }

  params.allowed = permissions?.allowed || "";
  params.blocked = permissions?.blocked || "";

  return res.render("admin/followers", params);
});

router.get("/following", isAuthenticated, async (req, res) => {
  let params = req.query.raw
    ? {}
    : { title: "Admin: Manage your federated follows" };
  params.layout = "admin";

  const apDb = req.app.get("apDb");

  if (actorInfo.disabled) {
    return res.render("nonfederated", params);
  }

  try {
    const following = await apDb.getFollowing();
    params.following = JSON.parse(following || "[]");
  } catch (e) {
    console.log("Error fetching followers for admin page");
  }

  return res.render("admin/following", params);
});

router.get("/data", isAuthenticated, async (req, res) => {
  let params = req.query.raw ? {} : { title: "Admin: Data export" };
  params.layout = "admin";

  return res.render("admin/data", params);
});

router.get("/bookmarks.db", isAuthenticated, async (req, res) => {
  const filePath = `${DATA_PATH}/bookmarks.db`;

  res.setHeader("Content-Type", "application/vnd.sqlite3");
  res.setHeader("Content-Disposition", 'attachment; filename="bookmarks.db"');

  res.download(filePath);
});

router.get("/activitypub.db", isAuthenticated, async (req, res) => {
  const filePath = `${DATA_PATH}/activitypub.db`;

  res.setHeader("Content-Type", "application/vnd.sqlite3");
  res.setHeader("Content-Disposition", 'attachment; filename="activitypub.db"');

  res.download(filePath);
});

router.post("/followers/block", isAuthenticated, async (req, res) => {
  let db = req.app.get("apDb");

  const oldFollowersText = (await db.getFollowers()) || "[]";

  // update followers
  let followers = parseJSON(oldFollowersText);
  if (followers) {
    followers.forEach((follower, idx, followers) => {
      if (follower === req.body.actor) {
        followers.splice(idx, 1);
      }
    });
  }

  let newFollowersText = JSON.stringify(followers);

  try {
    const updatedFollowers = await db.setFollowers(newFollowersText);
  } catch (e) {
    console.log("error storing followers after unfollow", e);
  }

  const oldBlocksText = (await db.getBlocks()) || "[]";

  let blocks = parseJSON(oldBlocksText);

  if (blocks) {
    blocks.push(req.body.actor);
    // unique items
    blocks = [...new Set(blocks)];
  } else {
    blocks = [req.body.actor];
  }
  let newBlocksText = JSON.stringify(blocks);
  try {
    // update into DB
    const newBlocks = await db.setBlocks(newBlocksText);

    console.log("updated blocks!");
  } catch (e) {
    console.log("error storing blocks after block action", e);
  }

  res.redirect("/admin/followers");
});

router.post("/followers/unblock", isAuthenticated, async (req, res) => {
  let db = req.app.get("apDb");

  const oldBlocksText = (await db.getBlocks()) || "[]";

  let blocks = parseJSON(oldBlocksText);
  if (blocks) {
    blocks.forEach((block, idx, blocks) => {
      if (block === req.body.actor) {
        blocks.splice(idx, 1);
      }
    });
  }

  let newBlocksText = JSON.stringify(blocks);

  try {
    const updatedBlocks = await db.setBlocks(newBlocksText);
  } catch (e) {
    console.log("error storing blocks after unblock action", e);
  }

  res.redirect("/admin/followers");
});

router.post("/following/follow", isAuthenticated, async (req, res) => {
  const db = req.app.get("apDb");
  const account = req.app.get("account");
  const domain = req.app.get("domain");

  const canonicalUrl = await lookupActorInfo(req.body.actor);

  try {
    const inbox = await getInboxFromActorProfile(canonicalUrl);

    if (inbox) {
      const followMessage = await createFollowMessage(
        account,
        domain,
        canonicalUrl,
        db
      );
      signAndSend(
        followMessage,
        account,
        domain,
        db,
        req.body.actor.split("@").slice(-1),
        inbox
      );
    }

    return res.redirect("/admin/following");
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Couldn't process follow request");
  }
});

router.post("/following/unfollow", isAuthenticated, async (req, res) => {
  const db = req.app.get("apDb");
  const account = req.app.get("account");
  const domain = req.app.get("domain");

  const oldFollowsText = (await db.getFollowing()) || "[]";

  let follows = parseJSON(oldFollowsText);
  if (follows) {
    follows.forEach((follow, idx, follows) => {
      if (follow === req.body.actor) {
        follows.splice(idx, 1);
      }
    });

    const inbox = await getInboxFromActorProfile(req.body.actor);

    const unfollowMessage = createUnfollowMessage(account, domain, req.body.actor, db);

    signAndSend(
        unfollowMessage,
        account,
        domain,
        db,
        new URL(req.body.actor).hostname,
        inbox
      );

    const oldFollowsText = (await db.getFollowing()) || "[]";

    follows.forEach((follow, idx, follows) => {
      if (follow === req.body.actor) {
        follows.splice(idx, 1);
      }
    });

    let newFollowsText = JSON.stringify(follows);

    try {
      const updatedFollows = await db.setFollowing(newFollowsText);
    } catch (e) {
      console.log("error storing follows after unfollow action", e);
    }
    res.redirect("/admin/following");
  } else {
    return res.status(500).send('Encountered an error processing existing following list');
  }
});

router.post("/permissions", isAuthenticated, async (req, res) => {
  const apDb = req.app.get("apDb");

  await apDb.setGlobalPermissions(req.body.allowed, req.body.blocked);

  res.redirect("/admin");
});

router.post("/reset", isAuthenticated, async (req, res) => {
  const db = req.app.get("bookmarksDb");

  await db.deleteAllBookmarks();
  res.redirect("/admin");
});
