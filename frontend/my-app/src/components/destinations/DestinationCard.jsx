import React from "react";
import WeatherChip from "../weather/WeatherChip";
import { useWeatherPreview } from "../../hooks/useWeatherPreview";

export default function DestinationCard({
  title = "Tokyo",
  image,
  lat,
  lon,
  onClick,
}) {
  const weather = useWeatherPreview(lat, lon);

  return (
    <button className="sk-destCard" onClick={onClick} type="button">
      <div
        className="sk-destImg"
        style={{ backgroundImage: `url(${image})` }}
      />

      <div className="sk-destOverlay" />

      <div className="sk-destTop">
        <div className="sk-destTitleRow">
          <span className="sk-destPlane">✈️</span>
          <span className="sk-destTitle">{title}</span>
        </div>

        <WeatherChip
          loading={weather.loading}
          temp={weather.temp}
          label={weather.label}
          high={weather.high}
          low={weather.low}
          emoji={weather.emoji}
          compact
        />
      </div>
    </button>
  );
}