import fs from "node:fs";

const playersDir = new URL("../modules/players/", import.meta.url);
const csvPath = new URL("NorwayPlayers.csv", playersDir);
const tsPath = new URL("norway.ts", playersDir);

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function parseGates(value) {
  if (value == null || value === "") {
    return {};
  }

  const tokens = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      if (/^gener(el|al)\s+all\s+gates$/i.test(part) || part === "*") {
        return ["*"];
      }
      if (/^[A-Za-z]*\d+[A-Za-z]*\.[A-Za-z]*\d+[A-Za-z]*$/.test(part)) {
        return part.split(".").map((item) => item.trim());
      }
      return [part];
    })
    .filter(Boolean);

  if (tokens.includes("*")) {
    return { allGates: true };
  }

  const gates = [...new Set(tokens)];
  return gates.length ? { gates } : {};
}

function formatGate(raw) {
  const { gates, allGates } = parseGates(raw);
  if (allGates) {
    return '    Gate: "*",';
  }
  if (!gates?.length) {
    return null;
  }
  if (gates.length === 1) {
    return `    Gate: ${JSON.stringify(gates[0])},`;
  }
  return `    Gate: ${JSON.stringify(gates)},`;
}

const csv = fs.readFileSync(csvPath, "utf8");
const rows = csv
  .replace(/\r\n/g, "\n")
  .replace(/\r/g, "\n")
  .split("\n")
  .filter((line) => line.length > 0)
  .slice(1);

const seen = new Set();
const records = [];

for (const line of rows) {
  const [id, gateRaw, iata, , lat, lon] = parseCsvLine(line);
  if (!id || seen.has(id)) {
    continue;
  }
  seen.add(id);
  records.push({
    PlayerID: Number(id),
    gateRaw: (gateRaw || "").trim(),
    IATA: (iata || "").trim(),
    Latitude: lat,
    Longitude: lon,
  });
}

const body = records
  .map((record) => {
    const lines = ["  {", `    PlayerID: ${record.PlayerID},`];
    const gateLine = formatGate(record.gateRaw);
    if (gateLine) {
      lines.push(gateLine);
    }
    if (record.IATA) {
      lines.push(`    IATA: ${JSON.stringify(record.IATA)},`);
    }
    lines.push(`    Latitude: ${record.Latitude},`);
    lines.push(`    Longitude: ${record.Longitude},`);
    lines.push("  }");
    return lines.join("\n");
  })
  .join(",\n");

const output = `import {
  createCountryPlayerLookup,
  type PlayerSourceRecord,
} from "./types";
import { testPlayerRecords } from "./test";

const playerRecords: PlayerSourceRecord[] = [
${body},
];

export const norwayPlayers = createCountryPlayerLookup(
  playerRecords,
  testPlayerRecords,
);
`;

fs.writeFileSync(tsPath, output);
console.log(`Wrote ${records.length} unique players to norway.ts`);
