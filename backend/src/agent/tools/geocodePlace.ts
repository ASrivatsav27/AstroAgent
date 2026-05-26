export interface GeoResult {
  lat: number;
  lng: number;
  timezone: string;
  displayName: string;
}

export async function geocodePlace(place: string): Promise<GeoResult> {
  // Using nominatim (free, no API key needed)
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "AstroAgent/1.0",
    },
  });

  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error(`Could not find location: ${place}`);
  }

  const { lat, lon, display_name } = data[0];

  // Get timezone from lat/lng using timezonefinder API
  const tzRes = await fetch(
    `https://timezonefinder.michelfe.it/api/0?lat=${lat}&lng=${lon}`
  );
  const tzData = await tzRes.json();

  return {
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    timezone: tzData.tz_name ?? "UTC",
    displayName: display_name,
  };
}