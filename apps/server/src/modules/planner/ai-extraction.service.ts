import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as chrono from 'chrono-node';
import { schemas } from '@jocasta/shared';
import { z } from 'zod';

export interface ExtractedIntent {
  kind: 'event' | 'task';
  title: string;
  type: string;
  fixedTime?: {
    startAt: string;
    endAt: string;
  };
  window?: {
    startAt: string;
    endAt: string;
  };
  durationMinutes: number;
  locationText?: string;
  modePreference?: string;
  priority?: number;
  isLocked?: boolean;
}

@Injectable()
export class AIExtractionService {
  private readonly logger = new Logger(AIExtractionService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    this.model = this.configService.get<string>('openai.model') || 'gpt-4o-mini';

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.openai = null;
      this.logger.warn('OpenAI API key not configured - using fallback parser');
    }
  }

  /**
   * Extract structured intent from natural language input
   */
  async extractIntent(
    text: string,
    context: {
      timezone: string;
      preferredMode?: string;
      currentDate?: Date;
    },
  ): Promise<ExtractedIntent> {
    // Try AI extraction first
    if (this.openai) {
      try {
        return await this.extractWithAI(text, context);
      } catch (error) {
        this.logger.error('AI extraction failed, falling back to parser', error);
      }
    }

    // Fallback to deterministic parser
    return this.extractWithParser(text, context);
  }

  /**
   * AI-powered extraction using OpenAI
   */
  private async extractWithAI(
    text: string,
    context: { timezone: string; preferredMode?: string; currentDate?: Date },
  ): Promise<ExtractedIntent> {
    const currentDate = context.currentDate || new Date();
    const dateStr = currentDate.toISOString().split('T')[0];

    const systemPrompt = `You are a scheduling assistant. Extract scheduling intent from user text.
Current date: ${dateStr}
Timezone: ${context.timezone}
User's preferred transport: ${context.preferredMode || 'sedan'}

Extract the following information and return as JSON:
- kind: "event" (fixed time) or "task" (flexible scheduling)
- title: short title for the calendar entry
- type: one of: appointment, client_training, personal_workout, dog_walk, kids_dropoff, kids_pickup, fueling, shopping, home_chores, meeting, other
- fixedTime: { startAt, endAt } in ISO 8601 if specific time mentioned
- window: { startAt, endAt } in ISO 8601 if flexible time window mentioned
- durationMinutes: estimated duration
- locationText: location if mentioned
- modePreference: sedan, motorcycle, taxi, transit, walking if mentioned
- priority: 1 (high), 2 (medium), 3 (low)
- isLocked: true if user indicates this is mandatory

Be conservative with duration estimates. Default to 30 minutes if not specified.
For relative dates like "tomorrow" or "next week", calculate from current date.`;

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);

    // Validate with schema
    const result = schemas.ExtractedIntentSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn('AI response validation failed', result.error);
      throw new Error('Invalid AI response');
    }

    return result.data;
  }

  /**
   * Deterministic fallback parser using chrono-node
   */
  private extractWithParser(
    text: string,
    context: { timezone: string; preferredMode?: string; currentDate?: Date },
  ): ExtractedIntent {
    const currentDate = context.currentDate || new Date();
    const lowerText = text.toLowerCase();

    // Parse dates/times with chrono
    const parsedResults = chrono.parse(text, currentDate, {
      forwardDate: true,
    });

    // Extract duration
    let durationMinutes = 30; // default
    const durationMatch = lowerText.match(
      /(\d+)\s*(min(?:ute)?s?|hr?s?|hours?)/i,
    );
    if (durationMatch) {
      const value = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      if (unit.startsWith('h')) {
        durationMinutes = value * 60;
      } else {
        durationMinutes = value;
      }
    }

    // Detect event type
    let type = 'other';
    const typeKeywords: Record<string, string[]> = {
      client_training: ['client', 'training', 'session', 'train'],
      personal_workout: ['workout', 'gym', 'exercise', 'crossfit', 'fitness'],
      dog_walk: ['dog', 'walk', 'pet'],
      kids_dropoff: ['drop off', 'dropoff', 'school drop'],
      kids_pickup: ['pick up', 'pickup', 'school pick'],
      fueling: ['gas', 'fuel', 'petrol'],
      shopping: ['shop', 'grocery', 'costco', 'store', 'buy'],
      meeting: ['meeting', 'call', 'zoom', 'teams'],
      appointment: ['appointment', 'doctor', 'dentist', 'salon'],
      home_chores: ['chore', 'clean', 'laundry', 'dishes'],
    };

    for (const [eventType, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some((k) => lowerText.includes(k))) {
        type = eventType;
        break;
      }
    }

    // Extract location
    let locationText: string | undefined;
    const locationPatterns = [
      /at\s+([^,]+?)(?:\s+(?:on|at|this|next|tomorrow)|\s*$)/i,
      /to\s+([^,]+?)(?:\s+(?:on|at|this|next|tomorrow)|\s*$)/i,
    ];
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        locationText = match[1].trim();
        break;
      }
    }

    // Extract transport mode
    let modePreference: string | undefined;
    const modeKeywords: Record<string, string[]> = {
      sedan: ['car', 'drive', 'driving'],
      motorcycle: ['motorcycle', 'moto', 'bike'],
      taxi: ['taxi', 'uber', 'lyft', 'cab'],
      transit: ['bus', 'train', 'transit', 'public transport'],
      walking: ['walk', 'walking'],
    };
    for (const [mode, keywords] of Object.entries(modeKeywords)) {
      if (keywords.some((k) => lowerText.includes(k))) {
        modePreference = mode;
        break;
      }
    }

    // Extract priority
    let priority = 2;
    if (
      lowerText.includes('urgent') ||
      lowerText.includes('important') ||
      lowerText.includes('asap')
    ) {
      priority = 1;
    } else if (
      lowerText.includes('low priority') ||
      lowerText.includes('whenever')
    ) {
      priority = 3;
    }

    // Build time information
    let fixedTime: { startAt: string; endAt: string } | undefined;
    let window: { startAt: string; endAt: string } | undefined;
    let kind: 'event' | 'task' = 'task';

    if (parsedResults.length > 0) {
      const firstResult = parsedResults[0];
      const startDate = firstResult.start.date();

      // Check if specific time was mentioned
      if (firstResult.start.isCertain('hour')) {
        kind = 'event';
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        fixedTime = {
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
        };
      } else {
        // Just a date, create a window
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        window = {
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
        };
      }

      // Check for date range
      if (parsedResults.length > 1 || firstResult.end) {
        const endResult = firstResult.end || parsedResults[1]?.start;
        if (endResult) {
          const windowEnd = endResult.date();
          windowEnd.setHours(23, 59, 59, 999);
          window = {
            startAt: startDate.toISOString(),
            endAt: windowEnd.toISOString(),
          };
          fixedTime = undefined;
          kind = 'task';
        }
      }
    } else {
      // No date found - default to next 7 days
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 7);
      window = {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
      };
    }

    // Generate title - clean up the text
    let title = text
      .replace(/\b(at|on|by|before|after|this|next|tomorrow|today)\s+\d+.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Truncate if too long
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    return {
      kind,
      title,
      type,
      fixedTime,
      window,
      durationMinutes,
      locationText,
      modePreference: modePreference || context.preferredMode,
      priority,
      isLocked: lowerText.includes('must') || lowerText.includes('mandatory'),
    };
  }
}
