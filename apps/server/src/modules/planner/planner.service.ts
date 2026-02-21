import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventsService } from '../events/events.service';
import { TasksService } from '../tasks/tasks.service';
import { SlotFinderService, ProposedSlot } from './slot-finder.service';
import { AIExtractionService, ExtractedIntent } from './ai-extraction.service';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';

export interface ProposeRequest {
  text: string;
  preferredMode?: string;
  preferredDate?: string;
}

export interface ProposeResponse {
  proposals: ProposedSlot[];
  extractedIntent: ExtractedIntent;
  warnings: string[];
}

export interface CommitRequest {
  proposalId: string;
  overrides?: {
    title?: string;
    notes?: string;
    isLocked?: boolean;
  };
}

export interface CommitResponse {
  event: any;
  travelSegment: any | null;
  notificationsScheduled: number;
}

// In-memory proposal cache (for MVP - in production, use Redis)
const proposalCache = new Map<
  string,
  { proposal: ProposedSlot; intent: ExtractedIntent; userId: string; expiresAt: Date }
>();

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly tasksService: TasksService,
    private readonly slotFinder: SlotFinderService,
    private readonly aiExtraction: AIExtractionService,
    private readonly notificationsService: NotificationsService,
  ) {
    // Clean up expired proposals every 5 minutes
    setInterval(() => this.cleanupExpiredProposals(), 5 * 60 * 1000);
  }

  /**
   * Process natural language input and generate scheduling proposals
   */
  async propose(userId: string, request: ProposeRequest): Promise<ProposeResponse> {
    // Get user timezone
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, defaultTransportMode: true },
    });

    const timezone = user?.timezone || 'America/Edmonton';
    const preferredMode = request.preferredMode || user?.defaultTransportMode || 'sedan';

    // Extract intent from text
    const intent = await this.aiExtraction.extractIntent(request.text, {
      timezone,
      preferredMode,
      currentDate: request.preferredDate
        ? new Date(request.preferredDate)
        : undefined,
    });

    this.logger.log(`Extracted intent: ${JSON.stringify(intent)}`);

    const warnings: string[] = [];

    // Get location if specified
    let locationId: string | null = null;
    if (intent.locationText) {
      const location = await this.findOrCreateLocation(
        userId,
        intent.locationText,
      );
      if (location) {
        locationId = location.id;
      } else {
        warnings.push(`Could not find location: ${intent.locationText}`);
      }
    }

    // Find slots
    let proposals: ProposedSlot[];

    if (intent.fixedTime) {
      // Validate fixed time slot
      const startAt = new Date(intent.fixedTime.startAt);
      const endAt = new Date(intent.fixedTime.endAt);

      const validation = await this.slotFinder.validateFixedSlot(
        userId,
        startAt,
        endAt,
      );

      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
      }

      if (validation.conflicts.length > 0) {
        warnings.push(
          `Conflicts with: ${validation.conflicts.map((c) => c.title).join(', ')}`,
        );
      }

      // Create single proposal for fixed time
      proposals = [
        {
          id: uuidv4(),
          rank: 1,
          startAt,
          endAt,
          travelDepartTime: null,
          travelMode: preferredMode,
          travelEtaMinutes: null,
          confidence: validation.valid ? 1.0 : 0.5,
          explanation: validation.valid
            ? ['Fixed time slot available']
            : ['Fixed time has conflicts - review recommended'],
          conflictsToResolve: validation.conflicts.map((c) => ({
            eventId: c.id,
            eventTitle: c.title,
            action: 'move' as const,
            reason: 'Conflicts with requested time',
          })),
          weatherWarning: null,
          score: validation.valid ? 100 : 50,
        },
      ];
    } else {
      // Find flexible slots
      proposals = await this.slotFinder.findSlots({
        userId,
        durationMinutes: intent.durationMinutes,
        eventType: intent.type,
        preferredMode,
        locationId,
        windowStart: intent.window ? new Date(intent.window.startAt) : undefined,
        windowEnd: intent.window ? new Date(intent.window.endAt) : undefined,
        priority: intent.priority,
        isLocked: intent.isLocked,
      });

      if (proposals.length === 0) {
        warnings.push('No available slots found in the requested time window');
      }
    }

    // Cache proposals for later commit
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    for (const proposal of proposals) {
      proposalCache.set(proposal.id, {
        proposal,
        intent,
        userId,
        expiresAt,
      });
    }

    return {
      proposals,
      extractedIntent: intent,
      warnings,
    };
  }

  /**
   * Commit a proposal to create the event/task
   */
  async commit(userId: string, request: CommitRequest): Promise<CommitResponse> {
    const cached = proposalCache.get(request.proposalId);

    if (!cached) {
      throw new BadRequestException('Proposal not found or expired');
    }

    if (cached.userId !== userId) {
      throw new BadRequestException('Proposal not found');
    }

    if (cached.expiresAt < new Date()) {
      proposalCache.delete(request.proposalId);
      throw new BadRequestException('Proposal has expired');
    }

    const { proposal, intent } = cached;

    // Get location
    let locationId: string | null = null;
    if (intent.locationText) {
      const location = await this.findOrCreateLocation(userId, intent.locationText);
      locationId = location?.id || null;
    }

    // Create the event
    const event = await this.eventsService.create(userId, {
      title: request.overrides?.title || intent.title,
      type: intent.type,
      startAt: proposal.startAt,
      endAt: proposal.endAt,
      locationId,
      isLocked: request.overrides?.isLocked ?? intent.isLocked ?? false,
      priority: intent.priority || 2,
      notes: request.overrides?.notes || null,
    });

    // Create travel segment if applicable
    let travelSegment = null;
    if (proposal.travelDepartTime && proposal.travelEtaMinutes && locationId) {
      travelSegment = await this.prisma.travelSegment.create({
        data: {
          userId,
          toEventId: event.id,
          toLocationId: locationId,
          mode: proposal.travelMode || 'sedan',
          etaMinutes: proposal.travelEtaMinutes,
          departAt: proposal.travelDepartTime,
          arriveAt: proposal.startAt,
          source: 'heuristic',
          confidence: proposal.confidence,
        },
      });
    }

    // Schedule notifications
    let notificationsScheduled = 0;
    try {
      notificationsScheduled = await this.notificationsService.scheduleEventReminders(
        userId,
        event.id,
        proposal.startAt,
      );
    } catch (error) {
      this.logger.error('Failed to schedule notifications', error);
    }

    // Clean up cached proposal
    proposalCache.delete(request.proposalId);

    return {
      event,
      travelSegment,
      notificationsScheduled,
    };
  }

  /**
   * Find or create a location from text
   */
  private async findOrCreateLocation(
    userId: string,
    locationText: string,
  ): Promise<{ id: string } | null> {
    // Try to find existing location by name
    const existing = await this.prisma.location.findFirst({
      where: {
        userId,
        OR: [
          { name: { contains: locationText, mode: 'insensitive' } },
          { address: { contains: locationText, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      return existing;
    }

    // For MVP, return null if not found
    // In production, could geocode and create new location
    return null;
  }

  /**
   * Clean up expired proposals from cache
   */
  private cleanupExpiredProposals(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [id, cached] of proposalCache.entries()) {
      if (cached.expiresAt < now) {
        proposalCache.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired proposals`);
    }
  }
}
