import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Location } from '@prisma/client';

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateLocationDto {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault?: boolean;
}

export interface UpdateLocationDto {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly googleMapsApiKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.googleMapsApiKey = this.configService.get('google.mapsApiKey');
  }

  /**
   * Search for places using Google Places Autocomplete
   */
  async searchPlaces(query: string, userId: string): Promise<PlaceSuggestion[]> {
    const suggestions: PlaceSuggestion[] = [];

    // First, search user's saved locations
    const savedLocations = await this.prisma.location.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 3,
    });

    for (const loc of savedLocations) {
      suggestions.push({
        placeId: `saved_${loc.id}`,
        name: loc.name,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    }

    // Then search Google Places if API key is configured
    if (this.googleMapsApiKey && query.length >= 3) {
      try {
        const params = new URLSearchParams({
          input: query,
          key: this.googleMapsApiKey,
          types: 'establishment|geocode',
          components: 'country:ca', // Limit to Canada, adjust as needed
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'OK' && data.predictions) {
            for (const prediction of data.predictions.slice(0, 5)) {
              suggestions.push({
                placeId: prediction.place_id,
                name: prediction.structured_formatting?.main_text || prediction.description,
                address: prediction.description,
              });
            }
          }
        }
      } catch (error) {
        this.logger.error('Google Places API failed', error);
      }
    }

    return suggestions;
  }

  /**
   * Get place details (coordinates, hours) from place ID
   */
  async getPlaceDetails(placeId: string): Promise<{
    latitude: number;
    longitude: number;
    openingHours?: {
      isOpen: boolean;
      weekdayText?: string[];
      periods?: Array<{ open: { day: number; time: string }; close?: { day: number; time: string } }>;
    };
    formattedAddress?: string;
  } | null> {
    // Check if it's a saved location
    if (placeId.startsWith('saved_') || placeId.startsWith('custom_')) {
      const locationId = placeId.replace('saved_', '').replace('custom_', '');
      if (placeId.startsWith('saved_')) {
        const location = await this.prisma.location.findUnique({
          where: { id: locationId },
        });
        if (location) {
          return { latitude: location.latitude, longitude: location.longitude };
        }
      }
      return null;
    }

    // Otherwise fetch from Google
    if (!this.googleMapsApiKey) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        place_id: placeId,
        key: this.googleMapsApiKey,
        fields: 'geometry,opening_hours,formatted_address,business_status',
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.result?.geometry?.location) {
          const result: any = {
            latitude: data.result.geometry.location.lat,
            longitude: data.result.geometry.location.lng,
            formattedAddress: data.result.formatted_address,
          };

          if (data.result.opening_hours) {
            result.openingHours = {
              isOpen: data.result.opening_hours.open_now ?? true,
              weekdayText: data.result.opening_hours.weekday_text,
              periods: data.result.opening_hours.periods,
            };
            this.logger.log(`Place ${placeId} openingHours: isOpen=${result.openingHours.isOpen}`);
          }

          return result;
        }
      }
    } catch (error) {
      this.logger.error('Google Place Details API failed', error);
    }

    return null;
  }

  async findById(id: string, userId: string): Promise<Location | null> {
    const location = await this.prisma.location.findUnique({
      where: { id },
    });

    if (location && location.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this location');
    }

    return location;
  }

  async findMany(userId: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.googleMapsApiKey) {
      this.logger.warn('Google Maps API key not configured for geocoding');
      return null;
    }

    try {
      const params = new URLSearchParams({
        address,
        key: this.googleMapsApiKey,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
          const loc = data.results[0].geometry.location;
          return { latitude: loc.lat, longitude: loc.lng };
        }
      }
    } catch (error) {
      this.logger.error('Geocoding failed', error);
    }

    return null;
  }

  async create(userId: string, data: CreateLocationDto): Promise<Location> {
    // If this is the first location, make it default
    const existingCount = await this.prisma.location.count({
      where: { userId },
    });

    // Geocode address if coordinates not provided
    let latitude = data.latitude ?? 0;
    let longitude = data.longitude ?? 0;

    if ((!latitude || !longitude) && data.address) {
      const coords = await this.geocodeAddress(data.address);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
        this.logger.log(`Geocoded "${data.address}" to ${latitude}, ${longitude}`);
      }
    }

    return this.prisma.location.create({
      data: {
        userId,
        name: data.name,
        address: data.address,
        latitude,
        longitude,
        placeId: data.placeId,
        isDefault: data.isDefault ?? existingCount === 0,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: UpdateLocationDto,
  ): Promise<Location> {
    const location = await this.findById(id, userId);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.location.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Geocode if address is updated and no coordinates provided
    const updateData: any = { ...data };
    if (data.address && (!data.latitude || !data.longitude)) {
      const coords = await this.geocodeAddress(data.address);
      if (coords) {
        updateData.latitude = coords.latitude;
        updateData.longitude = coords.longitude;
        this.logger.log(`Geocoded "${data.address}" to ${coords.latitude}, ${coords.longitude}`);
      }
    }

    return this.prisma.location.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const location = await this.findById(id, userId);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    // Check if location is used by events
    const eventCount = await this.prisma.event.count({
      where: { locationId: id },
    });

    if (eventCount > 0) {
      throw new ForbiddenException(
        'Cannot delete location that is used by events',
      );
    }

    await this.prisma.location.delete({
      where: { id },
    });
  }

  async getDefaultLocation(userId: string): Promise<Location | null> {
    return this.prisma.location.findFirst({
      where: { userId, isDefault: true },
    });
  }
}
