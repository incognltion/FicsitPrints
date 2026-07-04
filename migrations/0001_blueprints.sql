create table if not exists blueprints (
  id text primary key,
  name text not null,
  description text not null,
  author text not null,
  owner_id text not null default '',
  author_avatar text not null default '',
  downloads integer not null default 0,
  category text not null,
  tags text not null default '[]',
  image_data text not null default '',
  image_type text not null default '',
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_data text not null default '',
  uploaded_at text not null
);
