import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as chrono from 'chrono-node';

export interface ExtractedContact {
  name: string;
  email?: string;
  phone?: string;
  category: 'work' | 'personal' | 'family' | 'service' | 'general';
  confidence: number;
  context?: string;
}

export interface ExtractedEvent {
  title: string;
  type: string;
  fixedTime?: { startAt: string; endAt: string };
  window?: { startAt: string; endAt: string };
  durationMinutes: number;
  locationText?: string;
  participants: string[];
  priority: number;
  confidence: number;
  rawText?: string;
}

export interface ExtractedLocation {
  name: string;
  address?: string;
  confidence: number;
}

export interface BatchExtractionResult {
  events: ExtractedEvent[];
  contacts: ExtractedContact[];
  locations: ExtractedLocation[];
  warnings: string[];
  metadata: {
    totalEventsFound: number;
    totalContactsFound: number;
    aiConfidence: number;
    processingTimeMs: number;
  };
}

interface ExtractionContext {
  timezone: string;
  currentDate?: Date;
  userId: string;
  preferredMode?: string;
}

@Injectable()
export class BatchExtractionService {
  private readonly logger = new Logger(BatchExtractionService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    this.model = this.configService.get<string>('openai.model') || 'gpt-4o-mini';

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.openai = null;
      this.logger.warn('OpenAI API key not configured - using deterministic parser only');
    }
  }

  /**
   * Extract multiple events, contacts, and locations from text
   */
  async extractBatch(
    text: string,
    context: ExtractionContext,
  ): Promise<BatchExtractionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Step 1: Deterministic extraction
    const deterministicResult = this.extractDeterministic(text, context);

    // Step 2: Enhance with AI if available
    let finalResult = deterministicResult;
    let aiConfidence = 0;

    if (this.openai && text.length > 20) {
      try {
        const aiResult = await this.extractWithAI(text, context);
        finalResult = this.mergeResults(deterministicResult, aiResult);
        aiConfidence = 0.85;
      } catch (error) {
        this.logger.error('AI batch extraction failed, using deterministic only', error);
        warnings.push('AI extraction failed, using pattern matching only');
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      ...finalResult,
      warnings,
      metadata: {
        totalEventsFound: finalResult.events.length,
        totalContactsFound: finalResult.contacts.length,
        aiConfidence,
        processingTimeMs,
      },
    };
  }

  /**
   * Deterministic extraction using regex and chrono-node
   */
  private extractDeterministic(
    text: string,
    context: ExtractionContext,
  ): Omit<BatchExtractionResult, 'warnings' | 'metadata'> {
    const currentDate = context.currentDate || new Date();

    // Split text into potential event chunks
    const chunks = this.splitIntoEventChunks(text);

    const events: ExtractedEvent[] = [];
    const contacts: ExtractedContact[] = [];
    const locations: ExtractedLocation[] = [];

    // Extract emails globally
    const emailMatches = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    for (const email of emailMatches) {
      // Try to find associated name
      const nameMatch = text.match(new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s*<?${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
      contacts.push({
        name: nameMatch ? nameMatch[1].trim() : email.split('@')[0],
        email: email.toLowerCase(),
        category: 'general',
        confidence: nameMatch ? 0.8 : 0.5,
        context: `Found email: ${email}`,
      });
    }

    // Extract phone numbers globally
    const phoneMatches = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
    for (const phone of phoneMatches) {
      // Try to find associated name
      const nameMatch = text.match(new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s*[-:]?\\s*${phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
      if (nameMatch) {
        const existingContact = contacts.find(c => c.name.toLowerCase() === nameMatch[1].trim().toLowerCase());
        if (existingContact) {
          existingContact.phone = phone.replace(/\D/g, '');
        } else {
          contacts.push({
            name: nameMatch[1].trim(),
            phone: phone.replace(/\D/g, ''),
            category: 'general',
            confidence: 0.7,
            context: `Found phone: ${phone}`,
          });
        }
      }
    }

    // Extract names (Title Case patterns)
    const namePatterns = [
      /(?:with|meet(?:ing)?|call|see|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|is|was|has|meeting|call)/g,
      /@([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
    ];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        // Filter out common false positives
        const skipWords = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
                           'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                           'September', 'October', 'November', 'December', 'Today', 'Tomorrow',
                           'This', 'Next', 'The', 'Meeting', 'Call', 'Event', 'Appointment'];
        if (!skipWords.includes(name) && name.length > 2) {
          const exists = contacts.some(c => c.name.toLowerCase() === name.toLowerCase());
          if (!exists) {
            contacts.push({
              name,
              category: 'general',
              confidence: 0.6,
              context: match[0],
            });
          }
        }
      }
    }

    // Process each chunk as a potential event
    for (const chunk of chunks) {
      const event = this.parseEventChunk(chunk, currentDate, context);
      if (event) {
        events.push(event);

        // Extract location from event
        if (event.locationText) {
          const exists = locations.some(l => l.name.toLowerCase() === event.locationText!.toLowerCase());
          if (!exists) {
            locations.push({
              name: event.locationText,
              confidence: 0.7,
            });
          }
        }
      }
    }

    return { events, contacts, locations };
  }

  /**
   * Split text into potential event chunks
   */
  private splitIntoEventChunks(text: string): string[] {
    // Split by line breaks, bullets, numbers, or time patterns
    const lines = text.split(/\n+/);
    const chunks: string[] = [];

    let currentChunk = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if this looks like a new event
      const isNewEvent = /^[\d•\-\*\u2022]\s/.test(trimmed) ||
                         /^\d{1,2}[:.]\d{2}/.test(trimmed) ||
                         /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(trimmed);

      if (isNewEvent && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmed;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // If only one chunk but it's very long, try splitting by sentences with times
    if (chunks.length === 1 && chunks[0].length > 200) {
      const timeBasedSplit = chunks[0].split(/(?<=[.!?])\s+(?=\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:am|pm)|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))/i);
      if (timeBasedSplit.length > 1) {
        return timeBasedSplit.map(s => s.trim()).filter(s => s.length > 5);
      }
    }

    // Further split chunks that contain multiple events separated by comma with time patterns
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      const splitByComma = this.splitByMultipleTimes(chunk);
      finalChunks.push(...splitByComma);
    }

    return finalChunks.filter(c => c.length > 5);
  }

  /**
   * Split a chunk if it contains multiple time patterns separated by comma
   * e.g., "Drive Dasha to McKenzie Dental thursday 3PM, kick lesson at 4pm till 5PM"
   * becomes two separate chunks
   */
  private splitByMultipleTimes(chunk: string): string[] {
    // Pattern to find comma followed by a new event with time
    // Match: ", [text] [time]" where time is like "3pm", "4:00", "at 5pm"
    const timePattern = /,\s+(?=[^,]*?\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/gi;

    // Count time patterns in the chunk
    const allTimes = chunk.match(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi) || [];

    if (allTimes.length <= 1) {
      return [chunk];
    }

    // Split by comma + time pattern
    const parts = chunk.split(timePattern);

    if (parts.length > 1) {
      // Each part should be its own event
      // For context, try to carry forward day references to later parts
      const dayMatch = chunk.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tomorrow)\b/i);
      const dayContext = dayMatch ? dayMatch[0] : '';

      return parts.map((part, index) => {
        const trimmed = part.trim();
        // If this part doesn't have a day reference but earlier parts did, inject it before the time
        if (index > 0 && dayContext && !/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tomorrow)\b/i.test(trimmed)) {
          // Find where the time is and insert day before it
          // e.g., "kick lesson at 4pm" -> "kick lesson thursday at 4pm"
          const timeMatch = trimmed.match(/\b(at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
          if (timeMatch) {
            const timeIndex = trimmed.indexOf(timeMatch[0]);
            return trimmed.slice(0, timeIndex) + dayContext + ' ' + trimmed.slice(timeIndex);
          }
          return `${trimmed} ${dayContext}`;
        }
        return trimmed;
      });
    }

    return [chunk];
  }

  /**
   * Parse a single event chunk
   */
  private parseEventChunk(
    chunk: string,
    currentDate: Date,
    context: ExtractionContext,
  ): ExtractedEvent | null {
    const lowerText = chunk.toLowerCase();

    // Parse dates/times with chrono
    const parsedResults = chrono.parse(chunk, currentDate, {
      forwardDate: true,
    });

    if (parsedResults.length === 0) {
      // No time info - might not be an event
      return null;
    }

    // Extract duration
    let durationMinutes = 60; // default
    const durationMatch = lowerText.match(/(\d+)\s*(min(?:ute)?s?|hr?s?|hours?)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      durationMinutes = unit.startsWith('h') ? value * 60 : value;
    }

    // Detect event type
    let type = 'meeting';
    const typeKeywords: Record<string, string[]> = {
      client_training: ['client', 'training', 'session'],
      personal_workout: ['workout', 'gym', 'exercise', 'fitness'],
      dog_walk: ['dog', 'walk', 'pet'],
      kids_dropoff: ['drop off', 'dropoff', 'school drop'],
      kids_pickup: ['pick up', 'pickup', 'school pick'],
      fueling: ['gas', 'fuel', 'petrol'],
      shopping: ['shop', 'grocery', 'store'],
      meeting: ['meeting', 'call', 'zoom', 'teams', 'sync', 'standup'],
      appointment: ['appointment', 'doctor', 'dentist', 'salon'],
      home_chores: ['chore', 'clean', 'laundry'],
    };

    for (const [eventType, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(k => lowerText.includes(k))) {
        type = eventType;
        break;
      }
    }

    // Extract location
    let locationText: string | undefined;
    const locationPatterns = [
      /at\s+([^,.\n]+?)(?:\s+(?:on|at|from|to|\d)|\s*[,.\n]|$)/i,
      /(?:in|@)\s+([^,.\n]+?)(?:\s+(?:on|at|from|to|\d)|\s*[,.\n]|$)/i,
      /location:\s*([^,.\n]+)/i,
      /venue:\s*([^,.\n]+)/i,
    ];
    for (const pattern of locationPatterns) {
      const match = chunk.match(pattern);
      if (match && match[1].length > 2 && match[1].length < 100) {
        // Filter out time-like matches
        const potential = match[1].trim();
        // Skip if it looks like a time (e.g., "4pm", "3:00", "4pm till")
        const isTimeLike = /^\d{1,2}[:.]\d{2}/i.test(potential) ||
                          /^(?:am|pm)$/i.test(potential) ||
                          /^\d{1,2}\s*(?:am|pm)/i.test(potential) ||
                          /^\d{1,2}\s*(?:am|pm)\s+(?:till|until|to|-)/i.test(potential);
        if (!isTimeLike) {
          locationText = potential;
          break;
        }
      }
    }

    // Extract participants
    const participants: string[] = [];
    const withMatch = chunk.match(/with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*(?:,|and)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*)/g);
    if (withMatch) {
      for (const m of withMatch) {
        const names = m.replace(/^with\s+/i, '').split(/\s*(?:,|and)\s*/);
        for (const name of names) {
          const trimmed = name.trim();
          if (trimmed && /^[A-Z]/.test(trimmed)) {
            participants.push(trimmed);
          }
        }
      }
    }

    // Extract priority
    let priority = 2;
    if (lowerText.includes('urgent') || lowerText.includes('important') || lowerText.includes('asap')) {
      priority = 1;
    } else if (lowerText.includes('low priority') || lowerText.includes('whenever')) {
      priority = 3;
    }

    // Build time information
    const firstResult = parsedResults[0];
    const startDate = firstResult.start.date();
    let fixedTime: { startAt: string; endAt: string } | undefined;
    let window: { startAt: string; endAt: string } | undefined;

    if (firstResult.start.isCertain('hour')) {
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      fixedTime = {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
      };
    } else {
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      window = {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
      };
    }

    // Generate title - extract the descriptive part, removing time/day info
    // Try to extract text after a dash separator (e.g., "Monday 10am - Team standup")
    const dashMatch = chunk.match(/^[^-]+-\s*(.+)$/);
    let title: string;

    if (dashMatch && dashMatch[1]) {
      title = dashMatch[1].trim();
    } else {
      title = chunk;
    }

    // Clean up title by removing time and day patterns
    title = title
      // Remove bullet/number prefixes
      .replace(/^\s*[\d•\-\*\u2022]\s*/, '')
      // Remove day names anywhere
      .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*/gi, '')
      // Remove time patterns like "at 4pm", "4:00 pm", "from 3pm", "till 5PM", "until 6pm"
      .replace(/\b(?:at|from|to|till|until|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      // Remove standalone times like "3PM", "4:00pm"
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      // Remove "today", "tomorrow"
      .replace(/\b(today|tomorrow)\b\s*/gi, '')
      // Clean up multiple spaces and trim
      .replace(/\s+/g, ' ')
      .trim();

    // Fallback: use type-based title if extraction failed
    if (!title || title.length < 3) {
      const typeLabels: Record<string, string> = {
        meeting: 'Meeting',
        appointment: 'Appointment',
        client_training: 'Client Training',
        personal_workout: 'Workout',
        dog_walk: 'Dog Walk',
        shopping: 'Shopping',
        home_chores: 'Home Chores',
      };
      title = typeLabels[type] || 'Event';
    }

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    // Calculate confidence based on what we found
    let confidence = 0.5;
    if (firstResult.start.isCertain('hour')) confidence += 0.2;
    if (locationText) confidence += 0.1;
    if (title.length > 10) confidence += 0.1;
    if (type !== 'meeting') confidence += 0.1;

    return {
      title,
      type,
      fixedTime,
      window,
      durationMinutes,
      locationText,
      participants,
      priority,
      confidence: Math.min(confidence, 1.0),
      rawText: chunk.length > 200 ? chunk.substring(0, 197) + '...' : chunk,
    };
  }

  /**
   * AI-powered batch extraction
   */
  private async extractWithAI(
    text: string,
    context: ExtractionContext,
  ): Promise<Omit<BatchExtractionResult, 'warnings' | 'metadata'>> {
    const currentDate = context.currentDate || new Date();
    const dateStr = currentDate.toISOString().split('T')[0];

    const systemPrompt = `You are analyzing meeting notes or schedule text to extract structured data.

Input text:
"""
${text}
"""

Current date: ${dateStr}
Timezone: ${context.timezone}

Extract ALL events, people, and locations mentioned. Return JSON with:
{
  "events": [
    {
      "title": "short descriptive title",
      "type": "meeting|appointment|personal_workout|client_training|dog_walk|kids_dropoff|kids_pickup|fueling|shopping|home_chores|other",
      "startAt": "ISO 8601 or null if not specified",
      "endAt": "ISO 8601 or null",
      "durationMinutes": number (estimate if not given, default 60),
      "locationText": "location if mentioned or null",
      "participants": ["Person Name 1", "Person Name 2"],
      "priority": 1-3 (1=high, 2=medium, 3=low),
      "confidence": 0-1 (how sure you are about this event)
    }
  ],
  "contacts": [
    {
      "name": "Full Name",
      "email": "email@example.com or null",
      "phone": "phone number or null",
      "category": "work|personal|family|service|general",
      "confidence": 0-1
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "address": "full address if known or null",
      "confidence": 0-1
    }
  ]
}

Guidelines:
- Extract ALL people mentioned, even if just names
- For relative dates (tomorrow, next week), calculate from current date
- Default meeting duration to 60 minutes if not specified
- Be conservative with confidence scores
- Include partial information (name without email is OK)
- Skip generic words that look like names but aren't (days of week, months, etc.)`;

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);

    // Transform AI response to our format
    const events: ExtractedEvent[] = (parsed.events || []).map((e: any) => {
      // Generate fallback title based on type
      const typeLabels: Record<string, string> = {
        meeting: 'Meeting',
        appointment: 'Appointment',
        client_training: 'Client Training',
        personal_workout: 'Workout',
        dog_walk: 'Dog Walk',
        shopping: 'Shopping',
        home_chores: 'Home Chores',
      };
      const fallbackTitle = typeLabels[e.type] || 'Event';

      // Use AI title if valid, otherwise fallback
      const aiTitle = (e.title && typeof e.title === 'string' && e.title.trim().length > 0)
        ? e.title.trim()
        : fallbackTitle;

      return {
        title: aiTitle,
        type: e.type || 'meeting',
        fixedTime: e.startAt && e.endAt ? { startAt: e.startAt, endAt: e.endAt } : undefined,
        window: e.startAt && !e.endAt ? {
          startAt: e.startAt,
          endAt: new Date(new Date(e.startAt).getTime() + (e.durationMinutes || 60) * 60000).toISOString(),
        } : undefined,
        durationMinutes: e.durationMinutes || 60,
        locationText: e.locationText || undefined,
        participants: e.participants || [],
        priority: e.priority || 2,
        confidence: e.confidence || 0.7,
        rawText: undefined,
      };
    });

    const contacts: ExtractedContact[] = (parsed.contacts || []).map((c: any) => ({
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
      category: c.category || 'general',
      confidence: c.confidence || 0.7,
    }));

    const locations: ExtractedLocation[] = (parsed.locations || []).map((l: any) => ({
      name: l.name,
      address: l.address || undefined,
      confidence: l.confidence || 0.7,
    }));

    return { events, contacts, locations };
  }

  /**
   * Merge deterministic and AI results
   */
  private mergeResults(
    deterministic: Omit<BatchExtractionResult, 'warnings' | 'metadata'>,
    ai: Omit<BatchExtractionResult, 'warnings' | 'metadata'>,
  ): Omit<BatchExtractionResult, 'warnings' | 'metadata'> {
    // Prefer AI events but boost confidence if deterministic also found them
    const events = ai.events.length > 0 ? ai.events : deterministic.events;

    // Merge contacts - prefer AI names but add deterministic emails/phones
    const contactMap = new Map<string, ExtractedContact>();

    for (const c of ai.contacts) {
      contactMap.set(c.name.toLowerCase(), c);
    }

    for (const c of deterministic.contacts) {
      const key = c.name.toLowerCase();
      const existing = contactMap.get(key);
      if (existing) {
        // Merge contact info
        if (c.email && !existing.email) existing.email = c.email;
        if (c.phone && !existing.phone) existing.phone = c.phone;
        existing.confidence = Math.max(existing.confidence, c.confidence);
      } else if (c.email || c.phone) {
        // Only add deterministic contacts that have email/phone
        contactMap.set(key, c);
      }
    }

    const contacts = Array.from(contactMap.values());

    // Merge locations
    const locationMap = new Map<string, ExtractedLocation>();
    for (const l of [...deterministic.locations, ...ai.locations]) {
      const key = l.name.toLowerCase();
      const existing = locationMap.get(key);
      if (existing) {
        if (l.address && !existing.address) existing.address = l.address;
        existing.confidence = Math.max(existing.confidence, l.confidence);
      } else {
        locationMap.set(key, l);
      }
    }

    const locations = Array.from(locationMap.values());

    return { events, contacts, locations };
  }
}
