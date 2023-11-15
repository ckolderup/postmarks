import fetch from 'node-fetch';
import crypto from 'crypto';
import escapeHTML from 'escape-html';

import { signedGetJSON, signedPostJSON } from './signature.js';
import { actorMatchesUsername, replaceEmptyText } from './util.js';
import * as db from './database.js';

function getGuidFromPermalink(urlString) {
  return urlString.match(/(?:\/m\/)([a-zA-Z0-9+/]+)/)[1];
}

export async function signAndSend(message, name, domain, targetDomain, inbox) {
  try {
    const response = await signedPostJSON(inbox, {
      body: JSON.stringify(message),
    });
    const data = await response.text();

    console.log(`Sent message to an inbox at ${targetDomain}!`);
    console.log('Response Status Code:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.log('Error:', error.message);
    console.log('Stacktrace: ', error.stack);
  }
}

export function createNoteObject(bookmark, account, domain) {
  const guidNote = crypto.randomBytes(16).toString('hex');
  const d = new Date();

  const updatedBookmark = bookmark;

  updatedBookmark.title = escapeHTML(bookmark.title);
  updatedBookmark.description = escapeHTML(bookmark.description);

  let linkedTags = '';

  if (bookmark.tags && bookmark.tags.length > 0) {
    linkedTags = bookmark.tags
      ?.split(' ')
      .map((tag) => {
        const tagName = tag.slice(1);
        return `<a href="https://${domain}/tagged/${tagName}" class="mention hashtag" rel="tag nofollow noopener noreferrer">${tag}</a>`;
      })
      .join(' ');
  }

  if (updatedBookmark.description?.trim().length > 0) {
    updatedBookmark.description = `<br/>${updatedBookmark.description?.trim().replace('\n', '<br/>') || ''}`;
  }

  if (linkedTags.trim().length > 0) {
    linkedTags = `<p>${linkedTags}</p>`;
  }

  const noteMessage = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `https://${domain}/m/${guidNote}`,
    type: 'Note',
    published: d.toISOString(),
    attributedTo: `https://${domain}/u/${account}`,
    content: `<p><strong><a href="${updatedBookmark.url}" rel="nofollow noopener noreferrer">${replaceEmptyText(
      updatedBookmark.title,
      updatedBookmark.url,
    )}</a></strong>${updatedBookmark.description}</p>${linkedTags}`,
    to: [`https://${domain}/u/${account}/followers/`, 'https://www.w3.org/ns/activitystreams#Public'],
    tag: [],
  };

  bookmark.tags?.split(' ').forEach((tag) => {
    const tagName = tag.slice(1);
    noteMessage.tag.push({
      type: 'Hashtag',
      href: `https://${domain}/tagged/${tagName}`,
      name: tag,
    });
  });

  return noteMessage;
}

async function createMessage(noteObject, bookmarkId, account, domain) {
  const guidCreate = crypto.randomBytes(16).toString('hex');

  const message = {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: `https://${domain}/m/${guidCreate}`,
    type: 'Create',
    actor: `https://${domain}/u/${account}`,
    to: [`https://${domain}/u/${account}/followers/`, 'https://www.w3.org/ns/activitystreams#Public'],
    object: noteObject,
  };

  // TODO: does "insert or replace" work?
  await db.run(
    `
      insert or replace into messages
      (guid, bookmark_id, message)
      values (?, ?, ?)
    `,
    getGuidFromPermalink(noteObject.id),
    bookmarkId,
    JSON.stringify(noteObject),
  );

  return message;
}

async function createUpdateMessage(bookmark, account, domain) {
  const guid = (await db.get('select guid from messages where bookmark_id = ?', bookmark.id))?.guid;

  let note = `https://${domain}/m/${guid}`;

  // if the bookmark was created but not published to activitypub
  // we might need to just make our own note object to send along
  if (guid === undefined) {
    note = createNoteObject(bookmark, account, domain);
    await createMessage(note, bookmark.id, account, domain);
  }

  return {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    summary: `${account} updated the bookmark`,
    type: 'Create', // this should be 'Update' but Mastodon does weird things with Updates
    actor: `https://${domain}/u/${account}`,
    object: note,
  };
}

async function createDeleteMessage(bookmark, account, domain) {
  const guid = (await db.get('select guid from messages where bookmark_id = ?', bookmark.id))?.guid;

  await db.run('delete from messages where bookmark_id = ?', bookmark.id);

  return {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: `https://${domain}/m/${guid}`,
    type: 'Delete',
    actor: `https://${domain}/u/${account}`,
    to: [`https://${domain}/u/${account}/followers/`, 'https://www.w3.org/ns/activitystreams#Public'],
    object: {
      type: 'Tombstone',
      id: `https://${domain}/m/${guid}`,
    },
  };
}

export async function createFollowMessage(account, domain, target) {
  const guid = crypto.randomBytes(16).toString('hex');

  const followMessage = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: guid,
    type: 'Follow',
    actor: `https://${domain}/u/${account}`,
    object: target,
  };

  await db.run(
    `
      insert or replace into messages
      (guid, bookmark_id, message)
      values (?, ?, ?)
    `,
    guid,
    null,
    JSON.stringify(followMessage),
  );

  return followMessage;
}

export async function createUnfollowMessage(account, domain, target) {
  const undoGuid = crypto.randomBytes(16).toString('hex');

  const messageRows = await db.all('select * from messages where message like ?', `%${target}%`);

  console.log('result', messageRows);

  const followMessage = messageRows.find((row) => {
    const message = JSON.parse(row.message || '{}');
    return message.type === 'Follow' && message.object === target;
  });

  if (followMessage) {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Undo',
      id: undoGuid,
      actor: `${domain}/u/${account}`,
      object: followMessage.message,
    };
  }

  console.log('tried to find a Follow record in order to unfollow, but failed');
  return null;
}

export async function getInboxFromActorProfile(profileUrl) {
  const response = await signedGetJSON(`${profileUrl}.json`);
  const data = await response.json();

  if (data?.inbox) {
    return data.inbox;
  }
  throw new Error(`Couldn't find inbox at supplied profile url ${profileUrl}`);
}

// actorUsername format is @username@domain
export async function lookupActorInfo(actorUsername) {
  const parsedDomain = actorUsername.split('@').slice(-1);
  const parsedUsername = actorUsername.split('@').slice(-2, -1);
  try {
    const response = await fetch(`https://${parsedDomain}/.well-known/webfinger/?resource=acct:${parsedUsername}@${parsedDomain}`);
    const data = await response.json();
    const selfLink = data.links.find((o) => o.rel === 'self');
    if (!selfLink || !selfLink.href) {
      throw new Error();
    }

    return selfLink.href;
  } catch (e) {
    console.log("couldn't look up canonical actor info");
    return null;
  }
}

export async function broadcastMessage(bookmark, action, account, domain) {
  // TODO bail if activitypub not set up

  let followers = (await db.all('select actor from followers')).map((r) => r.actor);

  if (!followers.length) {
    console.log(`No followers for account ${account}@${domain}`);
    return;
  }

  const blocked = await db.all(
    `
    select actor
    from permissions
    where status = 0
    and (bookmark_id = 0 or bookmark_id = ?)
    `,
    bookmark.id,
  );
  const blocklist = blocked.map((b) => b.actor);

  // now let's try to remove the blocked users
  followers = followers.filter((actor) => {
    const matches = blocklist.forEach((username) => {
      actorMatchesUsername(actor, username);
    });

    return !matches?.some((x) => x);
  });

  const noteObject = createNoteObject(await bookmark, account, domain);
  let message;
  switch (action) {
    case 'create':
      message = await createMessage(noteObject, bookmark.id, account, domain);
      break;
    case 'update':
      message = await createUpdateMessage(bookmark, account, domain);
      break;
    case 'delete':
      message = await createDeleteMessage(bookmark, account, domain);
      break;
    default:
      console.log('unsupported action!');
      return;
  }

  console.log(`sending this message to all followers: ${JSON.stringify(message)}`);

  // eslint-disable-next-line no-restricted-syntax
  for (const follower of followers) {
    // TODO: Don't assume that this is where the user's inbox is
    const inbox = `${follower}/inbox`;
    const { host: targetDomain } = new URL(follower);
    signAndSend(message, account, domain, targetDomain, inbox);
  }
}

export function synthesizeActivity(note) {
  return {
    // Fake activity URI adds a "a-" prefix to the Note/message guid
    id: note.id.replace('/m/', '/m/a-'),
    type: 'Create',
    published: note.published,
    actor: note.attributedTo,
    object: note,
  };
}
