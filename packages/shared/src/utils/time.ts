/**
 * Time utility functions for the Jocasta scheduler
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/**
 * Convert minutes to HH:MM format
 */
export function minutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM format to minutes from midnight
 */
export function hhmmToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + mins;
}

/**
 * Get 15-minute bucket for caching (floors to nearest 15 min)
 */
export function getDepartBucket(date: Date): string {
  const minutes = date.getMinutes();
  const bucketMinutes = Math.floor(minutes / 15) * 15;
  const bucketDate = new Date(date);
  bucketDate.setMinutes(bucketMinutes, 0, 0);
  return bucketDate.toISOString();
}

/**
 * Get hourly bucket for weather caching
 */
export function getHourlyBucket(date: Date): string {
  const bucketDate = new Date(date);
  bucketDate.setMinutes(0, 0, 0);
  return bucketDate.toISOString();
}

/**
 * Check if two time ranges overlap
 */
export function doTimeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Calculate duration in minutes between two dates
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Subtract minutes from a date
 */
export function subtractMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

/**
 * Get start of day in a specific timezone
 */
export function getStartOfDay(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date);
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Get end of day in a specific timezone
 */
export function getEndOfDay(date: Date, timezone: string): Date {
  const startOfDay = getStartOfDay(date, timezone);
  return new Date(startOfDay.getTime() + MINUTES_PER_DAY * 60 * 1000 - 1);
}

/**
 * Check if a time is within a time range (handles overnight ranges)
 */
export function isTimeInRange(
  time: string, // HH:MM
  rangeStart: string, // HH:MM
  rangeEnd: string // HH:MM
): boolean {
  const timeMinutes = hhmmToMinutes(time);
  const startMinutes = hhmmToMinutes(rangeStart);
  const endMinutes = hhmmToMinutes(rangeEnd);

  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 09:00 - 17:00)
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 06:00)
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayName = formatter.format(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.indexOf(dayName);
}

/**
 * Format date for display
 */
export function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Format time only for display
 */
export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Parse ISO date string to Date
 */
export function parseISO(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function toDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Generate date range array
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Round time to nearest interval (e.g., 15 minutes)
 */
export function roundToInterval(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

/**
 * Ceiling time to next interval
 */
export function ceilToInterval(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Floor time to previous interval
 */
export function floorToInterval(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}
