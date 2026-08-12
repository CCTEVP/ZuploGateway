export type PlayerSourceRecord = {
  PlayerID: number;
  Latitude: number;
  Longitude: number;
  /** Optional airport gate for flights endpoints (e.g. "A4"). */
  Gate?: string;
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
  gate?: string;
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

    const gate = record.Gate?.trim();
    const iata = record.IATA?.trim().toUpperCase();

    return {
      playerId: String(record.PlayerID),
      latitude: record.Latitude,
      longitude: record.Longitude,
      ...(gate ? { gate } : {}),
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
