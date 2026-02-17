/**
 * Haversine distance calculation.
 *
 * Used by rules that compare geographic positions (StopPlace ↔ Quay,
 * StopPlace ↔ ScheduledStopPoint).
 */

/**
 * Calculate the distance in meters between two WGS84 lat/lon points
 * using the Haversine formula.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
