create table if not exists blueprints (
  id text primary key,
  name text not null,
  description text not null,
  author text not null,
  downloads integer not null default 0,
  category text not null,
  tags text not null default '[]',
  image_key text not null default '',
  file_name text not null,
  r2_key text not null,
  uploaded_at text not null
);
