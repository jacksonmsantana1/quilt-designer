-- Taking quilts down from the community. People report a shared quilt (once each); enough reports hide it until
-- someone looks at it (server/scripts/moderate.js), and whoever keeps sharing what breaks the rules can be stopped.
alter table shared_designs add column hidden boolean not null default false;
alter table users add column share_blocked boolean not null default false;

create table shared_reports (
  shared_id   uuid not null references shared_designs (id) on delete cascade,
  reporter_id uuid not null references users (id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  primary key (shared_id, reporter_id)
);
