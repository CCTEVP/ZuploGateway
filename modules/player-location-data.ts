import playerLocationRecords from "../config/player-location-data.json";

export type PlayerLocationRecord = {
  playerId: string;
  latitude: number;
  longitude: number;
};

export function findPlayerLocation(playerId: string) {
  return (playerLocationRecords as PlayerLocationRecord[]).find(
    (record) => record.playerId === playerId,
  );
}
