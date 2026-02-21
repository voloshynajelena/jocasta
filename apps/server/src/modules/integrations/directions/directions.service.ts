import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { LRUCache } from 'lru-cache';
import {
  utils,
  TransportMode,
  DirectionSource,
} from '@jocasta/shared';

export interface DirectionsResult {
  etaMinutes: number;
  distanceMeters: number;
  polyline?: string;
  source: DirectionSource;
  confidence: number;
}

@Injectable()
export class DirectionsService {
  private readonly logger = new Logger(DirectionsService.name);
  private readonly googleMapsApiKey: string | undefined;
  private readonly memoryCache: LRUCache<string, DirectionsResult>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.googleMapsApiKey = this.configService.get('google.mapsApiKey');

    // In-memory LRU cache
    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minutes
    });
  }

  /**
   * Get directions between two points
   */
  async getDirections(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: TransportMode,
    departureTime?: Date,
  ): Promise<DirectionsResult> {
    const departBucket = utils.getDepartBucket(departureTime || new Date());
    const cacheKey = utils.generateDirectionsCacheKey(
      fromLat,
      fromLng,
      toLat,
      toLng,
      mode,
      departBucket,
    );

    // Check memory cache
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached) {
      this.logger.debug(`Directions cache hit (memory): ${cacheKey}`);
      return { ...memCached, source: 'cached' };
    }

    // Check database cache
    const dbCached = await this.prisma.directionsCache.findUnique({
      where: { cacheKey },
    });

    if (dbCached) {
      const age = Date.now() - dbCached.updatedAt.getTime();
      if (age < dbCached.ttlSeconds * 1000) {
        const result: DirectionsResult = {
          etaMinutes: dbCached.etaMinutes,
          distanceMeters: dbCached.distanceMeters,
          polyline: dbCached.polyline || undefined,
          source: 'cached',
          confidence: 0.9,
        };
        this.memoryCache.set(cacheKey, result);
        this.logger.debug(`Directions cache hit (db): ${cacheKey}`);
        return result;
      }
    }

    // Try API if configured
    if (this.googleMapsApiKey) {
      try {
        const result = await this.fetchFromGoogleMaps(
          fromLat,
          fromLng,
          toLat,
          toLng,
          mode,
          departureTime,
        );

        // Cache result
        await this.cacheDirections(cacheKey, result, mode, fromLat, fromLng, toLat, toLng, departBucket);

        return result;
      } catch (error) {
        this.logger.error('Google Maps API failed, using fallback', error);
      }
    }

    // Fallback to heuristic
    return this.getHeuristicDirections(fromLat, fromLng, toLat, toLng, mode);
  }

  /**
   * Fetch directions from Google Maps API
   */
  private async fetchFromGoogleMaps(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: TransportMode,
    departureTime?: Date,
  ): Promise<DirectionsResult> {
    const googleMode = this.mapModeToGoogle(mode);
    const origin = `${fromLat},${fromLng}`;
    const destination = `${toLat},${toLng}`;

    const params = new URLSearchParams({
      origin,
      destination,
      mode: googleMode,
      key: this.googleMapsApiKey!,
      departure_time: departureTime
        ? Math.floor(departureTime.getTime() / 1000).toString()
        : 'now',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
    );

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    const leg = data.routes[0].legs[0];
    const durationInTraffic = leg.duration_in_traffic?.value || leg.duration.value;

    return {
      etaMinutes: Math.ceil(durationInTraffic / 60),
      distanceMeters: leg.distance.value,
      polyline: data.routes[0].overview_polyline?.points,
      source: 'directions',
      confidence: 1.0,
    };
  }

  /**
   * Get heuristic directions based on distance bands
   */
  private getHeuristicDirections(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: TransportMode,
  ): DirectionsResult {
    const distanceKm = utils.haversineDistance(fromLat, fromLng, toLat, toLng);
    const etaMinutes = utils.calculateHeuristicETA(distanceKm, mode);

    this.logger.debug(
      `Heuristic ETA: ${distanceKm.toFixed(1)}km = ${etaMinutes}min (${mode})`,
    );

    return {
      etaMinutes,
      distanceMeters: Math.round(distanceKm * 1000),
      source: 'heuristic',
      confidence: 0.6,
    };
  }

  /**
   * Cache directions result
   */
  private async cacheDirections(
    cacheKey: string,
    result: DirectionsResult,
    mode: TransportMode,
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    departBucket: string,
  ): Promise<void> {
    this.memoryCache.set(cacheKey, result);

    try {
      await this.prisma.directionsCache.upsert({
        where: { cacheKey },
        update: {
          etaMinutes: result.etaMinutes,
          distanceMeters: result.distanceMeters,
          polyline: result.polyline,
          provider: 'google',
          updatedAt: new Date(),
        },
        create: {
          cacheKey,
          mode,
          fromLatitude: fromLat,
          fromLongitude: fromLng,
          toLatitude: toLat,
          toLongitude: toLng,
          departBucket,
          etaMinutes: result.etaMinutes,
          distanceMeters: result.distanceMeters,
          polyline: result.polyline,
          provider: result.source === 'directions' ? 'google' : 'heuristic',
          ttlSeconds: 3600,
        },
      });
    } catch (error) {
      this.logger.error('Failed to cache directions', error);
    }
  }

  /**
   * Map transport mode to Google Maps API mode
   */
  private mapModeToGoogle(mode: TransportMode): string {
    const mapping: Record<TransportMode, string> = {
      sedan: 'driving',
      motorcycle: 'driving',
      taxi: 'driving',
      transit: 'transit',
      walking: 'walking',
    };
    return mapping[mode] || 'driving';
  }
}
