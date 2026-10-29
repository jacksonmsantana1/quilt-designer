-- Users, saved quilts and fabric photos. Each quilt and fabric row is shaped for syncing between devices:
--   rev      save counter: a change must say which rev it was based on, so two devices can't overwrite each other
--   seq      server-wide change number (from change_seq), set on every write: "what changed since N" for sync
--   deleted  deletions are kept as markers, so other devices learn of them
create extension if not exists vector; -- for "fabrics like this one" later

create sequence change_seq;

create table users (
  id          uuid primary key default gen_random_uuid(),
  auth_sub    text not null unique,          -- the login provider's id for the person ('dev:<name>' in development)
  email       text,
  created_at  timestamptz not null default now()
);

create table designs (
  owner_id        uuid not null references users (id) on delete cascade,
  id              text not null,             -- made by the app (a UUID; older saves have shorter ids), never changes
  name            text not null,
  doc             jsonb,                     -- the quilt (shared/src/format.js); null once deleted
  format_version  int,
  rev             int not null,
  seq             bigint not null,
  deleted         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (owner_id, id)                 -- ids are per person: the same quilt can be in two accounts
);
create index designs_owner_seq on designs (owner_id, seq);

create table fabrics (
  owner_id    uuid not null references users (id) on delete cascade,
  id          text not null,                 -- 'f' + sha-256 of the image (the same id the app gives it)
  name        text not null,
  cm          real not null,                 -- real size of the photo's width, in cm
  type        text not null,                 -- image/jpeg, image/png, image/webp
  bytes       int not null,
  object_key  text not null,                 -- where the checked image is kept in object storage (R2 / MinIO)
  upload_key  text,                          -- where the browser uploads it first (a new place for every upload)
  uploaded    boolean not null default false,-- the image arrived and its hash was checked
  rev         int not null,
  seq         bigint not null,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, id)
);
create index fabrics_owner_seq on fabrics (owner_id, seq);
