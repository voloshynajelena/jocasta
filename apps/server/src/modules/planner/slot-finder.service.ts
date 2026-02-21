import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Event, Constraint, Location } from '@prisma/client';
import {
  utils,
  DEFAULT_BUFFERS,
  PARKING_BUFFERS,
  TransportMode,
} from '@jocasta/shared';

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  blockedBy?: string;
}

export interface ProposedSlot {
  id: string;
  rank: number;
  startAt: Date;
  endAt: Date;
  travelDepartTime: Date | null;
  travelMode: string | null;
  travelEtaMinutes: number | null;
  confidence: number;
  explanation: string[];
  conflictsToResolve: ConflictResolution[];
  weatherWarning: string | null;
  score: number;
}

export interface ConflictResolution {
  eventId: string;
  eventTitle: string;
  action: 'move' | 'shorten' | 'cancel';
  newStartAt?: Date;
  newEndAt?: Date;
  reason: string;
}

export interface SlotRequest {
  userId: string;
  durationMinutes: number;
  eventType: string;
  preferredMode?: string;
  locationId?: string | null;
  windowStart?: Date;
  windowEnd?: Date;
  fixedStart?: Date;
  fixedEnd?: Date;
  priority?: number;
  isLocked?: boolean;
}

interface ConstraintConfig {
  type: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  maxMinutes?: number;
  minMinutes?: number;
  mode?: string;
}

@Injectable()
export class SlotFinderService {
  private readonly logger = new Logger(SlotFinderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find feasible time slots for a proposed event/task
   */
  async findSlots(request: SlotRequest): Promise<ProposedSlot[]> {
    const { userId, durationMinutes, eventType, windowStart, windowEnd } = request;

    // Default window: next 7 days
    const start = windowStart || new Date();
    const end = windowEnd || new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get user data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        homeLocation: true,
        workLocation: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get constraints
    const constraints = await this.prisma.constraint.findMany({
      where: { userId, isActive: true },
    });

    // Get existing events in the window
    const existingEvents = await this.prisma.event.findMany({
      where: {
        userId,
        OR: [
          { startAt: { gte: start, lte: end } },
          { endAt: { gte: start, lte: end } },
          { AND: [{ startAt: { lte: start } }, { endAt: { gte: end } }] },
        ],
      },
      include: { location: true },
      orderBy: { startAt: 'asc' },
    });

    // Get buffer configuration
    const buffer = this.getBufferForType(eventType);
    const totalDuration = durationMinutes + buffer.before + buffer.after;

    // Find all available slots
    const availableSlots = await this.findAvailableSlots(
      start,
      end,
      existingEvents,
      constraints,
      totalDuration,
      user.timezone,
    );

    // Score and rank slots
    const proposals = await this.scoreAndRankSlots(
      availableSlots,
      request,
      existingEvents,
      user,
    );

    // Return top 5 proposals
    return proposals.slice(0, 5);
  }

  /**
   * Find available time slots within a window
   */
  private async findAvailableSlots(
    windowStart: Date,
    windowEnd: Date,
    existingEvents: Event[],
    constraints: Constraint[],
    requiredMinutes: number,
    timezone: string,
  ): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const current = new Date(windowStart);
    current.setMinutes(0, 0, 0); // Round to hour

    while (current < windowEnd) {
      const dayOfWeek = utils.getDayOfWeek(current, timezone);
      const timeStr = utils.minutesToHHMM(
        current.getHours() * 60 + current.getMinutes(),
      );

      // Check constraints
      let blocked = false;
      let blockedBy = '';

      for (const constraint of constraints) {
        const config = constraint.config as ConstraintConfig;

        if (config.daysOfWeek && !config.daysOfWeek.includes(dayOfWeek)) {
          continue;
        }

        if (config.startTime && config.endTime) {
          if (utils.isTimeInRange(timeStr, config.startTime, config.endTime)) {
            if (
              config.type === 'sleep_block' ||
              config.type === 'quiet_hours'
            ) {
              blocked = true;
              blockedBy = constraint.name;
              break;
            }
          }
        }
      }

      // Check existing events
      if (!blocked) {
        const slotEnd = utils.addMinutes(current, requiredMinutes);
        for (const event of existingEvents) {
          if (
            utils.doTimeRangesOverlap(current, slotEnd, event.startAt, event.endAt)
          ) {
            blocked = true;
            blockedBy = `Conflict with: ${event.title}`;
            break;
          }
        }
      }

      slots.push({
        start: new Date(current),
        end: utils.addMinutes(current, requiredMinutes),
        available: !blocked,
        blockedBy: blocked ? blockedBy : undefined,
      });

      // Move to next 15-minute slot
      current.setMinutes(current.getMinutes() + 15);
    }

    return slots.filter((s) => s.available);
  }

  /**
   * Score and rank available slots
   */
  private async scoreAndRankSlots(
    slots: TimeSlot[],
    request: SlotRequest,
    existingEvents: Event[],
    user: { timezone: string; homeLocation: Location | null },
  ): Promise<ProposedSlot[]> {
    const proposals: ProposedSlot[] = [];
    const targetLocation = request.locationId
      ? await this.prisma.location.findUnique({
          where: { id: request.locationId },
        })
      : null;

    for (let i = 0; i < Math.min(slots.length, 20); i++) {
      const slot = slots[i];
      let score = 100;
      const explanation: string[] = [];

      // Prefer morning slots (6am-12pm) +10 points
      const hour = slot.start.getHours();
      if (hour >= 6 && hour < 12) {
        score += 10;
        explanation.push('Morning slot (preferred)');
      }

      // Prefer weekday slots for work-related types +5 points
      const dayOfWeek = slot.start.getDay();
      if (
        dayOfWeek >= 1 &&
        dayOfWeek <= 5 &&
        ['appointment', 'meeting', 'client_training'].includes(request.eventType)
      ) {
        score += 5;
      }

      // Penalize if too close to other events -5 points per adjacent event
      const adjacentEvents = existingEvents.filter((e) => {
        const gap = Math.abs(
          (e.endAt.getTime() - slot.start.getTime()) / (1000 * 60),
        );
        return gap < 30;
      });
      score -= adjacentEvents.length * 5;
      if (adjacentEvents.length > 0) {
        explanation.push(`${adjacentEvents.length} adjacent event(s)`);
      }

      // Calculate travel time if location is specified
      let travelEta: number | null = null;
      let travelDepart: Date | null = null;

      if (targetLocation && user.homeLocation) {
        const distanceKm = utils.haversineDistance(
          user.homeLocation.latitude,
          user.homeLocation.longitude,
          targetLocation.latitude,
          targetLocation.longitude,
        );
        travelEta = utils.calculateHeuristicETA(
          distanceKm,
          (request.preferredMode as TransportMode) || 'sedan',
        );
        travelDepart = utils.subtractMinutes(slot.start, travelEta + 5);

        // Penalize long travel times
        if (travelEta > 30) {
          score -= (travelEta - 30) / 2;
          explanation.push(`~${travelEta} min travel time`);
        }
      }

      // Check for conflicts that would need resolution
      const conflicts: ConflictResolution[] = [];

      proposals.push({
        id: `proposal-${i + 1}`,
        rank: i + 1,
        startAt: slot.start,
        endAt: slot.end,
        travelDepartTime: travelDepart,
        travelMode: request.preferredMode || null,
        travelEtaMinutes: travelEta,
        confidence: travelEta ? 0.8 : 1.0, // Lower confidence if using heuristic ETA
        explanation,
        conflictsToResolve: conflicts,
        weatherWarning: null,
        score,
      });
    }

    // Sort by score (highest first)
    proposals.sort((a, b) => b.score - a.score);

    // Re-rank after sorting
    return proposals.map((p, i) => ({ ...p, rank: i + 1 }));
  }

  /**
   * Validate a fixed time slot
   */
  async validateFixedSlot(
    userId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId?: string,
  ): Promise<{ valid: boolean; conflicts: Event[]; warnings: string[] }> {
    const conflicts = await this.prisma.event.findMany({
      where: {
        userId,
        id: excludeEventId ? { not: excludeEventId } : undefined,
        OR: [
          { AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }] },
        ],
      },
      include: { location: true },
    });

    const warnings: string[] = [];

    // Check constraints
    const constraints = await this.prisma.constraint.findMany({
      where: { userId, isActive: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone || 'America/Edmonton';
    const dayOfWeek = utils.getDayOfWeek(startAt, timezone);
    const timeStr = utils.minutesToHHMM(
      startAt.getHours() * 60 + startAt.getMinutes(),
    );

    for (const constraint of constraints) {
      const config = constraint.config as ConstraintConfig;

      if (config.daysOfWeek && !config.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }

      if (config.startTime && config.endTime) {
        if (utils.isTimeInRange(timeStr, config.startTime, config.endTime)) {
          if (config.type === 'sleep_block') {
            warnings.push(`Overlaps with ${constraint.name}`);
          } else if (config.type === 'quiet_hours') {
            warnings.push(`During quiet hours: ${constraint.name}`);
          }
        }
      }
    }

    return {
      valid: conflicts.length === 0 && warnings.length === 0,
      conflicts,
      warnings,
    };
  }

  /**
   * Get buffer configuration for an event type
   */
  private getBufferForType(eventType: string): {
    before: number;
    after: number;
  } {
    const buffer = DEFAULT_BUFFERS.find((b) => b.eventType === eventType);
    return buffer || { before: 5, after: 5 };
  }
}
