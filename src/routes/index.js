import { router as admin } from './admin.js';
import { router as auth } from "./auth.js";
import { router as bookmark } from './bookmark.js';
import { router as comment } from './comment.js';
import { router as core } from './core.js';
import { router as inbox } from './activitypub/inbox.js';
import { router as message } from './activitypub/message.js';
import { router as user } from './activitypub/user.js';
import { router as webfinger } from './activitypub/webfinger.js';
import { router as nodeinfo } from './activitypub/nodeinfo.js';

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
