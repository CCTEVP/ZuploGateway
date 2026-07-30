# Developer Portal

This portal documents the routes defined in `config/routes.oas.json` for the
gateway.

## Current Routes

### Weather

| Endpoint | Players |
| --- | --- |
| `GET /weather/sweden` | `modules/players/sweden.ts` |
| `GET /weather/norway` | `modules/players/norway.ts` |

Accepted query parameters:

- `latlon`: Comma-separated coordinates
- `player`: Player ID resolved from the country-specific player dataset
- `com.broadsign.suite.bsp.resource_id`: Alias for `player`
- `debug`: `true` or `false` (when `true`, includes debug metadata)
- `filter`: `false` (when set, bypasses the response filter)
- `format`: `json` (otherwise returns JavaScript: `data = {...};`)

Behavior:

- Requires one of `latlon`, `player`, or `com.broadsign.suite.bsp.resource_id`
- Rounds latitude/longitude to 3 decimal places before upstream request
- Applies inbound weather caching (`3600` seconds for HTTP `200` responses)
- Applies response filtering by default unless `filter=false`
- Adds `timestamp` to the response payload

Cache reset:

- `POST /weather/sweden/reset`
- `POST /weather/norway/reset`

### Flights Norway

#### `GET /flights/norway`

Returns Avinor flight data filtered by gate. Player lookups use the Norway
dataset (`Gate` + `IATA`).

Accepted query parameters:

- `gate` or `player` / `com.broadsign.suite.bsp.resource_id` (mutually exclusive)
- `iata` (optional; alias `airport`; default player IATA or `OSL`)
- `direction` (`D` default, or `A`)
- `debug`, `format`, `filter`

Cache: 60 seconds. Reset with `POST /flights/norway/reset`.

## Local Development

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Run the gateway and docs together from the repository root:

   ```bash
   npm run docs
   ```

3. Optional: run only the portal from `docs/`:

   ```bash
   npm run dev
   ```
