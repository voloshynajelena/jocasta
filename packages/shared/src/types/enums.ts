// Event types supported by the system
export const EventType = {
  APPOINTMENT: 'appointment',
  CLIENT_TRAINING: 'client_training',
  PERSONAL_WORKOUT: 'personal_workout',
  DOG_WALK: 'dog_walk',
  KIDS_DROPOFF: 'kids_dropoff',
  KIDS_PICKUP: 'kids_pickup',
  FUELING: 'fueling',
  SHOPPING: 'shopping',
  HOME_CHORES: 'home_chores',
  MEETING: 'meeting',
  TRAVEL_BLOCK: 'travel_block',
  SLEEP: 'sleep',
  WORK: 'work',
  OTHER: 'other',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

// Event source - whether managed by us or external
export const EventSource = {
  MANAGED: 'managed',
  EXTERNAL_GOOGLE: 'external_google',
} as const;

export type EventSource = (typeof EventSource)[keyof typeof EventSource];

// Task status
export const TaskStatus = {
  OPEN: 'open',
  SCHEDULED: 'scheduled',
  DONE: 'done',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

// Transportation modes
export const TransportMode = {
  SEDAN: 'sedan',
  MOTORCYCLE: 'motorcycle',
  TAXI: 'taxi',
  TRANSIT: 'transit',
  WALKING: 'walking',
} as const;

export type TransportMode = (typeof TransportMode)[keyof typeof TransportMode];

// Notification channels
export const NotificationChannel = {
  TELEGRAM: 'telegram',
  EXPO_PUSH: 'expo_push',
  WEB_PUSH: 'web_push',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

// Notification job status
export const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  DEAD: 'dead',
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

// Direction source (how ETA was calculated)
export const DirectionSource = {
  DIRECTIONS_API: 'directions',
  HEURISTIC: 'heuristic',
  CACHED: 'cached',
} as const;

export type DirectionSource = (typeof DirectionSource)[keyof typeof DirectionSource];

// Weather conditions that affect travel
export const WeatherCondition = {
  CLEAR: 'clear',
  CLOUDY: 'cloudy',
  RAIN: 'rain',
  SNOW: 'snow',
  FREEZING_RAIN: 'freezing_rain',
  HIGH_WIND: 'high_wind',
  FOG: 'fog',
  UNKNOWN: 'unknown',
} as const;

export type WeatherCondition = (typeof WeatherCondition)[keyof typeof WeatherCondition];

// Priority levels (1 = highest, 3 = lowest)
export const Priority = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

// Constraint types
export const ConstraintType = {
  QUIET_HOURS: 'quiet_hours',
  SLEEP_BLOCK: 'sleep_block',
  WORK_BLOCK: 'work_block',
  MAX_DAILY_TRAVEL: 'max_daily_travel',
  MIN_GAP_BETWEEN_EVENTS: 'min_gap_between_events',
  PREFERRED_TRANSPORT: 'preferred_transport',
} as const;

export type ConstraintType = (typeof ConstraintType)[keyof typeof ConstraintType];
