import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { LRUCache } from 'lru-cache';
import { utils } from '@jocasta/shared';

export interface WeatherForecast {
  temperature: number;
  condition: string;
  precipitation: number;
  windSpeed: number;
  humidity: number;
  visibility: number;
}

export interface WeatherImpact {
  condition: string;
  etaMultiplier: number;
  warning: string | null;
  recommendModeSwitch: boolean;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly memoryCache: LRUCache<string, WeatherForecast>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.memoryCache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 30, // 30 minutes
    });
  }

  /**
   * Get weather forecast for a location and time
   */
  async getForecast(
    latitude: number,
    longitude: number,
    time: Date,
  ): Promise<WeatherForecast | null> {
    const locationHash = `${Math.round(latitude * 100)}_${Math.round(longitude * 100)}`;
    const timeBucket = utils.getHourlyBucket(time);
    const cacheKey = `${locationHash}:${timeBucket}`;

    // Check memory cache
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached) {
      return memCached;
    }

    // Check database cache
    const dbCached = await this.prisma.weatherCache.findUnique({
      where: { locationHash_timeBucket: { locationHash, timeBucket } },
    });

    if (dbCached) {
      const age = Date.now() - dbCached.updatedAt.getTime();
      if (age < dbCached.ttlSeconds * 1000) {
        const forecast = dbCached.forecastJson as unknown as WeatherForecast;
        this.memoryCache.set(cacheKey, forecast);
        return forecast;
      }
    }

    // Fetch from Open-Meteo (free API, no key needed)
    try {
      const forecast = await this.fetchFromOpenMeteo(latitude, longitude, time);
      await this.cacheWeather(locationHash, timeBucket, forecast);
      return forecast;
    } catch (error) {
      this.logger.error('Failed to fetch weather', error);
      return null;
    }
  }

  /**
   * Fetch weather from Open-Meteo API
   */
  private async fetchFromOpenMeteo(
    latitude: number,
    longitude: number,
    time: Date,
  ): Promise<WeatherForecast> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,visibility',
      timezone: 'America/Edmonton',
      forecast_days: '7',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();

    // Find the closest hour index
    const targetHour = time.toISOString().slice(0, 13) + ':00';
    const hourIndex = data.hourly.time.findIndex(
      (t: string) => t.startsWith(targetHour.slice(0, 13)),
    );

    if (hourIndex === -1) {
      // Use first available hour
      return {
        temperature: data.hourly.temperature_2m[0],
        condition: this.mapWeatherCode(data.hourly.weather_code[0]),
        precipitation: data.hourly.precipitation[0],
        windSpeed: data.hourly.wind_speed_10m[0],
        humidity: data.hourly.relative_humidity_2m[0],
        visibility: data.hourly.visibility?.[0] || 10000,
      };
    }

    return {
      temperature: data.hourly.temperature_2m[hourIndex],
      condition: this.mapWeatherCode(data.hourly.weather_code[hourIndex]),
      precipitation: data.hourly.precipitation[hourIndex],
      windSpeed: data.hourly.wind_speed_10m[hourIndex],
      humidity: data.hourly.relative_humidity_2m[hourIndex],
      visibility: data.hourly.visibility?.[hourIndex] || 10000,
    };
  }

  /**
   * Map WMO weather code to condition string
   */
  private mapWeatherCode(code: number): string {
    if (code === 0) return 'clear';
    if (code <= 3) return 'cloudy';
    if (code <= 49) return 'fog';
    if (code <= 59) return 'rain';
    if (code <= 69) return 'snow';
    if (code <= 79) return 'freezing_rain';
    if (code <= 99) return 'rain';
    return 'unknown';
  }

  /**
   * Calculate weather impact on travel
   */
  calculateWeatherImpact(
    forecast: WeatherForecast | null,
    mode: string,
  ): WeatherImpact {
    if (!forecast) {
      return {
        condition: 'unknown',
        etaMultiplier: 1.0,
        warning: null,
        recommendModeSwitch: false,
      };
    }

    const condition = forecast.condition;
    let etaMultiplier = 1.0;
    let warning: string | null = null;
    let recommendModeSwitch = false;

    // Apply Calgary-specific weather rules
    if (['snow', 'freezing_rain'].includes(condition)) {
      if (mode === 'sedan') {
        etaMultiplier = 1.15;
        warning = 'Winter conditions - allow extra travel time';
      } else if (mode === 'taxi') {
        etaMultiplier = 1.1;
        warning = 'Winter conditions may affect travel time';
      } else if (mode === 'motorcycle') {
        warning = 'Weather not suitable for motorcycle - consider car or transit';
        recommendModeSwitch = true;
      } else if (mode === 'transit') {
        etaMultiplier = 1.1;
        warning = 'Transit delays possible due to weather';
      }
    }

    if (condition === 'rain') {
      if (mode === 'motorcycle') {
        warning = 'Rain expected - consider alternative transport';
        recommendModeSwitch = true;
      }
      if (['sedan', 'taxi'].includes(mode)) {
        etaMultiplier = 1.05;
      }
    }

    if (forecast.windSpeed > 50) {
      // km/h
      warning = warning
        ? `${warning}. High winds expected.`
        : 'High winds expected - drive carefully';
      if (mode === 'motorcycle') {
        recommendModeSwitch = true;
      }
    }

    if (condition === 'fog' || forecast.visibility < 1000) {
      etaMultiplier = Math.max(etaMultiplier, 1.1);
      warning = warning
        ? `${warning}. Low visibility.`
        : 'Low visibility - drive carefully';
    }

    // Temperature warnings for motorcycle
    if (mode === 'motorcycle') {
      if (forecast.temperature < -5) {
        warning = 'Temperature too cold for comfortable motorcycle riding';
        recommendModeSwitch = true;
      } else if (forecast.temperature > 35) {
        warning = 'Temperature very high - consider air-conditioned transport';
        recommendModeSwitch = true;
      }
    }

    return {
      condition,
      etaMultiplier,
      warning,
      recommendModeSwitch,
    };
  }

  /**
   * Cache weather forecast
   */
  private async cacheWeather(
    locationHash: string,
    timeBucket: string,
    forecast: WeatherForecast,
  ): Promise<void> {
    const cacheKey = `${locationHash}:${timeBucket}`;
    this.memoryCache.set(cacheKey, forecast);

    try {
      await this.prisma.weatherCache.upsert({
        where: { locationHash_timeBucket: { locationHash, timeBucket } },
        update: {
          forecastJson: forecast as any,
          provider: 'open-meteo',
          updatedAt: new Date(),
        },
        create: {
          locationHash,
          timeBucket,
          forecastJson: forecast as any,
          provider: 'open-meteo',
          ttlSeconds: 3600,
        },
      });
    } catch (error) {
      this.logger.error('Failed to cache weather', error);
    }
  }
}
