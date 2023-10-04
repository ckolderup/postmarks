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
