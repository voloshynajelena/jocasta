import type {
  Event,
  Task,
  Location,
  User,
  Constraint,
  NotificationEndpoint,
  TravelSegment,
  BufferConfig,
} from './entities';
import type { EventType, TransportMode, Priority, TaskStatus } from './enums';

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GoogleAuthStartResponse {
  authUrl: string;
  state: string;
}

export interface MobileCodeExchangeRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

// User types
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  defaultTransportMode: TransportMode;
  hasGoogleCalendar: boolean;
  hasTelegram: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  timezone?: string;
  defaultTransportMode?: TransportMode;
  homeLocationId?: string | null;
  workLocationId?: string | null;
}

// Event types
export interface CreateEventRequest {
  title: string;
  type: EventType;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  locationId?: string | null;
  isLocked?: boolean;
  priority?: Priority;
  notes?: string | null;
  recurrenceRule?: string | null; // iCal RRULE
}

export interface UpdateEventRequest {
  title?: string;
  type?: EventType;
  startAt?: string;
  endAt?: string;
  locationId?: string | null;
  isLocked?: boolean;
  priority?: Priority;
  notes?: string | null;
}

export interface EventResponse extends Omit<Event, 'notes'> {
  location: Location | null;
  travelSegment: TravelSegment | null;
  notes?: string | null;
}

export interface EventsListResponse {
  events: EventResponse[];
  total: number;
}

// Task types
export interface CreateTaskRequest {
  title: string;
  type: EventType;
  durationMinutes: number;
  durationMinutesMin?: number | null;
  durationMinutesMax?: number | null;
  locationId?: string | null;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  deadlineAt?: string | null;
  priority?: Priority;
  notes?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  type?: EventType;
  durationMinutes?: number;
  locationId?: string | null;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  deadlineAt?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  notes?: string | null;
}

export interface TaskResponse extends Task {
  location: Location | null;
  scheduledEvent: Event | null;
}

export interface TasksListResponse {
  tasks: TaskResponse[];
  total: number;
}

// Location types
export interface CreateLocationRequest {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface LocationsListResponse {
  locations: Location[];
  total: number;
}

// Planner types
export interface PlannerProposeRequest {
  text: string; // Natural language input
  preferredMode?: TransportMode;
  preferredDate?: string; // ISO 8601 date
}

export interface PlannerProposal {
  id: string;
  rank: number;
  slotStart: string; // ISO 8601
  slotEnd: string; // ISO 8601
  travelDepartTime: string | null;
  travelMode: TransportMode | null;
  travelEtaMinutes: number | null;
  confidence: number; // 0-1
  explanation: string[];
  conflictsToResolve: ConflictResolution[];
  weatherWarning: string | null;
}

export interface ConflictResolution {
  eventId: string;
  eventTitle: string;
  action: 'move' | 'shorten' | 'cancel';
  newStartAt?: string;
  newEndAt?: string;
  reason: string;
}

export interface PlannerProposeResponse {
  proposals: PlannerProposal[];
  extractedIntent: ExtractedIntent;
  warnings: string[];
}

export interface ExtractedIntent {
  kind: 'event' | 'task';
  title: string;
  type: EventType;
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
  modePreference?: TransportMode;
  priority?: Priority;
  isLocked?: boolean;
}

export interface PlannerCommitRequest {
  proposalId: string;
  overrides?: {
    title?: string;
    notes?: string;
    isLocked?: boolean;
  };
}

export interface PlannerCommitResponse {
  event: EventResponse;
  travelSegment: TravelSegment | null;
  notificationsScheduled: number;
}

// Settings types
export interface UserSettings {
  buffers: BufferConfig[];
  constraints: Constraint[];
  notifications: {
    reminderMinutesBefore: number[];
    weatherAlerts: boolean;
    trafficAlerts: boolean;
  };
}

export interface UpdateSettingsRequest {
  buffers?: Partial<BufferConfig>[];
  reminderMinutesBefore?: number[];
  weatherAlerts?: boolean;
  trafficAlerts?: boolean;
}

// Constraint types
export interface CreateConstraintRequest {
  type: string;
  name: string;
  config: Record<string, unknown>;
  isActive?: boolean;
  recurrenceRule?: string | null;
}

export interface UpdateConstraintRequest {
  name?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

// Telegram integration types
export interface TelegramConnectResponse {
  botUsername: string;
  deepLink: string;
  instructions: string;
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

// Expo push types
export interface RegisterPushTokenRequest {
  token: string;
  deviceId?: string;
}

// Google sync types
export interface GoogleSyncStatus {
  isConnected: boolean;
  lastSyncAt: string | null;
  managedCalendarId: string | null;
  syncErrors: string[];
}

export interface GoogleSyncTriggerResponse {
  success: boolean;
  eventsSynced: number;
  errors: string[];
}

// Calendar view types
export interface CalendarViewRequest {
  startDate: string; // ISO 8601 date
  endDate: string; // ISO 8601 date
  includeTravel?: boolean;
  includeTasks?: boolean;
}

export interface CalendarDayView {
  date: string;
  events: EventResponse[];
  tasks: TaskResponse[];
  travelSegments: TravelSegment[];
  totalTravelMinutes: number;
}

export interface CalendarViewResponse {
  days: CalendarDayView[];
  summary: {
    totalEvents: number;
    totalTasks: number;
    totalTravelMinutes: number;
  };
}

// Health check
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  services: {
    database: 'ok' | 'error';
    googleApi: 'ok' | 'error' | 'not_configured';
    telegram: 'ok' | 'error' | 'not_configured';
    weather: 'ok' | 'error';
    directions: 'ok' | 'error';
  };
}

// Error response
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
