-- Official fixed fares: LGBI Airport (Guwahati) prepaid taxi counter.
-- Run after migrations/002_fixed_fares.sql. Safe to re-run: it replaces this list only.
--
-- Source: Airports Authority of India, "Transport details: Guwahati: Taxi"
--   https://www.aai.aero/en/airports/transport-details/guwahati/Taxi
--   (fares per DTO Kamrup Metro notification TMV.195/2010/352-A, 20 Nov 2019).
-- Fares and km are copied exactly as listed. Destination points were looked up on
-- OpenStreetMap (Nominatim) and checked by hand; dest_radius_m is how close a drop must be
-- to count as that destination (about 1.5 km in the city, 3-5 km for towns, more for parks).
--
-- Listed but NOT included (so these trips fall back to the per-km rate):
--   * no reliable map point: Ahom Gaon, Athgaon, Chatribari, Gauripur, Geeta Mandir,
--     Hengrabari, Upper Hengrabari, Palasbari, Rani Pig Farm, Rupnagar,
--     Sarabhatti Chariali, Shillong (Happy Valley)
--   * fare inconsistent with listed km (likely typo): Missamari (227 km, Rs 3280),
--     Tinsukia (483 km, Rs 8000); every other entry is about Rs 20.5/km
--   * outside India: the Bhutan destinations
--   * "Dispur GNRC" is merged into "Six Mile / Dispur GNRC" (same fare, same hospital)

delete from public.fixed_fares where service_type = 'taxi' and origin_name = 'LGBI Airport';

insert into public.fixed_fares
  (area_id, service_type, origin_name, origin_lat, origin_lng, origin_radius_m,
   dest_name, dest_lat, dest_lng, dest_radius_m, fare, listed_km, source, source_note)
select
  'guwahati', 'taxi', 'LGBI Airport', 26.1054933, 91.5881147, 2500,
  v.dest_name, v.dest_lat, v.dest_lng, v.dest_radius_m, v.fare, v.listed_km,
  'official',
  'AAI LGBI Airport prepaid taxi fare list (DTO Kamrup Metro notification TMV.195/2010/352-A, 20 Nov 2019)'
from (values
  --  destination (as listed)                    lat       lng       radius   fare   km
  ('ABC / Christian Basti'                     , 26.15584, 91.77807,  1500,   680,  30),
  ('Amingaon / IIT'                            , 26.18616, 91.66995,  3000,   580,  25),
  ('Azara (station area)'                      , 26.1021 , 91.6166 ,  1500,   190,   6),
  ('Bamunimaidan'                              , 26.1852 , 91.7887 ,  1500,   700,  31),
  ('Byrnihat'                                  , 26.05433, 91.86965,  3000,  1030,  47),
  ('Beltola / Basistha Chariali'               , 26.12278, 91.8056 ,  1500,   640,  28),
  ('Bhangagarh / Rajgarh / GMCH'               , 26.15851, 91.76226,  1500,   620,  27),
  ('Bagharbori'                                , 26.1438 , 91.8295 ,  1500,   820,  37),
  ('Bharalumukh'                               , 26.17164, 91.72921,  1500,   520,  22),
  ('Bhetapara'                                 , 26.12996, 91.78623,  1500,   660,  29),
  ('Birubari'                                  , 26.15951, 91.7517 ,  1500,   620,  27),
  ('Boko'                                      , 25.9753 , 91.2276 ,  3000,   960,  44),
  ('Bongora IIITG'                             , 26.08041, 91.56052,  1500,   190,   6),
  ('Bora Service / Lachit Nagar'               , 26.17222, 91.76556,  1500,   600,  26),
  ('Borbari'                                   , 26.158  , 91.809  ,  1500,   780,  35),
  ('Chandmari'                                 , 26.18412, 91.77409,  1500,   660,  29),
  ('Chandrapur'                                , 26.21232, 91.89621,  4000,  1190,  55),
  ('Changsari'                                 , 26.26156, 91.69403,  3000,   680,  30),
  ('Chaygaon'                                  , 26.0551 , 91.3703 ,  3000,   600,  26),
  ('Downtown'                                  , 26.1387 , 91.7999 ,  1500,   700,  31),
  ('Fancy Bazaar / Pan Bazaar'                 , 26.17993, 91.73622,  1500,   580,  25),
  ('Fatashil Ambari'                           , 26.15826, 91.73445,  1500,   580,  25),
  ('Gandhi Basti'                              , 26.18155, 91.76194,  1500,   640,  28),
  ('Ganeshguri'                                , 26.14582, 91.78943,  1500,   680,  30),
  ('Garchuk / ISBT'                            , 26.11636, 91.72188,  1500,   560,  24),
  ('Gauhati University'                        , 26.15341, 91.66576,  1500,   310,  12),
  ('Guwahati Club / Silpukhuri'                , 26.18434, 91.76307,  1500,   600,  26),
  ('Hajo'                                      , 26.23598, 91.54235,  4000,   800,  36),
  ('Jalukbari / Sadilapur'                     , 26.1555 , 91.67122,  1500,   310,  12),
  ('Jorabat'                                   , 26.09932, 91.87732,  3000,   800,  36),
  ('Kahilipara'                                , 26.1444 , 91.7705 ,  1500,   660,  29),
  ('Kamakhya Temple / Foothill'                , 26.16511, 91.70593,  1500,   520,  22),
  ('Khanapara'                                 , 26.1251 , 91.8109 ,  1500,   700,  31),
  ('Khetri'                                    , 26.11327, 92.0821 ,  3000,  1410,  66),
  ('Kharghuli'                                 , 26.1949 , 91.76348,  1500,   630,  25),
  ('Kumarpara'                                 , 26.16956, 91.73569,  1500,   540,  23),
  ('Lalmati / Hatigaon'                        , 26.1291 , 91.7795 ,  1500,   660,  29),
  ('Lamb Road'                                 , 26.18803, 91.75442,  1500,   490,  23),
  ('Lankeswar / Satmile'                       , 26.1452 , 91.645  ,  1500,   270,  10),
  ('Lokhra / Lal Ganesh'                       , 26.1394 , 91.7499 ,  1500,   640,  28),
  ('Maligaon / Kamakhya Station'               , 26.15728, 91.69207,  1500,   400,  16),
  ('Mangaldoi'                                 , 26.44369, 92.03731,  4000,  1570,  74),
  ('Mirza / Bijaynagar'                        , 26.09289, 91.5333 ,  3000,   290,  11),
  ('Narengi Tiniali'                           , 26.16741, 91.83136,  1500,   720,  32),
  ('Noonmati'                                  , 26.19794, 91.79986,  1500,   700,  31),
  ('North Guwahati'                            , 26.24691, 91.7144 ,  3000,   640,  28),
  ('Pobitora Wildlife Sanctuary'               , 26.2594 , 91.98477,  8000,  1590,  75),
  ('Paltan Bazaar / Guwahati Railway Station'  , 26.18214, 91.75074,  1500,   580,  25),
  ('Panjabari'                                 , 26.1335 , 91.8229 ,  1500,   780,  35),
  ('Pilingkata'                                , 26.10622, 91.80137,  1500,   740,  33),
  ('Pub Sarania'                               , 26.17469, 91.76403,  1500,   680,  30),
  ('Radisson Blu'                              , 26.14148, 91.6736 ,  1500,   420,  17),
  ('Rangia'                                    , 26.54053, 91.59884,  4000,  1250,  58),
  ('Rukminigaon'                               , 26.1358 , 91.8029 ,  1500,   760,  34),
  ('Satgaon'                                   , 26.14092, 91.83777,  1500,   740,  33),
  ('Six Mile / Dispur GNRC'                    , 26.1312 , 91.8079 ,  1500,   700,  31),
  ('Sonapur'                                   , 26.11267, 92.00973,  4000,  1190,  55),
  ('Suwalkuchi'                                , 26.16991, 91.57085,  3000,   780,  35),
  ('Ujan Bazaar / Ambari'                      , 26.19196, 91.7553 ,  1500,   560,  24),
  ('Ulubari'                                   , 26.175  , 91.75769,  1500,   600,  26),
  ('Zoo Road / AIDC'                           , 26.17294, 91.77756,  1500,   680,  30),
  ('Barpeta'                                   , 26.34594, 91.03971,  5000,  2020,  96),
  ('Barpeta Road'                              , 26.50213, 90.96457,  5000,  2850, 137),
  ('Biswanath Chariali'                        , 26.72037, 93.1429 ,  5000,  5150, 250),
  ('Bhalukpong'                                , 27.01372, 92.63581,  5000,  5210, 253),
  ('Bokakhat'                                  , 26.69357, 93.54537,  5000,  5390, 262),
  ('Bongaigaon'                                , 26.48001, 90.55804,  5000,  3660, 177),
  ('Dimapur (Assam Gate)'                      , 25.90414, 93.71776,  5000,  6180, 301),
  ('Dhubri'                                    , 26.13227, 90.125  ,  5000,  4900, 238),
  ('Dibrugarh'                                 , 27.48446, 94.90194,  5000, 10370, 507),
  ('Goalpara'                                  , 26.04919, 90.60019,  5000,  2510, 120),
  ('Gohpur'                                    , 26.88445, 93.69711,  5000,  6330, 308),
  ('Golaghat'                                  , 26.51083, 93.97437,  5000,  6470, 315),
  ('Hojai / Lanka'                             , 25.96294, 92.98183,  5000,  3970, 192),
  ('Itanagar'                                  , 27.09797, 93.62373,  5000,  6470, 315),
  ('Jagiroad'                                  , 26.1193 , 92.2022 ,  4000,  1640,  77),
  ('Jakhalabandha'                             , 26.58041, 92.99063,  5000,  4050, 196),
  ('Jorhat'                                    , 26.75779, 94.20796,  5000,  6670, 325),
  ('Kaziranga National Park'                   , 26.587  , 93.41058, 15000,  3810, 184),
  ('Kokrajhar'                                 , 26.49121, 90.12152,  5000,  3830, 185),
  ('Manas National Park'                       , 26.72279, 90.97789, 15000,  2850, 137),
  ('Missa Camp'                                , 26.4851 , 92.94489,  5000,  3580, 173),
  ('Nagaon'                                    , 26.33136, 92.75248,  5000,  2970, 143),
  ('Nalbari'                                   , 26.4456 , 91.4354 ,  4000,  1530,  72),
  ('North Lakhimpur'                           , 27.25443, 94.11203,  5000,  7360, 359),
  ('Numaligarh'                                , 26.63049, 93.72677,  5000,  3900, 191),
  ('Sivasagar'                                 , 26.98349, 94.63942,  5000,  7750, 378),
  ('Tezpur'                                    , 26.62299, 92.79761,  5000,  3630, 175),
  ('Udalguri'                                  , 26.70472, 92.04215,  5000,  2100, 100),
  ('Cherrapunjee'                              , 25.27773, 91.72924,  5000,  3480, 168),
  ('Dawki'                                     , 25.18563, 92.02157,  5000,  4050, 196),
  ('Shillong (Laitumkhrah)'                    , 25.5702 , 91.89829,  2000,  2530, 121),
  ('Shillong (Police Bazar)'                   , 25.57671, 91.88145,  2000,  2490, 119),
  ('Tura'                                      , 25.51256, 90.21715,  5000,  4110, 199)
) as v (dest_name, dest_lat, dest_lng, dest_radius_m, fare, listed_km);

-- Expect 94 rows.
select count(*) as fixed_fares from public.fixed_fares where origin_name = 'LGBI Airport';
