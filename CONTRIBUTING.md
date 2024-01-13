# Contributing to Postmarks

## Table of Contents

- [Welcome](#welcome-hi)
- [Governance](#governance-how-this-project-runs)
- [Culture](#culture-code-of-conduct)
- [Technical philosophy](#technical-philosophy-important-things-to-understand)
- [Operations](#operations-how-to-develop-postmarks)
- [Submissions](#submissions-how-to-submit-changes)
- [Acknowledgments](#acknowledgments-how-you-will-be-recognized)
- [Changes/Suggestions](#changessuggestions)

## Welcome (Hi!)

Thanks for reading! Postmarks was initially built over 2022-2023 with a spirit
of creation and a desire to participate in the ecosystem of software being
formed around the ActivityPub protocol and its associated technologies,
sometimes referred to as "the Fediverse".

It also comes from the thought that some earlier web products "got it right"--
Postmarks comes most directly from a lineage of apps like del.icio.us and
Pinboard, and seeks to bring the concepts of those platforms into an age where
connecting individuals who run interoperable software can create their own
social networks on the internet without the need for centralization and profit
as motivating factors.

The project does not currently make any money and thus has no financial
compensation to offer to contributors, but we do accept contributions with the
understanding that your work will be included as part of an MIT-licensed free
and open-source project that (we hope) makes the Fediverse a little more useful
and interesting to the people that participate in it.

## Governance (How this project runs)

Postmarks currently operates under a "benevolent dictator" model, a
tongue-in-cheek piece of jargon that indicates that all decisionmaking currently
resides under the control of the person who started the project, Casey Kolderup.

This status is currently in place because the project is so new and it seems
too early to declare whether there will be lasting interest in development from
a large enough group of people to make a more complex governance system be of
enough utility to bother setting up.

A group of early contributors have been given collaborator access on the repo,
giving them the ability to create branches, review code, and open and merge PRs.
This is a temporary grant meant to keep the work of some of the project flowing
more smoothly and all grants have been made with an understanding that they can/
will be revoked at a time that formal governance is established.

[Postmarks is MIT-licensed](/LICENSE.md); if you don't want to contribute to the
repo at its original location under the guidelines put forth in this document
you are still free to fork it and do what you want within the terms of its
original license.

## Culture (Code of Conduct)

In the interests of making the fediverse a better place, we also strive to make
the various spaces in which Postmarks' development takes place to be safe and
inclusive. Harassment and abuse are not welcome in these spaces.

With that in mind, we've adopted the
[Contributor Covenant](https://contributor-covenant.org); the version we abide
by has been made available in the root of the project repo at
[CODE_OF_CONDUCT.md](/CODE_OF_CONDUCT.md). We ask that you read through it in
full before becoming involved with the project.

To report any witnessed instances of behavior that you believe violates the
code, please send an email to [Casey Kolderup](mailto:casey@kolderup.org) and/or
[Andy Piper](mailto:andypiper@imap.cc). Your report will be handled
confidentially.

## Technical Philosophy (Important things to understand)

- Postmarks is a Node.js app that uses Express.js, Handlebars, and SQLite.
- Postmarks strives to be performant and accessible via its simplicity.
- Postmarks sends messages to other sites using the ActivityPub protocol and its
associated protocols and specs, things like ActivityStreams and Webfinger.
- Many other ActivityPub apps trade off complexity and heavy
resource usage with the ability to host a large number of users. Postmarks takes
the opposite approach: a Postmarks instance hosts one user, and should be very
simple to install.

## Operations (How to develop Postmarks)

### NPM setup & common scripts

Postmarks uses NPM as its package manager. After downloading the repo or pulling
new changes that add or remove dependencies in package.json, run `npm install`
to automatically install all third-party packages necessary to both run and
develop the app.

The other npm commands you'll run most frequently are:

- `npm run start`, which will start up the server. Lots of output is currently
logged to the console via `console.log`; if you don't want this output to be
written to your terminal or other running environment you should pipe STDOUT to
/dev/null or use a similar strategy appropriate for your operating system.
- `npm run watch` which will start up the server and then restart it when you
make changes to files inside the project directory. This is very useful for
development purposes.
- `npm run lint` which will run ESLint + Prettier and give you feedback on any
issues with the formatting/code style in your changes. You should make sure this
command reports no errors before opening a PR with your changes; a Github Action
will block your changes if any errors are present. (If there's something you
simply don't understand about this, please open your PR and ask for help; if
someone has time they will try to assist you.)

Note that you can also run `npm run lint -- --fix` to try and let ESLint apply
automatic fixes for as many errors it finds as possible; we recommend you commit
your work BEFORE running this command in case something goes wrong. If you have
yet to push to Github you can always `git add` and `git commit --amend` to
replace your initial commit with all the correctly-applied formatting changes
once you've verified that they look okay.

### Using Visual Studio Code

The project offers a `.vscode` directory that will set some workspace settings
and recommend VSCode extensions required to make all those settings work
properly. You are not required to use VSCode to develop Postmarks. The settings
included are mostly meant to make the ESLint + Prettier configs allow us to
standardize code changes as much as possible and with as little friction for you
as we can add. If you have concerns or suggestions about specific settings, you
are welcome to open a Github Issue to discuss.

### Using Glitch

Glitch is an online community for creative coding. Its free hosting allows for
the "remixing" of projects, including directly from Github repos, and is
therefore useful for standing up ActivityPub servers that are instantly
available at unique hostnames on the internet. You can go to this URL:

https://glitch.new/github.com/ckolderup/postmarks

to spin up a new project that uses the current `main` branch of the Postmarks
repo. You'll be in a web-based IDE that auto-builds the project as you make
changes. If you're not logged in to Glitch, the project will be archived after
five days. You can create an account or log in to associate the project with
the account. You can read more about Glitch's hosting offerings on its
[documentation](https://help.glitch.com).

_(Disclosure: Postmarks maintainer Casey Kolderup has worked on Glitch from 2021
up to the time of this writing; no one at Glitch or its parent company requested
that Casey promote Glitch in the process of working on or talking about
Postmarks.)_

### Changing port

You can set the env var `PORT` to any valid number to make Postmarks bind to
that port. By default, Postmarks uses port 3000. (Don't do this if you're
developing on Glitch!)

### Logging persistence

To automatically log all requests to a text file, add `LOGGING_ENABLED=true`
to your .env file. This will cause all incoming requests to append to
`request_log.txt` in your project root directory.

> [!WARNING]  
> If you are running on a container with limited storage (e.g. Glitch), you
> should not leave this enabled, or you'll eventually run out of space as
> ActivityPub messages get logged. This is intended for debugging.

### Testing Mastodon interoperability

Postmarks aims to be interoperable with other Fediverse apps where it makes
sense to do so; one of the most common and obvious applications of that concept
is in working with Mastodon. If you plan on manually QAing changes to Postmarks
you may want to set up a pair of testing surfaces, one being a persistent Glitch
app running Postmarks, the other an account on a public Mastodon instance. You
may want this account to be locked and separate from any existing presence you
have on Mastodon and associated Fediverse microblogging networks. Many Mastodon
instances offer free accounts; you can take a look at
[Join Mastodon](https://joinmastodon.org) to see who is offering open signups
at this time.

### Bookmark data sets

We're [collecting CSV exports of Postmarks bookmarks](https://github.com/ckolderup/postmarks/wiki/Sample-bookmark-CSVs)
for the purposes of making it easy to test Postmarks development instances
with both "real-world" representative data as well as "edge case" data with
large numbers of bookmarks, odd distributions of tag usage, or other unique
things that might aid our work.

If you believe you have a collection of bookmarks that you believe would be
useful for reproducing a bug or testing a new feature, please feel free to
include a link to download that CSV in the appropriate Github Issue or PR.
Github itself can be used to host CSV files via [Gist](https://gist.github.com).

## Submissions (How to submit changes)

### Bugfixes

If you believe you've found a bug in Postmarks, we'd appreciate it if you
documented that bug in the Github Issues for the repo. This will help us work
with you to determine if the bug exists, if it's already been logged somewhere,
and what the desired behavior is.

Once that's been established, if you're motivated to fix it, you can open a PR.
Your PR should contain a detailed description of any specific implementation
choices that were made to fix the bug. It must also include the phrase "fixes #"
with the numeric ID of the issue that was filed (or the root issue that your
issue was determined to be a duplicate of).

### Features

If you plan to add a feature to the Postmarks codebase and have any interest in
submitting that change to the original repo, we'd recommend that you first open
a Github Issue and explain what it is that you'd like to see. Features
considered for merging should fit within the vision outlined in
[Technical Philosophy](#technical-philosophy-important-things-to-understand)
above, but it's possible that there will be other concerns that should be
considered before you get into the development process to avoid extra work
making changes that accommodate the ideas that come out of the conversation.

If you have opened an issue and feel reasonably confident that the maintainers
are open to your idea, you can fork the Postmarks repo, work on the feature on
a branch as described in the [Operations](#operations-how-to-develop-postmarks)
section above, then submit a PR to the repo using your fork's branch.

### Release

Once you've got an open PR from either of the sections above, a repo
collaborator will work with you to determine if everything looks okay. Once
someone else has approved your changes and all Github Actions checks have passed
successfully, a collaborator will merge your work.

If you _are_ a repo collaborator, the repo is still configured to require a
review from another person. That doesn't necessarily have to be Casey in the
case of a bugfix; use your best judgment and work with your reviewer to
determine if you're comfortable merging the change once the two of you think
it's ready.

Please note that there is no guarantee on timeframe for a response or merge of
your work; the project is maintained purely on a volunteer basis and peoples'
time is limited. Please do not open issues or attempt to contact people on other
platforms to ask them about the status of your PR unless they have given you
permission to do so.

Currently, no release process is in place, so merging to the `main` branch will
essentially mean the work is 'released'. We plan to revisit this with some kind
of versioned release process in the future.

## Acknowledgments (How you will be recognized)

Postmarks is still very early in its development and does not, as of this
writing, have any kind of automated changelog or release process. When public
updates are given, we will make an effort to include all work as well as credit
the authors of that work in a format we feel is appropriate. You are welcome to
contact the owner of the project ([Casey Kolderup](https://github.com/ckolderup)
) if you feel that credit was overlooked somewhere.

If you submit a change to this repo, we will assume that it's okay to refer to
the work you did using the username or display name you've set on Github in
other places on the repo as well as in references to Postmarks' development on
blogs, social media, etc. If that's NOT the case, please indicate your wishes
when submitting your PR and we'll accommodate you to the best of our abilities.

There is currently no automated method by which work contributed will result in
collaborator status or any additional privileges on the project; such processes
may be included in future revisions of project governance but are not
guaranteed.

## Changes/Suggestions

The majority of the process outlined here is not meant to be set in stone; it's
a good-faith effort to create a set of common-sense guidelines that will make
the project move forward under its current development phase and volume of
incoming attention.

If you believe that something needs to change to make you feel comfortable
contributing to this project, please feel free to open a Github Issue.
