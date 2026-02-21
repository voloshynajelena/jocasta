import { z } from 'zod';
import {
  EventTypeSchema,
  TransportModeSchema,
  PrioritySchema,
  TaskStatusSchema,
  ConstraintTypeSchema,
} from './enums';

// Common schemas
export const ISODateStringSchema = z.string().datetime({ offset: true });
export const DateOnlyStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimeOnlyStringSchema = z.string().regex(/^\d{2}:\d{2}$/);
export const UUIDSchema = z.string().uuid();

// Auth schemas
export const MobileCodeExchangeSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().url(),
});

// User schemas
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(50).optional(),
  defaultTransportMode: TransportModeSchema.optional(),
  homeLocationId: z.string().uuid().nullable().optional(),
  workLocationId: z.string().uuid().nullable().optional(),
});

// Event schemas
export const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  type: EventTypeSchema,
  startAt: ISODateStringSchema,
  endAt: ISODateStringSchema,
  locationId: z.string().uuid().nullable().optional(),
  isLocked: z.boolean().optional().default(false),
  priority: PrioritySchema.optional().default(2),
  notes: z.string().max(5000).nullable().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
}).refine(data => new Date(data.endAt) > new Date(data.startAt), {
  message: 'End time must be after start time',
  path: ['endAt'],
});

export const UpdateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: EventTypeSchema.optional(),
  startAt: ISODateStringSchema.optional(),
  endAt: ISODateStringSchema.optional(),
  locationId: z.string().uuid().nullable().optional(),
  isLocked: z.boolean().optional(),
  priority: PrioritySchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const EventQuerySchema = z.object({
  startDate: DateOnlyStringSchema.optional(),
  endDate: DateOnlyStringSchema.optional(),
  types: z.array(EventTypeSchema).optional(),
  includeExternal: z.boolean().optional().default(true),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

// Task schemas
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  type: EventTypeSchema,
  durationMinutes: z.number().int().positive().max(1440),
  durationMinutesMin: z.number().int().positive().max(1440).nullable().optional(),
  durationMinutesMax: z.number().int().positive().max(1440).nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  windowStartAt: ISODateStringSchema.nullable().optional(),
  windowEndAt: ISODateStringSchema.nullable().optional(),
  deadlineAt: ISODateStringSchema.nullable().optional(),
  priority: PrioritySchema.optional().default(2),
  notes: z.string().max(5000).nullable().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: EventTypeSchema.optional(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  locationId: z.string().uuid().nullable().optional(),
  windowStartAt: ISODateStringSchema.nullable().optional(),
  windowEndAt: ISODateStringSchema.nullable().optional(),
  deadlineAt: ISODateStringSchema.nullable().optional(),
  priority: PrioritySchema.optional(),
  status: TaskStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const TaskQuerySchema = z.object({
  status: z.array(TaskStatusSchema).optional(),
  startDate: DateOnlyStringSchema.optional(),
  endDate: DateOnlyStringSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

// Location schemas
export const CreateLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

// Planner schemas
export const PlannerProposeSchema = z.object({
  text: z.string().min(1).max(1000),
  preferredMode: TransportModeSchema.optional(),
  preferredDate: DateOnlyStringSchema.optional(),
});

export const PlannerCommitSchema = z.object({
  proposalId: z.string().uuid(),
  overrides: z.object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(5000).optional(),
    isLocked: z.boolean().optional(),
  }).optional(),
});

// Settings schemas
export const BufferConfigSchema = z.object({
  eventType: EventTypeSchema,
  beforeMinutes: z.number().int().min(0).max(120),
  afterMinutes: z.number().int().min(0).max(120),
});

export const UpdateSettingsSchema = z.object({
  buffers: z.array(BufferConfigSchema.partial()).optional(),
  reminderMinutesBefore: z.array(z.number().int().positive().max(10080)).optional(),
  weatherAlerts: z.boolean().optional(),
  trafficAlerts: z.boolean().optional(),
});

// Constraint schemas
export const QuietHoursConfigSchema = z.object({
  type: z.literal('quiet_hours'),
  startTime: TimeOnlyStringSchema,
  endTime: TimeOnlyStringSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
});

export const SleepBlockConfigSchema = z.object({
  type: z.literal('sleep_block'),
  startTime: TimeOnlyStringSchema,
  endTime: TimeOnlyStringSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
});

export const WorkBlockConfigSchema = z.object({
  type: z.literal('work_block'),
  startTime: TimeOnlyStringSchema,
  endTime: TimeOnlyStringSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  locationId: z.string().uuid().nullable().optional(),
});

export const MaxDailyTravelConfigSchema = z.object({
  type: z.literal('max_daily_travel'),
  maxMinutes: z.number().int().positive().max(480),
});

export const MinGapConfigSchema = z.object({
  type: z.literal('min_gap_between_events'),
  minMinutes: z.number().int().min(0).max(120),
});

export const PreferredTransportConfigSchema = z.object({
  type: z.literal('preferred_transport'),
  mode: TransportModeSchema,
  conditions: z.object({
    maxDistanceKm: z.number().positive().optional(),
    weatherExclusions: z.array(z.string()).optional(),
  }).optional(),
});

export const ConstraintConfigSchema = z.union([
  QuietHoursConfigSchema,
  SleepBlockConfigSchema,
  WorkBlockConfigSchema,
  MaxDailyTravelConfigSchema,
  MinGapConfigSchema,
  PreferredTransportConfigSchema,
]);

export const CreateConstraintSchema = z.object({
  type: ConstraintTypeSchema,
  name: z.string().min(1).max(100),
  config: ConstraintConfigSchema,
  isActive: z.boolean().optional().default(true),
  recurrenceRule: z.string().max(500).nullable().optional(),
});

export const UpdateConstraintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: ConstraintConfigSchema.optional(),
  isActive: z.boolean().optional(),
});

// Telegram schemas
export const TelegramWebhookSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      first_name: z.string(),
      username: z.string().optional(),
    }),
    chat: z.object({
      id: z.number(),
      type: z.string(),
    }),
    date: z.number(),
    text: z.string().optional(),
  }).optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({
      id: z.number(),
      first_name: z.string(),
    }),
    message: z.object({
      message_id: z.number(),
      chat: z.object({
        id: z.number(),
      }),
    }),
    data: z.string(),
  }).optional(),
});

// Expo push schemas
export const RegisterPushTokenSchema = z.object({
  token: z.string().min(1),
  deviceId: z.string().optional(),
});

// Calendar view schemas
export const CalendarViewSchema = z.object({
  startDate: DateOnlyStringSchema,
  endDate: DateOnlyStringSchema,
  includeTravel: z.boolean().optional().default(true),
  includeTasks: z.boolean().optional().default(true),
});

// AI extraction schemas (for server-side validation of AI output)
export const ExtractedIntentSchema = z.object({
  kind: z.enum(['event', 'task']),
  title: z.string().min(1).max(200),
  type: EventTypeSchema,
  fixedTime: z.object({
    startAt: ISODateStringSchema,
    endAt: ISODateStringSchema,
  }).optional(),
  window: z.object({
    startAt: ISODateStringSchema,
    endAt: ISODateStringSchema,
  }).optional(),
  durationMinutes: z.number().int().positive().max(1440),
  locationText: z.string().max(500).optional(),
  modePreference: TransportModeSchema.optional(),
  priority: PrioritySchema.optional(),
  isLocked: z.boolean().optional(),
});

// Pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});
