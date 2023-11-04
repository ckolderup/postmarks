import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { create } from 'express-handlebars';
import escapeHTML from 'escape-html';

import { domain, simpleLogger, getActorInfo, replaceEmptyText } from './src/util.js';
import session, { isAuthenticated } from './src/session-auth.js';
import * as bookmarksDb from './src/bookmarks-db.js';
import * as apDb from './src/activity-pub-db.js';
import * as db from './src/database.js';

import routes from './src/routes/index.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.json({ type: 'application/activity+json' }));
app.use(session());

app.use(async (req, res, next) => {
  res.locals.loggedIn = req.session.loggedIn;
  const { displayName } = await getActorInfo();
  res.locals.siteName = displayName;
  return next();
});

app.set('bookmarksDb', bookmarksDb);
app.set('apDb', apDb);
app.set('db', db);
app.set('domain', domain);

app.disable('x-powered-by');

// force HTTPS in production
if (process.env.ENVIRONMENT === 'production') {
  app.set('trust proxy', ['127.0.0.1', '10.0.0.0/8']);

  app.use(({ secure, hostname, url, port }, response, next) => {
    if (!secure) {
      return response.redirect(308, `https://${hostname}${url}${port ? `:${port}` : ''}`);
    }

    return next();
  });
} else {
  console.log("ENVIRONMENT is not 'production', HTTPS not forced");
}

const hbs = create({
  helpers: {
    pluralize(number, singular, plural) {
      if (number === 1) return singular;
      return typeof plural === 'string' ? plural : `${singular}s`;
    },
    htmlize(text) {
      // uh-oh. ohhhh no.
      const returnText = escapeHTML(text);
      return returnText?.replace('\n', '<br/>');
    },
    feedUrl() {
      return `https://${app.get('domain')}/index.xml`;
    },
    projectUrl() {
      return `https://${app.get('domain')}`;
    },
    glitchProjectName() {
      return process.env.PROJECT_DOMAIN;
    },
    section(name, options) {
      if (!this._sections) this._sections = {};
      this._sections[name] = options.fn(this);
      return null;
    },
    mastodonAccount() {
      return process.env.MASTODON_ACCOUNT;
    },
    ifIn(item, array, options) {
      const lowercased = array.map((tag) => tag.toLowerCase());
      return lowercased.indexOf(item.toLowerCase()) >= 0 ? options.fn(this) : options.inverse(this);
    },
    removeTag(tag, path) {
      return path
        .split('/')
        .filter((x) => x.toLowerCase() !== tag.toLowerCase())
        .join('/');
    },
    ifThisTag(tag, path, options) {
      return path.toLowerCase() === `/tagged/${tag}`.toLowerCase() ? options.fn(this) : options.inverse(this);
    },
    eq(a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    },
    setTitle(item) {
      return replaceEmptyText(item.title, item.url);
    },
  },
  partialsDir: './src/pages/partials',
  extname: '.hbs',
});

app.set('view engine', '.hbs');
app.set('views', './src/pages');
app.engine('.hbs', hbs.engine);

app.use(simpleLogger);

app.use('/admin', isAuthenticated, routes.admin);
app.use('/', routes.auth);
app.use('/bookmark', routes.bookmark);
app.use('/comment', routes.comment);
app.use('/.well-known/webfinger', cors(), routes.webfinger);
app.use('/u', cors(), routes.user);
app.use('/m', cors(), routes.message);
app.use('/', routes.core);
app.use('/api/inbox', cors(), routes.inbox);
app.use('/.well-known/nodeinfo', routes.nodeinfo);
app.use('/nodeinfo/2.0', routes.nodeinfo);

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
