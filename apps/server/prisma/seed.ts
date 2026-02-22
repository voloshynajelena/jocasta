import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('1Jocasta2', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'voloshynajelena@gmail.com' },
    update: {
      passwordHash: adminPassword,
      role: 'admin',
      name: 'Olena Voloshyna',
    },
    create: {
      email: 'voloshynajelena@gmail.com',
      passwordHash: adminPassword,
      role: 'admin',
      name: 'Olena Voloshyna',
      timezone: 'America/Edmonton',
      defaultTransportMode: 'sedan',
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@jocasta.io' },
    update: {
      isDemo: true,
      name: 'Elena Martinez (Demo)',
    },
    create: {
      email: 'demo@jocasta.io',
      name: 'Elena Martinez (Demo)',
      timezone: 'America/Edmonton',
      defaultTransportMode: 'sedan',
      isDemo: true,
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Create Calgary default locations
  const locations = [
    {
      name: 'Home',
      address: '123 Centre St SW, Calgary, AB T2P 2X1',
      latitude: 51.0447,
      longitude: -114.0719,
      isDefault: true,
    },
    {
      name: 'Downtown Office',
      address: '225 6 Ave SW, Calgary, AB T2P 1N2',
      latitude: 51.0461,
      longitude: -114.0687,
    },
    {
      name: 'CrossFit Gym',
      address: '1234 11 Ave SW, Calgary, AB T3C 0M3',
      latitude: 51.0397,
      longitude: -114.0923,
    },
    {
      name: 'Kids School',
      address: '500 10 St NW, Calgary, AB T2N 1V6',
      latitude: 51.0555,
      longitude: -114.0833,
    },
    {
      name: 'Costco Beacon Hill',
      address: '99 Beacon Hill Dr NW, Calgary, AB T3R 0G5',
      latitude: 51.1201,
      longitude: -114.1445,
    },
    {
      name: 'Petro-Canada 17th Ave',
      address: '1702 10 Ave SW, Calgary, AB T3C 0K1',
      latitude: 51.0372,
      longitude: -114.0953,
    },
    {
      name: 'Dog Park (Nose Hill)',
      address: 'Nose Hill Park, Calgary, AB',
      latitude: 51.1089,
      longitude: -114.1089,
    },
    {
      name: 'Client Training - Ranchlands',
      address: '7750 Ranchview Dr NW, Calgary, AB T3G 1Y9',
      latitude: 51.1151,
      longitude: -114.1999,
    },
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: {
        id: `${user.id}-${loc.name.toLowerCase().replace(/\s+/g, '-')}`,
      },
      update: loc,
      create: {
        id: `${user.id}-${loc.name.toLowerCase().replace(/\s+/g, '-')}`,
        userId: user.id,
        ...loc,
      },
    });
  }

  console.log('✅ Created Calgary locations');

  // Set home and work locations
  const homeLocation = await prisma.location.findFirst({
    where: { userId: user.id, name: 'Home' },
  });

  const workLocation = await prisma.location.findFirst({
    where: { userId: user.id, name: 'Downtown Office' },
  });

  if (homeLocation && workLocation) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        homeLocationId: homeLocation.id,
        workLocationId: workLocation.id,
      },
    });
    console.log('✅ Set home and work locations');
  }

  // Create default constraints
  const constraints = [
    {
      type: 'sleep_block',
      name: 'Sleep',
      config: {
        type: 'sleep_block',
        startTime: '22:30',
        endTime: '06:30',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
    },
    {
      type: 'work_block',
      name: 'Work Hours',
      config: {
        type: 'work_block',
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        locationId: workLocation?.id ?? null,
      },
    },
    {
      type: 'quiet_hours',
      name: 'No Scheduling - Early Morning',
      config: {
        type: 'quiet_hours',
        startTime: '06:30',
        endTime: '07:30',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
    },
    {
      type: 'preferred_transport',
      name: 'Default to Sedan',
      config: {
        type: 'preferred_transport',
        mode: 'sedan',
        conditions: {
          weatherExclusions: ['snow', 'freezing_rain'],
        },
      },
    },
    {
      type: 'min_gap_between_events',
      name: 'Minimum 10-minute gaps',
      config: {
        type: 'min_gap_between_events',
        minMinutes: 10,
      },
    },
  ];

  for (const constraint of constraints) {
    await prisma.constraint.create({
      data: {
        userId: user.id,
        ...constraint,
      },
    });
  }

  console.log('✅ Created default constraints');

  // Create user settings
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      buffers: [
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
      ],
      reminderMinutesBefore: [30, 10],
      weatherAlerts: true,
      trafficAlerts: true,
    },
  });

  console.log('✅ Created user settings');

  // Create sample events for the next 7 days
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const gymLocation = await prisma.location.findFirst({
    where: { userId: user.id, name: 'CrossFit Gym' },
  });

  const clientLocation = await prisma.location.findFirst({
    where: { userId: user.id, name: 'Client Training - Ranchlands' },
  });

  const dogParkLocation = await prisma.location.findFirst({
    where: { userId: user.id, name: 'Dog Park (Nose Hill)' },
  });

  // Sample events
  const events = [
    {
      title: 'Morning Workout',
      type: 'personal_workout',
      startAt: new Date(tomorrow.setHours(6, 30)),
      endAt: new Date(tomorrow.setHours(7, 30)),
      locationId: gymLocation?.id,
      priority: 2,
      isLocked: true,
    },
    {
      title: 'Client Session - John',
      type: 'client_training',
      startAt: new Date(tomorrow.setHours(10, 0)),
      endAt: new Date(tomorrow.setHours(11, 0)),
      locationId: clientLocation?.id,
      priority: 1,
      isLocked: false,
    },
    {
      title: 'Dog Walk - Nose Hill',
      type: 'dog_walk',
      startAt: new Date(tomorrow.setHours(17, 0)),
      endAt: new Date(tomorrow.setHours(17, 45)),
      locationId: dogParkLocation?.id,
      priority: 2,
      isLocked: false,
    },
  ];

  for (const event of events) {
    await prisma.event.create({
      data: {
        userId: user.id,
        source: 'managed',
        ...event,
      },
    });
  }

  console.log('✅ Created sample events');

  // Create sample tasks
  const tasks = [
    {
      title: 'Pick up dog food from Costco',
      type: 'shopping',
      durationMinutes: 45,
      windowStartAt: tomorrow,
      windowEndAt: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000),
      priority: 2,
      status: 'open',
    },
    {
      title: 'Get car washed',
      type: 'fueling',
      durationMinutes: 30,
      windowStartAt: tomorrow,
      windowEndAt: new Date(tomorrow.getTime() + 3 * 24 * 60 * 60 * 1000),
      priority: 3,
      status: 'open',
    },
  ];

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        userId: user.id,
        ...task,
      },
    });
  }

  console.log('✅ Created sample tasks');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
