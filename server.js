import * as dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { create } from "express-handlebars";

import { domain, account, simpleLogger, actorInfo } from "./src/util.js";
import session, { isAuthenticated } from "./src/session-auth.js";
import * as bookmarksDb from "./src/bookmarks-db.js";
import * as apDb from "./src/activity-pub-db.js";

import routes from "./src/routes/index.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.json({ type: "application/activity+json" }));
app.use(session());

app.use((req, res, next) => {
  res.locals.loggedIn = req.session.loggedIn;
  return next();
});

app.set("site_name", actorInfo.displayName || "Postmarks");
app.set("bookmarksDb", bookmarksDb);
app.set("apDb", apDb);
app.set("account", account);
app.set("domain", domain);

app.disable("x-powered-by");

//force HTTPS in production
if (process.env.ENVIRONMENT === "production") {
  app.set("trust proxy", ["127.0.0.1", "10.0.0.0/8"]);

  app.use(({ secure, hostname, url, port }, response, next) => {
    if (!secure) {
      return response.redirect(
        308,
        `https://${hostname}${url}${port ? `:${port}` : ""}`
      );
    }

    next();
  });
} else {
  console.log("ENVIRONMENT is not 'production', HTTPS not forced");
}

const hbs = create({
  helpers: {
    pluralize(number, singular, plural) {
      if (number === 1) return singular;
      else return typeof plural === "string" ? plural : singular + "s";
    },
    htmlize(text) {
      // uh-oh. ohhhh no.
      return text?.replace("\n", "<br/>");
    },
    siteName() {
      return app.get("site_name");
    },
    account() {
      return app.get("account");
    },
    feedLink() {
      return `<link rel="alternate" type="application/atom+xml" href="https://${app.get(
        "domain"
      )}/index.xml" />`;
    },
    projectUrl() {
      return `https://${app.get("domain")}`;
    },
    glitchProjectName() {
      return process.env.PROJECT_DOMAIN;
    },
    section(name, options) {
      if (!this._sections) this._sections = {};
      this._sections[name] = options.fn(this);
      return null;
    },
  },
  partialsDir: "./src/pages/partials",
  extname: ".hbs",
});

app.set("view engine", ".hbs");
app.set("views", "./src/pages");
app.engine(".hbs", hbs.engine);

app.use(simpleLogger);

app.use("/admin", isAuthenticated, routes.admin);
app.use("/", routes.auth);
app.use("/bookmark", routes.bookmark);
app.use("/comment", routes.comment);
app.use("/.well-known/webfinger", cors(), routes.webfinger);
app.use("/u", cors(), routes.user);
app.use("/m", cors(), routes.message);
app.use("/", routes.core);
app.use("/api/inbox", cors(), routes.inbox);
app.use("/.well-known/nodeinfo", routes.nodeinfo)
app.use("/nodeinfo/2.0", routes.nodeinfo)

app.listen(PORT, () => console.log(`App listening on port ${ PORT }`));