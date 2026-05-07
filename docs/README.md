# Developer Portal

This portal documents the routes defined in `config/routes.oas.json` for the
gateway.

## Current Routes

### `GET /weather/`

Transforms weather requests before forwarding to OpenWeather.

Accepted query parameters:

- `latlon`: Comma-separated coordinates (example: `32.46564,12.8737874`)
- `player`: Player ID resolved from the bundled player-location dataset
- `com.broadsign.suite.bsp.resource_id`: Alias for `player`
- `debug`: `true` or `false` (when `true`, includes debug metadata)
- `format`: `json` (otherwise returns JavaScript: `data = {...};`)

Behavior:

- Requires one of `latlon`, `player`, or
  `com.broadsign.suite.bsp.resource_id`
- Rounds latitude/longitude to 3 decimal places before upstream request
- Applies inbound weather caching (`3600` seconds for HTTP `200` responses)
- Adds `timestamp` to the response payload

Common responses:

- `200`: Weather response (JSON or JavaScript wrapper)
- `400`: Invalid or missing query parameters
- `404`: Unknown `player` / `resource_id`

### `POST /weather/reset`

Resets the weather cache namespace by updating the internal cache version key.

Common responses:

- `200`: Cache reset confirmation JSON:
  `{ "cache": "weather", "reset": true, "version": "<timestamp>" }`

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
