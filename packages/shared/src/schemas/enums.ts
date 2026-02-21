import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'appointment',
  'client_training',
  'personal_workout',
  'dog_walk',
  'kids_dropoff',
  'kids_pickup',
  'fueling',
  'shopping',
  'home_chores',
  'meeting',
  'travel_block',
  'sleep',
  'work',
  'other',
]);

export const EventSourceSchema = z.enum(['managed', 'external_google']);

export const TaskStatusSchema = z.enum(['open', 'scheduled', 'done', 'cancelled']);

export const TransportModeSchema = z.enum([
  'sedan',
  'motorcycle',
  'taxi',
  'transit',
  'walking',
]);

export const NotificationChannelSchema = z.enum([
  'telegram',
  'expo_push',
  'web_push',
]);

export const NotificationStatusSchema = z.enum([
  'pending',
  'sent',
  'failed',
  'dead',
]);

export const DirectionSourceSchema = z.enum(['directions', 'heuristic', 'cached']);

export const WeatherConditionSchema = z.enum([
  'clear',
  'cloudy',
  'rain',
  'snow',
  'freezing_rain',
  'high_wind',
  'fog',
  'unknown',
]);

export const PrioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const ConstraintTypeSchema = z.enum([
  'quiet_hours',
  'sleep_block',
  'work_block',
  'max_daily_travel',
  'min_gap_between_events',
  'preferred_transport',
]);
