import { createWeatherNormalizeCacheKey } from "./weather-handler";
import { polandPlayers } from "./players/poland";

export const WEATHER_POLAND_CACHE_NAMESPACE = "weather-poland-cache";

export default createWeatherNormalizeCacheKey(
  polandPlayers,
  WEATHER_POLAND_CACHE_NAMESPACE,
);
