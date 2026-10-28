/**
 * Suggest ODT planner stop IDs for Poland players, for human review.
 *
 * For each player in modules/players/poland.ts, calls the ODT planner
 * `/stops/nearby/` with the player's coordinates and writes the nearest
 * places (with all their platform/pole stop IDs) to a review CSV.
 * Copy the chosen IDs into the `Stops` column of poland.csv, then run
 * `node scripts/update-poland-from-csv.mjs`.
 *
 * Usage:
 *   node scripts/suggest-poland-stops.mjs [--modes rail] [--radius 500]
 *     [--places 2] [--players 963988113,447246098]
 *
 * Set ODT_API_KEY to use higher rate limits (sent as X-API-Key).
 */
import fs from "node:fs";

const PLANNER = "https://api.odt.org.pl/api/planner/v1";
const playersTs = new URL("../modules/players/poland.ts", import.meta.url);
const outCsv = new URL(
  "../modules/players/poland-stops-suggestions.csv",
  import.meta.url,
);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const modes = arg("modes", "rail");
const radius = Number(arg("radius", "500"));
const places = Number(arg("places", "2"));
const onlyPlayers = arg("players", "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const apiKey = process.env.ODT_API_KEY;
// Without a key the search/status limit is 150 requests/minute per IP.
const delayMs = apiKey ? 100 : 450;

function readPlayers() {
  const ts = fs.readFileSync(playersTs, "utf8");
  const players = new Map();
  for (const [, block] of ts.matchAll(/\{([^{}]*)\}/g)) {
    const id = block.match(/PlayerID: (\d+)/)?.[1];
    const lat = block.match(/Latitude: (-?[\d.]+)/)?.[1];
    const lon = block.match(/Longitude: (-?[\d.]+)/)?.[1];
    const city = block.match(/City: ("(?:[^"\\]|\\.)*")/)?.[1];
    if (id && lat && lon && !players.has(id)) {
      players.set(id, { id, lat, lon, city: city ? JSON.parse(city) : "" });
    }
  }
  return [...players.values()].filter(
    (player) => !onlyPlayers.length || onlyPlayers.includes(player.id),
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function nearby(lat, lon) {
  const url = new URL(`${PLANNER}/stops/nearby/`);
  url.searchParams.set("near", `${lat},${lon}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("page_size", String(places));
  for (const mode of modes.split(",").filter(Boolean)) {
    url.searchParams.append("modes", mode);
  }

  for (;;) {
    const response = await fetch(url, {
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? "10");
      console.warn(`Rate limited; waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!response.ok) {
      throw new Error(`${response.status} for ${url}`);
    }
    return (await response.json()).results ?? [];
  }
}

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const players = readPlayers();
const cache = new Map();
const rows = [
  [
    "PlayerID",
    "City",
    "Latitude",
    "Longitude",
    "Rank",
    "Place",
    "DistanceM",
    "Modes",
    "Stops",
    "Platforms",
  ],
];

for (const [i, player] of players.entries()) {
  const key = `${Number(player.lat).toFixed(4)},${Number(player.lon).toFixed(4)}`;
  if (!cache.has(key)) {
    cache.set(key, await nearby(player.lat, player.lon));
    await sleep(delayMs);
  }

  const results = cache.get(key);
  if (!results.length) {
    rows.push([player.id, player.city, player.lat, player.lon, "", "", "", "", "", ""]);
  }
  results.forEach((place, rank) => {
    rows.push([
      player.id,
      player.city,
      player.lat,
      player.lon,
      rank + 1,
      place.name,
      place.distance_m,
      place.modes.join(" "),
      place.stops.map((stop) => stop.id).join(";"),
      place.stops.map((stop) => stop.platform ?? stop.code ?? "").join(";"),
    ]);
  });

  if ((i + 1) % 50 === 0) {
    console.log(`${i + 1}/${players.length} players`);
  }
}

fs.writeFileSync(outCsv, `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`);
console.log(
  `Wrote suggestions for ${players.length} players (${cache.size} lookups) to ${outCsv.pathname}`,
);
