import * as admin from './admin';
import * as auth from './auth';
import * as bookmark from './bookmark';
import * as comment from './comment';
import * as core from './core';
import * as inbox from './activitypub/inbox';
import * as message from './activitypub/message';
import * as user from './activitypub/user';
import * as webfinger from './activitypub/webfinger';
import * as nodeinfo from './activitypub/nodeinfo';

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
};
