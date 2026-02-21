import type {
  EventType,
  EventSource,
  TaskStatus,
  TransportMode,
  NotificationChannel,
  NotificationStatus,
  DirectionSource,
  ConstraintType,
  Priority,
} from './enums';

// Base entity with common fields
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User entity
export interface User extends BaseEntity {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  defaultTransportMode: TransportMode;
  homeLocationId: string | null;
  workLocationId: string | null;
  googleRefreshToken: string | null; // encrypted
  googleAccessToken: string | null; // encrypted
  googleTokenExpiresAt: Date | null;
}

// Location entity
export interface Location extends BaseEntity {
  userId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string | null; // Google Place ID
  isDefault: boolean;
}

// Event entity (calendar events)
export interface Event extends BaseEntity {
  userId: string;
  title: string;
  type: EventType;
  startAt: Date;
  endAt: Date;
  locationId: string | null;
  isLocked: boolean;
  priority: Priority;
  notes: string | null; // encrypted at rest optional
  source: EventSource;
  externalProviderId: string | null; // e.g., Google event ID
  externalEtag: string | null;
  lastModifiedAt: Date;
  recurrenceRuleId: string | null;
  parentEventId: string | null; // for recurring event instances
}

// Task entity (to be scheduled)
export interface Task extends BaseEntity {
  userId: string;
  title: string;
  type: EventType;
  durationMinutes: number;
  durationMinutesMin: number | null;
  durationMinutesMax: number | null;
  locationId: string | null;
  windowStartAt: Date | null;
  windowEndAt: Date | null;
  deadlineAt: Date | null;
  priority: Priority;
  status: TaskStatus;
  scheduledEventId: string | null;
  notes: string | null;
}

// Recurrence rule (iCal RRULE format)
export interface RecurrenceRule extends BaseEntity {
  userId: string;
  eventTemplateId: string | null;
  constraintId: string | null;
  rrule: string; // iCal RRULE string
  timezone: string;
  startDate: Date;
  endDate: Date | null;
}

// Constraint entity
export interface Constraint extends BaseEntity {
  userId: string;
  type: ConstraintType;
  name: string;
  config: ConstraintConfig;
  isActive: boolean;
  recurrenceRuleId: string | null;
}

// Constraint configuration types
export type ConstraintConfig =
  | QuietHoursConfig
  | SleepBlockConfig
  | WorkBlockConfig
  | MaxDailyTravelConfig
  | MinGapConfig
  | PreferredTransportConfig;

export interface QuietHoursConfig {
  type: 'quiet_hours';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
}

export interface SleepBlockConfig {
  type: 'sleep_block';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysOfWeek: number[];
}

export interface WorkBlockConfig {
  type: 'work_block';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysOfWeek: number[];
  locationId: string | null;
}

export interface MaxDailyTravelConfig {
  type: 'max_daily_travel';
  maxMinutes: number;
}

export interface MinGapConfig {
  type: 'min_gap_between_events';
  minMinutes: number;
}

export interface PreferredTransportConfig {
  type: 'preferred_transport';
  mode: TransportMode;
  conditions: {
    maxDistanceKm?: number;
    weatherExclusions?: string[]; // e.g., ['snow', 'rain'] for motorcycle
  };
}

// Travel segment (calculated travel between events)
export interface TravelSegment extends BaseEntity {
  userId: string;
  fromEventId: string | null;
  toEventId: string;
  fromLocationId: string | null;
  toLocationId: string;
  mode: TransportMode;
  etaMinutes: number;
  departAt: Date;
  arriveAt: Date;
  source: DirectionSource;
  confidence: number; // 0-1
  cachedKey: string | null;
  lastComputedAt: Date;
  weatherImpact: number | null; // percentage adjustment
}

// Notification endpoint (where to send notifications)
export interface NotificationEndpoint extends BaseEntity {
  userId: string;
  channel: NotificationChannel;
  address: string; // chat_id for Telegram, push token for Expo
  isEnabled: boolean;
  isVerified: boolean;
  metadata: Record<string, unknown>;
}

// Notification job (scheduled notification)
export interface NotificationJob extends BaseEntity {
  userId: string;
  channel: NotificationChannel;
  endpointId: string;
  payload: NotificationPayload;
  scheduledFor: Date;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  dedupeKey: string;
  relatedEventId: string | null;
}

// Notification payload types
export interface NotificationPayload {
  type: 'reminder' | 'proposal' | 'confirmation' | 'warning' | 'alert';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'accept' | 'snooze' | 'reschedule' | 'switch_mode' | 'dismiss';
  payload?: Record<string, unknown>;
}

// Google sync state
export interface GoogleSyncState extends BaseEntity {
  userId: string;
  calendarId: string;
  syncToken: string | null;
  lastSyncAt: Date | null;
  backoffUntil: Date | null;
  failureCount: number;
  isManagedCalendar: boolean;
}

// Cache entities
export interface GeoCache {
  queryHash: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  provider: string;
  updatedAt: Date;
  ttlSeconds: number;
}

export interface DirectionsCache {
  cacheKey: string;
  mode: TransportMode;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  departBucket: string; // floor to 15-min intervals
  etaMinutes: number;
  distanceMeters: number;
  polyline: string | null;
  provider: string;
  updatedAt: Date;
  ttlSeconds: number;
}

export interface WeatherCache {
  locationHash: string;
  timeBucket: string; // hourly
  forecastJson: WeatherForecast;
  provider: string;
  updatedAt: Date;
  ttlSeconds: number;
}

export interface WeatherForecast {
  temperature: number;
  condition: string;
  precipitation: number;
  windSpeed: number;
  humidity: number;
  visibility: number;
}

// Buffer configuration per event type
export interface BufferConfig {
  eventType: EventType;
  beforeMinutes: number;
  afterMinutes: number;
}

// Default buffer configurations
export const DEFAULT_BUFFERS: BufferConfig[] = [
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
  { eventType: 'travel_block', beforeMinutes: 0, afterMinutes: 0 },
  { eventType: 'sleep', beforeMinutes: 0, afterMinutes: 0 },
  { eventType: 'work', beforeMinutes: 0, afterMinutes: 0 },
  { eventType: 'other', beforeMinutes: 5, afterMinutes: 5 },
];

// Parking buffer by mode
export const PARKING_BUFFERS: Record<TransportMode, number> = {
  sedan: 5,
  motorcycle: 3,
  taxi: 2,
  transit: 0,
  walking: 0,
};
