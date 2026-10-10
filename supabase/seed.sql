-- =============================================================================
-- Travel Trap Detector: seed data
-- Run AFTER supabase/migrations/001_init.sql. Safe to re-run: areas, places and
-- benchmarks are upserted; seed reports (is_seed = true) are deleted and re-inserted.
-- =============================================================================
--
-- FARE BENCHMARKS: PLACEHOLDERS (source = 'demo_estimate') EXCEPT GUWAHATI TAXI.
-- Guwahati taxi is OFFICIAL: fitted to the AAI airport prepaid taxi list (see
-- supabase/seed-fixed-fares.sql for the exact route fares). All other rows are
-- plausible guesses, NOT official fares. To replace one, edit the matching row in
-- section 3 below and fill in its source and source_note columns. Seed report prices are computed from
-- these rows, so they follow your edits automatically.
--
-- Per-km services: expected = max(min_fare, base_fare + per_km_rate * distance_km),
-- multiplied by night_multiplier between 22:00 and 05:00 IST. Shared Sumo is per seat.
--
-- | Area              | Service     | Base ₹ | ₹/km | Min ₹ | Night × |
-- |-------------------|-------------|-------:|-----:|------:|--------:|
-- | Guwahati          | auto        |     40 |   18 |    50 |    1.25 |
-- | Guwahati (OFFICIAL)| taxi       |     70 | 20.34|   190 |    1.00 |
-- | Guwahati          | bike_taxi   |     20 |    7 |    35 |    1.20 |
-- | Guwahati          | shared_sumo |     20 |  2.8 |    50 |    1.00 |
-- | Shillong          | auto        |     40 |   20 |    60 |    1.25 |
-- | Shillong          | taxi        |     80 |   30 |   150 |    1.25 |
-- | Shillong          | bike_taxi   |     20 |    8 |    40 |    1.20 |
-- | Shillong          | shared_sumo |     25 |  3.0 |    60 |    1.00 |
-- | Kaziranga (Kohora)| auto        |     30 |   16 |    50 |    1.30 |
-- | Kaziranga (Kohora)| taxi        |    100 |   22 |   300 |    1.30 |
-- | Kaziranga (Kohora)| bike_taxi   |     20 |    8 |    40 |    1.25 |
-- | Kaziranga (Kohora)| shared_sumo |     20 |  2.8 |    50 |    1.00 |
-- | Gangtok           | auto        |     40 |   22 |    60 |    1.25 |
-- | Gangtok           | taxi        |    100 |   45 |   200 |    1.25 |
-- | Gangtok           | bike_taxi   |     25 |   10 |    50 |    1.20 |
-- | Gangtok           | shared_sumo |     30 |  4.0 |    80 |    1.00 |
-- | Tawang            | auto        |     40 |   24 |    60 |    1.30 |
-- | Tawang            | taxi        |    100 |   40 |   200 |    1.30 |
-- | Tawang            | bike_taxi   |     30 |   10 |    50 |    1.25 |
-- | Tawang            | shared_sumo |     30 |  4.0 |    80 |    1.00 |
-- | REGIONAL DEFAULT  | auto        |     40 |   18 |    50 |    1.25 |
-- | REGIONAL DEFAULT  | taxi        |    100 |   25 |   200 |    1.25 |
-- | REGIONAL DEFAULT  | bike_taxi   |     20 |    8 |    40 |    1.20 |
-- | REGIONAL DEFAULT  | shared_sumo |     25 |  3.0 |    60 |    1.00 |
--
-- Guides (per session, no night multiplier):
--
-- | Area              | Half day ₹ | Full day ₹ |
-- |-------------------|-----------:|-----------:|
-- | Guwahati          |        800 |       1500 |
-- | Shillong          |       1000 |       1800 |
-- | Kaziranga (Kohora)|       1000 |       1800 |
-- | Gangtok           |       1200 |       2200 |
-- | Tawang            |       1200 |       2000 |
-- | REGIONAL DEFAULT  |       1000 |       1800 |
--
-- PLACES: coordinates are taken from OpenStreetMap (via Nominatim, 2026-10-10);
-- the OSM element is noted on each row. Not fully verified:
--   * LGBI Airport (Terminal 1): OSM also maps a newer "Terminal 2" ~2 km north
--     (26.1211726, 91.5990901, way/1460609131). Check which terminal handles
--     arrivals before the demo and swap if needed.
--   * Pakyong Airport: no terminal building is mapped in OSM; this is the centre
--     of the airfield.
--   * Police Bazar (Shillong): centre of the pedestrian street, not a single point.
-- Shillong, Gangtok and Tawang have no railway station; Tawang and Kaziranga have
-- no airport. Kaziranga's nearest railway station is Jakhalabandha (~43 km by road),
-- so that area's radius is 45 km.
--
-- REPORTS: 100 synthetic reports (is_seed = true): 70 normal fares near the
-- benchmark and 30 scams. Prices = benchmark expected fare x a factor in the row.
-- Distances are road distances from OSRM (router.project-osrm.org), except
-- airport -> Paltan Bazaar, set to 23.5 km because OSRM returned a 30.8 km detour.
-- Hotspots: Guwahati Railway Station (11 scams, 5 devices) and Guwahati airport
-- (9 scams, 5 devices). Places with no reports at all: Iewduh, Cathedral of Mary
-- Help of Christians, Kaziranga Orchid and Biodiversity Park, Vajra Taxi Stand,
-- Enchey Monastery, Old Market, Nehru Market.
-- Seed device IDs all start with 5eed0000-.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Areas (circle = centre + radius; a point belongs to the area it falls inside)
-- -----------------------------------------------------------------------------
insert into public.areas (id, name, state, center_lat, center_lng, radius_km) values
  ('guwahati',  'Guwahati',           'Assam',             26.1805978, 91.7539430, 22),  -- OSM node/566672802
  ('shillong',  'Shillong',           'Meghalaya',         25.5759931, 91.8827872, 20),  -- OSM node/245735780
  ('kaziranga', 'Kaziranga (Kohora)', 'Assam',             26.5869979, 93.4105813, 45),  -- OSM node/1681545138
  ('gangtok',   'Gangtok',            'Sikkim',            27.3290460, 88.6122673, 15),  -- OSM node/342097621
  ('tawang',    'Tawang',             'Arunachal Pradesh', 27.5879186, 91.8637330, 10)   -- OSM node/342097760
on conflict (id) do update set
  name = excluded.name, state = excluded.state,
  center_lat = excluded.center_lat, center_lng = excluded.center_lng, radius_km = excluded.radius_km;

-- -----------------------------------------------------------------------------
-- 2. Places (names must stay unique: seed reports below look them up by name)
-- -----------------------------------------------------------------------------
insert into public.places (area_id, name, kind, lat, lng) values
  -- Guwahati
  ('guwahati',  'Guwahati Railway Station',                 'railway',   26.1823701, 91.7501234),  -- node/2669094329
  ('guwahati',  'LGBI Airport (Terminal 1)',                'airport',   26.1054933, 91.5881147),  -- way/1336970458
  ('guwahati',  'ISBT Guwahati (Lokhra)',                   'bus_stand', 26.1163561, 91.7218831),  -- way/222979992
  ('guwahati',  'Kamakhya Temple',                          'temple',    26.1651070, 91.7059298),  -- node/6161176228
  ('guwahati',  'Fancy Bazaar',                             'market',    26.1799322, 91.7362163),  -- node/1698296623
  ('guwahati',  'Paltan Bazaar',                            'market',    26.1794742, 91.7525068),  -- node/6163737300
  -- Shillong
  ('shillong',  'Shillong Airport (Umroi)',                 'airport',   25.7061153, 91.9751553),  -- way/271152567 (terminal)
  ('shillong',  'Police Bazar',                             'market',    25.5767136, 91.8814531),  -- way/278791804
  ('shillong',  'Iewduh (Bara Bazar)',                      'market',    25.5768041, 91.8754573),  -- way/342901666
  ('shillong',  'Shillong ISBT (Mawiong)',                  'bus_stand', 25.6311051, 91.8927209),  -- node/11906862908
  ('shillong',  'Cathedral of Mary Help of Christians',     'other',     25.5684009, 91.8913797),  -- node/7025361585
  ('shillong',  'Ward''s Lake',                             'park',      25.5748717, 91.8870228),  -- way/131468994
  -- Kaziranga (Kohora)
  ('kaziranga', 'Kohora Chariali',                          'bus_stand', 26.5894914, 93.4007137),  -- node/10221694742
  ('kaziranga', 'Kaziranga Central Range Safari Counter',   'other',     26.5838240, 93.4031534),  -- node/4769494222
  ('kaziranga', 'Kaziranga Western Range (Bagori)',         'other',     26.5809700, 93.2908059),  -- node/10794841305
  ('kaziranga', 'Kaziranga Orchid and Biodiversity Park',   'park',      26.5859719, 93.4280153),  -- way/1098675197
  ('kaziranga', 'Jakhalabandha Railway Station',            'railway',   26.5804062, 92.9906325),  -- node/3684357943
  -- Gangtok
  ('gangtok',   'MG Marg',                                  'market',    27.3284536, 88.6123851),  -- node/4603773589
  ('gangtok',   'SNT Bus Stand',                            'bus_stand', 27.3339366, 88.6145270),  -- node/4868280221
  ('gangtok',   'Vajra Taxi Stand',                         'bus_stand', 27.3424817, 88.6127550),  -- node/10845047106
  ('gangtok',   'Enchey Monastery',                         'temple',    27.3359063, 88.6191241),  -- way/452322802
  ('gangtok',   'Rumtek Monastery',                         'temple',    27.2887582, 88.5614200),  -- way/452322822
  ('gangtok',   'Pakyong Airport',                          'airport',   27.2329128, 88.5886764),  -- way/1333442739 (airfield centre)
  -- Tawang
  ('tawang',    'Tawang Monastery',                         'temple',    27.5866091, 91.8573902),  -- way/507428055
  ('tawang',    'Tawang War Memorial',                      'other',     27.5867951, 91.8766864),  -- node/5302878254
  ('tawang',    'Tawang Bus Stand (APSTS)',                 'bus_stand', 27.5948593, 91.8726057),  -- node/5302057025
  ('tawang',    'Old Market',                               'market',    27.5946760, 91.8708249),  -- node/5409315183
  ('tawang',    'Nehru Market',                             'market',    27.5928066, 91.8740165)   -- node/2519164005
on conflict (area_id, name) do update set
  kind = excluded.kind, lat = excluded.lat, lng = excluded.lng;

-- -----------------------------------------------------------------------------
-- 3. Fare benchmarks: placeholders, see the table at the top of this file.
--    area_id null = regional default (used outside every area or when an area has no row).
-- -----------------------------------------------------------------------------
insert into public.fare_benchmarks (
  area_id, service_type, pricing_unit, base_fare, per_km_rate, min_fare, night_multiplier,
  session_rates, source, source_note, source_url, updated_at
)
select
  v.area_id,
  v.service_type,
  case when v.service_type = 'guide' then 'per_session' else 'per_km' end,
  v.base_fare, v.per_km_rate, v.min_fare, v.night_multiplier,
  case when v.service_type = 'guide' then jsonb_build_object('half_day', v.half_day, 'full_day', v.full_day) end,
  coalesce(v.source, 'demo_estimate'),
  coalesce(v.source_note, 'Replace with official fare chart'),
  v.source_url,
  now()
from (values
  --  area         service        base   ₹/km   min   night   half   full   source   source_note   source_url
  ('guwahati',  'auto',          40,    18,     50,  1.25,   null,  null, null, null, null),
  ('guwahati',  'taxi',          70,    20.34, 190,  1.00,   null,  null,  'official', 'AAI Guwahati airport prepaid taxi fare list (DTO Kamrup Metro notification TMV.195/2010/352-A, 20 Nov 2019): base + per-km fitted to its 73 local destinations (all within ₹78). Airport-counter fares; no night rate listed.', 'https://www.aai.aero/en/airports/transport-details/guwahati/Taxi'),
  ('guwahati',  'bike_taxi',     20,    7,      35,  1.20,   null,  null, null, null, null),
  ('guwahati',  'shared_sumo',   20,    2.8,    50,  1.00,   null,  null, null, null, null),
  ('guwahati',  'guide',         null,  null,  null, 1.00,   800,   1500, null, null, null),
  ('shillong',  'auto',          40,    20,     60,  1.25,   null,  null, null, null, null),
  ('shillong',  'taxi',          80,    30,    150,  1.25,   null,  null, null, null, null),
  ('shillong',  'bike_taxi',     20,    8,      40,  1.20,   null,  null, null, null, null),
  ('shillong',  'shared_sumo',   25,    3.0,    60,  1.00,   null,  null, null, null, null),
  ('shillong',  'guide',         null,  null,  null, 1.00,   1000,  1800, null, null, null),
  ('kaziranga', 'auto',          30,    16,     50,  1.30,   null,  null, null, null, null),
  ('kaziranga', 'taxi',          100,   22,    300,  1.30,   null,  null, null, null, null),
  ('kaziranga', 'bike_taxi',     20,    8,      40,  1.25,   null,  null, null, null, null),
  ('kaziranga', 'shared_sumo',   20,    2.8,    50,  1.00,   null,  null, null, null, null),
  ('kaziranga', 'guide',         null,  null,  null, 1.00,   1000,  1800, null, null, null),
  ('gangtok',   'auto',          40,    22,     60,  1.25,   null,  null, null, null, null),
  ('gangtok',   'taxi',          100,   45,    200,  1.25,   null,  null, null, null, null),
  ('gangtok',   'bike_taxi',     25,    10,     50,  1.20,   null,  null, null, null, null),
  ('gangtok',   'shared_sumo',   30,    4.0,    80,  1.00,   null,  null, null, null, null),
  ('gangtok',   'guide',         null,  null,  null, 1.00,   1200,  2200, null, null, null),
  ('tawang',    'auto',          40,    24,     60,  1.30,   null,  null, null, null, null),
  ('tawang',    'taxi',          100,   40,    200,  1.30,   null,  null, null, null, null),
  ('tawang',    'bike_taxi',     30,    10,     50,  1.25,   null,  null, null, null, null),
  ('tawang',    'shared_sumo',   30,    4.0,    80,  1.00,   null,  null, null, null, null),
  ('tawang',    'guide',         null,  null,  null, 1.00,   1200,  2000, null, null, null),
  (null,        'auto',          40,    18,     50,  1.25,   null,  null, null, null, null),
  (null,        'taxi',          100,   25,    200,  1.25,   null,  null, null, null, null),
  (null,        'bike_taxi',     20,    8,      40,  1.20,   null,  null, null, null, null),
  (null,        'shared_sumo',   25,    3.0,    60,  1.00,   null,  null, null, null, null),
  (null,        'guide',         null,  null,  null, 1.00,   1000,  1800, null, null, null)
) as v (area_id, service_type, base_fare, per_km_rate, min_fare, night_multiplier, half_day, full_day, source, source_note, source_url)
on conflict on constraint fare_benchmarks_area_service_key do update set
  pricing_unit     = excluded.pricing_unit,
  base_fare        = excluded.base_fare,
  per_km_rate      = excluded.per_km_rate,
  min_fare         = excluded.min_fare,
  night_multiplier = excluded.night_multiplier,
  session_rates    = excluded.session_rates,
  source           = excluded.source,
  source_note      = excluded.source_note,
  source_url       = excluded.source_url,
  updated_at       = now();

-- -----------------------------------------------------------------------------
-- 4. Seed reports (synthetic, is_seed = true)
--    Each row names a pickup place (+ an offset in metres so pins don't stack),
--    an optional drop place, and price factors relative to the benchmark.
--    quoted/paid price = expected fare from section 3 x factor, rounded to ₹10.
-- -----------------------------------------------------------------------------
delete from public.reports where is_seed;

with v (device_id, service_type, pickup_place, drop_place, session_type, distance_km,
        north_m, east_m, quoted_factor, paid_factor, felt_fair, is_scam, scam_tags, description, age_hours) as (
  values
  -- Guwahati taxi, airport -> Paltan Bazaar (8: enough for the community blend)
  ('5eed0000-0000-4000-8000-000000000101', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.3, -126, 110, 1.20, 1.04, true, false, '{}', 'Fair price, polite driver.', 737),
  ('5eed0000-0000-4000-8000-000000000102', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 22.8, 24, -116, 1.08, 1.03, true, false, '{}', 'Agreed the price before starting, no issues.', 310),
  ('5eed0000-0000-4000-8000-000000000103', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 22.9, -58, -83, 1.16, 1.05, true, false, '{}', null, 1366),
  ('5eed0000-0000-4000-8000-000000000104', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.9, 46, 148, 1.07, 1.06, true, false, '{}', null, 1464),
  ('5eed0000-0000-4000-8000-000000000105', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 24.1, 118, -106, 1.29, 1.06, true, false, '{}', 'Smooth ride, price as expected.', 1770),
  ('5eed0000-0000-4000-8000-000000000106', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 24.1, 17, -67, 1.11, 1.02, true, false, '{}', 'Smooth ride, price as expected.', 592),
  ('5eed0000-0000-4000-8000-000000000107', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.6, 67, 8, 1.11, 1.11, true, false, '{}', null, 2625),
  ('5eed0000-0000-4000-8000-000000000108', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.8, 81, 94, 1.09, 1.09, true, false, '{}', 'Fair price, polite driver.', 75),
  -- Guwahati auto, railway station -> Kamakhya Temple
  ('5eed0000-0000-4000-8000-000000000109', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.7, -68, -80, 1.10, 0.99, true, false, '{}', null, 2138),
  ('5eed0000-0000-4000-8000-000000000110', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 7, 33, -11, 1.21, 1.05, true, false, '{}', null, 762),
  ('5eed0000-0000-4000-8000-000000000111', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.7, -144, -2, 1.18, 1.05, true, false, '{}', null, 965),
  ('5eed0000-0000-4000-8000-000000000112', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.7, 131, -123, 1.18, 0.94, true, false, '{}', 'Fair price, polite driver.', 1432),
  ('5eed0000-0000-4000-8000-000000000113', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.6, -61, -20, 1.09, 1.07, true, false, '{}', 'Fair price, polite driver.', 1530),
  ('5eed0000-0000-4000-8000-000000000114', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.6, -94, 99, 1.03, 0.96, true, false, '{}', 'Fair price, polite driver.', 1991),
  ('5eed0000-0000-4000-8000-000000000115', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.6, 147, -30, 1.11, 0.98, true, false, '{}', 'Fair price, polite driver.', 1954),
  -- Guwahati auto, Fancy Bazaar -> railway station
  ('5eed0000-0000-4000-8000-000000000116', 'auto', 'Fancy Bazaar', 'Guwahati Railway Station', null, 2.4, -10, 86, 1.08, 0.95, true, false, '{}', 'Smooth ride, price as expected.', 656),
  ('5eed0000-0000-4000-8000-000000000117', 'auto', 'Fancy Bazaar', 'Guwahati Railway Station', null, 2.4, 77, -30, 1.30, 0.92, true, false, '{}', 'Smooth ride, price as expected.', 634),
  ('5eed0000-0000-4000-8000-000000000118', 'auto', 'Fancy Bazaar', 'Guwahati Railway Station', null, 2.5, 88, 50, 1.17, 1.11, true, false, '{}', null, 2631),
  ('5eed0000-0000-4000-8000-000000000119', 'auto', 'Fancy Bazaar', 'Guwahati Railway Station', null, 2.4, 105, -149, 1.24, 1.00, true, false, '{}', 'Smooth ride, price as expected.', 2402),
  -- Guwahati bike taxi, ISBT -> Paltan Bazaar
  ('5eed0000-0000-4000-8000-000000000120', 'bike_taxi', 'ISBT Guwahati (Lokhra)', 'Paltan Bazaar', null, 9.8, -148, -85, 1.26, 0.96, true, false, '{}', 'Agreed the price before starting, no issues.', 340),
  ('5eed0000-0000-4000-8000-000000000121', 'bike_taxi', 'ISBT Guwahati (Lokhra)', 'Paltan Bazaar', null, 10.1, 102, 147, 1.04, 1.04, true, false, '{}', null, 273),
  ('5eed0000-0000-4000-8000-000000000122', 'bike_taxi', 'ISBT Guwahati (Lokhra)', 'Paltan Bazaar', null, 9.8, 147, -54, 1.28, 1.01, true, false, '{}', null, 2340),
  ('5eed0000-0000-4000-8000-000000000123', 'bike_taxi', 'ISBT Guwahati (Lokhra)', 'Paltan Bazaar', null, 10.4, 87, -43, 1.15, 0.93, true, false, '{}', null, 2375),
  ('5eed0000-0000-4000-8000-000000000124', 'bike_taxi', 'ISBT Guwahati (Lokhra)', 'Paltan Bazaar', null, 10.1, -52, 89, 1.14, 1.03, true, false, '{}', null, 2758),
  -- Guwahati taxi, ISBT -> airport
  ('5eed0000-0000-4000-8000-000000000125', 'taxi', 'ISBT Guwahati (Lokhra)', 'LGBI Airport (Terminal 1)', null, 22.6, 96, 80, 1.20, 1.08, true, false, '{}', null, 845),
  ('5eed0000-0000-4000-8000-000000000126', 'taxi', 'ISBT Guwahati (Lokhra)', 'LGBI Airport (Terminal 1)', null, 21.8, 1, -120, 1.02, 0.92, true, false, '{}', null, 2436),
  ('5eed0000-0000-4000-8000-000000000127', 'taxi', 'ISBT Guwahati (Lokhra)', 'LGBI Airport (Terminal 1)', null, 22.5, -4, -58, 1.21, 0.98, true, false, '{}', 'Agreed the price before starting, no issues.', 2127),
  -- Guwahati guide, full day from Kamakhya Temple
  ('5eed0000-0000-4000-8000-000000000128', 'guide', 'Kamakhya Temple', null, 'full_day', null, 103, -75, 1.13, 1.03, true, false, '{}', null, 687),
  ('5eed0000-0000-4000-8000-000000000129', 'guide', 'Kamakhya Temple', null, 'full_day', null, 92, 29, 1.18, 0.92, true, false, '{}', null, 2114),
  -- Shared Sumo seat, Guwahati Paltan Bazaar -> Shillong Police Bazar
  ('5eed0000-0000-4000-8000-000000000130', 'shared_sumo', 'Paltan Bazaar', 'Police Bazar', null, 95.5, 90, -119, 1.24, 1.01, true, false, '{}', 'Smooth ride, price as expected.', 38),
  ('5eed0000-0000-4000-8000-000000000131', 'shared_sumo', 'Paltan Bazaar', 'Police Bazar', null, 99.1, -74, 67, 1.29, 0.92, true, false, '{}', null, 2472),
  ('5eed0000-0000-4000-8000-000000000132', 'shared_sumo', 'Paltan Bazaar', 'Police Bazar', null, 99.5, -135, 105, 1.28, 1.07, true, false, '{}', null, 452),
  ('5eed0000-0000-4000-8000-000000000133', 'shared_sumo', 'Paltan Bazaar', 'Police Bazar', null, 97.3, -120, -92, 1.16, 0.93, true, false, '{}', 'Fair price, polite driver.', 2584),
  ('5eed0000-0000-4000-8000-000000000134', 'shared_sumo', 'Paltan Bazaar', 'Police Bazar', null, 97.7, -49, 51, 1.19, 1.02, true, false, '{}', null, 762),
  ('5eed0000-0000-4000-8000-000000000135', 'shared_sumo', 'Paltan Bazaar', 'Police Bazar', null, 94.9, -113, -119, 1.21, 1.04, true, false, '{}', 'Agreed the price before starting, no issues.', 1224),
  -- Shillong taxi, Police Bazar -> airport
  ('5eed0000-0000-4000-8000-000000000136', 'taxi', 'Police Bazar', 'Shillong Airport (Umroi)', null, 30.3, 74, 36, 1.04, 1.00, true, false, '{}', 'Fair price, polite driver.', 1437),
  ('5eed0000-0000-4000-8000-000000000137', 'taxi', 'Police Bazar', 'Shillong Airport (Umroi)', null, 30.4, -138, 120, 1.09, 1.09, false, false, '{}', 'Agreed the price before starting, no issues.', 2094),
  ('5eed0000-0000-4000-8000-000000000138', 'taxi', 'Police Bazar', 'Shillong Airport (Umroi)', null, 29.7, 104, 96, 1.10, 1.10, false, false, '{}', null, 1325),
  ('5eed0000-0000-4000-8000-000000000139', 'taxi', 'Police Bazar', 'Shillong Airport (Umroi)', null, 29.6, 68, -28, 1.11, 0.96, true, false, '{}', 'Smooth ride, price as expected.', 2019),
  ('5eed0000-0000-4000-8000-000000000140', 'taxi', 'Police Bazar', 'Shillong Airport (Umroi)', null, 29.8, 54, 16, 1.09, 1.01, true, false, '{}', null, 1163),
  ('5eed0000-0000-4000-8000-000000000141', 'taxi', 'Police Bazar', 'Shillong Airport (Umroi)', null, 29.6, 30, 72, 1.14, 1.08, true, false, '{}', 'Smooth ride, price as expected.', 510),
  -- Shillong taxi, Police Bazar -> Ward's Lake
  ('5eed0000-0000-4000-8000-000000000142', 'taxi', 'Police Bazar', 'Ward''s Lake', null, 1.3, -30, -115, 1.13, 1.04, true, false, '{}', null, 2100),
  ('5eed0000-0000-4000-8000-000000000143', 'taxi', 'Police Bazar', 'Ward''s Lake', null, 1.3, -136, -17, 1.09, 1.09, true, false, '{}', 'Agreed the price before starting, no issues.', 1131),
  ('5eed0000-0000-4000-8000-000000000144', 'taxi', 'Police Bazar', 'Ward''s Lake', null, 1.3, -108, 84, 1.06, 0.99, true, false, '{}', 'Agreed the price before starting, no issues.', 2664),
  -- Shillong taxi, ISBT -> Police Bazar
  ('5eed0000-0000-4000-8000-000000000145', 'taxi', 'Shillong ISBT (Mawiong)', 'Police Bazar', null, 11.6, 12, -104, 1.29, 1.09, true, false, '{}', 'Fair price, polite driver.', 793),
  ('5eed0000-0000-4000-8000-000000000146', 'taxi', 'Shillong ISBT (Mawiong)', 'Police Bazar', null, 11.8, -17, 129, 1.18, 1.05, true, false, '{}', 'Smooth ride, price as expected.', 918),
  ('5eed0000-0000-4000-8000-000000000147', 'taxi', 'Shillong ISBT (Mawiong)', 'Police Bazar', null, 11.3, 111, 92, 1.13, 0.96, true, false, '{}', null, 2063),
  -- Shillong guide, half day from Police Bazar
  ('5eed0000-0000-4000-8000-000000000148', 'guide', 'Police Bazar', null, 'half_day', null, -102, -46, 1.07, 1.04, true, false, '{}', 'Agreed the price before starting, no issues.', 1824),
  ('5eed0000-0000-4000-8000-000000000149', 'guide', 'Police Bazar', null, 'half_day', null, 137, 81, 1.25, 0.92, true, false, '{}', null, 440),
  -- Kaziranga guide, full day from Central Range
  ('5eed0000-0000-4000-8000-000000000150', 'guide', 'Kaziranga Central Range Safari Counter', null, 'full_day', null, 15, 7, 1.29, 1.05, true, false, '{}', 'Smooth ride, price as expected.', 2559),
  ('5eed0000-0000-4000-8000-000000000151', 'guide', 'Kaziranga Central Range Safari Counter', null, 'full_day', null, -131, -56, 1.04, 0.99, true, false, '{}', 'Agreed the price before starting, no issues.', 2254),
  ('5eed0000-0000-4000-8000-000000000152', 'guide', 'Kaziranga Central Range Safari Counter', null, 'full_day', null, 28, 39, 1.30, 1.03, true, false, '{}', 'Fair price, polite driver.', 2016),
  -- Kaziranga taxi, Kohora -> Western Range (Bagori)
  ('5eed0000-0000-4000-8000-000000000153', 'taxi', 'Kohora Chariali', 'Kaziranga Western Range (Bagori)', null, 11.7, 132, 52, 1.18, 1.10, false, false, '{}', 'Agreed the price before starting, no issues.', 527),
  ('5eed0000-0000-4000-8000-000000000154', 'taxi', 'Kohora Chariali', 'Kaziranga Western Range (Bagori)', null, 11.2, 122, -113, 1.17, 0.93, true, false, '{}', 'Smooth ride, price as expected.', 910),
  -- Kaziranga taxi, Jakhalabandha station -> Kohora
  ('5eed0000-0000-4000-8000-000000000155', 'taxi', 'Jakhalabandha Railway Station', 'Kohora Chariali', null, 43.2, 6, -145, 1.06, 1.03, true, false, '{}', 'Agreed the price before starting, no issues.', 2544),
  ('5eed0000-0000-4000-8000-000000000156', 'taxi', 'Jakhalabandha Railway Station', 'Kohora Chariali', null, 42.4, -10, 64, 1.21, 0.93, true, false, '{}', null, 634),
  -- Gangtok taxi, SNT -> MG Marg
  ('5eed0000-0000-4000-8000-000000000157', 'taxi', 'SNT Bus Stand', 'MG Marg', null, 0.7, -120, 103, 1.23, 1.07, true, false, '{}', null, 1785),
  ('5eed0000-0000-4000-8000-000000000158', 'taxi', 'SNT Bus Stand', 'MG Marg', null, 0.7, -90, 90, 1.27, 1.04, true, false, '{}', 'Agreed the price before starting, no issues.', 1796),
  ('5eed0000-0000-4000-8000-000000000159', 'taxi', 'SNT Bus Stand', 'MG Marg', null, 0.7, 108, 78, 1.10, 1.06, true, false, '{}', null, 792),
  -- Gangtok taxi, MG Marg -> Rumtek Monastery
  ('5eed0000-0000-4000-8000-000000000160', 'taxi', 'MG Marg', 'Rumtek Monastery', null, 21.8, -79, -46, 1.04, 1.01, true, false, '{}', null, 1805),
  ('5eed0000-0000-4000-8000-000000000161', 'taxi', 'MG Marg', 'Rumtek Monastery', null, 22, 130, -90, 1.11, 1.06, true, false, '{}', 'Smooth ride, price as expected.', 2083),
  ('5eed0000-0000-4000-8000-000000000162', 'taxi', 'MG Marg', 'Rumtek Monastery', null, 21.9, 53, -129, 1.17, 0.98, true, false, '{}', 'Smooth ride, price as expected.', 2792),
  -- Gangtok taxi, Pakyong Airport -> MG Marg
  ('5eed0000-0000-4000-8000-000000000163', 'taxi', 'Pakyong Airport', 'MG Marg', null, 25.7, -44, 13, 1.06, 1.06, true, false, '{}', 'Smooth ride, price as expected.', 2723),
  ('5eed0000-0000-4000-8000-000000000164', 'taxi', 'Pakyong Airport', 'MG Marg', null, 27.2, 42, -36, 1.21, 1.04, true, false, '{}', 'Fair price, polite driver.', 690),
  ('5eed0000-0000-4000-8000-000000000165', 'taxi', 'Pakyong Airport', 'MG Marg', null, 26.6, -118, 66, 1.04, 1.03, true, false, '{}', null, 940),
  -- Tawang taxi, bus stand -> Tawang Monastery
  ('5eed0000-0000-4000-8000-000000000166', 'taxi', 'Tawang Bus Stand (APSTS)', 'Tawang Monastery', null, 3.6, 114, 50, 1.07, 1.07, true, false, '{}', 'Agreed the price before starting, no issues.', 1588),
  ('5eed0000-0000-4000-8000-000000000167', 'taxi', 'Tawang Bus Stand (APSTS)', 'Tawang Monastery', null, 3.7, -2, 94, 1.21, 1.12, false, false, '{}', 'Agreed the price before starting, no issues.', 847),
  ('5eed0000-0000-4000-8000-000000000168', 'taxi', 'Tawang Bus Stand (APSTS)', 'Tawang Monastery', null, 3.8, -44, 106, 1.25, 1.05, true, false, '{}', 'Fair price, polite driver.', 2681),
  -- Tawang guide, half day from Tawang Monastery
  ('5eed0000-0000-4000-8000-000000000169', 'guide', 'Tawang Monastery', null, 'half_day', null, 94, -118, 1.13, 0.96, true, false, '{}', null, 105),
  ('5eed0000-0000-4000-8000-000000000170', 'guide', 'Tawang Monastery', null, 'half_day', null, 8, 74, 1.10, 0.99, true, false, '{}', null, 2457),
  -- HOTSPOT: Guwahati Railway Station (5 devices)
  ('5eed0000-0000-4000-8000-000000000201', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.8, -236, -219, 2.59, null, false, true, '{inflated_tourist_price,luggage_surcharge}', 'Asked for far more than the usual fare because I was a tourist.', 88),
  ('5eed0000-0000-4000-8000-000000000201', 'taxi', 'Guwahati Railway Station', 'LGBI Airport (Terminal 1)', null, 21.7, 187, -140, 2.52, null, false, true, '{meter_refusal,luggage_surcharge}', 'Refused to use the meter and insisted on a fixed price.', 230),
  ('5eed0000-0000-4000-8000-000000000201', 'taxi', 'Guwahati Railway Station', 'ISBT Guwahati (Lokhra)', null, 9.7, 194, -53, 2.88, 2.17, false, true, '{meter_refusal,fake_closure_detour}', 'Refused to use the meter and insisted on a fixed price.', 414),
  ('5eed0000-0000-4000-8000-000000000202', 'auto', 'Guwahati Railway Station', 'Fancy Bazaar', null, 2.6, -226, -145, 2.45, null, false, true, '{inflated_tourist_price,fake_closure_detour}', 'Asked for far more than the usual fare because I was a tourist.', 579),
  ('5eed0000-0000-4000-8000-000000000202', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.7, -241, -208, 2.98, 2.27, false, true, '{inflated_tourist_price,fake_closure_detour}', 'Asked for far more than the usual fare because I was a tourist.', 803),
  ('5eed0000-0000-4000-8000-000000000203', 'taxi', 'Guwahati Railway Station', 'LGBI Airport (Terminal 1)', null, 21.6, -145, -238, 2.64, 2.31, false, true, '{fake_closure_detour}', 'Said the main road was closed and took a long detour.', 1000),
  ('5eed0000-0000-4000-8000-000000000203', 'taxi', 'Guwahati Railway Station', 'ISBT Guwahati (Lokhra)', null, 9.8, -150, 106, 2.29, null, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 1255),
  ('5eed0000-0000-4000-8000-000000000204', 'auto', 'Guwahati Railway Station', 'Fancy Bazaar', null, 2.6, -118, 97, 1.91, 1.78, false, true, '{luggage_surcharge}', 'Demanded extra money for each bag after the ride.', 1645),
  ('5eed0000-0000-4000-8000-000000000204', 'auto', 'Guwahati Railway Station', 'Kamakhya Temple', null, 6.8, -165, 36, 2.96, 1.77, false, true, '{luggage_surcharge,meter_refusal}', 'Demanded extra money for each bag after the ride.', 2041),
  ('5eed0000-0000-4000-8000-000000000205', 'taxi', 'Guwahati Railway Station', 'LGBI Airport (Terminal 1)', null, 21.7, -208, -238, 2.01, null, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 2349),
  ('5eed0000-0000-4000-8000-000000000205', 'taxi', 'Guwahati Railway Station', 'ISBT Guwahati (Lokhra)', null, 10, -172, -103, 2.52, null, false, true, '{meter_refusal,fake_closure_detour}', 'Refused to use the meter and insisted on a fixed price.', 2847),
  -- HOTSPOT: Guwahati airport (5 devices)
  ('5eed0000-0000-4000-8000-000000000206', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.3, -140, 166, 3.11, null, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 64),
  ('5eed0000-0000-4000-8000-000000000206', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.3, 4, 100, 2.09, 2.03, false, true, '{luggage_surcharge}', 'Demanded extra money for each bag after the ride.', 274),
  ('5eed0000-0000-4000-8000-000000000207', 'taxi', 'LGBI Airport (Terminal 1)', 'Fancy Bazaar', null, 21, -61, -169, 2.53, null, false, true, '{inflated_tourist_price,luggage_surcharge}', 'Asked for far more than the usual fare because I was a tourist.', 470),
  ('5eed0000-0000-4000-8000-000000000207', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.3, -92, -186, 2.49, null, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 740),
  ('5eed0000-0000-4000-8000-000000000208', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 22.9, 76, 80, 2.75, 2.62, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 1056),
  ('5eed0000-0000-4000-8000-000000000208', 'taxi', 'LGBI Airport (Terminal 1)', 'Fancy Bazaar', null, 20.6, 76, -186, 3.07, null, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 1412),
  ('5eed0000-0000-4000-8000-000000000209', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.2, 125, 30, 2.63, 1.84, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 1723),
  ('5eed0000-0000-4000-8000-000000000209', 'taxi', 'LGBI Airport (Terminal 1)', 'Paltan Bazaar', null, 23.3, -234, -102, 2.01, null, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 2129),
  ('5eed0000-0000-4000-8000-000000000202', 'taxi', 'LGBI Airport (Terminal 1)', 'Fancy Bazaar', null, 20.5, 201, 180, 3.13, 2.52, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 2401),
  -- Kamakhya Temple guide (2 reports: below threshold)
  ('5eed0000-0000-4000-8000-000000000210', 'guide', 'Kamakhya Temple', null, 'full_day', null, -127, -58, 2.78, 2.57, false, true, '{hidden_charges}', 'Added an ''entry fee'' at the end that was never mentioned.', 359),
  ('5eed0000-0000-4000-8000-000000000211', 'guide', 'Kamakhya Temple', null, 'full_day', null, -185, -153, 2.61, null, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 1484),
  -- Shillong Police Bazar taxi (2: below threshold)
  ('5eed0000-0000-4000-8000-000000000212', 'taxi', 'Police Bazar', 'Shillong ISBT (Mawiong)', null, 9.2, 236, 76, 3.12, null, false, true, '{wrong_change}', 'Did not return the correct change.', 532),
  ('5eed0000-0000-4000-8000-000000000213', 'taxi', 'Police Bazar', 'Shillong ISBT (Mawiong)', null, 9, -42, -230, 3.07, null, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 1844),
  -- Gangtok MG Marg taxi (2: below threshold)
  ('5eed0000-0000-4000-8000-000000000214', 'taxi', 'MG Marg', 'Pakyong Airport', null, 27, -232, -71, 1.99, 1.81, false, true, '{fake_closure_detour}', 'Said the main road was closed and took a long detour.', 204),
  ('5eed0000-0000-4000-8000-000000000215', 'taxi', 'MG Marg', 'SNT Bus Stand', null, 3.3, -228, 171, 2.81, 2.08, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 1196),
  -- Kohora taxi (2: below threshold)
  ('5eed0000-0000-4000-8000-000000000216', 'taxi', 'Kohora Chariali', 'Kaziranga Central Range Safari Counter', null, 0.7, 176, 119, 2.68, null, false, true, '{other}', 'Price kept changing during the trip.', 655),
  ('5eed0000-0000-4000-8000-000000000217', 'taxi', 'Kohora Chariali', 'Kaziranga Central Range Safari Counter', null, 0.7, 77, 37, 2.20, null, false, true, '{other}', 'Price kept changing during the trip.', 2240),
  -- Tawang bus stand taxi (1)
  ('5eed0000-0000-4000-8000-000000000218', 'taxi', 'Tawang Bus Stand (APSTS)', 'Tawang War Memorial', null, 1.4, 63, -242, 2.92, null, false, true, '{inflated_tourist_price}', 'Asked for far more than the usual fare because I was a tourist.', 916),
  -- Fancy Bazaar auto (1)
  ('5eed0000-0000-4000-8000-000000000219', 'auto', 'Fancy Bazaar', 'Kamakhya Temple', null, 5.2, -35, 215, 2.24, 2.14, false, true, '{wrong_change}', 'Did not return the correct change.', 1329)
),
located as (
  select v.*,
         p.area_id,
         p.lat + v.north_m / 111320.0                                as pickup_lat,
         p.lng + v.east_m / (111320.0 * cos(radians(p.lat)))         as pickup_lng,
         d.lat                                                       as drop_lat,
         d.lng                                                       as drop_lng
  from v
  join public.places p      on p.name = v.pickup_place
  left join public.places d on d.name = v.drop_place
),
priced as (
  select l.*,
         case when b.pricing_unit = 'per_session'
              then (b.session_rates ->> l.session_type)::numeric
              else greatest(b.min_fare, b.base_fare + b.per_km_rate * l.distance_km)
         end as expected
  from located l
  join public.fare_benchmarks b on b.area_id = l.area_id and b.service_type = l.service_type
)
insert into public.reports (
  device_id, area_id, service_type, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, session_type,
  quoted_price, paid_price, felt_fair, is_scam, scam_tags, description, is_seed, created_at
)
select
  device_id::uuid, area_id, service_type, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, session_type,
  round(expected * quoted_factor / 10) * 10,
  round(expected * paid_factor / 10) * 10,
  felt_fair, is_scam, scam_tags::text[], description, true,
  now() - make_interval(hours => age_hours)
from priced;

-- -----------------------------------------------------------------------------
-- 5. Sanity check: fails (and rolls back) if a place name above was mistyped.
-- -----------------------------------------------------------------------------
do $$
declare
  n_reports int;
  n_scams   int;
  n_bench   int;
begin
  select count(*), count(*) filter (where is_scam) into n_reports, n_scams from public.reports where is_seed;
  select count(*) into n_bench from public.fare_benchmarks;
  if n_reports <> 100 then
    raise exception 'Expected 100 seed reports but inserted %. Check pickup/drop place names in section 4.', n_reports;
  end if;
  if n_bench < 30 then
    raise exception 'Expected at least 30 fare benchmarks, found %.', n_bench;
  end if;
  raise notice 'Seed OK: % seed reports (% scams), % benchmarks.', n_reports, n_scams, n_bench;
end $$;

commit;
