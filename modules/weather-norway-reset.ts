import { createWeatherReset } from "./weather-handler";
import { WEATHER_NORWAY_CACHE_NAMESPACE } from "./weather-norway-normalize-cache-key";

export default createWeatherReset(
  WEATHER_NORWAY_CACHE_NAMESPACE,
  "weather-norway",
);
