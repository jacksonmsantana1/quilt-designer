-- Quilts shared with the community: a copy of a design as it was when shared (sharing again updates it), shown
-- to everyone under the author name its owner chose. The fabric photos it uses are listed so viewers can see them.
create table shared_designs (
  id          uuid primary key default gen_random_uuid(),  -- the shared quilt's public id
  owner_id    uuid not null references users (id) on delete cascade,
  design_id   text not null,                                -- the owner's design it is a copy of
  name        text not null,
  author      text not null,                                -- the name shown; never the email
  doc         jsonb not null,                               -- the quilt (shared/src/format.js)
  fabric_ids  text[] not null default '{}',                 -- the owner's photos it uses
  shared_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, design_id)
);
create index shared_designs_newest on shared_designs (updated_at desc, id);
