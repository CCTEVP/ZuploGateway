export type PlayerSourceRecord = {
  PlayerID: number;
  Latitude: number;
  Longitude: number;
  /**
   * Airport gate(s). A string, a list of gates, or `"*"` for all gates
   * at the player's IATA airport.
   */
  Gate?: string | string[];
  /** Optional IATA airport code for flights endpoints (e.g. "OSL", "BGO"). */
  IATA?: string;
  DisplayUnitsID?: number;
  DisplayUnitID?: number;
  FrameID?: number;
  PanelsID?: number;
  IDSFaceID?: number;
  Country?: string;
  Municipality?: string;
  NameStreet?: string;
  Address?: string;
};

export type PlayerRecord = {
  playerId: string;
  latitude: number;
  longitude: number;
  /** Normalized gate list. Empty when `allGates` is true. */
  gates?: string[];
  /** When true, flights are not filtered to a specific gate. */
  allGates?: boolean;
  iata?: string;
};

export type PlayerLookup = {
  findSourceRecord: (playerId: string) => PlayerSourceRecord | undefined;
  findPlayer: (playerId: string) => PlayerRecord | undefined;
};

/**
 * Country datasets win on ID collision; shared/test players are appended so
 * they remain available on every country endpoint.
 */
export function parseGates(
  value: string | string[] | undefined,
): { gates?: string[]; allGates?: boolean } {
  if (value == null) {
    return {};
  }

  const tokens = (Array.isArray(value) ? value : [value])
    .flatMap((part) => String(part).split(","))
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
    return { allGates: true, gates: [] };
  }

  const gates = [...new Set(tokens)];
  return gates.length ? { gates } : {};
}

export function mergePlayerRecords(
  countryRecords: PlayerSourceRecord[],
  sharedRecords: PlayerSourceRecord[],
): PlayerSourceRecord[] {
  const countryIds = new Set(
    countryRecords.map((record) => record.PlayerID),
  );
  return [
    ...countryRecords,
    ...sharedRecords.filter(
      (record) => !countryIds.has(record.PlayerID),
    ),
  ];
}

export function createPlayerLookup(
  records: PlayerSourceRecord[],
): PlayerLookup {
  function findSourceRecord(playerId: string) {
    return records.find((item) => String(item.PlayerID) === playerId);
  }

  function findPlayer(playerId: string): PlayerRecord | undefined {
    const record = findSourceRecord(playerId);

    if (!record) {
      return undefined;
    }

    const { gates, allGates } = parseGates(record.Gate);
    const iata = record.IATA?.trim().toUpperCase();

    return {
      playerId: String(record.PlayerID),
      latitude: record.Latitude,
      longitude: record.Longitude,
      ...(allGates ? { allGates: true, gates: [] } : {}),
      ...(gates?.length ? { gates } : {}),
      ...(iata ? { iata } : {}),
    };
  }

  return { findSourceRecord, findPlayer };
}

export function createCountryPlayerLookup(
  countryRecords: PlayerSourceRecord[],
  sharedRecords: PlayerSourceRecord[],
): PlayerLookup {
  return createPlayerLookup(mergePlayerRecords(countryRecords, sharedRecords));
}
