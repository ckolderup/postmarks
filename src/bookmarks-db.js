/**
 * Module handles database management
 *
 * Server API calls the methods in here to query and update the SQLite database
 */

// Utilities we need
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
// unclear why eslint can't resolve this package
// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import { stripHtml } from 'string-strip-html';
import { timeSince, account, domain } from './util.js';

const ACCOUNT_MENTION_REGEX = new RegExp(`^@${account}@${domain} `);

// Initialize the database
const dbFile = './.data/bookmarks.db';
const exists = fs.existsSync(dbFile);
let db;

// for now, strip the HTML when we retrieve it from the DB, just so that we keep as much data as possible
// if we ultimately decide that we don't want to do something fancier with keeping bold, italics, etc but
// discarding Mastodon's presentational HTML tags, then we'll remove this and handle that at the time comments get stored
function stripHtmlFromComment(comment) {
  return { ...comment, content: stripHtml(comment.content).result };
}

function stripMentionFromComment(comment) {
  return {
    ...comment,
    content: comment.content.replace(ACCOUNT_MENTION_REGEX, ''),
  };
}

function generateLinkedDisplayName(comment) {
  const match = comment.name.match(/^@([^@]+)@(.+)$/);
  return {
    linked_display_name: `<a href="http://${match[2]}/@${match[1]}">${match[1]}</a>`,
    ...comment,
  };
}

function addBookmarkDomain(bookmark) {
  return { domain: new URL(bookmark.url).hostname, ...bookmark };
}

function insertRelativeTimestamp(object) {
  return {
    timestamp: timeSince(new Date(object.created_at).getTime()),
    ...object,
  };
}

function addTags(bookmark) {
  const tagNames = bookmark.tags
    ?.split(' ')
    .map((t) => t.slice(1))
    .sort();
  return { tagNames, ...bookmark };
}

function massageBookmark(bookmark) {
  return addBookmarkDomain(addTags(insertRelativeTimestamp(bookmark)));
}

function massageComment(comment) {
  return generateLinkedDisplayName(stripMentionFromComment(stripHtmlFromComment(insertRelativeTimestamp(comment))));
}

/*
We're using the sqlite wrapper so that we can make async / await connections
- https://www.npmjs.com/package/sqlite
*/
open({
  filename: dbFile,
  driver: sqlite3.Database,
}).then(async (dBase) => {
  db = dBase;

  try {
    if (!exists) {
      // eslint-disable-next-line no-bitwise
      const newDb = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          throw new Error(`unable to open or create database: ${err}`);
        }
      });

      newDb.close();

      // now do it again, using the async/await library
      await open({
        filename: dbFile,
        driver: sqlite3.Database,
      }).then(async () => {
        db = dBase;
      });

      // Database doesn't exist yet - create Bookmarks table
      await db.run(
        'CREATE TABLE bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, url TEXT, description TEXT, tags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);',
      );

      // Add default choices to table
      const defaults = [
        {
          title: 'Postmarks - Getting Started',
          url: 'https://casey.kolderup.org/notes/b059694f5064c6c6285075c894a72317.html',
          description: 'Some notes on setup and acknowledgements',
          tags: '#postmarks #default',
        },
        {
          title: 'Postmarks - Ethos',
          url: 'https://casey.kolderup.org/notes/edf3a659f52528da103ea4dcbb09f66f.html',
          description: 'A short writeup about the influences and goals that led to the creation of Postmarks',
          tags: '#postmarks #default',
        },
        {
          title: 'Postmarks - Future Ideas',
          url: 'https://casey.kolderup.org/notes/9307f6d67bbfedbd215ae2d09caeab39.html',
          description: 'Some places I hope to take the platform in the future',
          tags: '#postmarks #default',
        },
      ];

      await db.run(
        'CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, url TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, visible integer BOOLEAN DEFAULT 0 NOT NULL CHECK (visible IN (0,1)), bookmark_id INTEGER, FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE);',
      );
      await db.run('CREATE UNIQUE INDEX comments_url ON comments(url)');

      const defaultsAsValuesList = defaults.map((b) => `('${b.title}', '${b.url}', '${b.description}', '${b.tags}')`).join(', ');
      db.run(`INSERT INTO bookmarks (title, url, description, tags) VALUES ${defaultsAsValuesList}`);
    }
  } catch (dbError) {
    console.error(dbError);
  }
});

export async function getBookmarkCount() {
  const result = await db.get('SELECT count(id) as count FROM bookmarks');
  return result?.count;
}

export async function getBookmarks(limit = 10, offset = 0) {
  // We use a try catch block in case of db errors
  try {
    const results = await db.all(
      'SELECT bookmarks.*, count(comments.id) as comment_count from bookmarks LEFT OUTER JOIN comments ON bookmarks.id = comments.bookmark_id AND comments.visible = 1 GROUP BY bookmarks.id ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      limit,
      offset,
    );
    return results.map((b) => massageBookmark(b));
  } catch (dbError) {
    // Database connection error
    console.error(dbError);
  }
  return undefined;
}

export async function getBookmarkCountForTags(tags) {
  const tagClauses = tags.map(() => `(tags like ? OR tags like ?)`).join(' AND ');
  const tagParams = tags.map((tag) => [`%${tag}% `, `%${tag}%`]).flat();
  const result = await db.get.apply(db, [`SELECT count(id) as count from bookmarks WHERE ${tagClauses}`, ...tagParams]);
  return result?.count;
}

export async function getBookmarksForTags(tags, limit = 10, offset = 0) {
  // We use a try catch block in case of db errors
  try {
    const tagClauses = tags.map(() => `(tags like ? OR tags like ?)`).join(' AND ');
    const tagParams = tags.map((tag) => [`%${tag}% `, `%${tag}%`]).flat();
    const results = await db.all.apply(db, [
      `SELECT * from bookmarks WHERE ${tagClauses} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      ...tagParams,
      limit,
      offset,
    ]);
    return results.map((b) => massageBookmark(b));
  } catch (dbError) {
    // Database connection error
    console.error(dbError);
  }
  return undefined;
}

export async function getBookmark(id) {
  try {
    const result = await db.get(
      'SELECT bookmarks.*, count(comments.id) as comment_count from bookmarks LEFT OUTER JOIN comments ON bookmarks.id = comments.bookmark_id AND comments.visible = 1 WHERE bookmarks.id = ?',
      id,
    );
    return massageBookmark(result);
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function getTags() {
  try {
    const allTagFields = await db.all('SELECT tags from bookmarks');
    const allTags = allTagFields.map((bookmarkTagList) => bookmarkTagList.tags?.split(' ')).flat();
    const parsedTags = allTags.filter((t) => t !== undefined).map((t) => t.slice(1));

    return [...new Set(parsedTags)].sort();
  } catch (dbError) {
    // Database connection error
    console.error(dbError);
  }
  return undefined;
}

export async function getNetworkPosts() {
  try {
    const result = await db.all('SELECT * from comments WHERE bookmark_id IS NULL ORDER BY created_at DESC');

    return result;
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function createBookmark(body) {
  try {
    const result = await db.run(
      'INSERT INTO bookmarks (title, url, description, tags) VALUES (?, ?, ?, ?)',
      body.title,
      body.url,
      body.description,
      body.tags,
    );

    return getBookmark(result.lastID);
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function updateBookmark(id, body) {
  try {
    await db.run(
      'UPDATE bookmarks SET title = ?, url = ?, description = ?, tags = ? WHERE id = ?',
      body.title,
      body.url,
      body.description,
      body.tags,
      id,
    );

    return await db.get('SELECT * from bookmarks WHERE id = ?', id);
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function deleteBookmark(id) {
  try {
    await db.run('DELETE from bookmarks WHERE id = ?', id);
  } catch (dbError) {
    console.error(dbError);
  }
}

export async function createComment(bookmarkId, name, url, content, visible = 0) {
  try {
    await db.run('INSERT INTO comments (name, url, content, bookmark_id, visible) VALUES (?, ?, ?, ?, ?)', name, url, content, bookmarkId, visible);
  } catch (dbError) {
    console.error(dbError);
  }
}

export async function deleteComment(url) {
  try {
    await db.run('DELETE FROM comments WHERE url = ?', url);
  } catch (dbError) {
    console.error(dbError);
  }
}

export async function toggleCommentVisibility(commentId) {
  try {
    await db.run('UPDATE comments SET visible = ((visible | 1) - (visible & 1)) WHERE id = ?', commentId);
  } catch (dbError) {
    console.error(dbError);
  }
}

export async function getAllCommentsForBookmark(bookmarkId) {
  try {
    const results = await db.all('SELECT * FROM comments WHERE bookmark_id = ?', bookmarkId);
    return results.map((c) => massageComment(c));
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function getVisibleCommentsForBookmark(bookmarkId) {
  try {
    const results = await db.all('SELECT * FROM comments WHERE visible = 1 AND bookmark_id = ?', bookmarkId);
    return results.map((c) => massageComment(c));
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function deleteHiddenCommentsForBookmark(bookmarkId) {
  try {
    await db.run('DELETE FROM comments WHERE visible = 0 AND bookmark_id = ?', bookmarkId);
  } catch (dbError) {
    console.error(dbError);
  }
}

export async function deleteAllBookmarks() {
  try {
    // Delete the bookmarks
    await db.run('DELETE from bookmarks');

    // Return empty array
    return [];
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}

export async function searchBookmarks(keywords) {
  try {
    const searchFields = ['title', 'description', 'url', 'tags'];
    const where = keywords.map(() => `(${searchFields.map((f) => `${f} like ?`).join(' or ')})`).join(' and ');
    const keywordParams = keywords.map((kw) => Array(searchFields.length).fill(`%${kw}%`)).flat();
    const results = await db.all.apply(db, [`SELECT * from bookmarks WHERE ${where} ORDER BY updated_at DESC LIMIT 20`, ...keywordParams]);
    return results.map((b) => massageBookmark(b));
  } catch (dbError) {
    console.error(dbError);
  }
  return undefined;
}
