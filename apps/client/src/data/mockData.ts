// Mock data for Elena - Working mom, downtown office, 2 kids (9 & 11), dog, gym 3x/week

// Helper to get current date (fresh each time)
const getToday = () => new Date();

const getDate = (daysOffset: number, hours: number, minutes: number = 0) => {
  const date = getToday();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

// Find next Monday (dynamically)
const getDaysUntilMonday = () => {
  const today = getToday();
  return (8 - today.getDay()) % 7 || 7;
};

export const DEMO_USER = {
  id: 'demo-user',
  email: 'elena@workingmom.io',
  name: 'Elena Martinez',
  avatarUrl: null,
  timezone: 'America/Los_Angeles',
  defaultTransportMode: 'sedan',
};

export const DEMO_EVENTS = [
  // Today
  {
    id: 'evt-1',
    title: 'Morning Dog Walk - Max',
    type: 'dog_walk',
    startAt: getDate(0, 6, 30),
    endAt: getDate(0, 7, 0),
    location: { name: 'Riverside Park' },
    isLocked: true,
  },
  {
    id: 'evt-2',
    title: 'Drop kids at school',
    type: 'personal',
    startAt: getDate(0, 7, 45),
    endAt: getDate(0, 8, 15),
    location: { name: 'Lincoln Elementary' },
    isLocked: true,
  },
  {
    id: 'evt-3',
    title: 'Team Standup',
    type: 'meeting',
    startAt: getDate(0, 9, 0),
    endAt: getDate(0, 9, 30),
    location: { name: 'Downtown Office - Room 4B' },
    isLocked: false,
  },
  {
    id: 'evt-4',
    title: 'Product Review Meeting',
    type: 'meeting',
    startAt: getDate(0, 11, 0),
    endAt: getDate(0, 12, 0),
    location: { name: 'Conference Room A' },
    isLocked: false,
  },
  {
    id: 'evt-5',
    title: 'Lunch Break',
    type: 'personal',
    startAt: getDate(0, 12, 30),
    endAt: getDate(0, 13, 30),
    location: null,
    isLocked: false,
  },
  {
    id: 'evt-6',
    title: 'Client Call - Acme Corp',
    type: 'meeting',
    startAt: getDate(0, 14, 0),
    endAt: getDate(0, 15, 0),
    location: { name: 'Zoom' },
    isLocked: true,
  },
  {
    id: 'evt-7',
    title: 'Pick up kids',
    type: 'personal',
    startAt: getDate(0, 15, 30),
    endAt: getDate(0, 16, 0),
    location: { name: 'Lincoln Elementary' },
    isLocked: true,
  },
  {
    id: 'evt-8',
    title: 'Gym - CrossFit',
    type: 'personal_workout',
    startAt: getDate(0, 18, 0),
    endAt: getDate(0, 19, 0),
    location: { name: 'FitLife Gym' },
    isLocked: false,
  },
  {
    id: 'evt-9',
    title: 'Evening Dog Walk - Max',
    type: 'dog_walk',
    startAt: getDate(0, 19, 30),
    endAt: getDate(0, 20, 0),
    location: { name: 'Neighborhood' },
    isLocked: false,
  },

  // Tomorrow
  {
    id: 'evt-10',
    title: 'Morning Dog Walk - Max',
    type: 'dog_walk',
    startAt: getDate(1, 6, 30),
    endAt: getDate(1, 7, 0),
    location: { name: 'Riverside Park' },
    isLocked: true,
  },
  {
    id: 'evt-11',
    title: 'Drop kids at school',
    type: 'personal',
    startAt: getDate(1, 7, 45),
    endAt: getDate(1, 8, 15),
    location: { name: 'Lincoln Elementary' },
    isLocked: true,
  },
  {
    id: 'evt-12',
    title: 'Sprint Planning',
    type: 'meeting',
    startAt: getDate(1, 10, 0),
    endAt: getDate(1, 11, 30),
    location: { name: 'Downtown Office' },
    isLocked: false,
  },
  {
    id: 'evt-13',
    title: "Sophie's Soccer Practice",
    type: 'kids_activity',
    startAt: getDate(1, 16, 0),
    endAt: getDate(1, 17, 30),
    location: { name: 'Community Fields' },
    isLocked: true,
  },

  // Day 2 (2 days from now)
  {
    id: 'evt-14',
    title: 'Morning Dog Walk - Max',
    type: 'dog_walk',
    startAt: getDate(2, 6, 30),
    endAt: getDate(2, 7, 0),
    location: { name: 'Riverside Park' },
    isLocked: true,
  },
  {
    id: 'evt-15',
    title: '1:1 with Manager',
    type: 'meeting',
    startAt: getDate(2, 14, 0),
    endAt: getDate(2, 14, 30),
    location: { name: "Sarah's Office" },
    isLocked: false,
  },
  {
    id: 'evt-16',
    title: 'Gym - Yoga',
    type: 'personal_workout',
    startAt: getDate(2, 18, 0),
    endAt: getDate(2, 19, 0),
    location: { name: 'FitLife Gym' },
    isLocked: false,
  },
  {
    id: 'evt-17',
    title: "Jake's Piano Lesson",
    type: 'kids_activity',
    startAt: getDate(2, 17, 0),
    endAt: getDate(2, 17, 45),
    location: { name: 'Music Academy' },
    isLocked: true,
  },

  // Day 3
  {
    id: 'evt-18',
    title: 'Dentist - Kids Checkup',
    type: 'appointment',
    startAt: getDate(3, 9, 0),
    endAt: getDate(3, 10, 0),
    location: { name: 'Smile Dental Clinic' },
    isLocked: true,
  },

  // Day 4 - Gym
  {
    id: 'evt-19',
    title: 'Gym - Strength Training',
    type: 'personal_workout',
    startAt: getDate(4, 6, 0),
    endAt: getDate(4, 7, 0),
    location: { name: 'FitLife Gym' },
    isLocked: false,
  },

  // Next Monday - Doctor
  {
    id: 'evt-doctor',
    title: 'Annual Physical - Dr. Martinez',
    type: 'appointment',
    startAt: getDate(getDaysUntilMonday(), 10, 0),
    endAt: getDate(getDaysUntilMonday(), 11, 0),
    location: { name: 'Downtown Medical Center' },
    isLocked: true,
    priority: 9,
  },

  // Weekend
  {
    id: 'evt-20',
    title: "Sophie's Birthday Party",
    type: 'personal',
    startAt: getDate(5, 14, 0),
    endAt: getDate(5, 17, 0),
    location: { name: 'Fun Zone' },
    isLocked: true,
  },
  {
    id: 'evt-21',
    title: 'Family Brunch',
    type: 'personal',
    startAt: getDate(6, 11, 0),
    endAt: getDate(6, 13, 0),
    location: { name: "Grandma's House" },
    isLocked: false,
  },
];

export const DEMO_TASKS = [
  {
    id: 'task-1',
    title: 'Schedule vet appointment for Max',
    status: 'pending',
    priority: 7,
    durationMinutes: 60,
    deadlineAt: getDate(7, 17, 0),
    notes: 'Annual vaccination + checkup',
  },
  {
    id: 'task-2',
    title: 'Book summer camp for kids',
    status: 'pending',
    priority: 8,
    durationMinutes: 30,
    deadlineAt: getDate(14, 17, 0),
    notes: 'Research options: sports camp, STEM camp, art camp',
  },
  {
    id: 'task-3',
    title: 'Schedule car service',
    status: 'pending',
    priority: 5,
    durationMinutes: 120,
    deadlineAt: getDate(10, 17, 0),
    notes: 'Oil change + tire rotation',
  },
  {
    id: 'task-4',
    title: 'Plan date night with partner',
    status: 'pending',
    priority: 6,
    durationMinutes: 180,
    deadlineAt: null,
    notes: 'Need to book babysitter',
  },
  {
    id: 'task-5',
    title: "Order Jake's birthday gift",
    status: 'pending',
    priority: 9,
    durationMinutes: 20,
    deadlineAt: getDate(21, 12, 0),
    notes: 'He wants the new LEGO Star Wars set',
  },
  {
    id: 'task-6',
    title: 'Prepare Q1 report',
    status: 'scheduled',
    priority: 8,
    durationMinutes: 180,
    deadlineAt: getDate(5, 17, 0),
    scheduledFor: getDate(3, 14, 0),
  },
  {
    id: 'task-7',
    title: 'Grocery shopping',
    status: 'pending',
    priority: 6,
    durationMinutes: 60,
    deadlineAt: getDate(2, 20, 0),
    notes: 'Costco run - stock up on essentials',
  },
];

export const DEMO_SETTINGS = {
  buffers: [
    { eventType: 'meeting', beforeMinutes: 10, afterMinutes: 5 },
    { eventType: 'appointment', beforeMinutes: 15, afterMinutes: 10 },
    { eventType: 'personal_workout', beforeMinutes: 15, afterMinutes: 30 },
    { eventType: 'kids_activity', beforeMinutes: 20, afterMinutes: 10 },
  ],
  notifications: {
    reminderMinutesBefore: [15, 60],
    weatherAlerts: true,
    trafficAlerts: true,
  },
};

export const DEMO_GOOGLE_STATUS = {
  isConnected: true,
  lastSyncAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
  managedCalendarId: 'primary',
  syncErrors: [],
};

// Helper to filter events by date range
export function getEventsForDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return DEMO_EVENTS.filter((event) => {
    const eventDate = new Date(event.startAt);
    return eventDate >= start && eventDate < end;
  });
}

// Helper to get today's events
export function getTodayEvents() {
  const now = getToday();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  return getEventsForDateRange(todayStart.toISOString(), tomorrowStart.toISOString());
}

// Helper to get week events
export function getWeekEvents() {
  const now = getToday();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return getEventsForDateRange(weekStart.toISOString(), weekEnd.toISOString());
}
