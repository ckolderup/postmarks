# Federation

## Supported federation protocols and standards

- [ActivityPub](https://www.w3.org/TR/activitypub/) (Server-to-Server)
- [WebFinger](https://webfinger.net/)
- [Http Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)
- [NodeInfo](https://nodeinfo.diaspora.software/)

## Supported FEPs

- [FEP-f1d5: NodeInfo in Fediverse Software](https://codeberg.org/fediverse/fep/src/branch/main/fep/f1d5/fep-f1d5.md)
- [FEP-67ff: FEDERATION.md](https://codeberg.org/fediverse/fep/src/branch/main/fep/67ff/fep-67ff.md)

## ActivityPub

### Object Model

| Object Kind | Description                                              |
| ----------- | -------------------------------------------------------- |
| Actor       | The single actor associated with the Postmarks instance. |
| Bookmark    | A Postmarks bookmark (`Note`)                            |
| Comment     | A comment on a bookmark (`Note`)                         |
| Message     | An ActivityPub `Note` published by the Actor             |

### Actor

Postmarks is a single-actor ActivityPub server. To interact with the actor you must know
the actor URI or the Mastodon-compatible account name (@username@domain).

Followers of the Postmarks actor will receive ActivityPub activities to notify them when bookmarks are added, updated or deleted.

Followers may comment on a bookmark and that comment may be made visible in the frontend by the administrator of the Postmarks instance. Prior comments may be deleted.

The Postmarks actor may follow other actors. Received notes can be reviewed and may be converted into local bookmarks.

### Supported Inbox Activities

#### Inbox: Follow

A request to follow the Postmarks actor. It is automatically accepted.

#### Inbox: Undo/Follow

A request from a remote actor to remove a following relationship for the Postmarks actor.

### Inbox: Accept/Follow

A response from a remote server to tell us that a Postmarks actor follow request was accepted. There is no Reject processing at this time.

#### Inbox: Create/Note

If `inReplyTo` is present, then the `Note` is comment a comment on a published bookmark (specified by the `inReplyTo` URI).

Otherwise, it is considered a message to the Postmarks actor.

#### Inbox: Delete

A request to delete a comment identified by the `object` URI.

### Published Outbound Activities

#### Outbox: Follow

Request to be a follower of a remote instance. This is useful for following other Postmarks instances to receive notifications of bookmark updates.

#### Outbox: Undo/Follow

Request to stop following a remote actor.

### Outbox: Create/Note

Notification of a new bookmark. These are sent to the Postmarks actor's followers.

### Outbox: Update/Note

Notification that a bookmark was updated. These are sent to the Postmarks actor's followers.

### Outbox: Delete

Notification that a note was deleted. These are sent to the Postmarks actor's followers.

### Object Dereferencing

The `<prefix>` in the following information is the URL prefix of the server.

#### Actor

**URL Pattern:** `<prefix>/u/<username>`

Currently, any `<username>` will cause the Postmarks actor profile to be return. This may change in the future.

### Actor Inbox

**URL Pattern:** `<prefix>/u/api/inbox`

The URL for the instance-level shared `inbox`. There is no actor-level `inbox`, but since this is a single-actor server, it's the same.

### Actor Outbox

**URL Pattern:** `<prefix>/u/<username>/outbox`

Creates `Note` objects for recent bookmark additions. Each outbox request will create new `Note` URIs, but the objects are embedded in the response.

### Actor Followers

**URL Pattern:** `<prefix>/u/<username>/followers`

The collection of remote actors following the Postmarks actor.

### Actor Following

**URL Pattern:** `<prefix>/u/<username>/following`

The collection of remote actors followed by the Postmarks actor.

### Published Note

**URL Pattern:** `<prefix>/m/<guid>`

This will retrieve a `Note` published using ActivityPub. Currently, the published note `<guid>` will not be the same as what it returned in an actor outbox query.

## Additional documentation

- [Source Code](https://github.com/ckolderup/postmarks)
- [Ethos](https://casey.kolderup.org/notes/edf3a659f52528da103ea4dcbb09f66f.html)
- [Future Ideas](https://casey.kolderup.org/notes/9307f6d67bbfedbd215ae2d09caeab39.html)
