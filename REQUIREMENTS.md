# Requirements

Product and technical requirements for **Dynode** (Zuplo gateway for
digital-signage players), plus an assessment of how the current code meets
them. Operational how-to lives in [README.md](README.md); deployment detail in
[INFRASTRUCTURE.md](INFRASTRUCTURE.md).

> Last reviewed: 2026-10-15 against commit `638422e` ("Added Local Test Player").
> Status legend: ✅ met · ⚠️ met with caveats · ❌ not met / missing.

## 1. Goals

- Expose edge APIs that resolve **player IDs** (or explicit coords /
  gates / airport) to **weather** and **flight** data suitable for digital
  signage.
- Keep country-specific player data maintainable in-repo (and in the Zuplo
  editor).
- Prefer short, cacheable responses (JS `data = {...};` or JSON) for players
  and CMS sync jobs.
- Protect upstreams (OpenWeather quota, Avinor fair-use) through gateway caching.

## 2. System overview

| Aspect | Current state |
| --- | --- |
| Product | `dynode` (Zuplo managed edge, `zuplo` ^6, `compatibilityDate 2025-02-06`) |
| Deployed URL | `https://dynode-main-8eca196.zuplo.app` |
| Routes | 4 GET data routes + 4 POST reset routes (`config/routes.oas.json`) |
| Policies | Per-route custom cache-key normalizer → `caching-inbound` (`config/policies.json`) |
| Upstreams | OpenWeather current weather (API key); Avinor XmlFeed + airportNames (public) |
| Player data | Bundled TS arrays: Sweden 13, Norway 48, Poland ~867, shared test 3 |
| Tests | `zuplo test` integration suite in `tests/` (runs against a live gateway) |
| Docs | Zudoku portal in `docs/` built from the OpenAPI file |

Request pipeline: route → normalize cache key (resolves player → canonical
`latlon`/`q`/`gates`+`iata`+`direction`, appends `cacheVersion`) → Zuplo cache
(200 only) → handler → upstream → filter + format.

## 3. Functional requirements

### 3.1 Player identity

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| P-1 | Accept player id via `player`, `resource_id`, or legacy `com.broadsign.suite.bsp.resource_id` (precedence in that order). | ✅ | `modules/player-query-params.ts` |
| P-2 | Player datasets are **country-scoped** (`sweden`, `norway`, `poland`). | ✅ | `modules/players/{country}.ts` |
| P-3 | Shared test/demo players (`modules/players/test.ts`) are merged into every country lookup; country records win on ID collision. | ✅ | `mergePlayerRecords`. Currently **3** test players (759244535 D9, 582309742 D1, 1302044465 D5 — all OSL, located in Coslada, ES). |
| P-4 | Flights players may include optional `Gate` (single, comma list, dot notation `C2.C3`, `*`, or "General all gates") and `IATA`. | ✅ | `parseGates` in `players/types.ts` |
| P-5 | Weather players resolve to latitude/longitude, optionally `City` + `Country` for city lookup. | ✅ | |
| P-6 | Player datasets are regenerable from source CSVs via `scripts/`. | ❌ | Scripts exist but their input CSVs were deleted from the repo (see §6). |

### 3.2 Weather

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| W-1 | Country routes `/weather/sweden`, `/weather/norway`, `/weather/poland`; adding a country = players file + 3 thin modules + 2 policies + 2 routes. | ✅ | Shared factory in `modules/weather-handler.ts` |
| W-2 | Resolve location from `latlon` **or** player id. | ✅ | |
| W-2a | `source=latlon` (default) or `source=city`. City uses player `City`+`Country` → OpenWeather `q=City,CC`; falls back to coords if City missing; city overrides latlon. | ✅ | Country name → ISO map covers PL/SE/NO/ES only. |
| W-3 | Round coordinates to 3 decimals before the upstream call and cache key. | ✅ | |
| W-4 | Upstream OpenWeather current weather, `units=metric`. | ✅ | |
| W-5 | Require `OPENWEATHER_API_KEY`; fail closed if missing. | ✅ | Throws `ConfigurationError` (500). |
| W-6 | Default filter: `coord`, `main.temp`, `weather[0].main`, `wind.speed`, `rain.1h`, `sys.sunrise`, `sys.sunset` (+ always `timestamp`); bypass with `filter=false`. | ✅ | `modules/response-filter.ts` |
| W-7 | Default body `data = {...};`; `format=json` for JSON; any other `format` → 400. | ✅ | |
| W-8 | `debug=true` adds masked upstream URL, `source`, `resolvedBy`, matched player. | ✅ | API key masked. |
| W-9 | Cache HTTP 200 for **3600 s**; reset via `POST /weather/{country}/reset`. | ✅ | Version key in `ZoneCache`. |
| W-10 | Unknown player → 404; missing location → 400; invalid `source`/`latlon` → 400. | ⚠️ | Weather errors are **plain text**, unlike flights' standard `{error, message}` envelope (see R-5). |

### 3.3 Flights (Norway)

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| F-1 | Route `/flights/norway` (Avinor provider). | ✅ | |
| F-2 | Direct `gates` lookup and player lookup are mutually exclusive → `gate_and_player_conflict` (400). | ✅ | `iata` + player is allowed (iata acts as fallback only). |
| F-3 | Direct lookup: `gates` (+ optional `iata`, default `OSL`), `iata` alone (all gates), aliases `gate` and `airport`. | ✅ | |
| F-4 | `gates` supports single, comma list, dot notation, and `*`. | ✅ | |
| F-5 | Player without gate config → `player_has_no_gate` (400); unknown player → `unknown_player` (404). | ✅ | |
| F-6 | Default airport `OSL` when IATA not on player/query. | ✅ | |
| F-7 | Default `direction=AD` (merged arrivals + departures, deduped by `uniqueID`, sorted by schedule time); `A`/`D` override; invalid → `invalid_direction`. | ✅ | |
| F-8 | Upstream Avinor XmlFeed (`TimeFrom=1`, `TimeTo=7` hours) + airportNames enrichment (`airportName`), ISO-8859-1 decoded. | ✅ | Airport names cached in-isolate ~24 h. |
| F-9 | Filter flights to resolved gate(s) (case-insensitive); flights without a gate are excluded unless `*`. | ✅ | Arrivals often lack gates. |
| F-10 | Include Avinor attribution in payload. | ✅ | `attribution` survives default filter. |
| F-11 | Cache HTTP 200 for **180 s**; reset via `POST /flights/norway/reset`. | ⚠️ | Partial `AD` results can be cached (see R-1). |
| F-12 | Same `format` / `filter` / `debug` conventions as weather. | ✅ | |

### 3.4 Sample signage client

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| S-1 | Portrait 1080×1920 HTML sample under `samples/v1/`. | ❌ | **Removed** in commit `4d644e5` ("Clean Up"). README, INFRASTRUCTURE and the docs nav (`/samples/v1/index.html`) still reference it. |
| S-2 | Split assets: HTML, CSS, JS. | ❌ | As above. |
| S-3 | Call `/flights/norway`, forwarding `player`, `resource_id`, `gates`, `iata`, `direction`, `refresh`, `api`. | ❌ | As above. |
| S-4 | Display next departure/arrival (city, schedule, ETA/ETD, status). | ❌ | As above. |

**Decision needed:** either restore `samples/v1` (e.g. under `docs/public/samples/v1/`
so Zudoku serves it) or drop S-1…S-4 and remove the references.

## 4. Non-functional requirements

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| N-1 | Runtime: Zuplo managed edge (Workers-compatible TypeScript). | ✅ | |
| N-2 | No DOM XML parser dependency for Avinor; Workers-safe regex parsing. | ✅ | Regex parser is tolerant but brittle to feed format changes. |
| N-3 | Secrets only via Zuplo env / local `.env`; never committed. | ✅ | `.env`, `.env.zuplo` ignored. `env.example` still carries template `EXAMPLE_*` entries. |
| N-4 | CORS: `corsPolicy: none` (clients load JS via script tag / offline sync). | ✅ | Browser `fetch` from other origins will fail by design. |
| N-5 | OpenAPI (`routes.oas.json`) is the contract for the developer portal. | ✅ | |
| N-6 | Respect Avinor terms: attribution, ≥3 min refresh, gateway caching. | ✅ | |
| N-7 | Upstream failures return a controlled error and are never cached as success. | ⚠️ | See R-1, R-2. |
| N-8 | Automated test coverage for all routes and parameter variants. | ⚠️ | 55 integration cases; no unit tests; no CI runner in repo. |
| N-9 | Administrative endpoints protected from public use. | ❌ | Reset routes are unauthenticated (see R-3). |

## 5. Out of scope (current)

- Flights providers for countries other than Norway.
- Flights for Sweden/Poland (no provider).
- In-repo CI/CD or custom deploy scripts (Git → Zuplo portal deploy).
- Authentication / API keys on data routes.
- External player database (players ship inside the bundle).

## 6. Assessment findings

### 6.1 Risks / defects (ordered by impact)

| ID | Finding | Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| R-1 | Avinor responses are not checked for `ok`. For `direction=AD`, status/headers come only from the departures call, so if arrivals fails the merged (departures-only) payload returns **200 and is cached for 180 s**. A non-200 single feed is parsed as empty flights. | `modules/avinor-xml.ts` (`fetchAvinorFeedSingle`, `fetchAvinorFlights`) | Silent missing data on screens. | Check `response.ok`; for AD return the worst status (e.g. 502) or a `partial` flag; never cache partial results. |
| R-2 | No `try/catch`/timeout around upstream `fetch`; weather calls `upstreamResponse.json()` unconditionally. Network errors or non-JSON bodies surface as unformatted 500s. | `weather-handler.ts`, `avinor-xml.ts` | Signage receives non-`data =` bodies and may break. | Wrap upstream calls; return standard error envelope with 502/504; add `AbortSignal.timeout`. |
| R-3 | `POST …/reset` routes have no auth. Anyone can repeatedly bust caches and drive OpenWeather quota/cost. | `config/routes.oas.json` | Cost / abuse vector. | Add Zuplo API-key or shared-secret header policy to reset routes (and consider rate limiting on GET routes). |
| R-4 | Weather accepts an undocumented client-supplied `q` when `source=city` and no player is given; such requests bypass cache-key normalization (no `cacheVersion`), so reset does not invalidate them. | `weather-handler.ts` | Undocumented surface, stale cache after reset. | Either document `q` and normalize it, or ignore client `q`. |
| R-5 | Error format inconsistency: weather returns plain-text errors; flights returns `data = {error, message};`/JSON. | `weather-handler.ts`, `response-format.ts` | Clients need two error-handling paths. | Use `buildStandardErrorResponse` in weather. |
| R-6 | Player lookup is a linear `Array.find` per call (Poland ~867 records, called twice per request in normalizer + handler). | `players/types.ts` | Minor CPU cost at edge. | Build a `Map` once per lookup. |
| R-7 | `normalizeDirectionParam` returns invalid values unchanged (both branches return `normalized`); correctness relies on the separate validator. | `avinor-xml.ts` | Latent bug if reused. | Fall back to default or throw. |

### 6.2 Repository / documentation drift

| ID | Finding | Recommendation |
| --- | --- | --- |
| D-1 | `samples/v1/` deleted (`4d644e5`) but still documented in README, INFRASTRUCTURE and linked from `docs/zudoku.config.tsx`. | Restore or remove references (see §3.4). |
| D-2 | `NorwayPlayers.csv` (deleted `9283197`) and `poland.csv` (deleted `81bf8ca`) are inputs to `scripts/update-*-from-csv.mjs`; scripts cannot run from a clean checkout. `generate-poland-players.mjs` expects an undocumented `Formated_full_list.csv`. | Commit the source CSVs (if not sensitive) or document where they live; delete the obsolete generator. |
| D-3 | README states 2 test players; there are 3. | Update README table. |
| D-4 | Template leftovers: `modules/hello-world.ts`, unused `mock-api-inbound` policy, `EXAMPLE_*` in `env.example`, Zuplo placeholder logos in `docs/zudoku.config.tsx`. | Remove / replace with project assets. |
| D-5 | `config/player-location-data.json` is not referenced by any module and contains duplicate player IDs. | Delete or document its purpose. |
| D-6 | `npm run test` runs `zuplo test` without `--endpoint`; it only works with extra flags. | Add `test:local` / `test:smoke` scripts. |

### 6.3 Strengths

- Clean factory pattern for weather countries; per-country modules are 4–9 lines.
- Cache-key normalization resolves players to canonical location/gate keys, so
  many players at the same site share one cache entry and one upstream call.
- Version-bump invalidation via `ZoneCache` avoids needing purge APIs.
- Correct ISO-8859-1 handling for Avinor; airport-name enrichment cached per isolate.
- Integration suite covers happy paths, aliases, error codes and resets, with a
  production-safe `smoke:` filter.

## 7. Acceptance checks

- [ ] `/weather/sweden`, `/weather/norway`, `/weather/poland` resolve country + test players (latlon and `source=city`).
- [ ] `/flights/norway?player=<test id>` returns gate-filtered flights for OSL demo gates.
- [ ] `/flights/norway?gates=D9&iata=OSL` and `?iata=BGO` return direct results.
- [ ] `gates` + `player` together returns `gate_and_player_conflict`.
- [ ] Weather without `OPENWEATHER_API_KEY` fails with a configuration error.
- [ ] Upstream failure (simulated) returns a non-200 standard error and is not cached. *(R-1/R-2 — currently fails)*
- [ ] Reset routes reject unauthenticated calls. *(R-3 — currently fails)*
- [ ] Signage sample loads live flight data from URL parameters. *(S-1 — sample missing)*
- [ ] `npx zuplo test --endpoint http://localhost:9000` passes.
