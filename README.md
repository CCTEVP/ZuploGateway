## Dynode (Zuplo Gateway)

Zuplo-managed edge API that serves **weather** (OpenWeather) for Sweden, Norway,
and Poland, plus **Norway flights** (Avinor), keyed by country player datasets
or explicit query parameters.

Created with [`create-zuplo-api`](https://zuplo.com/docs).

**Further reading**

- [REQUIREMENTS.md](REQUIREMENTS.md) — functional / non-functional requirements
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — hosting, caches, upstreams, deploy
- [docs/](docs/) — Zudoku developer portal (`npm run docs`)

**Deployed gateway:** `https://dynode-main-8eca196.zuplo.app`

## Getting Started

```bash
npm run dev
```

Gateway: [http://localhost:9000](http://localhost:9000)  
Editor: port `9100`

Docs portal:

```bash
npm run docs
```

### API tests (`tests/`)

Integration tests against a live gateway (local or deployed):

```bash
# Terminal 1
npm run dev

# Terminal 2 — full suite
npx zuplo test --endpoint http://localhost:9000

# Read-only smoke (safe for production)
npx zuplo test --endpoint https://dynode-main-8eca196.zuplo.app --filter "smoke:"
```

| File | Coverage |
| --- | --- |
| `tests/smoke.test.ts` | Happy-path weather + flights |
| `tests/weather.test.ts` | All weather countries + param variants (`source`, `format`, aliases, errors) |
| `tests/flights.test.ts` | Player/direct lookup, directions, gates/iata, errors |
| `tests/transit.test.ts` | Poland transit: player/direct stops, limit/window, errors |
| `tests/cache-reset.test.ts` | `POST …/reset` (side effects; skip in production smoke) |

If ports `9000` / `9100` are in use on Windows:

```powershell
.\start-dev.ps1
```

### Environment

Copy `env.example` to `.env`:

| Variable | Required for | Notes |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | `/weather/*` | OpenWeather API key |
| Flights | `/flights/norway` | No API key (public Avinor XmlFeed) |
| `ODT_API_KEY` | `/transit/poland` | Optional. ODT planner key (higher rate limits); works without it |

Deployed secrets are set in the Zuplo portal (not only in Git).

## Architecture

| Layer | Location |
| --- | --- |
| Routes | `config/routes.oas.json` |
| Policies | `config/policies.json` |
| Handlers / policies | `modules/` |
| Player data | `modules/players/` |
| Sample signage client | `samples/v1/` |
| Developer portal | `docs/` (Zudoku) |

```mermaid
flowchart LR
  Client --> WeatherSE["/weather/sweden"]
  Client --> WeatherNO["/weather/norway"]
  Client --> WeatherPL["/weather/poland"]
  Client --> FlightsNO["/flights/norway"]
  WeatherSE --> OpenWeather
  WeatherNO --> OpenWeather
  WeatherPL --> OpenWeather
  FlightsNO --> Avinor
```

## Player datasets

Country files under `modules/players/`:

| File | Used by | Players (approx.) |
| --- | --- | --- |
| `sweden.ts` | `/weather/sweden` | 13 |
| `norway.ts` | `/weather/norway`, `/flights/norway` | 48 |
| `poland.ts` | `/weather/poland` | 867 |
| `test.ts` | Merged into **every** country lookup | 5 |

Shared helper: `createCountryPlayerLookup(countryRecords, testPlayerRecords)`.

Norway flight players are sourced from `modules/players/NorwayPlayers.csv` and
regenerated with:

```bash
node scripts/update-norway-from-csv.mjs
```

Poland weather players are sourced from `modules/players/poland.csv` and
regenerated with:

```bash
node scripts/update-poland-from-csv.mjs
```

Optional player fields (flights):

- `Gate` — one gate, several gates (comma-separated or dot notation), or `*` for all gates
- `IATA` — airport code (e.g. `OSL`, `BGO`, `TRD`)

Demo/QA player IDs (always available):

| Player ID | Gates | IATA |
| --- | --- | --- |
| `759244535` | D9 | OSL |
| `582309742` | D1 | OSL |

Player id query aliases (weather, flights and transit):

- `player`
- `resource_id`
- `com.broadsign.suite.bsp.resource_id` (legacy CMS contract)
- `com.driver.drv.station_id` (CMS contract, same as above)

## Weather

Shared OpenWeather handler; country-specific player datasets and caches
(**1 hour** TTL).

| Endpoint | Dataset | Reset |
| --- | --- | --- |
| `GET /weather/sweden` | Sweden + test | `POST /weather/sweden/reset` |
| `GET /weather/norway` | Norway + test | `POST /weather/norway/reset` |
| `GET /weather/poland` | Poland + test | `POST /weather/poland/reset` |

Requires one of `latlon` or a player id.

| Parameter | Description |
| --- | --- |
| `latlon` | Comma-separated coordinates (rounded to 3 decimals upstream) |
| `player` / `resource_id` | Resolved from the country dataset |
| `source` | `latlon` (default) or `city`. With `city`, uses player `City` + `Country` for OpenWeather `q=City,CC`; falls back to coordinates if City is missing. City overrides latlon when both are available. |
| `format=json` | Raw JSON instead of default JavaScript |
| `filter=false` | Full OpenWeather payload |
| `debug=true` | Masked upstream URL + matched player |

Default body is JavaScript: `data = {...};`.

Default filtered fields: `coord`, `main.temp`, `weather[0].main`, `wind.speed`,
`rain.1h`, `sys.sunrise`, `sys.sunset`.

## Flights Norway

`GET /flights/norway` — Avinor XmlFeed, filtered by gate(s). Cache **180 seconds**
(Avinor recommends refreshing about every 3 minutes).

Two lookup modes — never combine them:

1. **Direct** — `gates` with optional `iata`, or `iata` alone (all gates at that airport)
2. **Player** — `player` or `resource_id` (resolves gates + IATA from dataset)

| Parameter | Description |
| --- | --- |
| `gates` | Direct lookup: gate code, comma-separated list, dot notation (`C2.C3`), or `*` for all gates. Legacy alias: `gate`. |
| `iata` | Direct lookup: airport code. With `gates`, defaults to `OSL` when omitted. **Without `gates`, returns all gates at this airport.** Alias: `airport`. |
| `player` | Player lookup: resolves gate(s) + IATA from Norway (+ test) players. |
| `resource_id` | Alias of `player`. |
| `direction` | `AD` both (default), `A` arrivals, or `D` departures. |
| `debug` / `format` / `filter` | Same semantics as weather. |

Each flight may include `airportName` (city/airport label from Avinor
`airportNames`). Arrivals often lack matching gate codes; departures match
player gates more reliably.

Reset: `POST /flights/norway/reset`.

Attribution in responses: “Flight data from Avinor” → [avinor.no](https://www.avinor.no).

## Transit Poland

`GET /transit/poland` — next departures (e.g. trains) from the
[Open Transport Data](https://odt.org.pl/en/developers) journey planner, which
merges GTFS timetables with GTFS-RT realtime feeds. Cache **30 seconds**.

Two lookup modes — never combine them:

1. **Player** — `player` or `resource_id`, resolved to the player's `Stops`
2. **Direct** — `stops`: comma-separated ODT stop IDs (`<feed>:<stop_id>`)

| Parameter | Description |
| --- | --- |
| `limit` | Departures to return, 1–10 (default 3) |
| `window` | Look-ahead in minutes, 1–720 (default 120) |
| `include=terminating` | Also return trips that end at the stop (skipped by default: nobody can board them) |
| `debug` / `format` / `filter` | Same semantics as weather |

Default response — only what a countdown needs, per departure: `line`,
`headsign`, `platform`, `arrival`, `departure` (realtime estimate, else
scheduled), `realtime`, `atPlatform` and `remainingSeconds` (until arrival;
**0 when the vehicle is already at the platform**). `filter=false` adds the
scheduled/estimated times, delay, operator, colors, `startsHere`,
`terminatesHere`, `tripId`, plus `next` and `stops`.

Clients should count down from `arrival`/`departure` on their own clock:
`remainingSeconds` is computed when the response is built and the response is
cached for up to 30 s. At the platform = `arrival <= now < departure`.

- "At platform" is inferred from realtime (or scheduled) arrival ≤ now <
  departure: ODT has no live positions for trains.
- A train that **starts** at the stop (`startsHere: true`) has no arrival time,
  so it counts down to departure even if it is already parked.
- `realtime: false` means the operator publishes no live data for that trip.

Player field: `Stops` (string or string[]) in `PlayerSourceRecord`, e.g.
`["plk:80416_RAIL_3_1", "plk:80416_RAIL_3_2"]` (Kraków Główny platforms 3/1, 3/2).
Suggest candidates from player coordinates, review them, add them to the
`Stops` column of `poland.csv`, then regenerate:

```bash
node scripts/suggest-poland-stops.mjs --modes rail --radius 500
node scripts/update-poland-from-csv.mjs
```

Test player `759244535` has all Kraków Główny platforms configured.

Reset: `POST /transit/poland/reset`.

### Examples

```bash
GET /flights/norway?player=582309742&format=json
GET /flights/norway?gates=D9&iata=OSL&direction=D&format=json
GET /flights/norway?gates=C34,C35&iata=BGO&format=json
GET /flights/norway?iata=BGO&format=json
GET /weather/norway?player=582309742&format=json
GET /weather/sweden?player=582607705&format=json
GET /weather/poland?player=963988113&format=json
GET /weather/poland?player=963988113&source=city&format=json
GET /transit/poland?player=759244535&format=json
GET /transit/poland?stops=plk:80416_RAIL_3_1,plk:80416_RAIL_3_2&limit=5&format=json
```

## Sample client (`samples/v1`)

1080×1920 portrait signage board, also linked from the docs portal at
`/samples/v1/index.html`:

| File | Role |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Layout |
| `app.js` | Loads gateway data and renders next departure/arrival |

At runtime the sample forwards query parameters from the page URL to the gateway:

- Player lookup: `player` or `resource_id`
- Direct lookup: `gates` and optional `iata`, or `iata` alone for all gates

```text
https://dynode-main-8eca196.zuplo.app/flights/norway?resource_id=759244535
https://dynode-main-8eca196.zuplo.app/flights/norway?gates=D9&iata=OSL
```

Example docs URL:

```text
/samples/v1/index.html?resource_id=759244535&direction=D
/samples/v1/index.html?gates=D9&iata=OSL&direction=D
```

Optional query: `direction=AD` (default), `A`, or `D`; `refresh=180` (seconds);
`api=` (override gateway base URL).

## Project layout (key paths)

```text
config/routes.oas.json      OpenAPI + x-zuplo-route wiring
config/policies.json        Cache + normalize policies
modules/weather-handler.ts  Shared weather factory
modules/avinor-xml.ts       Avinor feed + airport names
modules/flights-query-params.ts  gates/iata query helpers
modules/players/            Country + test player data
scripts/update-norway-from-csv.mjs  Regenerate norway.ts from CSV
scripts/update-poland-from-csv.mjs  Regenerate poland.ts from CSV
samples/v1/                 Signage sample
docs/                       Zudoku developer portal
zuplo.jsonc                 Zuplo project metadata
```

## Learn More

- [REQUIREMENTS.md](REQUIREMENTS.md)
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md)
- [Zuplo documentation](https://zuplo.com/docs)
- [Discord](https://discord.zuplo.com)
