import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import { actorMatchesUsername, parseJSON } from "../../util.js";
import { signAndSend, getInboxFromActorProfile } from "../../activitypub.js";

export const router = express.Router();

async function sendAcceptMessage(thebody, name, domain, req, res, targetDomain) {
  const db = req.app.get("apDb");
  const guid = crypto.randomBytes(16).toString("hex");
  let message = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `https://${domain}/u/${name}/accept/${guid}`,
    type: "Accept",
    actor: `https://${domain}/u/${name}`,
    object: thebody,
  };

  const inbox = await getInboxFromActorProfile(message.object.actor);

  signAndSend(message, name, domain, db, targetDomain, inbox);
}

router.post("/", async function (req, res) {
  // console.log(req.body);
  let domain = req.app.get("domain");
  const myURL = new URL(req.body.actor);
  let targetDomain = myURL.hostname;
  if (typeof req.body.object === "string" && req.body.type === "Follow") {
    let name = req.body.object.replace(`https://${domain}/u/`, "");
    await sendAcceptMessage(req.body, name, domain, req, res, targetDomain);
    // Add the user to the DB of accounts that follow the account
    let db = req.app.get("apDb");
    // get the followers JSON for the user
    const oldFollowersText = (await db.getFollowers()) || "[]";

    // update followers
    let followers = parseJSON(oldFollowersText);
    if (followers) {
      followers.push(req.body.actor);
      // unique items
      followers = [...new Set(followers)];
    } else {
      followers = [req.body.actor];
    }
    let newFollowersText = JSON.stringify(followers);
    try {
      // update into DB
      const newFollowers = await db.setFollowers(newFollowersText);

      console.log("updated followers!");
    } catch (e) {
      console.log("error storing followers after follow", e);
    }
  } else if (req.body.type === "Undo" && req.body.object.type === "Follow") {
    let name = req.body.object.object.replace(`https://${domain}/u/`, "");
    await sendAcceptMessage(req.body, name, domain, req, res, targetDomain);

    // Remove the user from the DB of accounts that follow the account
    let db = req.app.get("apDb");

    // get the followers JSON for the user
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
  } else if (req.body.type === "Accept" && req.body.object.type === "Follow") {
    let db = req.app.get("apDb");

    const oldFollowingText = (await db.getFollowing()) || "[]";

    let follows = parseJSON(oldFollowingText);

    console.log('recording that we are now following ', req.body.actor)

    if (follows) {
      follows.push(req.body.actor);
      // unique items
      follows = [...new Set(follows)];
    } else {
      follows = [req.body.actor];
    }
    let newFollowingText = JSON.stringify(follows);

    try {
      // update into DB
      const newFollowing = await db.setFollowing(newFollowingText);

      console.log("updated following!");
    } catch (e) {
      console.log("error storing follows after follow action", e);
    }
  } else if (req.body.type === "Create" && req.body.object.type === "Note") {
    const apDb = req.app.get("apDb");
    const bookmarksDb = req.app.get("bookmarksDb");

    const domain = req.app.get("domain");

    console.log(JSON.stringify(req.body));
    const inReplyToGuid = req.body.object.inReplyTo.match(
      `https://${domain}/m/(.+)`
    )[1];

    if (inReplyToGuid === undefined) {
      // TODO: support reply chains, aka normal human conversations
      console.log("couldn't parse which message this is in reply to");
      res.sendStatus(422);
    }

    const bookmarkId = await apDb.getBookmarkIdFromMessageGuid(inReplyToGuid);

    if (typeof bookmarkId !== "number") {
      console.log("couldn't find a bookmark this message is related to");
      res.sendStatus(400);
    }

    const bookmarkPermissions = await apDb.getPermissionsForBookmark(
      bookmarkId
    );
    const globalPermissions = await apDb.getGlobalPermissions();

    const bookmarkBlocks = bookmarkPermissions?.blocked?.split("\n") || [];
    const globalBlocks = globalPermissions?.blocked?.split("\n") || [];

    const bookmarkAllows = bookmarkPermissions?.allowed?.split("\n") || [];
    const globalAllows = globalPermissions?.allowed?.split("\n") || [];

    const blocklist = bookmarkBlocks
      .concat(globalBlocks)
      .filter((x) => x.match(/^@([^@]+)@(.+)$/));
    const allowlist = bookmarkAllows
      .concat(globalAllows)
      .filter((x) => x.match(/^@([^@]+)@(.+)$/));

    if (
      blocklist.length > 0 &&
      blocklist
        .map((username) => actorMatchesUsername(req.body.actor, username))
        .some((x) => x)
    ) {
      console.log(
        `Actor ${req.body.actor} matches a blocklist item, ignoring comment`
      );
      return res.sendStatus(403);
    }
    // TODO fetch actor details PS do NOT write your own URL regex
    const actorDetails = req.body.actor.match(
      /https?:\/\/([^\/]+)\/users\/([a-zA-Z0-9\_]+)/
    );
    const actorDomain = actorDetails[1];
    const actorUsername = actorDetails[2];

    const actor = `@${actorUsername}@${actorDomain}`;
    const commentUrl = req.body.object.id;

    let visible = 0;
    if (
      allowlist
        .map((username) => actorMatchesUsername(req.body.actor, username))
        .some((x) => x)
    ) {
      console.log(
        `Actor ${req.body.actor} matches an allowlist item, marking comment visible`
      );
      visible = 1;
    }

    bookmarksDb.createComment(
      bookmarkId,
      actor,
      commentUrl,
      req.body.object.content,
      visible
    );

    return res.sendStatus(200);
  }
});
