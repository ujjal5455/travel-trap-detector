-- Travel Trap Detector: initial schema.
-- Run once in the Supabase SQL Editor (or `supabase db push`). Safe to re-run: every statement is idempotent.
--
-- Access model: the browser never talks to Supabase. Route handlers use the secret (service role) key,
-- which bypasses RLS. RLS is ON for every table with NO policies, and anon/authenticated have no grants,
-- so the public API keys can read or write nothing. service_role gets explicit grants below.

-- ---------------------------------------------------------------------------
-- Areas and places
-- ---------------------------------------------------------------------------

create table if not exists public.areas (
  id          text primary key,                       -- slug, e.g. 'guwahati'
  name        text not null,
  state       text not null,
  center_lat  double precision not null check (center_lat between -90 and 90),
  center_lng  double precision not null check (center_lng between -180 and 180),
  radius_km   numeric(6,2) not null check (radius_km > 0)
);

create table if not exists public.places (
  id       uuid primary key default gen_random_uuid(),
  area_id  text not null references public.areas(id) on delete cascade,
  name     text not null,
  kind     text not null check (kind in ('railway','airport','bus_stand','temple','market','park','other')),
  lat      double precision not null check (lat between -90 and 90),
  lng      double precision not null check (lng between -180 and 180),
  unique (area_id, name)
);
create index if not exists places_area_idx on public.places (area_id);

-- ---------------------------------------------------------------------------
-- Fare benchmarks (area_id null = regional default for that service)
-- ---------------------------------------------------------------------------

create table if not exists public.fare_benchmarks (
  id               uuid primary key default gen_random_uuid(),
  area_id          text references public.areas(id) on delete cascade,
  service_type     text not null check (service_type in ('auto','taxi','bike_taxi','shared_sumo','guide')),
  pricing_unit     text not null check (pricing_unit in ('per_km','per_session')),
  base_fare        numeric(10,2) check (base_fare >= 0),
  per_km_rate      numeric(10,2) check (per_km_rate >= 0),
  min_fare         numeric(10,2) check (min_fare >= 0),
  night_multiplier numeric(4,2) not null default 1.0 check (night_multiplier >= 1),
  night_start      smallint not null default 22 check (night_start between 0 and 23),
  night_end        smallint not null default 5  check (night_end between 0 and 23),
  session_rates    jsonb,                                -- {"half_day": n, "full_day": n} for guides
  source           text not null check (source in ('official','app_comparison','demo_estimate')),
  source_note      text,
  updated_at       timestamptz not null default now(),
  -- one row per (area, service); NULLS NOT DISTINCT also makes the regional default unique per service
  constraint fare_benchmarks_area_service_key unique nulls not distinct (area_id, service_type),
  constraint fare_benchmarks_pricing_shape check (
    (pricing_unit = 'per_km'
      and base_fare is not null and per_km_rate is not null and min_fare is not null)
    or (pricing_unit = 'per_session'
      and jsonb_typeof(session_rates -> 'half_day') = 'number'
      and jsonb_typeof(session_rates -> 'full_day') = 'number')
  ),
  constraint fare_benchmarks_guide_per_session check ((service_type = 'guide') = (pricing_unit = 'per_session'))
);

-- ---------------------------------------------------------------------------
-- Community reports
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null,
  area_id       text references public.areas(id) on delete set null,   -- null = outside every area
  service_type  text not null check (service_type in ('auto','taxi','bike_taxi','shared_sumo','guide')),
  pickup_lat    double precision not null check (pickup_lat between -90 and 90),
  pickup_lng    double precision not null check (pickup_lng between -180 and 180),
  drop_lat      double precision check (drop_lat between -90 and 90),
  drop_lng      double precision check (drop_lng between -180 and 180),
  distance_km   numeric(7,2) check (distance_km > 0),
  session_type  text check (session_type in ('half_day','full_day')),
  quoted_price  numeric(10,2) check (quoted_price > 0),
  paid_price    numeric(10,2) check (paid_price > 0),
  felt_fair     boolean,
  is_scam       boolean not null default false,
  scam_tags     text[] not null default '{}' check (scam_tags <@ array[
                  'hidden_charges','meter_refusal','fake_closure_detour','inflated_tourist_price',
                  'luggage_surcharge','wrong_change','other']::text[]),
  description   text check (char_length(description) <= 500),
  photo_path    text,                                   -- path in the private 'evidence' bucket; never shown
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now(),
  -- a plain fare report must say what was paid; a scam report may not (traveller walked away)
  constraint reports_paid_or_scam check (paid_price is not null or is_scam),
  -- guides are per session with no drop point; everything else is a point-to-point trip
  constraint reports_guide_session check ((service_type = 'guide') = (session_type is not null)),
  constraint reports_trip_shape check (
    service_type = 'guide'
    or (drop_lat is not null and drop_lng is not null and distance_km is not null)
  )
);
-- community blend: same area + service, recent first
create index if not exists reports_area_service_created_idx on public.reports (area_id, service_type, created_at desc);
-- time windows (90 / 180 days), map "recent reports"
create index if not exists reports_created_idx on public.reports (created_at desc);
-- 500 m escalation and hotspots: bounding-box prefilter on pickup
create index if not exists reports_pickup_idx on public.reports (pickup_lat, pickup_lng);
-- rate limit: reports per device per hour
create index if not exists reports_device_created_idx on public.reports (device_id, created_at desc);

create table if not exists public.report_votes (
  report_id  uuid not null references public.reports(id) on delete cascade,
  device_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);

-- ---------------------------------------------------------------------------
-- Fare checks (one row per verdict; also the rate-limit log)
-- ---------------------------------------------------------------------------

create table if not exists public.fare_checks (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null,
  area_id       text references public.areas(id) on delete set null,
  service_type  text not null check (service_type in ('auto','taxi','bike_taxi','shared_sumo','guide')),
  distance_km   numeric(7,2),
  quoted_price  numeric(10,2) not null check (quoted_price > 0),
  verdict       text not null check (verdict in ('FAIR','SUSPICIOUS','HIGH_RISK')),
  ratio         numeric(6,3) not null,
  result        jsonb,   -- full FareVerdict, so /api/explain works from a check id (decision D2)
  explanation   text,    -- cached AI / template explanation
  created_at    timestamptz not null default now()
);
create index if not exists fare_checks_device_created_idx on public.fare_checks (device_id, created_at desc);
create index if not exists fare_checks_created_idx on public.fare_checks (created_at desc);

-- ---------------------------------------------------------------------------
-- Lock down: RLS on, no policies, no grants for the public roles
-- ---------------------------------------------------------------------------

alter table public.areas           enable row level security;
alter table public.places          enable row level security;
alter table public.fare_benchmarks enable row level security;
alter table public.reports         enable row level security;
alter table public.report_votes    enable row level security;
alter table public.fare_checks     enable row level security;

revoke all on public.areas, public.places, public.fare_benchmarks,
              public.reports, public.report_votes, public.fare_checks
  from anon, authenticated;

-- The server's secret key acts as service_role. Grant it explicitly so the app works even when the
-- project was created with "Automatically expose new tables" turned off (the recommended setting).
grant usage on schema public to service_role;
grant select, insert, update, delete on public.areas, public.places, public.fare_benchmarks,
              public.reports, public.report_votes, public.fare_checks
  to service_role;

-- ---------------------------------------------------------------------------
-- Private Storage bucket for evidence photos (max 2 MB, images only)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
