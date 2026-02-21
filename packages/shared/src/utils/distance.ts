/**
 * Distance and travel utility functions
 */

import type { TransportMode } from '../types/enums';

/**
 * Calculate haversine distance between two coordinates (in km)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Distance bands for heuristic ETA calculation (in km)
 */
const DISTANCE_BANDS = [
  { maxKm: 3, drivingMinutes: 10 },
  { maxKm: 8, drivingMinutes: 20 },
  { maxKm: 15, drivingMinutes: 35 },
  { maxKm: 25, drivingMinutes: 50 },
  { maxKm: Infinity, drivingMinutes: 70 },
];

/**
 * Mode multipliers for heuristic ETA
 */
const MODE_MULTIPLIERS: Record<TransportMode, number> = {
  sedan: 1.0,
  motorcycle: 0.9, // Slightly faster in traffic
  taxi: 1.1, // Account for pickup time
  transit: 1.5, // Generally slower
  walking: 4.0, // Much slower
};

/**
 * Transit additional time (waiting + walking)
 */
const TRANSIT_OVERHEAD_MINUTES = 20; // 10 min waiting + 10 min walking

/**
 * Calculate heuristic ETA based on distance bands
 * Used as fallback when directions API is unavailable
 */
export function calculateHeuristicETA(
  distanceKm: number,
  mode: TransportMode
): number {
  // Find the appropriate distance band
  const band = DISTANCE_BANDS.find(b => distanceKm <= b.maxKm)!;
  let etaMinutes = band.drivingMinutes;

  // Apply mode multiplier
  etaMinutes *= MODE_MULTIPLIERS[mode];

  // Add transit overhead
  if (mode === 'transit') {
    etaMinutes += TRANSIT_OVERHEAD_MINUTES;
  }

  return Math.round(etaMinutes);
}

/**
 * Apply weather impact to ETA
 */
export function applyWeatherImpact(
  etaMinutes: number,
  mode: TransportMode,
  weatherCondition: string
): { adjustedEta: number; warningMessage: string | null } {
  let multiplier = 1.0;
  let warningMessage: string | null = null;

  switch (weatherCondition.toLowerCase()) {
    case 'snow':
    case 'freezing_rain':
    case 'high_wind':
      if (mode === 'sedan') {
        multiplier = 1.15;
        warningMessage = 'Winter conditions - allow extra travel time';
      } else if (mode === 'taxi') {
        multiplier = 1.1;
        warningMessage = 'Winter conditions may affect travel time';
      } else if (mode === 'motorcycle') {
        warningMessage = 'Weather not suitable for motorcycle - consider car or transit';
        multiplier = 1.0; // We recommend switching modes instead
      } else if (mode === 'transit') {
        multiplier = 1.1;
        warningMessage = 'Transit delays possible due to weather';
      }
      break;
    case 'rain':
      if (mode === 'motorcycle') {
        warningMessage = 'Rain expected - consider alternative transport';
      }
      if (mode === 'sedan' || mode === 'taxi') {
        multiplier = 1.05;
      }
      break;
    case 'fog':
      if (mode === 'sedan' || mode === 'taxi') {
        multiplier = 1.1;
        warningMessage = 'Fog expected - drive carefully';
      }
      break;
  }

  return {
    adjustedEta: Math.round(etaMinutes * multiplier),
    warningMessage,
  };
}

/**
 * Get parking buffer for a transport mode
 */
export function getParkingBuffer(mode: TransportMode): number {
  const buffers: Record<TransportMode, number> = {
    sedan: 5,
    motorcycle: 3,
    taxi: 2,
    transit: 0,
    walking: 0,
  };
  return buffers[mode];
}

/**
 * Check if motorcycle is recommended for given conditions
 */
export function isMotorcycleRecommended(
  weatherCondition: string,
  temperatureCelsius: number
): { recommended: boolean; reason: string | null } {
  const badConditions = ['snow', 'freezing_rain', 'high_wind', 'rain', 'fog'];

  if (badConditions.includes(weatherCondition.toLowerCase())) {
    return {
      recommended: false,
      reason: `Weather condition "${weatherCondition}" not suitable for motorcycle`,
    };
  }

  if (temperatureCelsius < -5) {
    return {
      recommended: false,
      reason: 'Temperature too cold for comfortable motorcycle riding',
    };
  }

  if (temperatureCelsius > 35) {
    return {
      recommended: false,
      reason: 'Temperature very high - consider air-conditioned transport',
    };
  }

  return { recommended: true, reason: null };
}

/**
 * Calculate total travel time including buffers
 */
export function calculateTotalTravelTime(
  etaMinutes: number,
  mode: TransportMode,
  includeParking: boolean = true
): number {
  let total = etaMinutes;

  if (includeParking) {
    total += getParkingBuffer(mode);
  }

  return total;
}

/**
 * Generate cache key for directions
 */
export function generateDirectionsCacheKey(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode: TransportMode,
  departBucket: string
): string {
  // Round coordinates to 4 decimal places (about 11m precision)
  const roundedFromLat = Math.round(fromLat * 10000) / 10000;
  const roundedFromLng = Math.round(fromLng * 10000) / 10000;
  const roundedToLat = Math.round(toLat * 10000) / 10000;
  const roundedToLng = Math.round(toLng * 10000) / 10000;

  return `${roundedFromLat},${roundedFromLng}|${roundedToLat},${roundedToLng}|${mode}|${departBucket}`;
}

/**
 * Generate cache key for geocoding
 */
export function generateGeoCacheKey(query: string): string {
  // Normalize query for caching
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s,]/g, '');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `geo_${Math.abs(hash).toString(36)}`;
}
