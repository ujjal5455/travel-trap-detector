-- Official fixed fares for specific routes, e.g. the Guwahati airport prepaid taxi list.
-- Run after 001_init.sql. Safe to re-run.
--
-- A trip matches when its pickup is within origin_radius_m of the origin and its drop is within
-- dest_radius_m of the destination; the fixed fare then replaces the rate card (scoring step 1).

create table if not exists public.fixed_fares (
  id               uuid primary key default gen_random_uuid(),
  area_id          text references public.areas(id) on delete cascade,
  service_type     text not null check (service_type in ('auto','taxi','bike_taxi','shared_sumo','guide')),
  origin_name      text not null,
  origin_lat       double precision not null check (origin_lat between -90 and 90),
  origin_lng       double precision not null check (origin_lng between -180 and 180),
  origin_radius_m  integer not null default 2500 check (origin_radius_m between 50 and 20000),
  dest_name        text not null,
  dest_lat         double precision not null check (dest_lat between -90 and 90),
  dest_lng         double precision not null check (dest_lng between -180 and 180),
  dest_radius_m    integer not null default 1500 check (dest_radius_m between 50 and 30000),
  fare             numeric(10,2) not null check (fare > 0),
  listed_km        numeric(7,2) check (listed_km > 0),
  source           text not null check (source in ('official','app_comparison','demo_estimate')),
  source_note      text,
  updated_at       timestamptz not null default now(),
  unique (service_type, origin_name, dest_name)
);
create index if not exists fixed_fares_service_idx on public.fixed_fares (service_type);

-- Link to the published source, shown as "check the official website" on the verdict card.
-- Added with "if not exists" so this file can be re-run after an earlier version of it.
alter table public.fixed_fares add column if not exists source_url text;
alter table public.fare_benchmarks add column if not exists source_url text;
alter table public.fixed_fares drop constraint if exists fixed_fares_source_url_https;
alter table public.fixed_fares add constraint fixed_fares_source_url_https check (source_url ~ '^https://');
alter table public.fare_benchmarks drop constraint if exists fare_benchmarks_source_url_https;
alter table public.fare_benchmarks add constraint fare_benchmarks_source_url_https check (source_url ~ '^https://');

alter table public.fixed_fares enable row level security;
revoke all on public.fixed_fares from anon, authenticated;
grant select, insert, update, delete on public.fixed_fares to service_role;
