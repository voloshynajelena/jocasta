// J.O.C.A.S.T.A. Demo Data - Complete Feature Demonstration
// Working mom persona: Elena Martinez, Calgary, Canada

// ============================================
// TYPES
// ============================================

export type EventType =
  | 'appointment'
  | 'client_training'
  | 'personal_workout'
  | 'dog_walk'
  | 'kids_dropoff'
  | 'kids_pickup'
  | 'fueling'
  | 'shopping'
  | 'home_chores'
  | 'meeting'
  | 'travel_block'
  | 'personal';

export type TransportMode = 'sedan' | 'motorcycle' | 'taxi' | 'transit';

export type TaskStatus = 'pending' | 'scheduled' | 'done';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'dead';

export interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  startAt: string;
  endAt: string;
  location?: Location;
  isLocked: boolean;
  priority: 1 | 2 | 3;
  notes?: string;
  source: 'managed' | 'external_google';
  externalProviderId?: string;
  travelSegment?: TravelSegment;
  weatherImpact?: WeatherImpact;
}

export interface Task {
  id: string;
  title: string;
  type: EventType;
  durationMinutes: number;
  durationMax?: number;
  windowStart?: string;
  windowEnd?: string;
  deadlineAt?: string;
  priority: 1 | 2 | 3;
  status: TaskStatus;
  scheduledEventId?: string;
  locationText?: string;
  notes?: string;
}

export interface TravelSegment {
  id: string;
  fromEventId: string;
  toEventId: string;
  mode: TransportMode;
  etaMinutes: number;
  departAt: string;
  arriveAt: string;
  source: 'directions' | 'heuristic';
  confidence: number;
  distanceKm: number;
}

export interface WeatherImpact {
  condition: 'clear' | 'snow' | 'rain' | 'freezing_rain' | 'wind';
  etaAdjustmentPercent: number;
  recommendation?: string;
}

export interface Proposal {
  id: string;
  slotStart: string;
  slotEnd: string;
  departAt: string;
  travelMinutes: number;
  confidence: number;
  explanation: string[];
  disruption: 'none' | 'low' | 'medium' | 'high';
  movedItems?: string[];
}

export interface Constraint {
  id: string;
  type: 'quiet_hours' | 'sleep' | 'work' | 'min_gap' | 'max_travel' | 'preferred_mode';
  config: Record<string, any>;
}

export interface NotificationJob {
  id: string;
  channel: 'telegram' | 'expo_push';
  type: 'leave_by' | 'reminder_60' | 'reminder_30' | 'reminder_10' | 'proposal';
  eventId: string;
  scheduledFor: string;
  status: NotificationStatus;
  attempts: number;
  lastError?: string;
}

export interface BufferRule {
  eventType: EventType;
  beforeMinutes: number;
  afterMinutes: number;
}

export interface GoogleSyncStatus {
  isConnected: boolean;
  lastSyncAt: string | null;
  managedCalendarId: string | null;
  syncErrors: string[];
  pendingSync: boolean;
}

// ============================================
// DEMO USER
// ============================================

export const DEMO_USER = {
  id: 'demo-user',
  email: 'elena@workingmom.io',
  name: 'Elena Martinez',
  avatarUrl: null,
  timezone: 'America/Edmonton',
  defaultTransportMode: 'sedan' as TransportMode,
  hasGoogleCalendar: true,
  hasTelegram: true,
};

// ============================================
// LOCATIONS
// ============================================

export const DEMO_LOCATIONS: Location[] = [
  {
    id: 'loc-home',
    name: 'Home',
    address: '123 Maple Street, Calgary, AB',
    lat: 51.0447,
    lng: -114.0719,
    isDefault: true,
  },
  {
    id: 'loc-office',
    name: 'Downtown Office',
    address: '500 Centre Street S, Calgary, AB',
    lat: 51.0453,
    lng: -114.0581,
  },
  {
    id: 'loc-gym',
    name: 'FitLife Gym',
    address: '1200 17 Ave SW, Calgary, AB',
    lat: 51.0380,
    lng: -114.0900,
  },
  {
    id: 'loc-school',
    name: 'Lincoln Elementary',
    address: '2000 14 Street NW, Calgary, AB',
    lat: 51.0550,
    lng: -114.0850,
  },
  {
    id: 'loc-park',
    name: 'Riverside Park',
    address: 'Memorial Drive NW, Calgary, AB',
    lat: 51.0520,
    lng: -114.0650,
  },
  {
    id: 'loc-medical',
    name: 'Downtown Medical Center',
    address: '800 5 Ave SW, Calgary, AB',
    lat: 51.0480,
    lng: -114.0700,
  },
  {
    id: 'loc-gas',
    name: 'Petro-Canada',
    address: '1500 16 Ave NW, Calgary, AB',
    lat: 51.0650,
    lng: -114.0800,
  },
  {
    id: 'loc-grocery',
    name: 'Superstore',
    address: '3545 32 Ave NE, Calgary, AB',
    lat: 51.0750,
    lng: -114.0300,
  },
];

// ============================================
// BUFFER RULES
// ============================================

export const DEMO_BUFFER_RULES: BufferRule[] = [
  { eventType: 'appointment', beforeMinutes: 10, afterMinutes: 10 },
  { eventType: 'client_training', beforeMinutes: 10, afterMinutes: 10 },
  { eventType: 'personal_workout', beforeMinutes: 10, afterMinutes: 15 },
  { eventType: 'dog_walk', beforeMinutes: 5, afterMinutes: 5 },
  { eventType: 'kids_dropoff', beforeMinutes: 10, afterMinutes: 10 },
  { eventType: 'kids_pickup', beforeMinutes: 10, afterMinutes: 10 },
  { eventType: 'fueling', beforeMinutes: 5, afterMinutes: 5 },
  { eventType: 'shopping', beforeMinutes: 5, afterMinutes: 5 },
  { eventType: 'home_chores', beforeMinutes: 0, afterMinutes: 0 },
  { eventType: 'meeting', beforeMinutes: 5, afterMinutes: 5 },
];

// ============================================
// CONSTRAINTS
// ============================================

export const DEMO_CONSTRAINTS: Constraint[] = [
  {
    id: 'con-sleep',
    type: 'sleep',
    config: { start: '22:30', end: '06:00' },
  },
  {
    id: 'con-work',
    type: 'work',
    config: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
  },
  {
    id: 'con-quiet',
    type: 'quiet_hours',
    config: { start: '21:00', end: '08:00', noScheduling: true },
  },
  {
    id: 'con-gap',
    type: 'min_gap',
    config: { minutes: 15 },
  },
  {
    id: 'con-travel',
    type: 'max_travel',
    config: { minutesPerDay: 120 },
  },
  {
    id: 'con-mode',
    type: 'preferred_mode',
    config: { mode: 'sedan', fallback: 'taxi' },
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

const getToday = () => new Date();

const getDate = (daysOffset: number, hours: number, minutes: number = 0): string => {
  const date = getToday();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const getDaysUntilMonday = (): number => {
  const today = getToday();
  return (8 - today.getDay()) % 7 || 7;
};

// ============================================
// DEMO EVENTS
// ============================================

export const generateDemoEvents = (): Event[] => {
  const events: Event[] = [];

  // Today's events
  events.push(
    {
      id: 'evt-dog-am',
      title: 'Morning Walk - Max',
      type: 'dog_walk',
      startAt: getDate(0, 6, 30),
      endAt: getDate(0, 7, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-park'),
      isLocked: true,
      priority: 2,
      source: 'managed',
    },
    {
      id: 'evt-kids-drop',
      title: 'Drop kids at school',
      type: 'kids_dropoff',
      startAt: getDate(0, 7, 45),
      endAt: getDate(0, 8, 15),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-school'),
      isLocked: true,
      priority: 3,
      source: 'managed',
      travelSegment: {
        id: 'ts-1',
        fromEventId: 'evt-dog-am',
        toEventId: 'evt-kids-drop',
        mode: 'sedan',
        etaMinutes: 12,
        departAt: getDate(0, 7, 25),
        arriveAt: getDate(0, 7, 40),
        source: 'directions',
        confidence: 0.9,
        distanceKm: 5.2,
      },
    },
    {
      id: 'evt-standup',
      title: 'Team Standup',
      type: 'meeting',
      startAt: getDate(0, 9, 0),
      endAt: getDate(0, 9, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: false,
      priority: 2,
      source: 'external_google',
      externalProviderId: 'google-evt-123',
      travelSegment: {
        id: 'ts-2',
        fromEventId: 'evt-kids-drop',
        toEventId: 'evt-standup',
        mode: 'sedan',
        etaMinutes: 18,
        departAt: getDate(0, 8, 30),
        arriveAt: getDate(0, 8, 50),
        source: 'directions',
        confidence: 0.85,
        distanceKm: 8.5,
      },
    },
    {
      id: 'evt-product-review',
      title: 'Product Review',
      type: 'meeting',
      startAt: getDate(0, 11, 0),
      endAt: getDate(0, 12, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: false,
      priority: 2,
      source: 'external_google',
      externalProviderId: 'google-evt-124',
    },
    {
      id: 'evt-lunch',
      title: 'Lunch Break',
      type: 'personal',
      startAt: getDate(0, 12, 30),
      endAt: getDate(0, 13, 30),
      isLocked: false,
      priority: 1,
      source: 'managed',
    },
    {
      id: 'evt-client-call',
      title: 'Client Call - Acme Corp',
      type: 'meeting',
      startAt: getDate(0, 14, 0),
      endAt: getDate(0, 15, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: true,
      priority: 3,
      source: 'managed',
    },
    {
      id: 'evt-kids-pickup',
      title: 'Pick up kids',
      type: 'kids_pickup',
      startAt: getDate(0, 15, 30),
      endAt: getDate(0, 16, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-school'),
      isLocked: true,
      priority: 3,
      source: 'managed',
      travelSegment: {
        id: 'ts-3',
        fromEventId: 'evt-client-call',
        toEventId: 'evt-kids-pickup',
        mode: 'sedan',
        etaMinutes: 15,
        departAt: getDate(0, 15, 10),
        arriveAt: getDate(0, 15, 25),
        source: 'directions',
        confidence: 0.88,
        distanceKm: 6.8,
      },
    },
    {
      id: 'evt-gym',
      title: 'CrossFit',
      type: 'personal_workout',
      startAt: getDate(0, 18, 0),
      endAt: getDate(0, 19, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-gym'),
      isLocked: false,
      priority: 2,
      source: 'managed',
    },
    {
      id: 'evt-dog-pm',
      title: 'Evening Walk - Max',
      type: 'dog_walk',
      startAt: getDate(0, 19, 30),
      endAt: getDate(0, 20, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-park'),
      isLocked: false,
      priority: 2,
      source: 'managed',
    }
  );

  // Tomorrow's events
  events.push(
    {
      id: 'evt-dog-am-1',
      title: 'Morning Walk - Max',
      type: 'dog_walk',
      startAt: getDate(1, 6, 30),
      endAt: getDate(1, 7, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-park'),
      isLocked: true,
      priority: 2,
      source: 'managed',
    },
    {
      id: 'evt-kids-drop-1',
      title: 'Drop kids at school',
      type: 'kids_dropoff',
      startAt: getDate(1, 7, 45),
      endAt: getDate(1, 8, 15),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-school'),
      isLocked: true,
      priority: 3,
      source: 'managed',
    },
    {
      id: 'evt-sprint',
      title: 'Sprint Planning',
      type: 'meeting',
      startAt: getDate(1, 10, 0),
      endAt: getDate(1, 11, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: false,
      priority: 2,
      source: 'external_google',
    },
    {
      id: 'evt-soccer',
      title: "Sophie's Soccer Practice",
      type: 'personal',
      startAt: getDate(1, 16, 0),
      endAt: getDate(1, 17, 30),
      location: { id: 'loc-soccer', name: 'Community Fields', address: '3000 26 Ave NE', lat: 51.07, lng: -114.03 },
      isLocked: true,
      priority: 3,
      source: 'managed',
    }
  );

  // Day 2 events
  events.push(
    {
      id: 'evt-1on1',
      title: '1:1 with Manager',
      type: 'meeting',
      startAt: getDate(2, 14, 0),
      endAt: getDate(2, 14, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: false,
      priority: 2,
      source: 'external_google',
    },
    {
      id: 'evt-yoga',
      title: 'Yoga Class',
      type: 'personal_workout',
      startAt: getDate(2, 18, 0),
      endAt: getDate(2, 19, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-gym'),
      isLocked: false,
      priority: 2,
      source: 'managed',
    },
    {
      id: 'evt-piano',
      title: "Jake's Piano Lesson",
      type: 'personal',
      startAt: getDate(2, 17, 0),
      endAt: getDate(2, 17, 45),
      location: { id: 'loc-music', name: 'Music Academy', address: '1800 4 Street SW', lat: 51.03, lng: -114.07 },
      isLocked: true,
      priority: 3,
      source: 'managed',
    }
  );

  // Day 3 - Dentist
  events.push({
    id: 'evt-dentist',
    title: 'Dentist - Kids Checkup',
    type: 'appointment',
    startAt: getDate(3, 9, 0),
    endAt: getDate(3, 10, 0),
    location: { id: 'loc-dentist', name: 'Smile Dental', address: '1500 Centre Street N', lat: 51.06, lng: -114.06 },
    isLocked: true,
    priority: 3,
    source: 'managed',
  });

  // Day 4 - Gym
  events.push({
    id: 'evt-strength',
    title: 'Strength Training',
    type: 'personal_workout',
    startAt: getDate(4, 6, 0),
    endAt: getDate(4, 7, 0),
    location: DEMO_LOCATIONS.find(l => l.id === 'loc-gym'),
    isLocked: false,
    priority: 2,
    source: 'managed',
  });

  // Next Monday - Doctor's Appointment
  const mondayOffset = getDaysUntilMonday();
  events.push({
    id: 'evt-doctor',
    title: 'Annual Physical - Dr. Martinez',
    type: 'appointment',
    startAt: getDate(mondayOffset, 10, 0),
    endAt: getDate(mondayOffset, 11, 0),
    location: DEMO_LOCATIONS.find(l => l.id === 'loc-medical'),
    isLocked: true,
    priority: 3,
    source: 'managed',
    notes: 'Fasting required. Bring insurance card.',
  });

  // Week 2 events (7-13 days from now)
  events.push(
    {
      id: 'evt-w2-standup-1',
      title: 'Weekly Team Standup',
      type: 'meeting',
      startAt: getDate(7, 9, 0),
      endAt: getDate(7, 9, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: false,
      priority: 2,
      source: 'external_google',
    },
    {
      id: 'evt-w2-training',
      title: 'Client Training Session',
      type: 'client_training',
      startAt: getDate(8, 14, 0),
      endAt: getDate(8, 16, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: true,
      priority: 3,
      source: 'managed',
    },
    {
      id: 'evt-w2-dentist',
      title: 'Teeth Cleaning',
      type: 'appointment',
      startAt: getDate(9, 11, 0),
      endAt: getDate(9, 12, 0),
      location: { id: 'loc-dentist', name: 'Smile Dental', address: '1500 Centre Street N', lat: 51.06, lng: -114.06 },
      isLocked: true,
      priority: 2,
      source: 'managed',
    },
    {
      id: 'evt-w2-gym',
      title: 'Personal Training',
      type: 'personal_workout',
      startAt: getDate(10, 6, 30),
      endAt: getDate(10, 7, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-gym'),
      isLocked: false,
      priority: 2,
      source: 'managed',
    },
    {
      id: 'evt-w2-date',
      title: 'Date Night',
      type: 'personal',
      startAt: getDate(11, 19, 0),
      endAt: getDate(11, 22, 0),
      location: { id: 'loc-restaurant', name: 'The Nash', address: '925 11 St SE', lat: 51.04, lng: -114.05 },
      isLocked: true,
      priority: 3,
      source: 'managed',
      notes: 'Reservation confirmed. Babysitter: Sarah',
    },
    {
      id: 'evt-w2-soccer',
      title: "Kids' Soccer Tournament",
      type: 'personal',
      startAt: getDate(12, 10, 0),
      endAt: getDate(12, 14, 0),
      location: { id: 'loc-soccer', name: 'Community Fields', address: '3000 26 Ave NE', lat: 51.07, lng: -114.03 },
      isLocked: true,
      priority: 3,
      source: 'managed',
    }
  );

  // Week 3 events (14-20 days from now)
  events.push(
    {
      id: 'evt-w3-all-hands',
      title: 'Company All-Hands',
      type: 'meeting',
      startAt: getDate(14, 10, 0),
      endAt: getDate(14, 11, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: false,
      priority: 2,
      source: 'external_google',
    },
    {
      id: 'evt-w3-vet',
      title: 'Max - Vet Checkup',
      type: 'appointment',
      startAt: getDate(15, 9, 0),
      endAt: getDate(15, 10, 0),
      location: { id: 'loc-vet', name: 'Calgary Animal Hospital', address: '2500 4 Street SW', lat: 51.03, lng: -114.07 },
      isLocked: true,
      priority: 2,
      source: 'managed',
      notes: 'Annual shots + heartworm test',
    },
    {
      id: 'evt-w3-conference',
      title: 'Tech Conference',
      type: 'meeting',
      startAt: getDate(16, 9, 0),
      endAt: getDate(16, 17, 0),
      location: { id: 'loc-telus', name: 'TELUS Convention Centre', address: '120 9 Ave SE', lat: 51.04, lng: -114.06 },
      isLocked: true,
      priority: 3,
      source: 'managed',
    },
    {
      id: 'evt-w3-birthday',
      title: "Jake's Birthday Party",
      type: 'personal',
      startAt: getDate(19, 14, 0),
      endAt: getDate(19, 17, 0),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-home'),
      isLocked: true,
      priority: 3,
      source: 'managed',
      notes: '8 kids confirmed. Cake ordered.',
    }
  );

  // Week 4 events (21-27 days from now)
  events.push(
    {
      id: 'evt-w4-review',
      title: 'Quarterly Review',
      type: 'meeting',
      startAt: getDate(21, 14, 0),
      endAt: getDate(21, 15, 30),
      location: DEMO_LOCATIONS.find(l => l.id === 'loc-office'),
      isLocked: true,
      priority: 3,
      source: 'external_google',
    },
    {
      id: 'evt-w4-car',
      title: 'Car Service',
      type: 'appointment',
      startAt: getDate(22, 8, 0),
      endAt: getDate(22, 12, 0),
      location: { id: 'loc-dealer', name: 'Toyota Dealership', address: '5808 Blackfoot Trail SE', lat: 51.0, lng: -114.04 },
      isLocked: true,
      priority: 2,
      source: 'managed',
      notes: '60k service + tire rotation',
    },
    {
      id: 'evt-w4-spa',
      title: 'Spa Day',
      type: 'personal',
      startAt: getDate(25, 10, 0),
      endAt: getDate(25, 14, 0),
      location: { id: 'loc-spa', name: 'Kensington Spa', address: '1134 Kensington Rd NW', lat: 51.05, lng: -114.09 },
      isLocked: false,
      priority: 1,
      source: 'managed',
      notes: 'Self-care day!',
    }
  );

  return events;
};

// ============================================
// DEMO TASKS
// ============================================

export const generateDemoTasks = (): Task[] => [
  {
    id: 'task-vet',
    title: 'Schedule vet appointment for Max',
    type: 'appointment',
    durationMinutes: 60,
    windowStart: getDate(0, 9, 0),
    windowEnd: getDate(7, 17, 0),
    deadlineAt: getDate(7, 17, 0),
    priority: 2,
    status: 'pending',
    notes: 'Annual vaccination + checkup',
  },
  {
    id: 'task-camp',
    title: 'Book summer camp for kids',
    type: 'personal',
    durationMinutes: 30,
    windowStart: getDate(0, 9, 0),
    windowEnd: getDate(14, 17, 0),
    deadlineAt: getDate(14, 17, 0),
    priority: 3,
    status: 'pending',
    notes: 'Research: sports camp, STEM camp, art camp',
  },
  {
    id: 'task-car',
    title: 'Schedule car service',
    type: 'appointment',
    durationMinutes: 120,
    windowStart: getDate(0, 8, 0),
    windowEnd: getDate(10, 18, 0),
    deadlineAt: getDate(10, 17, 0),
    priority: 1,
    status: 'pending',
    locationText: 'Any dealership',
    notes: 'Oil change + tire rotation',
  },
  {
    id: 'task-date',
    title: 'Plan date night with partner',
    type: 'personal',
    durationMinutes: 180,
    durationMax: 240,
    priority: 2,
    status: 'pending',
    notes: 'Need to book babysitter first',
  },
  {
    id: 'task-gift',
    title: "Order Jake's birthday gift",
    type: 'shopping',
    durationMinutes: 20,
    deadlineAt: getDate(21, 12, 0),
    priority: 3,
    status: 'pending',
    notes: 'LEGO Star Wars set',
  },
  {
    id: 'task-report',
    title: 'Prepare Q1 report',
    type: 'meeting',
    durationMinutes: 180,
    windowStart: getDate(3, 9, 0),
    windowEnd: getDate(3, 17, 0),
    deadlineAt: getDate(5, 17, 0),
    priority: 3,
    status: 'scheduled',
    scheduledEventId: 'evt-report-scheduled',
  },
  {
    id: 'task-grocery',
    title: 'Grocery shopping',
    type: 'shopping',
    durationMinutes: 60,
    durationMax: 90,
    deadlineAt: getDate(2, 20, 0),
    priority: 2,
    status: 'pending',
    locationText: 'Costco or Superstore',
    notes: 'Stock up on essentials',
  },
  {
    id: 'task-fuel',
    title: 'Fill up car',
    type: 'fueling',
    durationMinutes: 15,
    deadlineAt: getDate(1, 20, 0),
    priority: 2,
    status: 'pending',
  },
];

// ============================================
// DEMO PROPOSALS
// ============================================

export const generateDemoProposals = (inputText: string): Proposal[] => {
  const now = getToday();

  return [
    {
      id: 'prop-1',
      slotStart: getDate(1, 13, 0),
      slotEnd: getDate(1, 14, 0),
      departAt: getDate(1, 12, 35),
      travelMinutes: 18,
      confidence: 0.92,
      explanation: [
        'Best available slot with minimal disruption',
        '18 min drive to location',
        'No conflicts with existing events',
        'Within your preferred work hours',
      ],
      disruption: 'none',
    },
    {
      id: 'prop-2',
      slotStart: getDate(2, 10, 0),
      slotEnd: getDate(2, 11, 0),
      departAt: getDate(2, 9, 40),
      travelMinutes: 15,
      confidence: 0.88,
      explanation: [
        'Alternative morning slot',
        '15 min drive to location',
        'Good gap before next event',
      ],
      disruption: 'none',
    },
    {
      id: 'prop-3',
      slotStart: getDate(1, 16, 30),
      slotEnd: getDate(1, 17, 30),
      departAt: getDate(1, 16, 5),
      travelMinutes: 20,
      confidence: 0.75,
      explanation: [
        'Later afternoon option',
        'May have traffic delays',
        'Tight before evening activities',
      ],
      disruption: 'low',
    },
    {
      id: 'prop-4',
      slotStart: getDate(3, 14, 0),
      slotEnd: getDate(3, 15, 0),
      departAt: getDate(3, 13, 38),
      travelMinutes: 17,
      confidence: 0.85,
      explanation: [
        'Weekend option',
        'More flexible timing',
        'Requires moving grocery task',
      ],
      disruption: 'medium',
      movedItems: ['Grocery shopping'],
    },
  ];
};

// ============================================
// DEMO NOTIFICATIONS
// ============================================

export const generateDemoNotifications = (): NotificationJob[] => [
  {
    id: 'notif-1',
    channel: 'telegram',
    type: 'leave_by',
    eventId: 'evt-kids-drop',
    scheduledFor: getDate(0, 7, 20),
    status: 'sent',
    attempts: 1,
  },
  {
    id: 'notif-2',
    channel: 'telegram',
    type: 'reminder_30',
    eventId: 'evt-standup',
    scheduledFor: getDate(0, 8, 30),
    status: 'sent',
    attempts: 1,
  },
  {
    id: 'notif-3',
    channel: 'telegram',
    type: 'leave_by',
    eventId: 'evt-client-call',
    scheduledFor: getDate(0, 13, 45),
    status: 'pending',
    attempts: 0,
  },
  {
    id: 'notif-4',
    channel: 'telegram',
    type: 'reminder_60',
    eventId: 'evt-gym',
    scheduledFor: getDate(0, 17, 0),
    status: 'pending',
    attempts: 0,
  },
  {
    id: 'notif-5',
    channel: 'telegram',
    type: 'leave_by',
    eventId: 'evt-dentist',
    scheduledFor: getDate(3, 8, 30),
    status: 'failed',
    attempts: 3,
    lastError: 'Telegram API timeout',
  },
];

// ============================================
// DEMO GOOGLE SYNC STATUS
// ============================================

export const DEMO_GOOGLE_SYNC: GoogleSyncStatus = {
  isConnected: true,
  lastSyncAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  managedCalendarId: 'jocasta-managed-calendar-id',
  syncErrors: [],
  pendingSync: false,
};

// ============================================
// DEMO WEATHER
// ============================================

export const DEMO_WEATHER = {
  current: {
    condition: 'clear' as const,
    temperature: -5,
    feelsLike: -12,
    windSpeed: 15,
  },
  forecast: [
    { hour: 8, condition: 'clear', temperature: -8 },
    { hour: 12, condition: 'clear', temperature: -2 },
    { hour: 15, condition: 'snow', temperature: -4, etaImpact: 15 },
    { hour: 18, condition: 'snow', temperature: -6, etaImpact: 15 },
  ],
  alerts: [
    {
      type: 'snow',
      message: 'Light snow expected 3-6 PM. Consider +15% travel time.',
      startAt: getDate(0, 15, 0),
      endAt: getDate(0, 18, 0),
    },
  ],
};

// ============================================
// DEMO SETTINGS
// ============================================

export const DEMO_SETTINGS = {
  user: DEMO_USER,
  buffers: DEMO_BUFFER_RULES,
  constraints: DEMO_CONSTRAINTS,
  notifications: {
    reminderMinutesBefore: [60, 30, 10],
    leaveByReminders: true,
    weatherAlerts: true,
    trafficAlerts: true,
  },
  privacy: {
    sendNotesToAI: false,
    analyzeExternalEvents: true,
    weatherInfluence: true,
    googleSyncEnabled: true,
  },
  telegram: {
    connected: true,
    chatId: '123456789',
    username: '@elena_martinez',
  },
};

// ============================================
// DAILY SUMMARY
// ============================================

export const generateDailySummary = () => {
  const events = generateDemoEvents();
  const today = getToday();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayEvents = events.filter(e => {
    const eventDate = new Date(e.startAt);
    return eventDate >= today && eventDate < tomorrow;
  });

  const totalTravelMinutes = todayEvents.reduce((acc, e) => {
    return acc + (e.travelSegment?.etaMinutes || 0);
  }, 0);

  const meetings = todayEvents.filter(e => e.type === 'meeting').length;
  const appointments = todayEvents.filter(e => e.type === 'appointment').length;

  return {
    date: today.toISOString(),
    eventCount: todayEvents.length,
    meetings,
    appointments,
    totalTravelMinutes,
    freeTimeMinutes: 480 - (todayEvents.length * 60), // Rough estimate
    nextEvent: todayEvents[0],
    weatherAlert: DEMO_WEATHER.alerts[0],
  };
};

// ============================================
// EXPORT ALL
// ============================================

export const DEMO_EVENTS = generateDemoEvents();
export const DEMO_TASKS = generateDemoTasks();
export const DEMO_NOTIFICATIONS = generateDemoNotifications();
export const DEMO_DAILY_SUMMARY = generateDailySummary();
