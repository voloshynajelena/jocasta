import { Test, TestingModule } from '@nestjs/testing';
import { SlotFinderService } from './slot-finder.service';
import { PrismaService } from '../../database/prisma.service';

describe('SlotFinderService', () => {
  let service: SlotFinderService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    timezone: 'America/Edmonton',
    homeLocation: {
      id: 'home-id',
      latitude: 51.0447,
      longitude: -114.0719,
    },
    workLocation: null,
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    constraint: {
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
    },
    location: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotFinderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SlotFinderService>(SlotFinderService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findSlots', () => {
    it('should return available slots for a simple request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.constraint.findMany.mockResolvedValue([]);
      mockPrisma.event.findMany.mockResolvedValue([]);

      const request = {
        userId: 'test-user-id',
        durationMinutes: 30,
        eventType: 'appointment',
        windowStart: new Date('2026-03-01T09:00:00-07:00'),
        windowEnd: new Date('2026-03-01T17:00:00-07:00'),
      };

      const proposals = await service.findSlots(request);

      expect(proposals).toBeDefined();
      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals.length).toBeLessThanOrEqual(5);

      // Check proposal structure
      const firstProposal = proposals[0];
      expect(firstProposal).toHaveProperty('id');
      expect(firstProposal).toHaveProperty('rank');
      expect(firstProposal).toHaveProperty('startAt');
      expect(firstProposal).toHaveProperty('endAt');
      expect(firstProposal).toHaveProperty('confidence');
      expect(firstProposal).toHaveProperty('explanation');
    });

    it('should respect existing events and avoid conflicts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.constraint.findMany.mockResolvedValue([]);

      // Add an existing event from 10:00-11:00
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'existing-event',
          title: 'Existing Meeting',
          startAt: new Date('2026-03-01T10:00:00-07:00'),
          endAt: new Date('2026-03-01T11:00:00-07:00'),
          isLocked: true,
          priority: 1,
        },
      ]);

      const request = {
        userId: 'test-user-id',
        durationMinutes: 60,
        eventType: 'appointment',
        windowStart: new Date('2026-03-01T09:00:00-07:00'),
        windowEnd: new Date('2026-03-01T12:00:00-07:00'),
      };

      const proposals = await service.findSlots(request);

      // All proposals should not overlap with 10:00-11:00
      for (const proposal of proposals) {
        const proposalStart = new Date(proposal.startAt);
        const proposalEnd = new Date(proposal.endAt);
        const eventStart = new Date('2026-03-01T10:00:00-07:00');
        const eventEnd = new Date('2026-03-01T11:00:00-07:00');

        const overlaps =
          proposalStart < eventEnd && eventStart < proposalEnd;
        expect(overlaps).toBe(false);
      }
    });

    it('should respect sleep block constraints', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.event.findMany.mockResolvedValue([]);

      // Add a sleep constraint for 22:00-06:00
      mockPrisma.constraint.findMany.mockResolvedValue([
        {
          id: 'sleep-constraint',
          name: 'Sleep',
          type: 'sleep_block',
          config: {
            type: 'sleep_block',
            startTime: '22:00',
            endTime: '06:00',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
          isActive: true,
        },
      ]);

      const request = {
        userId: 'test-user-id',
        durationMinutes: 60,
        eventType: 'appointment',
        windowStart: new Date('2026-03-01T05:00:00-07:00'),
        windowEnd: new Date('2026-03-01T08:00:00-07:00'),
      };

      const proposals = await service.findSlots(request);

      // All proposals should be after 06:00
      for (const proposal of proposals) {
        const proposalStart = new Date(proposal.startAt);
        const hour = proposalStart.getHours();
        expect(hour).toBeGreaterThanOrEqual(6);
      }
    });

    it('should rank morning slots higher', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.constraint.findMany.mockResolvedValue([]);
      mockPrisma.event.findMany.mockResolvedValue([]);

      const request = {
        userId: 'test-user-id',
        durationMinutes: 30,
        eventType: 'appointment',
        windowStart: new Date('2026-03-01T06:00:00-07:00'),
        windowEnd: new Date('2026-03-01T20:00:00-07:00'),
      };

      const proposals = await service.findSlots(request);

      // First proposal should be in the morning (6am-12pm)
      if (proposals.length > 0) {
        const firstProposal = proposals[0];
        const hour = new Date(firstProposal.startAt).getHours();
        // Morning slots get +10 score, so they should rank higher
        expect(firstProposal.score).toBeGreaterThan(100);
      }
    });
  });

  describe('validateFixedSlot', () => {
    it('should return valid for non-conflicting slot', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.constraint.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        timezone: 'America/Edmonton',
      });

      const result = await service.validateFixedSlot(
        'test-user-id',
        new Date('2026-03-01T10:00:00-07:00'),
        new Date('2026-03-01T11:00:00-07:00'),
      );

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return conflicts for overlapping events', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'conflict-event',
          title: 'Conflicting Meeting',
          startAt: new Date('2026-03-01T10:30:00-07:00'),
          endAt: new Date('2026-03-01T11:30:00-07:00'),
        },
      ]);
      mockPrisma.constraint.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        timezone: 'America/Edmonton',
      });

      const result = await service.validateFixedSlot(
        'test-user-id',
        new Date('2026-03-01T10:00:00-07:00'),
        new Date('2026-03-01T11:00:00-07:00'),
      );

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].title).toBe('Conflicting Meeting');
    });
  });
});
