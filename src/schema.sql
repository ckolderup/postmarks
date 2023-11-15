create table if not exists settings (
  name text unique not null check (name <> ""),
  value text not null
);

insert into settings (name, value)
values
  ('username', '"bookmarks"'),
  ('avatar', '"https://cdn.glitch.global/8eaf209c-2fa9-4353-9b99-e8d8f3a5f8d4/postmarks-logo-white-small.png?v=1693610556689"'),
  ('displayName', '"Postmarks"'),
  ('description', '"An ActivityPub bookmarking and sharing site built with Postmarks"')
on conflict (name) do nothing;

create table if not exists followers (
  actor text primary key
);

create table if not exists following (
  actor text primary key
);

create table if not exists blocks (
  actor text primary key
);

-- TODO: index messages on bookmark_id
create table if not exists messages (
  guid text primary key,
  message text,
  bookmark_id integer
);

-- TODO add index and unique constraint on (bookmark_id, actor)
create table if not exists permissions (
  bookmark_id integer not null,
  actor text not null default '',
  -- 0 = blocked
  -- 1 = allowed
  status integer not null
);
