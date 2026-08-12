import { createWeatherReset } from "./weather-handler";
import { WEATHER_POLAND_CACHE_NAMESPACE } from "./weather-poland-normalize-cache-key";

export default createWeatherReset(
  WEATHER_POLAND_CACHE_NAMESPACE,
  "weather-poland",
);
