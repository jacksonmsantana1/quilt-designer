-- What the phone app adds: photos of real quilts, a person's fabric folders and notes, and blocking someone in the
-- community. Each belongs to one person and goes when their account does.

-- A photo of a quilt: of a saved design (quilt_id = its id), or of a quilt with no design (quilt_id made by the app, with
-- the album's name). Private: nothing here is shown to anyone else.
create table quilt_photos (
  owner_id    uuid not null references users (id) on delete cascade,
  id          uuid not null,                  -- made by the app, so a photo taken offline keeps it
  quilt_id    text not null,
  album       text,
  bytes       int not null,
  object_key  text not null,
  upload_key  text,                           -- where the app uploads it first, until it has been checked
  uploaded    boolean not null default false,
  taken_at    timestamptz not null,
  created_at  timestamptz not null default now(),
  primary key (owner_id, id)
);
create index quilt_photos_by_quilt on quilt_photos (owner_id, quilt_id);

-- Folders of fabrics. The newest change wins (updated_at is set by the device that made it); a deleted folder stays as a
-- marker, so that the person's other devices learn of it.
create table fabric_folders (
  owner_id    uuid not null references users (id) on delete cascade,
  id          uuid not null,
  name        text not null,
  fabric_ids  text[] not null default '{}',
  position    int not null default 0,         -- the person's order of their folders
  deleted     boolean not null default false,
  updated_at  timestamptz not null,
  primary key (owner_id, id)
);

-- A person's notes on a fabric: how much they have, and where it is kept.
create table fabric_notes (
  owner_id    uuid not null references users (id) on delete cascade,
  fabric_id   text not null,
  amount      text not null default '',
  place       text not null default '',
  updated_at  timestamptz not null,
  primary key (owner_id, fabric_id)
);

-- Whose shared quilts a person doesn't want to see.
create table user_blocks (
  blocker_id  uuid not null references users (id) on delete cascade,
  blocked_id  uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
