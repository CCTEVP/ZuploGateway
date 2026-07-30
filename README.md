## Zuplo API

This is a Zuplo API that was created with
[`create-zuplo-api`](https://zuplo.com/docs).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:9000](http://localhost:9000) with your browser to see the
result.

If you also want the docs server locally, run:

```bash
npm run docs
```

If port `9000` or `9100` is already in use, you can start the gateway with the
PowerShell launcher, which closes the previous listeners before starting npm:

```powershell
.\start-dev.ps1
```

## Player datasets

Player lookup data is stored per country under `modules/players/` so it can be
updated directly in the Zuplo editor:

- `modules/players/sweden.ts` — Sweden weather players
- `modules/players/norway.ts` — Norway weather + flights players
- `modules/players/test.ts` — shared demo/QA players merged into **every**
  country lookup (so the same Broadsign test IDs work on `/weather/sweden`,
  `/weather/norway`, `/flights/norway`, etc.)

Shared types live in `modules/players/types.ts`. Optional fields:

- `Gate` — airport gate for flights (e.g. `D1`, `A4`)
- `IATA` — airport IATA code for flights (e.g. `OSL`, `BGO`, `SVG`, `TRD`)

## Weather

Country-specific weather endpoints share OpenWeather upstream logic but use
separate player datasets and cache namespaces (1 hour TTL).

| Endpoint | Players | Cache reset |
| --- | --- | --- |
| `GET /weather/sweden` | Sweden dataset | `POST /weather/sweden/reset` |
| `GET /weather/norway` | Norway dataset | `POST /weather/norway/reset` |

Common query parameters: `latlon`, `player` /
`com.broadsign.suite.bsp.resource_id`, `debug`, `format=json`, `filter=false`.

By default responses are JavaScript (`data = {...};`). Use `format=json` for
raw JSON. When `debug=true`, the response includes a `debug` object with the
upstream OpenWeather URL (`appid` masked) and matched player data when
applicable.

## Flights Norway (`/flights/norway`)

`GET /flights/norway` returns Avinor flight data filtered by gate. Upstream data
comes from Avinor's public XmlFeed (`asrv.avinor.no/XmlFeed/v1.0`). No API key
is required. Responses are cached for **1 minute**.

Provide **either** `gate` **or** `player` /
`com.broadsign.suite.bsp.resource_id` — never both.

| Parameter | Description |
| --- | --- |
| `gate` | Gate to filter (e.g. `A4`). Mutually exclusive with `player`. |
| `player` | Broadsign player ID. Resolves `Gate` and `IATA` from the Norway dataset. |
| `iata` | IATA airport override. Defaults to player `IATA`, else `OSL`. Alias: `airport`. |
| `direction` | `D` (departures, default) or `A` (arrivals). |
| `debug` | When `true`, includes upstream URL and related debug metadata. |
| `format` | Default is JavaScript `data = {...};`. Use `format=json` for raw JSON. |
| `filter` | Set `filter=false` to bypass the response field allowlist. |

If a known player has no `Gate` configured, the endpoint returns a standard
error body with `error: "player_has_no_gate"`.

Successful responses include an `attribution` object (`Flight data from Avinor`
→ [avinor.no](https://www.avinor.no)).

To invalidate the flights cache, send `POST /flights/norway/reset`.

You can start editing the API by modifying `config/routes.oas.json`. The dev
server will automatically reload the API with your changes.

## Learn More

To learn more about Zuplo, you can visit the
[Zuplo documentation](https://zuplo.com/docs).

To connect with the community join [Discord](https://discord.zuplo.com).
