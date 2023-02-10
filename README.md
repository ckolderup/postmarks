# Fedimarks

![](https://cdn.glitch.global/8b08fe2b-99fe-48bd-9a54-d17f87b3df2b/pikaconstruct.gif?v=1669741965488)

## About this project

I've actually written a bit about Fedimarks. They show up as default bookmarks when you first install or on the
[demo site](https://fedimarks.glitch.me) but they are:

* [Getting Started](https://casey.kolderup.org/notes/b059694f5064c6c6285075c894a72317.html)
* [Ethos](https://casey.kolderup.org/notes/edf3a659f52528da103ea4dcbb09f66f.html)
* [Future Ideas](https://casey.kolderup.org/notes/9307f6d67bbfedbd215ae2d09caeab39.html) (with any luck, this is already out-of-date! who knows!)

The site __Admin__ page allows the user to add, edit and delete bookmarks–but only if a valid login is provided.
Check the setup below to understand how to do that!

## Setting up your site

To set your app up:

* If you're using Glitch:
  * Rename your project immediately in the project settings, if you intend to be called something else. If you change this later, you're likely to break the connection any existing followers have to your site.
  * In your `.env` editor, create a key `ADMIN_KEY` and give it a text string as a value. This is your "password" when your browser prompts you.
  * Create another key, this time called `ACTOR_NAME`. The value of this will determine the username (`@username@project-name.glitch.me`) that will identify you on the fediverse. (If you don't do this, your default actor name will be 'bookmarks', so people will find you on the fediverse `@bookmarks@project-name.glitch.me`.)
* Otherwise:
  * Set up your domain by editing `src/util.js` and making the definition of `export const domain` return a string that is your domain. Fun, huh?
  * Create a `.env` file in the root of the project.
  * Add the line `ADMIN_KEY={}` to your .env where {} is the password you'll enter when the browser prompts you.
  * Add the line `ACTOR_NAME={}` to your .env where {} is the username that will represent you in the `@username@project.tld` format. (If you don't do this, your default actor name will be 'bookmarks', so people will find you on the fediverse `@bookmarks@project.tld`.)
* If you're using Glitch, you should be done! If you're running this yourself, run `npm run start` via whatever mechanism you choose to use to host this website.
* Click on the __Admin__ link in the footer, enter the username "admin" and the password whatever you set above.
* It should load the admin page and, for as long as your browser caches the login, all POST requests should automatically use the same auth.


## We built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Need more help? [Check out the Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
