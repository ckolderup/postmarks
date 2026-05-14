import session from 'express-session';
import connectSqlite from 'connect-sqlite3';
import { dataDir } from './util.js';

const SQLiteStore = connectSqlite(session);

export default () =>
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: `${dataDir}/`,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
  });

export function isAuthenticated(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect(`/login?sendTo=${encodeURIComponent(req.originalUrl)}`); // TODO: redirect on hitting this? or better provide an error?
}

// Same-origin path only: must start with "/", must not start with "//"
// or "/\" (which browsers treat as a protocol-relative URL), and the same
// must still hold after decodeURIComponent (so "/%2fevil.com" cannot slip
// through). Returns true iff it is safe to use as a Location header.
function isSafeRelativeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return false; }
  if (!decoded.startsWith('/')) return false;
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return false;
  return true;
}

export function login(req, res, next) {
  req.session.regenerate((err) => {
    if (err) {
      next(err);
    }

    if (req.body.password === process.env.ADMIN_KEY) {
      req.session.loggedIn = true;
    }

    req.session.save((saveErr) => {
      if (saveErr) {
        return next(saveErr);
      }

      const sendTo = req.body.sendTo;
      if (isSafeRelativeRedirect(sendTo)) {
        return res.redirect(decodeURIComponent(sendTo));
      }
      return res.redirect('/');
    });
  });
}

export function logout(req, res, next) {
  req.session.user = null;
  req.session.save((err) => {
    if (err) {
      next(err);
    }

    req.session.regenerate((regenErr) => {
      if (regenErr) {
        next(regenErr);
      }
      res.redirect('/');
    });
  });
}
