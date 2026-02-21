import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Event, Prisma } from '@prisma/client';

export interface CreateEventDto {
  title: string;
  type: string;
  startAt: Date;
  endAt: Date;
  locationId?: string | null;
  isLocked?: boolean;
  priority?: number;
  notes?: string | null;
  source?: string;
  externalProviderId?: string | null;
  externalEtag?: string | null;
  recurrenceRuleId?: string | null;
}

export interface UpdateEventDto {
  title?: string;
  type?: string;
  startAt?: Date;
  endAt?: Date;
  locationId?: string | null;
  isLocked?: boolean;
  priority?: number;
  notes?: string | null;
}

export interface EventQueryDto {
  startDate?: Date;
  endDate?: Date;
  types?: string[];
  includeExternal?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, userId: string): Promise<Event | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        location: true,
        travelSegmentsTo: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (event && event.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this event');
    }

    return event;
  }

  async findMany(userId: string, query: EventQueryDto) {
    const where: Prisma.EventWhereInput = {
      userId,
    };

    if (query.startDate || query.endDate) {
      where.startAt = {};
      if (query.startDate) {
        where.startAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.startAt.lte = query.endDate;
      }
    }

    if (query.types && query.types.length > 0) {
      where.type = { in: query.types };
    }

    if (query.includeExternal === false) {
      where.source = 'managed';
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          location: true,
          travelSegmentsTo: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { startAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      events: events.map((e) => ({
        ...e,
        travelSegment: e.travelSegmentsTo[0] || null,
        travelSegmentsTo: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: {
        userId,
        OR: [
          {
            startAt: { gte: startDate, lte: endDate },
          },
          {
            endAt: { gte: startDate, lte: endDate },
          },
          {
            AND: [{ startAt: { lte: startDate } }, { endAt: { gte: endDate } }],
          },
        ],
      },
      include: {
        location: true,
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async create(userId: string, data: CreateEventDto): Promise<Event> {
    return this.prisma.event.create({
      data: {
        userId,
        title: data.title,
        type: data.type,
        startAt: data.startAt,
        endAt: data.endAt,
        locationId: data.locationId,
        isLocked: data.isLocked ?? false,
        priority: data.priority ?? 2,
        notes: data.notes,
        source: data.source ?? 'managed',
        externalProviderId: data.externalProviderId,
        externalEtag: data.externalEtag,
        recurrenceRuleId: data.recurrenceRuleId,
        lastModifiedAt: new Date(),
      },
      include: {
        location: true,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: UpdateEventDto,
  ): Promise<Event> {
    const event = await this.findById(id, userId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        ...data,
        lastModifiedAt: new Date(),
      },
      include: {
        location: true,
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const event = await this.findById(id, userId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    await this.prisma.event.delete({
      where: { id },
    });
  }

  async upsertFromGoogle(
    userId: string,
    googleEventId: string,
    data: CreateEventDto & { externalEtag: string },
  ): Promise<Event> {
    const existing = await this.prisma.event.findFirst({
      where: {
        userId,
        externalProviderId: googleEventId,
      },
    });

    if (existing) {
      // Check if etag changed (event was modified)
      if (existing.externalEtag === data.externalEtag) {
        return existing;
      }

      return this.prisma.event.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          startAt: data.startAt,
          endAt: data.endAt,
          locationId: data.locationId,
          externalEtag: data.externalEtag,
          lastModifiedAt: new Date(),
        },
        include: { location: true },
      });
    }

    return this.create(userId, {
      ...data,
      source: 'external_google',
      externalProviderId: googleEventId,
    });
  }

  async findConflicts(
    userId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId?: string,
  ): Promise<Event[]> {
    const where: Prisma.EventWhereInput = {
      userId,
      OR: [
        {
          AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
        },
      ],
    };

    if (excludeEventId) {
      where.id = { not: excludeEventId };
    }

    return this.prisma.event.findMany({
      where,
      include: { location: true },
      orderBy: { startAt: 'asc' },
    });
  }
}
