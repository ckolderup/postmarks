import admin from './admin.js';
import auth from './auth.js';
import bookmark from './bookmark.js';
import comment from './comment.js';
import core from './core.js';
import inbox from './activitypub/inbox.js';
import message from './activitypub/message.js';
import user from './activitypub/user.js';
import webfinger from './activitypub/webfinger.js';
import nodeinfo from './activitypub/nodeinfo.js';
import opensearch from './opensearch.js';

export default {
  admin,
  auth,
  bookmark,
  comment,
  core,
  inbox,
  message,
  user,
  webfinger,
  nodeinfo,
  opensearch,
};
