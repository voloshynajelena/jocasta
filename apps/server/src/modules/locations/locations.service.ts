import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Location } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(userId: string, data: CreateLocationDto): Promise<Location> {
    // If this is the first location, make it default
    const existingCount = await this.prisma.location.count({
      where: { userId },
    });

    return this.prisma.location.create({
      data: {
        userId,
        name: data.name,
        address: data.address,
        latitude: data.latitude ?? 0,
        longitude: data.longitude ?? 0,
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

    return this.prisma.location.update({
      where: { id },
      data,
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
