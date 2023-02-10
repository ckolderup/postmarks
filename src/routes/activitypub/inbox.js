import express from 'express';
import crypto from 'crypto';
import request from 'request';
import { actorMatchesUsername } from '../../util.js';

export const router = express.Router();

async function signAndSend(message, name, domain, req, res, targetDomain) {
  // get the URI of the actor object and append 'inbox' to it
  let inbox = message.object.actor+'/inbox';
  let inboxFragment = inbox.replace('https://'+targetDomain,'');
  // get the private key
  let db = req.app.get('apDb');
  const privkey = await db.getPrivateKey(`${name}@${domain}`);

  if (privkey === undefined) {
    return res.status(404).send(`No record found for ${name}.`);
  }
  else {
    const digestHash = crypto.createHash('sha256').update(JSON.stringify(message)).digest('base64');
    const signer = crypto.createSign('sha256');
    let d = new Date();
    let stringToSign = `(request-target): post ${inboxFragment}\nhost: ${targetDomain}\ndate: ${d.toUTCString()}\ndigest: SHA-256=${digestHash}`;
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(privkey);
    const signature_b64 = signature.toString('base64');
    let header = `keyId="https://${domain}/u/${name}",headers="(request-target) host date digest",signature="${signature_b64}"`;
    request({
      url: inbox,
      headers: {
        'Host': targetDomain,
        'Date': d.toUTCString(),
        'Digest': `SHA-256=${digestHash}`,
        'Signature': header
      },
      method: 'POST',
      json: true,
      body: message
    }, function (error, response){
      if (error) {
        console.log('Error:', error, response.body);
      }
      else {
        console.log('Response:', response.body);
      }
    });
    return res.status(200);
  }
}

function sendAcceptMessage(thebody, name, domain, req, res, targetDomain) {
  const guid = crypto.randomBytes(16).toString('hex');
  let message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${domain}/${guid}`,
    'type': 'Accept',
    'actor': `https://${domain}/u/${name}`,
    'object': thebody,
  };
  signAndSend(message, name, domain, req, res, targetDomain);
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch(e) {
    return null;
  }
}

router.post('/', async function (req, res) {
  // pass in a name for an account, if the account doesn't exist, create it!
  let domain = req.app.get('domain');
  const myURL = new URL(req.body.actor);
  let targetDomain = myURL.hostname;
  // TODO: add "Undo" follow event
  if (typeof req.body.object === 'string' && req.body.type === 'Follow') {
    let name = req.body.object.replace(`https://${domain}/u/`,'');
    sendAcceptMessage(req.body, name, domain, req, res, targetDomain);
    // Add the user to the DB of accounts that follow the account
    let db = req.app.get('apDb');
    // get the followers JSON for the user
    const oldFollowersText = await db.getFollowers(`${name}@${domain}`) || '[]';

    // update followers
    let followers = parseJSON(oldFollowersText);
    if (followers) {
      followers.push(req.body.actor);
      // unique items
      followers = [...new Set(followers)];
    }
    else {
      followers = [req.body.actor];
    }
    let newFollowersText = JSON.stringify(followers);
    try {
      // update into DB
      const newFollowers = await db.setFollowers(newFollowersText, `${name}@${domain}`);

      console.log('updated followers!', newFollowers);
    }
    catch(e) {
      console.log('error', e);
    }

  } else if (req.body.type === 'Create' && req.body.object.type === 'Note') {
    const apDb = req.app.get('apDb');
    const bookmarksDb = req.app.get('bookmarksDb');

    const domain = req.app.get('domain');

    console.log(JSON.stringify(req.body));
    const inReplyToGuid = req.body.object.inReplyTo.match(`https://${domain}/m/(.+)`)[1];

    if (inReplyToGuid === undefined) {
      // TODO: support reply chains, aka normal human conversations
      console.log("couldn't parse which message this is in reply to");
      res.sendStatus(422);
    }

    const bookmarkId = await apDb.getBookmarkIdFromMessageGuid(inReplyToGuid);

    if (typeof bookmarkId !== 'number') {
      console.log("couldn't find a bookmark this message is related to");
      res.sendStatus(400);
    }

    const bookmarkPermissions = await apDb.getPermissionsForBookmark(bookmarkId);
    const globalPermissions = await apDb.getGlobalPermissions();

    const bookmarkBlocks = bookmarkPermissions?.blocked?.split("\n") || [];
    const globalBlocks = globalPermissions?.blocked?.split("\n") || [];

    const bookmarkAllows = bookmarkPermissions?.allowed?.split("\n") || [];
    const globalAllows = globalPermissions?.allowed?.split("\n") || [];

    const blocklist = bookmarkBlocks.concat(globalBlocks).filter(x => x.match(/^@([^@]+)@(.+)$/));
    const allowlist = bookmarkAllows.concat(globalAllows).filter(x => x.match(/^@([^@]+)@(.+)$/));

    if (blocklist.length > 0 && blocklist.map((username) => actorMatchesUsername(req.body.actor, username)).some(x => x)) {
      console.log(`Actor ${req.body.actor} matches a blocklist item, ignoring comment`);
      return res.sendStatus(403);
    }
    // TODO fetch actor details PS do NOT write your own URL regex
    const actorDetails = req.body.actor.match(/https?:\/\/([^\/]+)\/users\/([a-zA-Z0-9\_]+)/);
    const actorDomain = actorDetails[1];
    const actorUsername = actorDetails[2];

    const actor = `@${actorUsername}@${actorDomain}`;
    const commentUrl = req.body.object.id

    let visible = 0;
    if (allowlist.map((username) => actorMatchesUsername(req.body.actor, username)).some(x => x)) {
      console.log(`Actor ${req.body.actor} matches an allowlist item, marking comment visible`);
      visible = 1;
    }

    bookmarksDb.createComment(bookmarkId, actor, commentUrl, req.body.object.content, visible);

    return res.sendStatus(200);
  }
});
