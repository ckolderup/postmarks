# Postmarks

## About this project

Postmarks is a bookmarking site that you own yourself and can connect the Fediverse, interacting with other Postmarks sites as well as Mastodon/FireFish/any text-based ActivityPub platform. You can read more about it here:

- [Getting Started](https://casey.kolderup.org/notes/b059694f5064c6c6285075c894a72317.html)
- [Ethos](https://casey.kolderup.org/notes/edf3a659f52528da103ea4dcbb09f66f.html)
- [Future Ideas](https://casey.kolderup.org/notes/9307f6d67bbfedbd215ae2d09caeab39.html)

The site allows the owner to add, edit and delete bookmarks, but only if a valid login is provided.
Check the setup below to understand how to do that!

## Setting up your site

To set your app up:

- If you're using Glitch:
  - Rename your project immediately in the project settings, if you intend to be called something else. This determines the domain that your site lives at, which also determines the second half of your `@username@project-name.glitch.me` identity on the fediverse. NOTE: If you change this later, you will break the connection any existing followers have to your site, they'll have to re-follow the account on its new domain (and depending on the software they're following from, may even prevent them from unfollowing the old URL 😱)
  - In your `.env` editor, create a key `ADMIN_KEY` and give it a text string as a value. This is your "password" when your browser prompts you, so make it as secure as you need to protect your data.
  - Add another key to your .env called `SESSION_SECRET` and generate a random string for its value. This is your [session secret](http://expressjs.com/en/resources/middleware/session.html#secret), used to generate the hashed version of your session that gets encoded with the cookies used to store your login. If you make this string too easily guessable, you make it easier for someone to hijack your session and gain unauthorized login. Also, if you ever change this string, it will invalidate all existing cookies.
  - If you've got a custom domain in front of your Glitch project, add a key to your .env called `PUBLIC_BASE_URL` with the value set to the hostname (the part after the https://) at which you want the project to be accessible.
  - Edit the contents of `account.json.example` to set your `@username`, display name, bio, and avatar. (If you don't set a username, your default actor name will be 'bookmarks', so people will find you on the fediverse `@bookmarks@project-name.glitch.me`.)
  - THEN: either rename `account.json.example` to `account.json`, or copy the contents into a new file called `account.json`. Whatever `username` you have in this file when the project first starts you'll need to retain or else you'll break your followers' connection to this account.
- Otherwise:
  - Create a `.env` file in the root of the project.
  - Add the line `PUBLIC_BASE_URL=<hostname>` to your .env where \<hostname\> is the hostname of your instance.
  - Add the line `ADMIN_KEY=<key>` to your .env where \<key\> is the password you'll enter when the browser prompts you, and another line for `SESSION_SECRET=<secret>` where \<secret\> is a random string used when hashing your session for use in a secure cookie.
  - Make a file called `account.json` in the project root. Copy the contents of `account.json.example` into it and edit the values to set your `@username`, display name, bio, and avatar. (If you don't set a username, your default actor name will be 'bookmarks', so people will find you on the fediverse `@bookmarks@project-name.glitch.me`.)
- If you're using Glitch, you should be done! If you're running this yourself, run `npm run start` via whatever mechanism you choose to use to host this website.
- Click on the **Admin** link in the footer, and enter the password (whatever you set ADMIN_KEY to in the .env).
- You should be logged in, at which point you can configure various settings, import bookmarks, and use the "Add" links in the header and footer (as well as the bookmarklet, available in the Admin section) to save new bookmarks.

## Mastodon Verification

Setting `MASTODON_ACCOUNT` in the `.env` file will cause a link to be added to the Postmarks home page that can be used for verification with your Mastodon account. See the [Mastodon documentation](https://docs.joinmastodon.org/user/profile/#verification) for more details.

## Development & Contributions

See [CONTRIBUTING.md](/CONTRIBUTING.md) for more information on how to work with Postmarks' development environment as well
as how to submit your changes for

## Acknowledgments

- The "Postmarks" name is compliments of [Casey C](https://sowe.li) (no relation to Casey K), who brainstormed dozens of ideas for the name when Casey was first trying to rename the project. Thank you!
- Postmarks (in its default configuration) uses an edited version of Eynav Raphael's ["Postmark Stamp"](https://thenounproject.com/icon/postmark-stamp-928917/) icon from The Noun Project.
- It also makes use of free fonts including [Averia Sans](http://iotic.com/averia/) and [Public Sans](https://public-sans.digital.gov/).
- Much of the original form of the site's frontend is lifted from the starter projects available on [Glitch](https://glitch.com). Thank you to all the people who have contributed to those projects over the years!
- Much of the original backend of the site is based off of Darius Kazemi's [express-activitypub](https://github.com/dariusk/express-activitypub) repo. I made a point not to just clone his repo from the start, but then ended up retyping most of it as I learned how things work. While some pieces have been upgraded, much of Darius' work creates the foundation for Postmarks' ActivityPub functionality.

## We built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Need more help? [Check out the Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
