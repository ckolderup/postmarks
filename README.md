# Fedimarks

## About this project

![](https://cdn.glitch.global/8b08fe2b-99fe-48bd-9a54-d17f87b3df2b/pikaconstruct.gif?v=1669741965488)

The site __Admin__ page allows the user to add, edit and delete bookmarks–but only if a valid login is provided.
The username is always `admin`; the password is dependent on the `ADMIN_KEY` environment variable.

## Setting up your site

To set your app up:

* In your `.env` file, find the variable named `ADMIN_KEY` and give it a text string as a value. This is your "password" for HTTP Basic Auth.
* Also in your .env file, set an `ACTOR_NAME` value. This will determine the username (`@username@project-name.glitch.me`) that will identify you on the fediverse. (If you don't do this, your default actor name will be 'webmaster')
* Click on the __Admin__ link in the footer, enter the username "admin" and the password whatever you set above.
* It should load the admin page and, for as long as your browser caches the login, all POST requests should automatically use the same auth.


## You built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Need more help? [Check out our Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
