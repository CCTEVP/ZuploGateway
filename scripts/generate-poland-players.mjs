import fs from "node:fs";

function parseCoord(raw, isLat) {
  const n = Number(raw);
  const min = isLat ? 49 : 14;
  const max = isLat ? 55 : 25;
  for (const exp of [8, 7, 6, 5, 4, 3, 2]) {
    const value = n / 10 ** exp;
    if (value >= min && value <= max) {
      return Math.round(value * 1e7) / 1e7;
    }
  }
  throw new Error(`Unable to parse coordinate: ${raw}`);
}

const csvPath = new URL(
  "../modules/players/Formated_full_list.csv",
  import.meta.url,
);
const outPath = new URL("../modules/players/poland.ts", import.meta.url);
const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const seen = new Set();
const records = [];

for (const line of lines.slice(1)) {
  const [
    ,
    frameId,
    playerId,
    displayUnitId,
    altId,
    panelsId,
    latRaw,
    lonRaw,
  ] = line.split(",");

  if (seen.has(playerId)) {
    continue;
  }
  seen.add(playerId);

  records.push({
    PlayerID: Number(playerId),
    FrameID: Number(frameId),
    DisplayUnitID: Number(displayUnitId),
    PanelsID: Number(panelsId),
    Latitude: parseCoord(latRaw, true),
    Longitude: parseCoord(lonRaw, false),
    NameStreet: altId,
  });
}

const recordLines = records
  .map((record) => {
    const nameStreet = record.NameStreet.replace(/\\/g, "\\\\").replace(
      /"/g,
      '\\"',
    );
    return `  {
    PlayerID: ${record.PlayerID},
    FrameID: ${record.FrameID},
    DisplayUnitID: ${record.DisplayUnitID},
    PanelsID: ${record.PanelsID},
    Latitude: ${record.Latitude},
    Longitude: ${record.Longitude},
    Country: "Poland",
    NameStreet: "${nameStreet}",
  }`;
  })
  .join(",\n");

const output = `import {
  createCountryPlayerLookup,
  type PlayerSourceRecord,
} from "./types";
import { testPlayerRecords } from "./test";

const playerRecords: PlayerSourceRecord[] = [
${recordLines},
];

export const polandPlayers = createCountryPlayerLookup(
  playerRecords,
  testPlayerRecords,
);
`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${records.length} Poland player records to poland.ts`);
