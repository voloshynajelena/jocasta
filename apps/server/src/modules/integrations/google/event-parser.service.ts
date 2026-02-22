import { Injectable } from '@nestjs/common';

export interface ParsedEventData {
  type: string;
  title: string;
  locationName?: string;
  locationAddress?: string;
  priority: number;
  notes?: string;
}

// Keywords for event type detection
const EVENT_TYPE_PATTERNS: { type: string; patterns: RegExp[]; priority: number }[] = [
  // Health & Fitness
  {
    type: 'personal_workout',
    patterns: [
      /workout/i, /gym/i, /exercise/i, /training/i, /fitness/i,
      /crossfit/i, /yoga/i, /pilates/i, /run\b/i, /running/i,
      /swim/i, /cycling/i, /kickbox/i, /martial\s*art/i
    ],
    priority: 2,
  },
  {
    type: 'client_training',
    patterns: [/client.*session/i, /client.*training/i, /pt\s*session/i, /personal\s*training/i],
    priority: 3,
  },
  // Family & Kids
  {
    type: 'kids_dropoff',
    patterns: [
      /drop.*off.*school/i, /school.*drop/i, /to\s*school/i,
      /daycare.*drop/i, /drop.*daycare/i
    ],
    priority: 4,
  },
  {
    type: 'kids_pickup',
    patterns: [
      /pick.*up.*school/i, /school.*pick/i, /from\s*school/i,
      /daycare.*pick/i, /pick.*daycare/i, /leo\s*from/i, /romeo\s*from/i
    ],
    priority: 4,
  },
  // Pets
  {
    type: 'dog_walk',
    patterns: [/dog\s*walk/i, /walk.*dog/i, /🐕/i, /🐶/i, /🐕‍🦺/i],
    priority: 2,
  },
  // Work & Meetings
  {
    type: 'meeting',
    patterns: [
      /meeting/i, /standup/i, /sync/i, /1:1/i, /one.*one/i,
      /call\b/i, /zoom/i, /teams/i, /huddle/i, /scrum/i
    ],
    priority: 3,
  },
  // Appointments
  {
    type: 'appointment',
    patterns: [
      /doctor/i, /dentist/i, /appointment/i, /checkup/i,
      /medical/i, /clinic/i, /hospital/i, /therapy/i,
      /physiotherap/i, /chiropract/i, /massage/i
    ],
    priority: 4,
  },
  // Food & Meals
  {
    type: 'meal',
    patterns: [
      /breakfast/i, /lunch/i, /dinner/i, /brunch/i,
      /🍳/i, /🍽️/i, /🍔/i, /🍕/i
    ],
    priority: 1,
  },
  // Transport & Errands
  {
    type: 'fueling',
    patterns: [/gas/i, /fuel/i, /⛽/i, /petrol/i],
    priority: 1,
  },
  {
    type: 'shopping',
    patterns: [/shopping/i, /grocery/i, /store/i, /mall/i, /🛒/i],
    priority: 1,
  },
  // Home
  {
    type: 'home_chores',
    patterns: [/clean/i, /laundry/i, /chores/i, /housework/i, /🏠/i],
    priority: 1,
  },
  // Sleep & Rest
  {
    type: 'sleep',
    patterns: [/sleep/i, /💤/i, /🛏️/i, /bedtime/i, /nap/i],
    priority: 1,
  },
  // Travel
  {
    type: 'travel',
    patterns: [/flight/i, /airport/i, /✈️/i, /travel/i, /trip/i],
    priority: 4,
  },
];

@Injectable()
export class EventParserService {
  /**
   * Parse a Google Calendar event and extract meaningful data
   */
  parseGoogleEvent(googleEvent: any): ParsedEventData {
    const title = googleEvent.summary || 'Untitled';
    const description = googleEvent.description || '';
    const fullText = `${title} ${description}`;

    // Determine event type
    const detectedType = this.detectEventType(fullText);

    // Extract location
    const locationData = this.parseLocation(googleEvent);

    // Determine priority based on type and other factors
    const priority = this.calculatePriority(detectedType.type, googleEvent);

    return {
      type: detectedType.type,
      title: this.cleanTitle(title),
      locationName: locationData?.name,
      locationAddress: locationData?.address,
      priority,
      notes: description || undefined,
    };
  }

  /**
   * Detect event type from text
   */
  private detectEventType(text: string): { type: string; confidence: number } {
    let bestMatch = { type: 'other', confidence: 0, priority: 0 };

    for (const pattern of EVENT_TYPE_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(text)) {
          // Higher priority patterns take precedence
          if (pattern.priority > bestMatch.priority) {
            bestMatch = {
              type: pattern.type,
              confidence: 0.8,
              priority: pattern.priority,
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Parse location from Google event
   */
  private parseLocation(googleEvent: any): { name?: string; address?: string } | null {
    if (!googleEvent.location) {
      return null;
    }

    const location = googleEvent.location;

    // Check if it's a full address or just a name
    const hasAddressIndicators = /\d+.*(?:st|street|ave|avenue|rd|road|blvd|drive|dr|way|lane|ln|unit|suite)/i.test(location);

    if (hasAddressIndicators) {
      // It's likely an address - try to extract name from first part
      const parts = location.split(',');
      if (parts.length > 1) {
        return {
          name: parts[0].trim(),
          address: location,
        };
      }
      return { address: location };
    }

    // It's likely just a place name
    return { name: location };
  }

  /**
   * Clean up event title (remove emojis at start if duplicated, etc.)
   */
  private cleanTitle(title: string): string {
    // Keep the title as-is for now, but could add cleaning logic
    return title.trim();
  }

  /**
   * Calculate priority based on event type and properties
   */
  private calculatePriority(type: string, googleEvent: any): number {
    // Base priority from type
    const pattern = EVENT_TYPE_PATTERNS.find(p => p.type === type);
    let priority = pattern?.priority || 2;

    // Adjust based on other factors
    // If it has attendees (shared event), increase priority
    if (googleEvent.attendees && googleEvent.attendees.length > 0) {
      priority = Math.min(priority + 1, 5);
    }

    // If marked as important/high priority in Google
    if (googleEvent.colorId === '11' || googleEvent.colorId === '4') {
      priority = Math.min(priority + 1, 5);
    }

    return priority;
  }

  /**
   * Check if an event should be included in travel planning
   * (has a physical location)
   */
  hasPhysicalLocation(googleEvent: any): boolean {
    if (!googleEvent.location) {
      return false;
    }

    // Virtual meeting indicators
    const virtualPatterns = [
      /zoom\.us/i, /teams\.microsoft/i, /meet\.google/i,
      /webex/i, /gotomeeting/i, /virtual/i, /online/i,
      /http/i, /https/i,
    ];

    const location = googleEvent.location;
    return !virtualPatterns.some(p => p.test(location));
  }
}
