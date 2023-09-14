import session from 'express-session';
import connectSqlite from 'connect-sqlite3';

const SQLiteStore = connectSqlite(session);

export default () =>
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: '.data/',
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

      if (req.body.sendTo && req.body.sendTo.startsWith('/')) {
        return res.redirect(decodeURIComponent(req.body.sendTo));
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
