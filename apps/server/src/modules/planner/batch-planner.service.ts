import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventsService } from '../events/events.service';
import { ContactsService } from '../contacts/contacts.service';
import { SlotFinderService, ProposedSlot } from './slot-finder.service';
import { BatchExtractionService, ExtractedEvent, ExtractedContact, ExtractedLocation } from './batch-extraction.service';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';
import { Contact, Event, Location } from '@prisma/client';

export interface BatchProposeRequest {
  text: string;
  preferredMode?: string;
}

export interface SimilarEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  similarity: number;
  conflictType: 'duplicate' | 'similar' | 'time_conflict';
}

export interface ExtractedEventWithProposals extends ExtractedEvent {
  proposals: ProposedSlot[];
  existingLocation?: Location;
  similarEvents?: SimilarEvent[];
}

export interface ExtractedContactWithMatch extends ExtractedContact {
  existingMatch?: Contact;
  similarMatches?: Array<Contact & { similarity: number }>;
  isNew: boolean;
}

export interface ExtractedLocationWithSuggestions extends ExtractedLocation {
  existingLocation?: Location;
}

export interface BatchProposeResponse {
  sessionId: string;
  extractedEvents: ExtractedEventWithProposals[];
  extractedContacts: ExtractedContactWithMatch[];
  extractedLocations: ExtractedLocationWithSuggestions[];
  warnings: string[];
  metadata: {
    totalEventsFound: number;
    totalContactsFound: number;
    processingTimeMs: number;
  };
}

export interface BatchCommitEventRequest {
  index: number;
  proposalId?: string;
  overrides?: { title?: string; notes?: string };
  skip?: boolean;
}

export interface BatchCommitContactRequest {
  index: number;
  save: boolean;
  merge?: string; // Existing contact ID to merge with
  overrides?: { name?: string; email?: string; phone?: string; category?: string };
}

export interface BatchCommitRequest {
  sessionId: string;
  events: BatchCommitEventRequest[];
  contacts: BatchCommitContactRequest[];
}

export interface BatchCommitResponse {
  createdEvents: Event[];
  savedContacts: Contact[];
  skippedEvents: number;
  warnings: string[];
}

@Injectable()
export class BatchPlannerService {
  private readonly logger = new Logger(BatchPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly contactsService: ContactsService,
    private readonly slotFinder: SlotFinderService,
    private readonly batchExtraction: BatchExtractionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Process batch text input and generate proposals for all events
   */
  async propose(userId: string, request: BatchProposeRequest): Promise<BatchProposeResponse> {
    const startTime = Date.now();

    // Get user timezone
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, defaultTransportMode: true },
    });

    const timezone = user?.timezone || 'America/Edmonton';
    const preferredMode = request.preferredMode || user?.defaultTransportMode || 'sedan';

    // Extract all events, contacts, and locations
    const extraction = await this.batchExtraction.extractBatch(request.text, {
      timezone,
      userId,
      preferredMode,
    });

    const warnings = [...extraction.warnings];

    // Process events - find slots for each
    const extractedEvents: ExtractedEventWithProposals[] = [];

    for (const event of extraction.events) {
      // Try to find location
      let existingLocation: Location | undefined;
      let locationId: string | null = null;

      if (event.locationText) {
        existingLocation = await this.findLocation(userId, event.locationText) || undefined;
        if (existingLocation) {
          locationId = existingLocation.id;
        }
      }

      // Find slots for this event
      let proposals: ProposedSlot[] = [];

      if (event.fixedTime) {
        const startAt = new Date(event.fixedTime.startAt);
        const endAt = new Date(event.fixedTime.endAt);

        const validation = await this.slotFinder.validateFixedSlot(userId, startAt, endAt);

        // Add the requested time slot (even if conflicting)
        proposals = [{
          id: uuidv4(),
          rank: 1,
          startAt,
          endAt,
          travelDepartTime: null,
          travelMode: preferredMode,
          travelEtaMinutes: null,
          confidence: validation.valid ? 0.9 : 0.3,
          explanation: validation.valid
            ? ['Requested time - available']
            : ['Requested time - has conflicts'],
          conflictsToResolve: validation.conflicts.map(c => ({
            eventId: c.id,
            eventTitle: c.title,
            action: 'move' as const,
            reason: 'Conflicts with requested time',
          })),
          weatherWarning: null,
          score: validation.valid ? 100 : 30,
        }];

        // If there are conflicts, find alternative slots on the same day
        if (!validation.valid) {
          const dayStart = new Date(startAt);
          dayStart.setHours(7, 0, 0, 0); // Start from 7 AM
          const dayEnd = new Date(startAt);
          dayEnd.setHours(22, 0, 0, 0); // End at 10 PM

          const alternativeSlots = await this.slotFinder.findSlots({
            userId,
            durationMinutes: event.durationMinutes,
            eventType: event.type,
            preferredMode,
            locationId,
            windowStart: dayStart,
            windowEnd: dayEnd,
            priority: event.priority,
            isLocked: false,
          });

          // Add up to 3 alternative slots with updated explanations
          for (let i = 0; i < Math.min(alternativeSlots.length, 3); i++) {
            const alt = alternativeSlots[i];
            proposals.push({
              ...alt,
              id: uuidv4(),
              rank: proposals.length + 1,
              explanation: ['Alternative time - no conflicts'],
              confidence: 0.8,
              score: alt.score - 10, // Slightly lower than if it was the requested time
            });
          }
        }
      } else if (event.window) {
        proposals = await this.slotFinder.findSlots({
          userId,
          durationMinutes: event.durationMinutes,
          eventType: event.type,
          preferredMode,
          locationId,
          windowStart: new Date(event.window.startAt),
          windowEnd: new Date(event.window.endAt),
          priority: event.priority,
          isLocked: false,
        });
      } else {
        // No time specified - find slots in next 7 days
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        proposals = await this.slotFinder.findSlots({
          userId,
          durationMinutes: event.durationMinutes,
          eventType: event.type,
          preferredMode,
          locationId,
          windowStart: now,
          windowEnd: weekLater,
          priority: event.priority,
          isLocked: false,
        });
      }

      // Find similar existing events
      const proposedStart = proposals[0]?.startAt;
      const proposedEnd = proposals[0]?.endAt;
      const similarEvents = await this.findSimilarEvents(
        userId,
        event.title,
        proposedStart,
        proposedEnd,
      );

      // Add warnings for similar events
      if (similarEvents.length > 0) {
        const duplicates = similarEvents.filter(se => se.conflictType === 'duplicate');
        const similar = similarEvents.filter(se => se.conflictType === 'similar');
        const conflicts = similarEvents.filter(se => se.conflictType === 'time_conflict');

        if (duplicates.length > 0) {
          warnings.push(`"${event.title}" may be a duplicate of "${duplicates[0].title}"`);
        }
        if (similar.length > 0 && duplicates.length === 0) {
          warnings.push(`"${event.title}" is similar to existing event "${similar[0].title}"`);
        }
        if (conflicts.length > 0) {
          warnings.push(`"${event.title}" conflicts with "${conflicts[0].title}" at the same time`);
        }
      }

      extractedEvents.push({
        ...event,
        proposals,
        existingLocation,
        similarEvents: similarEvents.length > 0 ? similarEvents : undefined,
      });
    }

    // Process contacts - check for existing matches
    const extractedContacts: ExtractedContactWithMatch[] = [];

    for (const contact of extraction.contacts) {
      const matchResult = await this.contactsService.matchOrSuggest(userId, contact.name);

      extractedContacts.push({
        ...contact,
        existingMatch: matchResult.exact || undefined,
        similarMatches: matchResult.similar.length > 0 ? matchResult.similar : undefined,
        isNew: !matchResult.exact,
      });
    }

    // Process locations - check for existing
    const extractedLocations: ExtractedLocationWithSuggestions[] = [];

    for (const location of extraction.locations) {
      const existing = await this.findLocation(userId, location.name);
      extractedLocations.push({
        ...location,
        existingLocation: existing || undefined,
      });
    }

    // Create session in database
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.batchPlanSession.create({
      data: {
        id: sessionId,
        userId,
        rawText: request.text,
        status: 'pending',
        extractedData: JSON.parse(JSON.stringify({
          events: extractedEvents,
          contacts: extractedContacts,
          locations: extractedLocations,
        })),
        expiresAt,
      },
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      sessionId,
      extractedEvents,
      extractedContacts,
      extractedLocations,
      warnings,
      metadata: {
        totalEventsFound: extractedEvents.length,
        totalContactsFound: extractedContacts.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Commit selected events and contacts from a batch session
   */
  async commit(userId: string, request: BatchCommitRequest): Promise<BatchCommitResponse> {
    // Get session
    const session = await this.prisma.batchPlanSession.findUnique({
      where: { id: request.sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'pending') {
      throw new BadRequestException('Session already processed');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.batchPlanSession.update({
        where: { id: request.sessionId },
        data: { status: 'cancelled' },
      });
      throw new BadRequestException('Session has expired');
    }

    const extractedData = session.extractedData as unknown as {
      events: ExtractedEventWithProposals[];
      contacts: ExtractedContactWithMatch[];
    };

    const createdEvents: Event[] = [];
    const savedContacts: Contact[] = [];
    const warnings: string[] = [];
    let skippedEvents = 0;

    // Process contacts first (events might reference them)
    for (const contactReq of request.contacts) {
      if (!contactReq.save) continue;

      const extracted = extractedData.contacts[contactReq.index];
      if (!extracted) {
        warnings.push(`Contact index ${contactReq.index} not found`);
        continue;
      }

      try {
        if (contactReq.merge) {
          // Update existing contact
          const updated = await this.contactsService.update(contactReq.merge, userId, {
            name: contactReq.overrides?.name || extracted.name,
            email: contactReq.overrides?.email || extracted.email,
            phone: contactReq.overrides?.phone || extracted.phone,
            category: contactReq.overrides?.category || extracted.category,
          });
          savedContacts.push(updated);
        } else {
          // Create new contact
          const created = await this.contactsService.create(userId, {
            name: contactReq.overrides?.name || extracted.name,
            email: contactReq.overrides?.email || extracted.email,
            phone: contactReq.overrides?.phone || extracted.phone,
            category: contactReq.overrides?.category || extracted.category,
            source: 'extracted',
            confidence: extracted.confidence,
          });
          savedContacts.push(created);
        }
      } catch (error: any) {
        warnings.push(`Failed to save contact ${extracted.name}: ${error.message}`);
      }
    }

    // Process events
    for (const eventReq of request.events) {
      if (eventReq.skip) {
        skippedEvents++;
        continue;
      }

      const extracted = extractedData.events[eventReq.index];
      if (!extracted) {
        warnings.push(`Event index ${eventReq.index} not found`);
        continue;
      }

      // Find the proposal
      const proposal = extracted.proposals.find(p => p.id === eventReq.proposalId) || extracted.proposals[0];
      if (!proposal) {
        warnings.push(`No proposal found for event: ${extracted.title}`);
        skippedEvents++;
        continue;
      }

      try {
        // Find location
        let locationId: string | null = null;
        if (extracted.existingLocation) {
          locationId = extracted.existingLocation.id;
        }

        // Create the event
        const event = await this.eventsService.create(userId, {
          title: eventReq.overrides?.title || extracted.title,
          type: extracted.type,
          startAt: proposal.startAt,
          endAt: proposal.endAt,
          locationId,
          isLocked: false,
          priority: extracted.priority || 2,
          notes: eventReq.overrides?.notes || null,
        });

        createdEvents.push(event);

        // Schedule notifications
        try {
          await this.notificationsService.scheduleEventReminders(
            userId,
            event.id,
            proposal.startAt,
          );
        } catch (error) {
          this.logger.error('Failed to schedule notifications', error);
        }
      } catch (error: any) {
        warnings.push(`Failed to create event ${extracted.title}: ${error.message}`);
        skippedEvents++;
      }
    }

    // Update session status
    await this.prisma.batchPlanSession.update({
      where: { id: request.sessionId },
      data: { status: 'committed' },
    });

    return {
      createdEvents,
      savedContacts,
      skippedEvents,
      warnings,
    };
  }

  /**
   * Get a batch planning session
   */
  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.batchPlanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Cancel a batch planning session
   */
  async cancelSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.batchPlanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.batchPlanSession.update({
      where: { id: sessionId },
      data: { status: 'cancelled' },
    });
  }

  /**
   * Find existing location by name
   */
  private async findLocation(userId: string, locationText: string): Promise<Location | null> {
    return this.prisma.location.findFirst({
      where: {
        userId,
        OR: [
          { name: { contains: locationText, mode: 'insensitive' } },
          { address: { contains: locationText, mode: 'insensitive' } },
        ],
      },
    });
  }

  /**
   * Find similar existing events by title and/or time
   */
  private async findSimilarEvents(
    userId: string,
    title: string,
    proposedStart?: Date,
    proposedEnd?: Date,
  ): Promise<SimilarEvent[]> {
    const similarEvents: SimilarEvent[] = [];

    // Get events from past 30 days and next 30 days
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 30);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 30);

    const existingEvents = await this.prisma.event.findMany({
      where: {
        userId,
        startAt: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
      },
    });

    // Extract keywords from the proposed event title
    const titleWords = this.extractKeywords(title);

    for (const event of existingEvents) {
      const eventWords = this.extractKeywords(event.title);
      const similarity = this.calculateWordSimilarity(titleWords, eventWords);

      // Check for title similarity (> 40% word match)
      if (similarity > 0.4) {
        similarEvents.push({
          id: event.id,
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt,
          similarity,
          conflictType: similarity > 0.8 ? 'duplicate' : 'similar',
        });
      }

      // Check for time conflict if we have proposed times
      if (proposedStart && proposedEnd) {
        const eventStart = new Date(event.startAt);
        const eventEnd = new Date(event.endAt);

        // Check if times overlap
        if (proposedStart < eventEnd && proposedEnd > eventStart) {
          const existing = similarEvents.find(se => se.id === event.id);
          if (existing) {
            existing.conflictType = 'time_conflict';
          } else {
            similarEvents.push({
              id: event.id,
              title: event.title,
              startAt: event.startAt,
              endAt: event.endAt,
              similarity: 0,
              conflictType: 'time_conflict',
            });
          }
        }
      }
    }

    // Deduplicate by title - keep the most severe conflict type per unique title
    const dedupedByTitle = new Map<string, SimilarEvent>();
    for (const event of similarEvents) {
      const key = event.title.toLowerCase();
      const existing = dedupedByTitle.get(key);
      const priority = { time_conflict: 3, duplicate: 2, similar: 1 };

      if (!existing) {
        dedupedByTitle.set(key, event);
      } else if (priority[event.conflictType] > priority[existing.conflictType]) {
        // Prefer more severe conflict type
        dedupedByTitle.set(key, event);
      } else if (event.conflictType === existing.conflictType && event.similarity > existing.similarity) {
        // Same type - prefer higher similarity
        dedupedByTitle.set(key, event);
      }
    }

    // Sort by conflict severity, then similarity
    return Array.from(dedupedByTitle.values()).sort((a, b) => {
      const priority = { time_conflict: 3, duplicate: 2, similar: 1 };
      if (priority[a.conflictType] !== priority[b.conflictType]) {
        return priority[b.conflictType] - priority[a.conflictType];
      }
      return b.similarity - a.similarity;
    }).slice(0, 5); // Limit to top 5 matches
  }

  /**
   * Extract meaningful keywords from a title
   */
  private extractKeywords(title: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'am', 'pm', 'till', 'until',
    ]);

    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Calculate Jaccard similarity between two word sets
   */
  private calculateWordSimilarity(words1: string[], words2: string[]): number {
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    let intersection = 0;
    for (const word of set1) {
      // Check for exact match or if one contains the other
      for (const word2 of set2) {
        if (word === word2 || word.includes(word2) || word2.includes(word)) {
          intersection++;
          break;
        }
      }
    }

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
